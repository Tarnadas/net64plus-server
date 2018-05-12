import * as zlib from 'zlib'

import { webSocketServer } from '.'
import { Client, CONNECTION_TIMEOUT, DECOMPRESSION_ERROR, AFK_TIMEOUT, AFK_TIMEOUT_COUNT } from './Client'
import { IClientServerMessage, Compression, ClientServer, ClientServerMessage } from './proto/ClientServerMessage'
import { IServerClientMessage, ServerClient, ServerClientMessage, ServerMessage, Error as ErrorProto } from './proto/ServerClientMessage'

const addClient = (client: Client) => {
  webSocketServer.clients[client.id] = client
}

describe('Client', () => {
  let client: Client
  let wsMock: any
  let fnMocks: {[key: string]: (...args: any[]) => void}

  beforeEach(() => {
    jest.useFakeTimers()
    console.info = jest.fn()
  })

  beforeEach(() => {
    fnMocks = {}
    // @ts-ignore
    webSocketServer = {
      clients: [],
      players: []
    } as any
    wsMock = {
      on: (type: string, callback: () => void) => {
        fnMocks[type] = callback
      },
      send: jest.fn(),
      close: jest.fn()
    }
    client = new Client(1, wsMock)
    addClient(client)
  })

  beforeEach(() => {
    expect(webSocketServer.clients[client.id]).toBeDefined()
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

      describe('onPing', () => {
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
