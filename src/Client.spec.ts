import * as zlib from 'zlib'

import { webSocketServer } from '.'
import { Client, CONNECTION_TIMEOUT, DECOMPRESSION_ERROR, AFK_TIMEOUT, AFK_TIMEOUT_COUNT, MAX_LENGTH_CHAT_MESSAGE, NO_PASSWORD_REQUIRED } from './Client'
import { Player } from './Player'
import { IClientServerMessage, Compression, ClientServer, ClientServerMessage, Chat } from './proto/ClientServerMessage'
import { IServerClientMessage, ServerClient, ServerClientMessage, ServerMessage, Error as ErrorProto, Authentication } from './proto/ServerClientMessage'
import {
  Identity,
  PASSWORD_THROTTLE_INCREASE,
  MESSAGE_CHARACTERS_PER_HALF_MINUTE_THRESHOLD,
  MESSAGES_PER_HALF_MINUTE_DOS_THRESHOLD,
  MESSAGES_PER_HALF_MINUTE_THRESHOLD,
  SPAM_NOTIFICATION_MESSAGE,
  warningLevelMuteMapping
} from './Identity'

const addClient = (client: Client) => {
  webSocketServer.clients[client.id] = client
}

describe('Client', () => {
  let client: Client
  let wsMock: any
  let fnMocks: {[key: string]: (...args: any[]) => Promise<void>}

  beforeEach(() => {
    jest.useFakeTimers()
    console.info = jest.fn()
  })

  beforeEach(() => {
    fnMocks = {}
    // @ts-ignore
    webSocketServer = {
      clients: [],
      players: [],
      onGlobalChatMessage: jest.fn(),
      sendHandshake: jest.fn(),
      addPlayer: jest.fn()
    } as any
    wsMock = {
      on: (type: string, callback: () => Promise<void>) => {
        fnMocks[type] = callback
      },
      send: jest.fn(),
      close: jest.fn(),
      _socket: {
        remoteAddress: '127.0.0.1'
      }
    }
    client = new Client(1, wsMock)
    addClient(client)
  })

  beforeEach(() => {
    expect(webSocketServer.clients[client.id]).toBeDefined()
  })

  beforeEach(() => {
    Identity.Identities = {}
  })

  it('should automatically disconnect, if no handshake and player data gets received in timeout interval', () => {
    jest.advanceTimersByTime(CONNECTION_TIMEOUT)

    expect(wsMock.close).toHaveBeenCalled()
  })

  describe('#ws', () => {
    describe('#onMessage', () => {
      describe('Compression', () => {
        it('should decompress gzip messages', async () => {
          const data = {
            messageType: ClientServer.MessageType.PING,
            ping: {}
          }
          const dataMessage = ClientServer.encode(ClientServer.fromObject(data)).finish()
          const message: IClientServerMessage = {
            compression: Compression.GZIP,
            compressedData: zlib.gzipSync(dataMessage as Buffer)
          }
          const encodedMessage = ClientServerMessage.encode(ClientServerMessage.fromObject(message)).finish()

          await fnMocks.message(encodedMessage)

          expect(wsMock.send).toHaveBeenCalledWith(new Uint8Array(encodedMessage), { binary: true })
        })

        it('should handle gzip decompression error', async () => {
          const data = {
            messageType: ClientServer.MessageType.PING,
            ping: {}
          }
          const dataMessage = ClientServer.encode(ClientServer.fromObject(data)).finish()
          const message: IClientServerMessage = {
            compression: Compression.GZIP,
            compressedData: new Uint8Array()
          }
          const encodedMessage = ClientServerMessage.encode(ClientServerMessage.fromObject(message)).finish()
          const error: IServerClientMessage = {
            compression: Compression.NONE,
            data: {
              messageType: ServerClient.MessageType.SERVER_MESSAGE,
              serverMessage: {
                messageType: ServerMessage.MessageType.ERROR,
                error: {
                  errorType: ErrorProto.ErrorType.BAD_REQUEST,
                  message: DECOMPRESSION_ERROR
                }
              }
            }
          }
          const errorMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(error)).finish()

          await fnMocks.message(encodedMessage)

          expect(wsMock.send).toHaveBeenCalledWith(errorMessage, { binary: true })
        })
      })

      describe('#onPing', () => {
        it('should send message back', async () => {
          const message: IClientServerMessage = {
            compression: Compression.NONE,
            data: {
              messageType: ClientServer.MessageType.PING,
              ping: {}
            }
          }
          const encodedMessage = ClientServerMessage.encode(ClientServerMessage.fromObject(message)).finish()

          await fnMocks.message(encodedMessage)

          expect(wsMock.send).toHaveBeenCalledWith(new Uint8Array(encodedMessage), { binary: true })
        })
      })

      describe('#onAuthentication', () => {
        let username: string
        let characterId: number

        beforeEach(() => {
          username = 'username'
          characterId = 4
          process.env.MAJOR = '0'
          process.env.MINOR = '0'
        })

        beforeEach(() => {
          expect(client.player).toBeUndefined()
        })

        describe('if password is required', () => {
          beforeEach(() => {
            // @ts-ignore
            webSocketServer.passwordRequired = true
            const message: IClientServerMessage = {
              compression: Compression.NONE,
              data: {
                messageType: ClientServer.MessageType.HANDSHAKE,
                handshake: {
                  characterId,
                  major: 0,
                  minor: 0,
                  username
                }
              }
            }
            const encodedMessage = ClientServerMessage.encode(ClientServerMessage.fromObject(message)).finish()

            return fnMocks.message(encodedMessage)
          })

          describe('on correct password', () => {
            beforeEach(async () => {
              const password = 'server-password'
              // @ts-ignore
              webSocketServer.password = password
              const message: IClientServerMessage = {
                compression: Compression.NONE,
                data: {
                  messageType: ClientServer.MessageType.AUTHENTICATE,
                  authenticate: {
                    password
                  }
                }
              }
              const encodedMessage = ClientServerMessage.encode(ClientServerMessage.fromObject(message)).finish()

              await fnMocks.message(encodedMessage)
            })

            it('should create player object', () => {
              expect(client.player).toBeDefined()
              expect(client.player!.username).toEqual(username)
              expect(client.player!.characterId).toEqual(characterId)
            })

            it('should add player to server', () => {
              expect(webSocketServer.addPlayer).toHaveBeenCalledWith(new Player(client, username, characterId))
            })

            it('should send password accepted message to client', () => {
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

              expect(wsMock.send).toHaveBeenLastCalledWith(successMessage, {
                binary: true
              })
            })
          })

          describe('on incorrect password', () => {
            let wrongPasswordMessage: Uint8Array
            beforeEach(async () => {
              const password = 'server-password'
              // @ts-ignore
              webSocketServer.password = password
              const message: IClientServerMessage = {
                compression: Compression.NONE,
                data: {
                  messageType: ClientServer.MessageType.AUTHENTICATE,
                  authenticate: {
                    password: 'incorrect-password'
                  }
                }
              }
              wrongPasswordMessage = ClientServerMessage.encode(ClientServerMessage.fromObject(message)).finish()

              await fnMocks.message(wrongPasswordMessage)
              expect(wsMock.send).toHaveBeenCalledTimes(1)
            })

            it('should send message that password was incorrect', () => {
              const message: IServerClientMessage = {
                compression: Compression.NONE,
                data: {
                  messageType: ServerClient.MessageType.SERVER_MESSAGE,
                  serverMessage: {
                    messageType: ServerMessage.MessageType.AUTHENTICATION,
                    authentication: {
                      status: Authentication.Status.DENIED,
                      throttle: PASSWORD_THROTTLE_INCREASE
                    }
                  }
                }
              }
              const wrongPasswordMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(message)).finish()

              expect(wsMock.send).toHaveBeenLastCalledWith(wrongPasswordMessage, {
                binary: true
              })
            })
          })

          describe('during throttling phase', () => {
            let wrongPasswordMessage: Uint8Array
            beforeEach(async () => {
              const password = 'server-password'
              // @ts-ignore
              webSocketServer.password = password
              const message: IClientServerMessage = {
                compression: Compression.NONE,
                data: {
                  messageType: ClientServer.MessageType.AUTHENTICATE,
                  authenticate: {
                    password: 'incorrect-password'
                  }
                }
              }
              wrongPasswordMessage = ClientServerMessage.encode(ClientServerMessage.fromObject(message)).finish()

              await fnMocks.message(wrongPasswordMessage)
              expect(wsMock.send).toHaveBeenCalledTimes(1)
            })

            it('should send remaining throttling time', async () => {
              const expectedRemainingTime = 3;
              (client as any).identity.getPasswordThrottle = jest.fn(() => expectedRemainingTime)
              const message: IServerClientMessage = {
                compression: Compression.NONE,
                data: {
                  messageType: ServerClient.MessageType.SERVER_MESSAGE,
                  serverMessage: {
                    messageType: ServerMessage.MessageType.AUTHENTICATION,
                    authentication: {
                      status: Authentication.Status.DENIED,
                      throttle: expectedRemainingTime
                    }
                  }
                }
              }
              const expectedMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(message)).finish()

              await fnMocks.message(wrongPasswordMessage)

              expect(wsMock.send).toHaveBeenLastCalledWith(expectedMessage, {
                binary: true
              })
            })

            it('should reaccept message after throttling phase', async () => {
              jest.advanceTimersByTime(PASSWORD_THROTTLE_INCREASE * 1000)
              await fnMocks.message(wrongPasswordMessage)

              expect(wsMock.send).toHaveBeenCalledTimes(2)
            })
          })
        })

        describe('if password is not required', () => {
          beforeEach(async () => {
            // @ts-ignore
            webSocketServer.passwordRequired = false
            let message: IClientServerMessage = {
              compression: Compression.NONE,
              data: {
                messageType: ClientServer.MessageType.HANDSHAKE,
                handshake: {
                  characterId,
                  major: 0,
                  minor: 0,
                  username
                }
              }
            }
            let encodedMessage = ClientServerMessage.encode(ClientServerMessage.fromObject(message)).finish()

            await fnMocks.message(encodedMessage)

            message = {
              compression: Compression.NONE,
              data: {
                messageType: ClientServer.MessageType.AUTHENTICATE,
                authenticate: {
                  password: 'password'
                }
              }
            }
            encodedMessage = ClientServerMessage.encode(ClientServerMessage.fromObject(message)).finish()

            await fnMocks.message(encodedMessage)
          })

          it('should send message that password is not required', () => {
            const message: IServerClientMessage = {
              compression: Compression.NONE,
              data: {
                messageType: ServerClient.MessageType.SERVER_MESSAGE,
                serverMessage: {
                  messageType: ServerMessage.MessageType.ERROR,
                  error: {
                    errorType: ErrorProto.ErrorType.BAD_REQUEST,
                    message: NO_PASSWORD_REQUIRED
                  }
                }
              }
            }
            const noPassRequiredMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(message)).finish()

            expect(wsMock.send).toHaveBeenLastCalledWith(noPassRequiredMessage, {
              binary: true
            })
          })
        })
      })

      describe('#onChatMessage', () => {
        it('should send global chat message', async () => {
          const message: IClientServerMessage = {
            compression: Compression.NONE,
            data: {
              messageType: ClientServer.MessageType.CHAT,
              chat: {
                chatType: Chat.ChatType.GLOBAL,
                message: new Array(MAX_LENGTH_CHAT_MESSAGE + 1).join('a')
              }
            }
          }
          const encodedMessage = ClientServerMessage.encode(ClientServerMessage.fromObject(message)).finish()

          await fnMocks.message(encodedMessage)

          expect(webSocketServer.onGlobalChatMessage).toHaveBeenCalled()
        })

        it('should fail if message is too long', async () => {
          const message: IClientServerMessage = {
            compression: Compression.NONE,
            data: {
              messageType: ClientServer.MessageType.CHAT,
              chat: {
                chatType: Chat.ChatType.GLOBAL,
                message: new Array(MAX_LENGTH_CHAT_MESSAGE + 2).join('a')
              }
            }
          }
          const encodedMessage = ClientServerMessage.encode(ClientServerMessage.fromObject(message)).finish()

          await fnMocks.message(encodedMessage)

          expect(webSocketServer.onGlobalChatMessage).not.toHaveBeenCalled()
        })

        it('should have spam protection against large amount of messages', async () => {
          const message: IClientServerMessage = {
            compression: Compression.NONE,
            data: {
              messageType: ClientServer.MessageType.CHAT,
              chat: {
                chatType: Chat.ChatType.GLOBAL,
                message: ''
              }
            }
          }
          const encodedMessage = ClientServerMessage.encode(ClientServerMessage.fromObject(message)).finish()

          const messages: Promise<void>[] = []
          for (let i = 0; i < MESSAGES_PER_HALF_MINUTE_THRESHOLD + 1; i++) {
            messages.push(fnMocks.message(encodedMessage))
          }
          await Promise.all(messages)

          expect(webSocketServer.onGlobalChatMessage).toHaveBeenCalledTimes(MESSAGES_PER_HALF_MINUTE_THRESHOLD)
        })

        it('should have DoS protection against large amount of messages', async () => {
          const message: IClientServerMessage = {
            compression: Compression.NONE,
            data: {
              messageType: ClientServer.MessageType.CHAT,
              chat: {
                chatType: Chat.ChatType.GLOBAL,
                message: ''
              }
            }
          }
          const encodedMessage = ClientServerMessage.encode(ClientServerMessage.fromObject(message)).finish()

          const messages: Promise<void>[] = []
          for (let i = 0; i < MESSAGES_PER_HALF_MINUTE_DOS_THRESHOLD; i++) {
            messages.push(fnMocks.message(encodedMessage))
          }
          await Promise.all(messages)

          expect(wsMock.close).toHaveBeenCalled()
        })

        it('should have spam protection against large messages', async () => {
          const message: IClientServerMessage = {
            compression: Compression.NONE,
            data: {
              messageType: ClientServer.MessageType.CHAT,
              chat: {
                chatType: Chat.ChatType.GLOBAL,
                message: new Array(MAX_LENGTH_CHAT_MESSAGE + 1).join('a')
              }
            }
          }
          const encodedMessage = ClientServerMessage.encode(ClientServerMessage.fromObject(message)).finish()

          const messages: Promise<void>[] = []
          for (let i = 0; i < MESSAGES_PER_HALF_MINUTE_THRESHOLD; i++) {
            messages.push(fnMocks.message(encodedMessage))
          }
          await Promise.all(messages)

          const expectedAmountOfMessages = Math.ceil(MESSAGE_CHARACTERS_PER_HALF_MINUTE_THRESHOLD / MAX_LENGTH_CHAT_MESSAGE)
          expect(webSocketServer.onGlobalChatMessage).toHaveBeenCalledTimes(expectedAmountOfMessages)
        })

        it('should mute client on too many messages', async () => {
          const message: IClientServerMessage = {
            compression: Compression.NONE,
            data: {
              messageType: ClientServer.MessageType.CHAT,
              chat: {
                chatType: Chat.ChatType.GLOBAL,
                message: ''
              }
            }
          }
          const encodedMessage = ClientServerMessage.encode(ClientServerMessage.fromObject(message)).finish()

          const expectMuteMessageWarningLevel = async (warningLevel: number) => {
            const messages: Promise<void>[] = []
            for (let i = 0; i < MESSAGES_PER_HALF_MINUTE_THRESHOLD + 1; i++) {
              messages.push(fnMocks.message(encodedMessage))
            }
            await Promise.all(messages)

            const muteMessage: IClientServerMessage = {
              compression: Compression.NONE,
              data: {
                messageType: ClientServer.MessageType.CHAT,
                chat: {
                  chatType: Chat.ChatType.COMMAND,
                  message: SPAM_NOTIFICATION_MESSAGE(warningLevelMuteMapping[warningLevel])
                }
              }
            }
            const spamNotificationMessage = ClientServerMessage.encode(ClientServerMessage.fromObject(muteMessage)).finish()

            expect(wsMock.send).toHaveBeenLastCalledWith(spamNotificationMessage, {
              binary: true
            })

            jest.advanceTimersByTime(warningLevelMuteMapping[warningLevel] * 1000)
          }

          for (let i = 0; i < warningLevelMuteMapping.length; i++) {
            await expectMuteMessageWarningLevel(i)
          }
          await expectMuteMessageWarningLevel(0)
        })
      })
    })
  })

  describe('#afkTimeout', () => {
    it('should kick player on inactivity', async () => {
      const message: IClientServerMessage = {
        compression: Compression.NONE,
        data: {
          messageType: ClientServer.MessageType.PLAYER_DATA,
          playerData: {}
        }
      }
      const encodedMessage = ClientServerMessage.encode(ClientServerMessage.fromObject(message)).finish()
      client.player = {
        playerData: new Uint8Array('0'.repeat(12).split('').map(c => Number(c)))
      } as any

      await fnMocks.message(encodedMessage)
      jest.advanceTimersByTime(AFK_TIMEOUT * AFK_TIMEOUT_COUNT)

      expect(wsMock.close).toHaveBeenCalled()
    })

    it('should not kick player on activity', async () => {
      const message: IClientServerMessage = {
        compression: Compression.NONE,
        data: {
          messageType: ClientServer.MessageType.PLAYER_DATA,
          playerData: {}
        }
      }
      const encodedMessage = ClientServerMessage.encode(ClientServerMessage.fromObject(message)).finish()
      client.player = {
        playerData: new Uint8Array([ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ])
      } as any

      await fnMocks.message(encodedMessage)
      jest.advanceTimersByTime(AFK_TIMEOUT * AFK_TIMEOUT_COUNT - 1)
      client.player!.playerData = new Uint8Array([ 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ])
      jest.advanceTimersByTime(1)

      expect(wsMock.close).not.toHaveBeenCalled()
    })

    it('should not kick player on partial inactivity', async () => {
      const message: IClientServerMessage = {
        compression: Compression.NONE,
        data: {
          messageType: ClientServer.MessageType.PLAYER_DATA,
          playerData: {}
        }
      }
      const encodedMessage = ClientServerMessage.encode(ClientServerMessage.fromObject(message)).finish()
      client.player = {
        playerData: new Uint8Array([ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ])
      } as any

      await fnMocks.message(encodedMessage)
      jest.advanceTimersByTime(AFK_TIMEOUT * (AFK_TIMEOUT_COUNT) - 1)
      client.player!.playerData = new Uint8Array([ 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0 ])
      jest.advanceTimersByTime(AFK_TIMEOUT * (AFK_TIMEOUT_COUNT) - 1)
      client.player!.playerData = new Uint8Array([ 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0 ])
      jest.advanceTimersByTime(AFK_TIMEOUT * (AFK_TIMEOUT_COUNT) - 1)

      expect(wsMock.close).not.toHaveBeenCalled()
    })
  })
})
