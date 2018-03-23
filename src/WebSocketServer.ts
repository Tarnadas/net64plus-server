import * as WebSocket from 'uws'

import * as zlib from 'zlib'

import { Client } from './Client'
import { Player } from './Player'
import { MetaData } from './MetaData'
import { Command } from './Command'
import { ConnectionError } from './models/Connection.model'
import { Settings } from './models/Settings.model'
import { Server } from './models/Server.model'
import {
  ServerClientMessage,
  IServerClientMessage,
  ServerClient,
  ServerMessage,
  ConnectionDenied,
  ServerToken,
  Compression,
  Chat,
  Error as ErrorProto,
  IMeta,
  GameModeType
} from './proto/ServerClientMessage'

let WSServer: typeof WebSocket.Server
if (process.env.TARGET_ENV === 'win32') {
  WSServer = require('../compile/uws').Server
} else {
  WSServer = require('uws').Server
}

export class WebSocketServer {
  public clients: Client[] = []

  public players: Player[] = []

  public gameMode = 1;

  private server?: WebSocket.Server

  private metaData: MetaData = new MetaData()

  private command: Command = new Command()

  private tokenHolder?: Player // TODO

  private ip: string

  private port: number

  private name: string

  private domain: string

  private description: string

  private countryCode: string

  constructor (
    { port, name, domain, description }: Settings,
    { ip, countryCode }: Server
  ) {
    this.ip = ip
    this.port = port
    this.name = name
    this.domain = domain
    this.description = description
    this.countryCode = countryCode
    this.onConnection = this.onConnection.bind(this)
    this.init()
  }

  private init (): void {
    this.server = new WSServer({ port: this.port }, () => {
      console.info(`\nNet64+ ${process.env.VERSION} server successfully started!\nAccepting connections on Port ${this.port}`)
      if (process.env.TARGET_ENV === 'win32') {
        console.info('Connect locally via direct connect 127.0.0.1\nTo accept external connections, your Port must be forwarded.\nTo join via LAN, others must use your LAN IP address: win + "cmd" > ipconfig > IPv4 Address or via Hamachi network and IP')
        console.info('\nThis is a precompiled version of the Net64+ server. It has the limitation, that it cannot be displayed on the public server list. It is only meant to be used for user servers!\n')
      }
    })
    this.server.on('connection', this.onConnection)
    this.metaData = new MetaData()
    this.clients = []
    this.players = []
  }

  public restart (): void {
    this.server!.close()
    delete this.server
    this.init()
  }

  public addPlayer (player: Player): void {
    this.players[player.client.id] = player
    if (player.client.id === 1) {
      this.grantNewServerToken()
    }
  }

