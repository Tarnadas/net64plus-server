import { WebSocket } from '@clusterws/cws'

import * as zlib from 'zlib'

import { webSocketServer } from './globals'
import { Identity } from './Identity'
import { Player, PLAYER_DATA_LENGTH } from './Player'
import { ConnectionError } from './models/Connection.model'
import {
  Authentication,
  ConnectionDenied,
  Error as ErrorProto,
  IServerClientMessage,
  ServerClient,
  ServerClientMessage,
  ServerMessage,
  IPlayer
} from './proto/ServerClientMessage'
import {
  Chat,
  ClientServer,
  ClientServerMessage,
  Compression,
  IClientHandshake,
  IClientServer
} from './proto/ClientServerMessage'

export const CONNECTION_TIMEOUT = 10000

export const AFK_TIMEOUT = 10000

export const AFK_TIMEOUT_COUNT = 30

export const DECOMPRESSION_ERROR = 'Your message could not be decompressed'

export const NO_PASSWORD_REQUIRED = 'This server requires no password authentication'

export const MAX_LENGTH_CHAT_MESSAGE = 100

/* eslint-disable @typescript-eslint/no-var-requires */
const escapeHTML = require('escape-html')
const FilterXSS = require('xss')
/* eslint-enable */

export class Client {
  private readonly identity: Identity

  public player?: Player

  private connectionTimeout?: NodeJS.Timer

  private readonly afkTimeout?: NodeJS.Timer

  private afkTimerCount = 0

  private previousPlayerLocation = 0

  private desiredUsername?: string

  private desiredCharacterId?: number

  constructor (public id: number, public readonly ws: WebSocket, private readonly verbose: boolean) {
    this.id = id
    this.ws = ws
    this.identity = Identity.getIdentity(this, (ws as any)._socket.remoteAddress)
    ws.on('close', this.onDisconnect.bind(this))
    ws.on('message', this.onMessage.bind(this))
    this.connectionTimeout = setTimeout(() => {
      this.connectionTimeout = undefined
      this.ws.close()
      if (process.env.NODE_ENV === 'development' || verbose) {
        console.info(`${this.getName()} timed out on handshake`)
      }
    }, CONNECTION_TIMEOUT)
    this.afkTimeout = setInterval(this.afkTimer, AFK_TIMEOUT)
    if (!this.identity.canSendPassword) {
      this.sendWrongPasswordMessage()
    }
  }

  public closeConnection (): void {
    this.ws.close()
  }

  private readonly afkTimer = () => {
    if (!this.player) {
      return
    }
    const playerLocation = this.player.playerData.slice(6, 12)
    const playerLocationHash = playerLocation.reduce(
      (sum: number, byte: number) => sum + byte, 0
    )
    if (this.previousPlayerLocation !== playerLocationHash) {
      this.afkTimerCount = 0
      this.previousPlayerLocation = playerLocationHash
      return
    }
    this.afkTimerCount++
    if (this.afkTimerCount < AFK_TIMEOUT_COUNT) return
    this.ws.close()
    if (process.env.NODE_ENV === 'development' || this.verbose) {
      console.info(`${this.getName()} timed out because of inactivity`)
    }
  }

  public getName (): string {
    return `${this.player ? this.player.username : `ClientID ${this.id}`};${this.ws._socket.remoteAddress}`
  }

