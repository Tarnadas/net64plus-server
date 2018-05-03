import * as WebSocket from 'uws'

import * as zlib from 'zlib'

import { webSocketServer } from '.'
import { Player } from './Player'
import { WebSocketServer } from './WebSocketServer'
import { ConnectionError } from './models/Connection.model'
import {
  ServerClientMessage, IServerClientMessage, ServerClient, ServerMessage, ConnectionDenied, Error as ErrorProto
} from './proto/ServerClientMessage'
import { ClientServerMessage, ClientServer, IClientServer, IClientHandshake, Compression, Chat } from './proto/ClientServerMessage'

export const CONNECTION_TIMEOUT = 10000

export const AFK_TIMEOUT = 10000

export const AFK_TIMEOUT_COUNT = 30

export const DECOMPRESSION_ERROR = 'Your message could not be decompressed'

export class Client {
  public player?: Player

  private connectionTimeout?: NodeJS.Timer

  private afkTimeout?: NodeJS.Timer

  private afkTimerCount = 0

  private previousPlayerLocation = 0

  constructor (public id: number, private ws: WebSocket) {
    this.id = id
    this.ws = ws
    ws.on('close', this.onDisconnect.bind(this))
    ws.on('message', this.onMessage.bind(this))
    this.connectionTimeout = setTimeout(() => {
      this.connectionTimeout = undefined
      this.ws.close()
      if (process.env.NODE_ENV === 'development') {
        console.info('A player timed out on handshake')
      }
    }, CONNECTION_TIMEOUT)
    this.afkTimeout = setInterval(this.afkTimer, AFK_TIMEOUT)
  }

  private afkTimer = () => {
    if (!this.player) {
      return
    }
    const playerLocation = this.player.playerData.slice(6, 12).reduce(
      (sum: number, byte: number) => sum + byte, 0
    )
    if (this.previousPlayerLocation !== playerLocation) {
      this.previousPlayerLocation = playerLocation
      return
    }
    this.afkTimerCount++
    if (this.afkTimerCount < AFK_TIMEOUT_COUNT) return
    this.ws.close()
    if (process.env.NODE_ENV === 'development') {
      console.info('A player timed out because of inactivity')
    }
  }

  public sendMessage (message: Uint8Array): void {
    this.ws.send(message, {
      binary: true
    })
  }

  public sendPlayerReorder (playerId: number): void {
    const handshake: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.SERVER_MESSAGE,
        serverMessage: {
          messageType: ServerMessage.MessageType.PLAYER_REORDER,
          playerReorder: {
            playerId
          }
        }
      }
    }
    const handshakeMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(handshake)).finish()
    this.sendMessage(handshakeMessage)
  }

  private sendHandshake (): void {
    webSocketServer.sendHandshake(this)
  }

  private onDisconnect (): void {
    webSocketServer.removePlayer(this.id)
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
    }
    if (this.afkTimeout) {
      clearInterval(this.afkTimeout)
    }
    const activeUsers = webSocketServer.clients.filter(client => client).length
    console.info(`Active users: ${activeUsers}/24`)
  }

  /**
   * Handle binary messages received by WebSocket connection.
   *
   * @param {ArrayBuffer} data - The binary message to handle
   * @throws {Error} Rethrows on internal server error while in production mode, so that it can be handled by a global Error Handler
   */
  private async onMessage (data: ArrayBuffer): Promise<void> {
    const buffer = new Uint8Array(data)
    const message = ClientServerMessage.decode(buffer)
    let messageData: IClientServer | null | undefined
    try {
      switch (message.compression) {
        case Compression.ZSTD:
          // TODO
          break
        case Compression.GZIP:
          this.checkRequiredObjects(message.compressedData)
          const uncompressedData = await new Promise<Buffer>((resolve, reject) => {
            zlib.gunzip(message.compressedData! as Buffer, (err, result) => {
              if (err) reject(err)
              resolve(result)
            })
          })
          messageData = ClientServer.decode(uncompressedData)
          break
        default:
          messageData = message.data
      }
    } catch (err) {
      this.sendBadRequest(new ConnectionError(
        DECOMPRESSION_ERROR,
        ErrorProto.ErrorType.BAD_REQUEST
      ))
      return
    }
    try {
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
      if (Object.getPrototypeOf(ConnectionError).isPrototypeOf(err)) {
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
    for (const object of objects) {
      if (object == null) {
        throw new ConnectionError(
          'A required object is missing in the received message',
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
    if (this.player == null) return
    const player = messageData.player
    this.checkRequiredObjects(player)
    let hasChanged = false
    if (player!.characterId != null) {
      this.player.characterId = player!.characterId!
      hasChanged = true
    }
    if (player!.username != null) {
      this.player.username = player!.username!
      hasChanged = true
    }
    if (!hasChanged) return
    const playerMsg: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.PLAYER_UPDATE,
        playerUpdate: {
          player: this.player,
          playerId: this.id
        }
      }
    }
    const playerMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(playerMsg)).finish()
    webSocketServer.broadcastMessage(playerMessage)
  }

  private onPlayerData (messageData: IClientServer) {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
      this.connectionTimeout = undefined
    }
    if (!this.player) return
    const playerData = messageData.playerData
    this.checkRequiredObjects(playerData)
    this.checkRequiredObjects(playerData!.dataLength, playerData!.playerBytes)
    this.checkRequiredObjects(playerData!.playerBytes![0])
    this.checkRequiredObjects(playerData!.playerBytes![0].playerData)
    if (playerData!.playerBytes![0].playerData![3] !== this.id) return
    this.player.playerData = new Uint8Array(playerData!.playerBytes![0].playerData!)
  }

  private onMetaData (messageData: IClientServer) {
    const metaData = messageData.metaData
    this.checkRequiredObjects(metaData)
    this.checkRequiredObjects(metaData!.metaData)
    for (const meta of metaData!.metaData!) {
      webSocketServer.addMeta(meta)
    }
  }

  private onChatMessage (messageData: IClientServer): void {
    const chat = messageData.chat
    this.checkRequiredObjects(chat)
    this.checkRequiredObjects(chat!.message)
    switch (chat!.chatType) {
      case Chat.ChatType.GLOBAL:
        webSocketServer.onGlobalChatMessage(this, chat!.message!)
        break
      case Chat.ChatType.PRIVATE:
        this.checkRequiredObjects(chat!.private)
        this.checkRequiredObjects(chat!.private!.receiverId)
        webSocketServer.onPrivateChatMessage(this, chat!.message!, chat!.private!.receiverId!)
        break
      case Chat.ChatType.COMMAND:
        this.checkRequiredObjects(chat!.command)
        this.checkRequiredObjects(chat!.command!.arguments)
        webSocketServer.onCommandChatMessage(this, chat!.message!, chat!.command!.arguments!)
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
