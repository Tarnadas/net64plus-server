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
  IServerClient,
  IPlayerUpdate,
  ServerMessage,
  ConnectionDenied,
  Compression,
  Chat,
  Error as ErrorProto,
  IMeta
} from './proto/ServerClientMessage'

let WSServer: typeof WebSocket.Server
if (process.env.IS_EXECUTABLE) {
  WSServer = require('../compile/uws').Server
} else {
  WSServer = require('uws').Server
}

export const PLAYER_DATA_COMPRESSION_THRESHOLD = 3

export class WebSocketServer {
  public clients: Client[] = []

  public players: Player[] = []

  public gameMode: number

  public playerWithToken?: Player

  private server?: WebSocket.Server

  private metaData: MetaData = new MetaData()

  private command: Command

  private ip?: string

  private port: number

  private name: string

  private domain: string

  private description: string

  private countryCode?: string

  public readonly passwordRequired: boolean

  public readonly password: string

  private verbose: boolean

  constructor (
    { port, gamemode, enableGamemodeVote, passwordRequired, password, name, domain, description, verbose }: Settings
  ) {
    this.gameMode = gamemode
    this.port = port
    this.name = name
    this.domain = domain
    this.description = description
    this.passwordRequired = passwordRequired
    this.password = password
    this.verbose = !!verbose
    this.command = new Command(enableGamemodeVote)
    this.onConnection = this.onConnection.bind(this)
    this.server = new WSServer({ port: this.port })
    this.metaData = new MetaData()
    this.clients = []
    this.players = []
  }

  public start (server?: Server) {
    this.ip = server ? server.ip : ''
    this.countryCode = server ? server.countryCode : 'LAN'
    console.info(`\nNet64+ ${process.env.VERSION} server successfully started!`)
    this.server!.on('connection', this.onConnection)
    if (this.passwordRequired) {
      console.info('Password protection enabled')
    }
  }

  public addPlayer (player: Player): void {
    const playerId = player.client.id
    this.players[playerId] = player
    if (!this.playerWithToken) {
      this.grantNewServerToken(player)
    }
    this.broadcastPlayerListMessage()
    const activeUsers = this.players.filter(players => players).length
    console.info(`Active users: ${activeUsers}/24`)
  }

  public removePlayer (clientId: number): void {
    const playerToRemove = this.players[clientId]
    let shouldGrantNewToken = false
    if (playerToRemove === this.playerWithToken) {
      delete this.playerWithToken
      shouldGrantNewToken = true
    }
    delete this.players[clientId]
    if (shouldGrantNewToken) {
      this.grantNewServerToken()
    }
    this.broadcastPlayerListMessage()
    const activeUsers = this.players.filter(player => player).length
    console.info(`Active users: ${activeUsers}/24`)
  }