  public sendHandshake (client: Client): void {
    const handshake: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.HANDSHAKE,
        handshake: {
          playerId: client.id,
          ip: this.ip,
          port: this.port,
          domain: this.domain,
          name: this.name,
          description: this.description,
          countryCode: this.countryCode,
          gameMode: this.gameMode,
          playerList: {
            playerUpdates: this.players.filter(player => player).map(player => ({
              player: {
                username: player.username,
                characterId: player.characterId
              },
              playerId: player.client.id
            }))
          }
        }
      }
    }
    const handshakeMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(handshake)).finish()
    client.sendMessage(handshakeMessage)
  }

  public sendServerToken (client: Client, tokenType: boolean = true): void {
    const handshake: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.SERVER_MESSAGE,
        serverMessage: {
          messageType: ServerMessage.MessageType.SERVER_TOKEN,
          serverToken: {
            tokenType: tokenType ? ServerToken.TokenType.GRANT : ServerToken.TokenType.LOSE
          }
        }
      }
    }
    const handshakeMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(handshake)).finish()
    client.sendMessage(handshakeMessage)
  }

  public broadcastMessage (message: Uint8Array): void {
    for (const i in this.players) {
      const player = this.players[i]
      player.client.sendMessage(message)
    }
  }

  public broadcastData (): void {
    const playerDataMessage = this.getPlayerData()
    const metaDataMessage = this.getMetaData()
    for (const i in this.players) {
      const player = this.players[i]
      player.client.sendMessage(playerDataMessage)
    }
    if (metaDataMessage) {
      for (const i in this.players) {
        const player = this.players[i]
        player.client.sendMessage(metaDataMessage)
      }
    }
  }

  private getPlayerData (): Uint8Array {
    const playerData: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.PLAYER_DATA,
        playerData: {
          dataLength: 0x1C,
          playerBytes: this.players
            .filter(player => player && player.playerData[3] !== 0)
            .map(player => ({
              playerId: player.client.id,
              playerData: player.playerData
            }))
        }
      }
    }
    return ServerClientMessage.encode(ServerClientMessage.fromObject(playerData)).finish()
  }

  private getMetaData (): Uint8Array | undefined {
    const metas = this.metaData.getMetaData()
    if (metas.length === 0) return
    const metaData: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.PLAYER_DATA,
        metaData: {
          metaData: metas
        }
      }
    }
    return ServerClientMessage.encode(ServerClientMessage.fromObject(metaData)).finish()
  }

  public addMeta (meta: IMeta): void {
    this.metaData.addIfNotAlreadySent(meta)
  }

  public onGlobalChatMessage (client: Client, message: string) {
    if (process.env.NODE_ENV === 'development') {
      console.info(`Received global message from client ${client.id}:\n${message}`)
    }
    const chat: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.CHAT,
        chat: {
          chatType: Chat.ChatType.GLOBAL,
          message,
          senderId: client.id
        }
      }
    }
    const chatMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(chat)).finish()
    for (const i in this.players) {
      const player = this.players[i]
      player.client.sendMessage(chatMessage)
    }
  }

  public onPrivateChatMessage (client: Client, message: string, receiverId: number) {
    if (!this.clients[receiverId]) {
      throw new ConnectionError(
        `You were trying to send a private chat message, but no client with id ${receiverId} exists.`,
        ErrorProto.ErrorType.BAD_REQUEST
      )
    }
    const chat: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.CHAT,
        chat: {
          chatType: Chat.ChatType.PRIVATE,
          message,
          senderId: client.id
        }
      }
    }
    const chatMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(chat)).finish()
    this.clients[receiverId].sendMessage(chatMessage)
  }

  public onCommandChatMessage (client: Client, message: string, args: string[]): void {
    switch (message) {
      case 'gamemode':
        this.command.onGameModeCommand(client, args)
        break
      default:
        this.onUnknownCommand(client)
    }
  }

  private onUnknownCommand (client: Client): void {
    const unknownCommand: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.CHAT,
        chat: {
          chatType: Chat.ChatType.COMMAND,
          message: 'Unknown command'
        }
      }
    }
    const unknownCommandMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(unknownCommand)).finish()
    client.sendMessage(unknownCommandMessage)
  }

  public grantNewServerToken (): void {
    for (const i in this.players) {
      const player = this.players[i]
      const serverToken: IServerClientMessage = {
        compression: Compression.NONE,
        data: {
          messageType: ServerClient.MessageType.SERVER_MESSAGE,
          serverMessage: {
            messageType: ServerMessage.MessageType.SERVER_TOKEN,
            serverToken: {
              tokenType: ServerToken.TokenType.GRANT
            }
          }
        }
      }
      const serverTokenMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(serverToken)).finish()
      player.client.sendMessage(serverTokenMessage)
      if (process.env.NODE_ENV === 'development') {
        console.info(`New server token has been granted to player [${player.client.id}] ${player.username}`)
      }
      return
    }
  }

  private onConnection (ws: WebSocket): void {
    const id = this.getNextClientId()
    if (id == null) {
      this.sendServerFullMessage(ws)
      if (process.env.NODE_ENV === 'development') {
        console.info(`A new client connected, but server is full`)
      }
      return
    }
    if (process.env.NODE_ENV === 'development') {
      console.info(`A new client connected and received ID: ${id}`)
    }
    this.clients[id] = new Client(id, this, ws)
    const activeUsers = this.clients.filter(client => client).length
    console.info(`Active users: ${activeUsers}/24`)
  }

  private getNextClientId (): number | null {
    for (let i = 1; i < 25; i++) {
      if (this.clients[i] == null) return i
    }
    return null
  }

  private sendServerFullMessage (ws: WebSocket): void {
    const serverFull: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.SERVER_MESSAGE,
        serverMessage: {
          messageType: ServerMessage.MessageType.CONNECTION_DENIED,
          connectionDenied: {
            reason: ConnectionDenied.Reason.SERVER_FULL,
            serverFull: {
              maxPlayers: 24
            }
          }
        }
      }
    }
    const serverFullMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(serverFull)).finish()
    ws.send(serverFullMessage, {
      binary: true
    })
  }
}
