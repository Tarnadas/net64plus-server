import { Client } from './Client'
import {
  IServerClientMessage, ServerClient, Compression, ServerClientMessage, Chat
} from './proto/ServerClientMessage'

export const PASSWORD_THROTTLE_INCREASE = 10

export const PASSWORD_THROTTLE_RESET = 120

export const MESSAGES_PER_HALF_MINUTE_THRESHOLD = 15

export const MESSAGES_PER_HALF_MINUTE_DOS_THRESHOLD = 150

export const MESSAGE_CHARACTERS_PER_HALF_MINUTE_THRESHOLD = 500

export const SPAM_NOTIFICATION_MESSAGE = (seconds: number) => `**You have been muted for the next ${seconds} seconds due to spamming in chat**`

export const warningLevelMuteMapping = [
  30, 60, 120, 240, 480
]

export const WARNING_LEVEL_RESET = 300000

export class Identity {
  public static Identities: { [key: string]: Identity } = {}

  private static identityDeleteTimers: { [key: string]: NodeJS.Timer } = {}

  private static identityDeleteTimeout = 120000

  private passwordThrottle = 0

  private passwordThrottledUntil = 0

  private passwordThrottleReset?: NodeJS.Timer

  private _canSendPassword = true
  public get canSendPassword (): boolean {
    return this._canSendPassword
  }

  private canSendPasswordReset?: NodeJS.Timer

  private warningLevel = 0

  private warningLevelReset?: NodeJS.Timer

  private isMuted = false

  private isMutedReset?: NodeJS.Timer

  private messagesFromLastHalfMinute: string[] = []

  private allMessagesFromLastHalfMinute: string[] = []

  private constructor (private client: Client | null, public ipAddress: string) {
    Identity.Identities[ipAddress] = this
    if (Identity.identityDeleteTimers[ipAddress]) {
      clearTimeout(Identity.identityDeleteTimers[ipAddress])
      delete Identity.identityDeleteTimers[ipAddress]
    }
  }

  public static getIdentity (client: Client, ipAddress: string): Identity {
    if (Identity.Identities[ipAddress]) {
      Identity.Identities[ipAddress].client = client
      return Identity.Identities[ipAddress]
    }
    return new Identity(client, ipAddress)
  }

  public startDeleteTimeout (): void {
    this.client = null
    Identity.identityDeleteTimers[this.ipAddress] = setTimeout(() => {
      delete Identity.Identities[this.ipAddress]
    }, Identity.identityDeleteTimeout)
  }

  public getPasswordThrottle (): number {
    if (!this._canSendPassword) {
      const remainingThrottleTime = this.passwordThrottledUntil - Date.now()
      return remainingThrottleTime / 1000
    }
    this.passwordThrottle += PASSWORD_THROTTLE_INCREASE
    this.passwordThrottledUntil = Date.now() + this.passwordThrottle * 1000
    this.passwordThrottleReset = setTimeout(() => {
      this.passwordThrottle = 0
      delete this.passwordThrottleReset
    }, PASSWORD_THROTTLE_RESET * 1000)
    this._canSendPassword = false
    this.canSendPasswordReset = setTimeout(() => {
      this._canSendPassword = true
      delete this.canSendPasswordReset
    }, this.passwordThrottle * 1000)
    return this.passwordThrottle
  }

  public chatProtect (message: string): boolean {
    if (!this.spamProtect(message)) {
      return false
    }
    return true
  }

  private spamProtect (message: string): boolean {
    this.allMessagesFromLastHalfMinute.push(message)
    setTimeout(() => {
      this.allMessagesFromLastHalfMinute.splice(0, 1)
    }, 30000)
    const allMessagesPerMinute = this.allMessagesFromLastHalfMinute.length
    if (this.isDoS(allMessagesPerMinute)) {
      this.client!.closeConnection()
      return false
    }

    if (this.isMuted) {
      return false
    }

    const messagesPerHalfMinute = this.messagesFromLastHalfMinute.length
    const messageCharactersPerHalfMinute = this.messagesFromLastHalfMinute.join('').length
    if (this.isSpam(messagesPerHalfMinute, messageCharactersPerHalfMinute)) {
      const muteTimeout = warningLevelMuteMapping[this.warningLevel]
      this.mute(muteTimeout * 1000)
      this.sendSpamNotification(muteTimeout)
      return false
    }
    this.messagesFromLastHalfMinute.push(message)
    setTimeout(() => {
      this.messagesFromLastHalfMinute.splice(0, 1)
    }, 30000)
    return true
  }

  private isDoS (allMessagesPerMinute: number): boolean {
    return allMessagesPerMinute >= MESSAGES_PER_HALF_MINUTE_DOS_THRESHOLD
  }

  private isSpam (messagesPerMinute: number, messageCharactersPerMinute: number): boolean {
    return messagesPerMinute >= MESSAGES_PER_HALF_MINUTE_THRESHOLD || messageCharactersPerMinute >= MESSAGE_CHARACTERS_PER_HALF_MINUTE_THRESHOLD
  }

  private sendSpamNotification (muteTimeout: number): void {
    const message: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.CHAT,
        chat: {
          chatType: Chat.ChatType.COMMAND,
          message: SPAM_NOTIFICATION_MESSAGE(muteTimeout)
        }
      }
    }
    const spamNotificationMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(message)).finish()
    this.client!.sendMessage(spamNotificationMessage)
    this.increaseWarningLevel()
  }

  private mute (time: number): void {
    this.isMuted = true
    if (this.isMutedReset) {
      clearTimeout(this.isMutedReset)
    }
    this.isMutedReset = setTimeout(() => {
      this.isMuted = false
      this.sendUnmuteNotification()
      delete this.isMutedReset
    }, time)
  }

  private sendUnmuteNotification (): void {
    if (!this.client) return
    const message: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.CHAT,
        chat: {
          chatType: Chat.ChatType.COMMAND,
          message: '**You have been unmuted**'
        }
      }
    }
    const spamNotificationMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(message)).finish()
    this.client.sendMessage(spamNotificationMessage)
  }

  private increaseWarningLevel (): void {
    this.warningLevel++
    this.updateWarningLevelResetTimer()
  }

  public maxWarningLevel (): void {
    this.warningLevel = warningLevelMuteMapping.length
    this.updateWarningLevelResetTimer()
  }

  private updateWarningLevelResetTimer (): void {
    if (this.warningLevelReset) {
      clearTimeout(this.warningLevelReset)
    }
    this.warningLevelReset = setTimeout(() => {
      this.warningLevel = 0
      delete this.warningLevelReset
    }, WARNING_LEVEL_RESET)
  }
}