  private broadcastPlayerListMessage (): void {
    const playerMsg: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.PLAYER_LIST_UPDATE,
        playerListUpdate: {
          playerUpdates: this.generatePlayerUpdates()
        }
      }
    }
    const playerMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(playerMsg)).finish()
    this.broadcastMessageAll(playerMessage)
  }

  private generatePlayerUpdates (): IPlayerUpdate[] {
    return this.players
      .filter(player => player)
      .map(player => ({
        player: {
          username: player.username,
          characterId: player.characterId
        },
        playerId: player.client.id
      }))
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
            playerUpdates: this.generatePlayerUpdates()
          },
          passwordRequired: this.passwordRequired
        }
      }
    }
    const handshakeMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(handshake)).finish()
    client.sendMessage(handshakeMessage)
  }

  public reorderPlayers (): void {
    const newClients: Client[] = []
    const newPlayers: Player[] = []
    let j = 1
    for (let i in this.clients) {
      if (!this.clients[i]) continue
      newClients[j] = this.clients[i]
      newClients[j].id = j
      newPlayers[j++] = this.players[i]
    }
    this.clients = newClients
    this.players = newPlayers
    for (let id = 2; id < this.clients.length; id++) {
      this.clients[id].sendPlayerReorder(id)
    }
  }

  /**
   * Broadcast message to all authenticate clients.
   *
   * @param {Uint8Array} message - The message to broadcast
   */
  public broadcastMessage (message: Uint8Array): void {
    this.players
      .filter(player => player)
      .forEach(({ client }) => {
        client.sendMessage(message)
      })
  }

  /**
   * Broadcast message to all clients.
   *
   * @param {Uint8Array} message - The message to broadcast
   */
  public broadcastMessageAll (message: Uint8Array): void {
    this.clients
      .filter(client => client)
      .forEach(client => {
        client.sendMessage(message)
      })
  }

  public async broadcastData (): Promise<void> {
    const playerDataMessage = await this.getPlayerData()
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

  private async getPlayerData (): Promise<Uint8Array> {
    const playersWithPlayerData = this.players
      .filter(player => player && player.playerData[3] !== 0)
    const data = {
      messageType: ServerClient.MessageType.PLAYER_DATA,
      playerData: {
        dataLength: 0x1C,
        playerBytes: playersWithPlayerData
          .map(player => ({
            playerId: player.client.id,
            playerData: player.playerData
          }))
      }
    }
    const playerData: IServerClientMessage = playersWithPlayerData.length >= PLAYER_DATA_COMPRESSION_THRESHOLD
      ? {
        compression: Compression.GZIP,
        compressedData: await this.getCompressedPlayerData(data)
      }
      : {
        compression: Compression.NONE,
        data
      }
    return ServerClientMessage.encode(ServerClientMessage.fromObject(playerData)).finish()
  }

  private getCompressedPlayerData (playerData: IServerClient): Promise<Buffer> {
    const dataBuffer = ServerClient.encode(ServerClient.fromObject(playerData)).finish()
    return new Promise((resolve, reject) => {
      zlib.gzip(dataBuffer as Buffer, (err, compressedDataBuffer) => {
        if (err) reject(err)
        resolve(compressedDataBuffer)
      })
    })
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
    if (process.env.NODE_ENV === 'development' || this.verbose) {
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

  private grantNewServerToken (playerToGrant?: Player): void {
    if (playerToGrant) {
      this.grantTokenToPlayer(playerToGrant)
      return
    }
    for (let i = this.players.length; i >= 0; i--) {
      playerToGrant = this.players[i]
      if (!playerToGrant) continue
      this.grantTokenToPlayer(playerToGrant)
      this.clients[1] = playerToGrant.client
      this.players[1] = playerToGrant
      this.clients[1].id = 1
      delete this.clients[i]
      delete this.players[i]
      return
    }
  }

  private grantTokenToPlayer (playerToGrant: Player): void {
    const serverToken: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.SERVER_MESSAGE,
        serverMessage: {
          messageType: ServerMessage.MessageType.PLAYER_REORDER,
          playerReorder: {
            playerId: 1,
            grantToken: true
          }
        }
      }
    }
    const serverTokenMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(serverToken)).finish()
    playerToGrant.client.sendMessage(serverTokenMessage)
    if (process.env.NODE_ENV === 'development' || this.verbose) {
      console.info(`New server token has been granted to player [${playerToGrant.client.id}] ${playerToGrant.username}`)
    }
    this.playerWithToken = playerToGrant
  }

  private onConnection (ws: WebSocket): void {
    const id = this.getNextClientId()
    if (id == null) {
      this.sendServerFullMessage(ws)
      if (process.env.NODE_ENV === 'development' || this.verbose) {
        console.info(`A new client connected, but server is full`)
      }
      return
    }
    if (process.env.NODE_ENV === 'development' || this.verbose) {
      console.info(`A new client connected and received ID: ${id}`)
    }
    this.clients[id] = new Client(id, ws, this.verbose)
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
