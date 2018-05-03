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
  IMeta,
  GameModeType
} from './proto/ServerClientMessage'

let WSServer: typeof WebSocket.Server
if (process.env.TARGET_ENV === 'win32') {
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

  private isOffline: boolean

  private server?: WebSocket.Server

  private metaData: MetaData = new MetaData()

  private command: Command

  private ip: string

  private port: number

  private name: string

  private domain: string

  private description: string

  private countryCode: string

  constructor (
    { port, gamemode, enableGamemodeVote, name, domain, description }: Settings,
    server?: Server
  ) {
    this.isOffline = !server
    this.gameMode = gamemode
    this.ip = server ? server.ip : ''
    this.port = port
    this.name = name
    this.domain = domain
    this.description = description
    this.countryCode = server ? server.countryCode : 'LAN'
    this.command = new Command(enableGamemodeVote)
    this.onConnection = this.onConnection.bind(this)
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

  public addPlayer (player: Player): void {
    const playerId = player.client.id
    this.players[playerId] = player
    if (!this.playerWithToken) {
      this.grantNewServerToken(player)
    }
    this.broadcastPlayerListMessage()
  }

  public removePlayer (clientId: number): void {
    delete this.clients[clientId]
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
    this.broadcastMessage(playerMessage)
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
          }
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

  public broadcastMessage (message: Uint8Array): void {
    for (const i in this.players) {
      const player = this.players[i]
      player.client.sendMessage(message)
    }
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
    if (process.env.NODE_ENV === 'development') {
      console.info(`New server token has been granted to player [${playerToGrant.client.id}] ${playerToGrant.username}`)
    }
    this.playerWithToken = playerToGrant
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
    this.clients[id] = new Client(id, ws)
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
