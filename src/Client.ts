import * as WebSocket from 'uws'

import { webSocketServer } from '.'
import { Player } from './Player'
import { WebSocketServer } from './WebSocketServer'
import { ConnectionError } from './models/Connection.model'
import {
  ServerClientMessage, IServerClientMessage, ServerClient, ServerMessage, ConnectionDenied, Error as ErrorProto
} from './proto/ServerClientMessage'
import { ClientServerMessage, ClientServer, IClientServer, IClientHandshake, Compression, Chat } from './proto/ClientServerMessage'

export class Client {
  public player?: Player

  constructor (public id: number, private server: WebSocketServer, private ws: WebSocket) {
    this.id = id
    this.server = server
    this.ws = ws
    ws.on('close', this.onDisconnect.bind(this, server))
    ws.on('message', this.onMessage.bind(this))
  }

  public sendMessage (message: Uint8Array): void {
    this.ws.send(message, {
      binary: true
    })
  }

  private sendHandshake (): void {
    this.server.sendHandshake(this)
  }

  private onDisconnect (server: WebSocketServer): void {
    if (webSocketServer !== server) return
    let shouldGrantNewToken = false
    if (this.player && this.server.players[this.id] === this.player) {
      shouldGrantNewToken = true
    }
    delete this.server.clients[this.id]
    delete this.server.players[this.id]
    if (shouldGrantNewToken) {
      this.server.grantNewServerToken()
    }
    const activeUsers = this.server.clients.filter(client => client).length
    console.info(`Active users: ${activeUsers}/24`)
  }

  /**
   * Handle binary messages received by WebSocket connection.
   *
   * @param {ArrayBuffer} data - The binary message to handle
   * @throws {Error} Rethrows on internal server error while in production mode, so that it can be handled by a global Error Handler
   */
  private onMessage (data: ArrayBuffer): void {
    const buffer = new Uint8Array(data)
    const message = ClientServerMessage.decode(buffer)
    if (message.compression === Compression.ZSTD) {
      // TODO compression
      return
    }
    try {
      const messageData = message.data
      this.checkRequiredObjects(messageData)
      switch (messageData!.messageType) {
        case ClientServer.MessageType.HANDSHAKE:
          this.onHandshake(messageData!)
          break
        case ClientServer.MessageType.PING:
          this.onPing(buffer)
          break
        case ClientServer.MessageType.PLAYER_UPDATE:
          this.onPlayerUpdate(messageData!)
          break
        case ClientServer.MessageType.PLAYER_DATA:
          this.onPlayerData(messageData!)
          break
        case ClientServer.MessageType.META_DATA:
          this.onMetaData(messageData!)
          break
        case ClientServer.MessageType.CHAT:
          this.onChatMessage(messageData!)
          break
        default:
          throw new ConnectionError(
            'Message type unknown',
            ErrorProto.ErrorType.BAD_REQUEST
          )
      }
    } catch (err) {
      if (err instanceof ConnectionError) {
        this.sendBadRequest(err)
        return
      }
      if (process.env.NODE_ENV === 'development') {
        this.sendInternalServerError(err)
        return
      }
      throw err
    }
  }

  /**
   * Checks whether given objects are defined.
   *
   * @param {any[]} objects - Objects to check
   * @throws {ConnectionError} Client sent a bad request
   */
  private checkRequiredObjects (...objects: any[]): void {
    for (const object in objects) {
      if (object == null) {
        throw new ConnectionError(
          `${Object.getPrototypeOf(object)} object is missing`,
          ErrorProto.ErrorType.BAD_REQUEST
        )
      }
    }
  }

  /**
   * Handle handshake message.
   *
   * @param {IClientServer} messageData - The received message
   */
  private onHandshake (messageData: IClientServer) {
    try {
      let handshake = messageData.handshake
      this.checkRequiredObjects(handshake)
      handshake = handshake as IClientHandshake
      this.checkRequiredObjects(handshake.major, handshake!.minor, handshake!.characterId, handshake!.username)
      // TODO add checks for invalid characterId and username
      if (this.isClientUsingWrongVersion(handshake!)) {
        this.sendWrongVersionMessage()
        return
      }
      this.player = new Player(this, handshake!.username!, handshake!.characterId!)
      webSocketServer.addPlayer(this.player)
      this.sendHandshake()
    } catch (err) {
      console.error(err)
    }
  }

  private isClientUsingWrongVersion (handshake: IClientHandshake): boolean {
    return String(handshake.major) !== process.env.MAJOR || String(handshake.minor) !== process.env.MINOR
  }

  private sendWrongVersionMessage (): void {
    const wrongVersion: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.SERVER_MESSAGE,
        serverMessage: {
          messageType: ServerMessage.MessageType.CONNECTION_DENIED,
          connectionDenied: {
            reason: ConnectionDenied.Reason.WRONG_VERSION,
            wrongVersion: {
              majorVersion: +process.env.MAJOR!,
              minorVersion: +process.env.MINOR!
            }
          }
        }
      }
    }
    const wrongVersionMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(wrongVersion)).finish()
    this.sendMessage(wrongVersionMessage)
  }

  private onPing (data: Uint8Array): void {
    this.sendMessage(data)
  }

  private onPlayerUpdate (messageData: IClientServer): void {
    const player = messageData.player
    this.checkRequiredObjects(player)
    if (player!.characterId == null || this.player == null) return
    this.player.characterId = player!.characterId!
  }

  private onPlayerData (messageData: IClientServer) {
    if (!this.player) return
    const playerData = messageData.playerData
    this.checkRequiredObjects(playerData)
    this.checkRequiredObjects(playerData!.dataLength, playerData!.playerData)
    this.player.playerData = playerData!.playerData!
  }

  private onMetaData (messageData: IClientServer) {
    const metaData = messageData.metaData
    this.checkRequiredObjects(metaData)
    this.checkRequiredObjects(metaData!.metaData)
    for (const meta of metaData!.metaData!) {
      this.server.addMeta(meta)
    }
  }

  private onChatMessage (messageData: IClientServer): void {
    const chat = messageData.chat
    this.checkRequiredObjects(chat)
    this.checkRequiredObjects(chat!.message)
    switch (chat!.chatType) {
      case Chat.ChatType.GLOBAL:
        this.server.onGlobalChatMessage(this, chat!.message!)
        break
      case Chat.ChatType.PRIVATE:
        this.checkRequiredObjects(chat!.private)
        this.checkRequiredObjects(chat!.private!.receiverId)
        this.server.onPrivateChatMessage(this, chat!.message!, chat!.private!.receiverId!)
        break
    }
  }

  private sendBadRequest (err: ConnectionError): void {
    const error: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.SERVER_MESSAGE,
        serverMessage: {
          messageType: ServerMessage.MessageType.ERROR,
          error: {
            errorType: err.errorType,
            message: err.message
          }
        }
      }
    }
    const errorMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(error)).finish()
    this.sendMessage(errorMessage)
  }

  private sendInternalServerError (err: Error): void {
    const error: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.SERVER_MESSAGE,
        serverMessage: {
          messageType: ServerMessage.MessageType.ERROR,
          error: {
            errorType: ErrorProto.ErrorType.INTERNAL_SERVER_ERROR,
            message: err.message
          }
        }
      }
    }
    const errorMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(error)).finish()
    this.sendMessage(errorMessage)
  }
}
