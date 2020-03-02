import { Command, GAMEMODE_VOTE_TIME, NAN_MESSAGE, TOO_MANY_ARGS_MESSAGE, GAMEMODE_ALREADY_RUNNING_MESSAGE, GAMEMODE_NOT_ENOUGH_VOTES } from './Command'
import { webSocketServer, setWebSocketServer } from './globals'
import { Client } from './Client'
import { ClientMock } from './Client.mock'
import { Vote } from './Vote'
import { IServerClientMessage, Compression, ServerClient, ServerMessage, ServerClientMessage } from './proto/ServerClientMessage'
import { Chat } from './proto/ClientServerMessage'

const addMockClient = (client: Client) => {
  webSocketServer.clients.push(client)
}

describe('Command', () => {
  let command: Command

  beforeEach(() => {
    jest.useFakeTimers()
    setWebSocketServer({
      gameMode: 0,
      clients: [],
      broadcastMessage: jest.fn(),
      reorderPlayers: jest.fn()
    } as any)
    addMockClient(undefined!)
    console.info = jest.fn()
    command = new Command(true)
    Vote.lastVotes = {}
  })

  describe('.onGameModeCommand', () => {
    it('should be disabled, if enableGamemodeVote is false', () => {
      command = new Command(false)
      const mockClient: Client = new ClientMock(1, {}, {}) as any
      addMockClient(mockClient)
      command.onGameModeCommand(mockClient, ['1'])
      expect(webSocketServer.broadcastMessage).not.toHaveBeenCalled()
    })

    it('should change game mode after vote has passed', () => {
      const mockClient0: Client = new ClientMock(1, {}, {}) as any
      addMockClient(mockClient0)
      const mockClient1: Client = new ClientMock(1, {}, {}) as any
      addMockClient(mockClient1)
      command.onGameModeCommand(mockClient0, ['1'])
      const message: IServerClientMessage = {
        compression: Compression.NONE,
        data: {
          messageType: ServerClient.MessageType.SERVER_MESSAGE,
          serverMessage: {
            messageType: ServerMessage.MessageType.GAME_MODE,
            gameMode: {
              gameMode: 1
            }
          }
        }
      }
      const expectedMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(message)).finish()

      jest.advanceTimersByTime(GAMEMODE_VOTE_TIME)
      expect(webSocketServer.broadcastMessage).toHaveBeenCalledWith(expectedMessage)
      expect(webSocketServer.gameMode).toEqual(1)
    })

    it('should change game mode after all clients voted', () => {
      const mockClient0: Client = new ClientMock(1, {}, {}) as any
      addMockClient(mockClient0)
      const mockClient1: Client = new ClientMock(2, {}, {}) as any
      addMockClient(mockClient1)
      command.onGameModeCommand(mockClient0, ['1'])
      command.onGameModeCommand(mockClient1, ['1'])
      const message: IServerClientMessage = {
        compression: Compression.NONE,
        data: {
          messageType: ServerClient.MessageType.SERVER_MESSAGE,
          serverMessage: {
            messageType: ServerMessage.MessageType.GAME_MODE,
            gameMode: {
              gameMode: 1
            }
          }
        }
      }
      const expectedMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(message)).finish()

      expect(webSocketServer.broadcastMessage).toHaveBeenCalledWith(expectedMessage)
      expect(webSocketServer.gameMode).toEqual(1)
    })

    it('should change game mode on multiple votes after vote has passed', () => {
      const mockClient0: Client = new ClientMock(1, {}, {}) as any
      addMockClient(mockClient0)
      const mockClient1: Client = new ClientMock(2, {}, {}) as any
      addMockClient(mockClient1)
      const mockClient2: Client = new ClientMock(3, {}, {}) as any
      addMockClient(mockClient2)
      const mockClient3: Client = new ClientMock(4, {}, {}) as any
      addMockClient(mockClient3)
      const mockClient4: Client = new ClientMock(5, {}, {}) as any
      addMockClient(mockClient4)
      const mockClient5: Client = new ClientMock(6, {}, {}) as any
      addMockClient(mockClient5)
      command.onGameModeCommand(mockClient0, ['1'])
      command.onGameModeCommand(mockClient1, ['1'])
      command.onGameModeCommand(mockClient2, ['2'])
      command.onGameModeCommand(mockClient3, ['3'])
      command.onGameModeCommand(mockClient4, ['2'])
      command.onGameModeCommand(mockClient5, ['2'])
      const message: IServerClientMessage = {
        compression: Compression.NONE,
        data: {
          messageType: ServerClient.MessageType.SERVER_MESSAGE,
          serverMessage: {
            messageType: ServerMessage.MessageType.GAME_MODE,
            gameMode: {
              gameMode: 2
            }
          }
        }
      }
      const expectedMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(message)).finish()

      jest.advanceTimersByTime(GAMEMODE_VOTE_TIME)
      expect(webSocketServer.broadcastMessage).toHaveBeenLastCalledWith(expectedMessage)
      expect(webSocketServer.gameMode).toEqual(2)
    })

    it('should not change game mode if not enough players have voted', () => {
      const mockClient0: Client = new ClientMock(1, {}, {}) as any
      addMockClient(mockClient0)
      const mockClient1: Client = new ClientMock(2, {}, {}) as any
      addMockClient(mockClient1)
      const mockClient2: Client = new ClientMock(3, {}, {}) as any
      addMockClient(mockClient2)
      const mockClient3: Client = new ClientMock(4, {}, {}) as any
      addMockClient(mockClient3)
      const mockClient4: Client = new ClientMock(5, {}, {}) as any
      addMockClient(mockClient4)
      const mockClient5: Client = new ClientMock(6, {}, {}) as any
      addMockClient(mockClient5)
      const mockClient6: Client = new ClientMock(7, {}, {}) as any
      addMockClient(mockClient6)
      command.onGameModeCommand(mockClient0, ['1'])
      command.onGameModeCommand(mockClient1, ['1'])
      command.onGameModeCommand(mockClient2, ['1'])
      const message: IServerClientMessage = {
        compression: Compression.NONE,
        data: {
          messageType: ServerClient.MessageType.CHAT,
          chat: {
            chatType: Chat.ChatType.COMMAND,
            message: GAMEMODE_NOT_ENOUGH_VOTES
          }
        }
      }
      const expectedMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(message)).finish()

      jest.advanceTimersByTime(GAMEMODE_VOTE_TIME)
      expect(webSocketServer.broadcastMessage).toHaveBeenLastCalledWith(expectedMessage)
      expect(webSocketServer.gameMode).toEqual(0)
    })

    it('should change game mode if enough players have voted', () => {
      const mockClient0: Client = new ClientMock(1, {}, {}) as any
      addMockClient(mockClient0)
      const mockClient1: Client = new ClientMock(2, {}, {}) as any
      addMockClient(mockClient1)
      const mockClient2: Client = new ClientMock(3, {}, {}) as any
      addMockClient(mockClient2)
      const mockClient3: Client = new ClientMock(4, {}, {}) as any
      addMockClient(mockClient3)
      const mockClient4: Client = new ClientMock(5, {}, {}) as any
      addMockClient(mockClient4)
      const mockClient5: Client = new ClientMock(6, {}, {}) as any
      addMockClient(mockClient5)
      const mockClient6: Client = new ClientMock(7, {}, {}) as any
      addMockClient(mockClient6)
      command.onGameModeCommand(mockClient0, ['1'])
      command.onGameModeCommand(mockClient1, ['1'])
      command.onGameModeCommand(mockClient2, ['2'])
      command.onGameModeCommand(mockClient3, ['3'])
      const message: IServerClientMessage = {
        compression: Compression.NONE,
        data: {
          messageType: ServerClient.MessageType.SERVER_MESSAGE,
          serverMessage: {
            messageType: ServerMessage.MessageType.GAME_MODE,
            gameMode: {
              gameMode: 1
            }
          }
        }
      }
      const expectedMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(message)).finish()

      jest.advanceTimersByTime(GAMEMODE_VOTE_TIME)
      expect(webSocketServer.broadcastMessage).toHaveBeenLastCalledWith(expectedMessage)
      expect(webSocketServer.gameMode).toEqual(1)
    })

    it('should accept one vote per client', () => {
      const mockClient0: Client = new ClientMock(1, {}, {}) as any
      addMockClient(mockClient0)
      const mockClient1: Client = new ClientMock(2, {}, {}) as any
      addMockClient(mockClient1)
      const mockClient2: Client = new ClientMock(3, {}, {}) as any
      addMockClient(mockClient2)
      command.onGameModeCommand(mockClient0, ['1'])
      command.onGameModeCommand(mockClient1, ['1'])
      command.onGameModeCommand(mockClient2, ['2'])
      command.onGameModeCommand(mockClient2, ['2'])
      command.onGameModeCommand(mockClient2, ['2'])
      const message: IServerClientMessage = {
        compression: Compression.NONE,
        data: {
          messageType: ServerClient.MessageType.SERVER_MESSAGE,
          serverMessage: {
            messageType: ServerMessage.MessageType.GAME_MODE,
            gameMode: {
              gameMode: 1
            }
          }
        }
      }
      const expectedMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(message)).finish()

      jest.advanceTimersByTime(GAMEMODE_VOTE_TIME)
      expect(webSocketServer.broadcastMessage).toHaveBeenLastCalledWith(expectedMessage)
      expect(webSocketServer.gameMode).toEqual(1)
    })

    it('should not work, if previous vote was within last 5min', () => {
      const mockClient: Client = new ClientMock(1, {}, {}) as any
      command.onGameModeCommand(mockClient, ['1'])
      jest.advanceTimersByTime(GAMEMODE_VOTE_TIME)
      command.onGameModeCommand(mockClient, ['1'])
      const message: IServerClientMessage = {
        compression: Compression.NONE,
        data: {
          messageType: ServerClient.MessageType.CHAT,
          chat: {
            chatType: Chat.ChatType.COMMAND,
            message: 'You must wait at least 5min until you can start the next gamemode vote.'
          }
        }
      }
      const expectedMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(message)).finish()

      expect(mockClient.sendMessage).toHaveBeenCalledWith(expectedMessage)
    })

    it('should not work, if command has invalid arguments', () => {
      const mockClient: Client = new ClientMock(1, {}, {}) as any
      command.onGameModeCommand(mockClient, ['a'])
      const message: IServerClientMessage = {
        compression: Compression.NONE,
        data: {
          messageType: ServerClient.MessageType.CHAT,
          chat: {
            chatType: Chat.ChatType.COMMAND,
            message: NAN_MESSAGE
          }
        }
      }
      const expectedMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(message)).finish()

      expect(mockClient.sendMessage).toHaveBeenCalledWith(expectedMessage)
    })

    it('should not work, if command has invalid amount of arguments', () => {
      const mockClient: Client = new ClientMock(1, {}, {}) as any
      command.onGameModeCommand(mockClient, ['1', '2'])
      const message: IServerClientMessage = {
        compression: Compression.NONE,
        data: {
          messageType: ServerClient.MessageType.CHAT,
          chat: {
            chatType: Chat.ChatType.COMMAND,
            message: TOO_MANY_ARGS_MESSAGE
          }
        }
      }
      const expectedMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(message)).finish()

      expect(mockClient.sendMessage).toHaveBeenCalledWith(expectedMessage)
    })

    it('should not work, if gamemode is already running', () => {
      webSocketServer.gameMode = 1
      const mockClient: Client = new ClientMock(1, {}, {}) as any
      command.onGameModeCommand(mockClient, ['1'])
      const message: IServerClientMessage = {
        compression: Compression.NONE,
        data: {
          messageType: ServerClient.MessageType.CHAT,
          chat: {
            chatType: Chat.ChatType.COMMAND,
            message: GAMEMODE_ALREADY_RUNNING_MESSAGE
          }
        }
      }
      const expectedMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(message)).finish()

      expect(mockClient.sendMessage).toHaveBeenCalledWith(expectedMessage)
    })
  })
})
