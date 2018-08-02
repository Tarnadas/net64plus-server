import { webSocketServer } from './globals'
import { Client } from './Client'
import { Vote } from './Vote'
import { IServerClientMessage, Compression, ServerClient, Chat, ServerClientMessage, GameModeType, ServerMessage } from './proto/ServerClientMessage'

export const GAMEMODE_VOTE_TIME = 30000
export const SECONDS_UNTIL_NEXT_GAMEMODE_VOTE = 300
export const GAMEMODE_VOTE_STARTED = 'A vote to change gamemode has started. You have 1min to vote with /gamemode <gamemodeID>'
export const GAMEMODE_USAGE_MESSAGE = '**Usage:**\n\n/gamemode <gamemodeID>\n\n' +
  '**Description:**\n\nYou can start a vote for a new gamemode once every 5min. Available gamemodes are:\n\n' +
  'DEFAULT = 1\n\n' +
  'THIRD_PERSON_SHOOTER = 2\n\n' +
  'INTERACTIONLESS = 3\n\n' +
  'PROP_HUNT = 4\n\n' +
  'BOSS_RUSH = 5\n\n' +
  'TAG = 6\n\n' +
  'WARIO_WARE = 8\n\n'
export const TOO_MANY_ARGS_MESSAGE = 'Too many arguments. Please type "/gamemode" for a command description.'
export const NAN_MESSAGE = 'The first argument must be a number.'
export const GAMEMODE_UNKNOWN_MESSAGE = 'Gamemode unknown. Please type "/gamemode" for a list of available gamemodes.'
export const GAMEMODE_ALREADY_RUNNING_MESSAGE = 'Gamemode is already running.'
export const GAMEMODE_NOT_ENOUGH_VOTES = 'Gamemode vote passed with too few votes.'

export class Command {
  private votesInProgress: {[key: string]: Vote} = {}

  // eslint-disable-next-line no-useless-constructor
  constructor (private enableGamemodeVote: boolean) {
  }

  public onGameModeCommand (client: Client, args: string[]): void {
    if (!this.enableGamemodeVote) return
    if (args.length === 0) {
      this.sendUsageMessage(client)
      return
    }
    if (args.length > 1) {
      this.sendTooManyArgsMessage(client)
      return
    }
    const lastVote = Vote.lastVotes['gameMode']
    if (lastVote && Date.now() - lastVote < SECONDS_UNTIL_NEXT_GAMEMODE_VOTE * 1000) {
      this.sendWaitMessage(client, lastVote)
      return
    }
    if (isNaN(+args[0])) {
      this.sendNaNMessage(client)
      return
    }
    const selectedGameMode = +args[0]
    if (this.isSelectedGameModeWithinRange(selectedGameMode)) {
      this.sendGameModeUnknownMessage(client)
      return
    }
    if (this.isSelectedGameModeAlreadyRunning(selectedGameMode)) {
      this.sendGameModeAlreadyRunningMessage(client)
      return
    }

    this.acceptGameModeVote(client, selectedGameMode)
  }

  private sendUsageMessage (client: Client): void {
    const command: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.CHAT,
        chat: {
          chatType: Chat.ChatType.COMMAND,
          message: GAMEMODE_USAGE_MESSAGE
        }
      }
    }
    const commandMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(command)).finish()
    client.sendMessage(commandMessage)
  }

  private sendTooManyArgsMessage (client: Client): void {
    const command: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.CHAT,
        chat: {
          chatType: Chat.ChatType.COMMAND,
          message: TOO_MANY_ARGS_MESSAGE
        }
      }
    }
    const commandMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(command)).finish()
    client.sendMessage(commandMessage)
  }

  private sendWaitMessage (client: Client, lastVote: number): void {
    const seconds = SECONDS_UNTIL_NEXT_GAMEMODE_VOTE - Math.trunc((Date.now() - lastVote) / 1000)
    const message = `You must wait at least ${Math.trunc(seconds / 60)}min${seconds % 60 > 0 ? `${seconds % 60}s` : ''} until you can start the next gamemode vote.`
    const command: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.CHAT,
        chat: {
          chatType: Chat.ChatType.COMMAND,
          message
        }
      }
    }
    const commandMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(command)).finish()
    client.sendMessage(commandMessage)
  }

  private sendNaNMessage (client: Client): void {
    const command: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.CHAT,
        chat: {
          chatType: Chat.ChatType.COMMAND,
          message: NAN_MESSAGE
        }
      }
    }
    const commandMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(command)).finish()
    client.sendMessage(commandMessage)
  }

  private isSelectedGameModeWithinRange (selectedGameMode: number): boolean {
    return selectedGameMode < 1 || selectedGameMode > 8 || selectedGameMode === 7
  }

  private sendGameModeUnknownMessage (client: Client): void {
    const command: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.CHAT,
        chat: {
          chatType: Chat.ChatType.COMMAND,
          message: GAMEMODE_UNKNOWN_MESSAGE
        }
      }
    }
    const commandMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(command)).finish()
    client.sendMessage(commandMessage)
  }

  private isSelectedGameModeAlreadyRunning (selectedGameMode: number): boolean {
    return selectedGameMode === webSocketServer.gameMode
  }

  private sendGameModeAlreadyRunningMessage (client: Client): void {
    const command: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.CHAT,
        chat: {
          chatType: Chat.ChatType.COMMAND,
          message: GAMEMODE_ALREADY_RUNNING_MESSAGE
        }
      }
    }
    const commandMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(command)).finish()
    client.sendMessage(commandMessage)
  }

  private acceptGameModeVote (client: Client, selectedGameMode: number): void {
    let vote: Vote = this.votesInProgress['gameMode']
    if (!vote) {
      vote = new Vote(GAMEMODE_VOTE_TIME, this.changeGameMode, this.sendTooFewGameModeVotes)
      this.votesInProgress['gameMode'] = vote
      const command: IServerClientMessage = {
        compression: Compression.NONE,
        data: {
          messageType: ServerClient.MessageType.CHAT,
          chat: {
            chatType: Chat.ChatType.COMMAND,
            message: GAMEMODE_VOTE_STARTED
          }
        }
      }
      const commandMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(command)).finish()
      webSocketServer.broadcastMessage(commandMessage)
    }
    vote.acceptVote(client, selectedGameMode)
  }

  private changeGameMode = (selectedGameMode: number) => {
    delete this.votesInProgress['gameMode']
    Vote.lastVotes['gameMode'] = Date.now()
    webSocketServer.gameMode = selectedGameMode
    webSocketServer.reorderPlayers()
    const gameMode: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.SERVER_MESSAGE,
        serverMessage: {
          messageType: ServerMessage.MessageType.GAME_MODE,
          gameMode: {
            gameMode: selectedGameMode
          }
        }
      }
    }
    const gameModeMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(gameMode)).finish()
    webSocketServer.broadcastMessage(gameModeMessage)
    console.info(`Gamemode successfully changed to ${selectedGameMode}`)
  }

  private sendTooFewGameModeVotes = () => {
    const command: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.CHAT,
        chat: {
          chatType: Chat.ChatType.COMMAND,
          message: GAMEMODE_NOT_ENOUGH_VOTES
        }
      }
    }
    const commandMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(command)).finish()
    webSocketServer.broadcastMessage(commandMessage)
  }
}