  public sendMessage (message: Uint8Array): void {
    this.ws.send(Buffer.from(message), {
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
    this.identity.startDeleteTimeout()
    delete webSocketServer.clients[this.id]
    if (this.player) {
      webSocketServer.removePlayer(this.id)
    }
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
    }
    if (this.afkTimeout) {
      clearInterval(this.afkTimeout)
    }
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
            zlib.gunzip(message.compressedData as Buffer, (err, result) => {
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
      messageData = messageData as IClientServer
      switch (messageData.messageType) {
        case ClientServer.MessageType.HANDSHAKE:
          this.onHandshake(messageData)
          break
        case ClientServer.MessageType.PING:
          this.onPing(buffer)
          break
        case ClientServer.MessageType.PLAYER_UPDATE:
          this.onPlayerUpdate(messageData)
          break
        case ClientServer.MessageType.AUTHENTICATE:
          this.onAuthentication(messageData)
          break
        case ClientServer.MessageType.PLAYER_DATA:
          this.onPlayerData(messageData)
          break
        case ClientServer.MessageType.META_DATA:
          this.onMetaData(messageData)
          break
        case ClientServer.MessageType.CHAT:
          this.onChatMessage(messageData)
          break
        default:
          throw new ConnectionError(
            'Message type unknown',
            ErrorProto.ErrorType.BAD_REQUEST
          )
      }
    } catch (err) {
      // eslint-disable-next-line no-prototype-builtins
      if (Object.getPrototypeOf(ConnectionError).isPrototypeOf(err)) {
        this.sendBadRequest(err)
        return
      }
      if (process.env.NODE_ENV === 'development' || this.verbose) {
        this.sendInternalServerError(err)
        return
      }
      throw err
    }
  }

  private onBadMessage (): void {
    this.identity.maxWarningLevel()
    this.ws.close()
  }

  /**
   * Checks whether given objects are defined.
   *
   * @param {any[]} objects - Objects to check
   * @throws {ConnectionError} Client sent a bad request
   */
  private checkRequiredObjects (...objects: any[]): void | never {
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
      this.checkRequiredObjects(handshake.major, handshake.minor, handshake.characterId, handshake.username)
      const characterId = handshake.characterId
      if (
        typeof characterId !== 'number' ||
        characterId < 0 ||
        characterId > 11
      ) {
        this.onBadMessage()
        return
      }
      const username = handshake.username as string
      const checkedUsername = username.replace(/\W/g, '')
      if (
        username !== checkedUsername ||
        username.length < 3 ||
        username.length > 24
      ) {
        this.onBadMessage()
        return
      }
      if (this.isClientUsingWrongVersion(handshake)) {
        this.sendWrongVersionMessage()
        return
      }
      this.sendHandshake()
      if (webSocketServer.passwordRequired) {
        this.desiredUsername = username
        this.desiredCharacterId = characterId
        return
      }
      this.createPlayerObject(username, characterId)
    } catch (err) {
      console.error(err)
    }
  }

  private createPlayerObject (username?: string, characterId?: number): void {
    username = username || this.desiredUsername
    if (!username) throw new Error('Player object could not be created, because username is null')
    characterId = characterId != null ? characterId : this.desiredCharacterId
    if (characterId == null) throw new Error('Player object could not be created, because characterId is null')
    this.player = new Player(this, username, characterId)
    webSocketServer.addPlayer(this.player)
  }

  private isClientUsingWrongVersion (handshake: IClientHandshake): boolean {
    const major = handshake.major != null ? handshake.major : -1
    const minor = handshake.minor != null ? handshake.minor : -1
    return major !== Number(process.env.MAJOR) || minor < Number(process.env.MINOR)
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
    let player = messageData.player
    this.checkRequiredObjects(player)
    player = player as IPlayer
    let hasChanged = false
    if (player.characterId != null) {
      this.player.characterId = player.characterId
      hasChanged = true
    }
    if (player.username != null) {
      this.player.username = player.username
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
    webSocketServer.broadcastMessageAll(playerMessage)
  }

  private onAuthentication (messageData: IClientServer): void {
    if (!webSocketServer.passwordRequired) {
      this.sendBadRequest(new ConnectionError(
        NO_PASSWORD_REQUIRED,
        ErrorProto.ErrorType.BAD_REQUEST
      ))
      return
    }
    const authenticate = messageData.authenticate
    this.checkRequiredObjects(authenticate)
    if (!this.identity.canSendPassword) {
      this.sendWrongPasswordMessage()
      return
    }
    const password = authenticate!.password
    if (password !== webSocketServer.password) {
      this.sendWrongPasswordMessage()
      return
    }
    this.sendSuccessfulAuthenticationMessage()
    this.createPlayerObject()
  }

  private sendWrongPasswordMessage (): void {
    const wrongPassword: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.SERVER_MESSAGE,
        serverMessage: {
          messageType: ServerMessage.MessageType.AUTHENTICATION,
          authentication: {
            status: Authentication.Status.DENIED,
            throttle: this.identity.getPasswordThrottle()
          }
        }
      }
    }
    const wrongPasswordMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(wrongPassword)).finish()
    this.sendMessage(wrongPasswordMessage)
  }

  private sendSuccessfulAuthenticationMessage (): void {
    const success: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.SERVER_MESSAGE,
        serverMessage: {
          messageType: ServerMessage.MessageType.AUTHENTICATION,
          authentication: {
            status: Authentication.Status.ACCEPTED
          }
        }
      }
    }
    const successMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(success)).finish()
    this.sendMessage(successMessage)
  }

  private onPlayerData (messageData: IClientServer): void {
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
    const data = playerData!.playerBytes![0].playerData!
    if (data.length !== PLAYER_DATA_LENGTH) {
      this.onBadMessage()
      return
    }
    this.player.playerData = new Uint8Array(data)
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
    const message = chat!.message!
    if (message.length > MAX_LENGTH_CHAT_MESSAGE) {
      this.onBadMessage()
      return
    }
    const escapedMessage = escapeHTML(message)
    const sanitizedMessage = FilterXSS(escapedMessage)
    if (escapedMessage !== sanitizedMessage) {
      this.onBadMessage()
      return
    }

    if (!this.identity.chatProtect(message)) {
      return
    }

    switch (chat!.chatType) {
      case Chat.ChatType.GLOBAL:
        webSocketServer.onGlobalChatMessage(this, message)
        break
      case Chat.ChatType.PRIVATE:
        this.checkRequiredObjects(chat!.private)
        this.checkRequiredObjects(chat!.private!.receiverId)
        webSocketServer.onPrivateChatMessage(this, message, chat!.private!.receiverId!)
        break
      case Chat.ChatType.COMMAND:
        this.checkRequiredObjects(chat!.command)
        this.checkRequiredObjects(chat!.command!.arguments)
        webSocketServer.onCommandChatMessage(this, message, chat!.command!.arguments!)
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
