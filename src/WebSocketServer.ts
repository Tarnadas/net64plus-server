import * as WebSocket from 'uws'

import * as zlib from 'zlib'

import { Client } from './Client'
import { Player } from './Player'
import { MetaData } from './MetaData'
import { ConnectionError } from './models/Connection.model'
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
  IMeta
} from './proto/ServerClientMessage'

let Server: typeof WebSocket.Server
if (process.env.TARGET_ENV === 'win32') {
  Server = require('../compile/uws').Server
} else {
  Server = require('uws').Server
}

export class WebSocketServer {
  private server?: WebSocket.Server

  private metaData: MetaData = new MetaData()

  private tokenHolder?: Player // TOOD

  constructor (private port: number, public clients: Client[] = [], public players: Player[] = []) {
    this.onConnection = this.onConnection.bind(this)
    this.init()
  }

  private init (): void {
    this.server = new Server({ port: this.port }, () => {
      console.log(`\nNet64+ ${process.env.VERSION} server successfully started!\nAccepting connections on Port ${this.port}`)
      if (process.env.TARGET_ENV === 'win32') {
        console.log('Connect locally via direct connect 127.0.0.1\nTo accept external connections, your Port must be forwarded.\nTo join via LAN, others must use your LAN IP address: win + "cmd" > ipconfig > IPv4 Address or via Hamachi network and IP')
        console.log('\nThis is a precompiled version of the Net64+ server. It has the limitation, that it cannot be displayed on the public server list. It is only meant to be used for user servers!\n')
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
    if (player.client.id === 1) {
      this.grantNewServerToken()
    }
    this.players[player.client.id] = player
  }

  public sendHandshake (client: Client): void {
    const handshake: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.HANDSHAKE,
        handshake: {
          playerId: client.id,
          playerList: {
            playerUpdates: this.players.map(player => ({
              player: {
                username: client!.player!.username,
                characterId: client!.player!.characterId
              },
              playerId: client.id
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
            tokenType: tokenType ? ServerToken.TokenType.GRANT : ServerToken.TokenType.LOSE,
            signature: ''
          }
        }
      }
    }
    const handshakeMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(handshake)).finish()
    client.sendMessage(handshakeMessage)
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
          playerLength: this.players.filter(player => player).length,
          playerData: this.players
            .filter(player => player && player.playerData[3] !== 0)
            .map(player => player.playerData)
            .reduce((concatenated, buffer) => new Uint8Array([...concatenated, ...buffer]), new Uint8Array())
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
          metaData: this.metaData.getMetaData()
        }
      }
    }
    return ServerClientMessage.encode(ServerClientMessage.fromObject(metaData)).finish()
  }

  public addMeta (meta: IMeta): void {
    this.metaData.addIfNotAlreadySent(meta)
  }

  public onGlobalChatMessage (client: Client, message: string) {
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

  public grantNewServerToken (): void {
    for (let i in this.players) {
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
      return
    }
  }

  private onConnection (ws: WebSocket): void {
    const id = this.getNextClientId()
    if (id == null) {
      this.sendServerFullMessage(ws)
      if (process.env.NODE_ENV === 'development') {
        console.info(`A new client connect, but server is full`)
      }
      return
    }
    if (process.env.NODE_ENV === 'development') {
      console.info(`A new client connect and received ID: ${id}`)
    }
    this.clients[id] = new Client(id, this, ws)
    const activeUsers = this.clients.filter(client => client).length
    console.log(`Active users: ${activeUsers}/24`)
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
