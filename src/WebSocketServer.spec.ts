import { setWebSocketServer } from './globals'
import { WebSocketServer } from './WebSocketServer'
import { Client } from './Client'
import { ClientMock } from './Client.mock'
import { Player } from './Player'
import {
  Compression,
  IServerClientMessage,
  ServerClient,
  ServerClientMessage,
  ServerMessage
} from './proto/ServerClientMessage'

describe('WebSocketServer', () => {
  let server: WebSocketServer

  beforeEach(() => {
    server = new WebSocketServer({
      port: 3678,
      gamemode: 1,
      enableGamemodeVote: true,
      passwordRequired: false,
      password: '',
      name: 'A Server',
      domain: '',
      description: 'A description'
    })
    setWebSocketServer(server)
    console.info = jest.fn()
  })

  afterEach(() => {
    (server as any).server.stop()
  })

  describe('#onMessage', () => {
    it('should compress player data message, if amount of players is above threshold')
  })

  describe('#addPlayer', () => {
    let mockClients: Client[] = []
    let mockPlayers: Player[] = []

    beforeEach(() => {
      mockClients.push(new ClientMock(0, {}, {}) as any)
      mockPlayers.push(new Player(mockClients[0], 'username', 0))
      server.broadcastMessageAll = jest.fn()
    })

    it('should add player', () => {
      server.addPlayer(mockPlayers[0])

      expect(server.players).toHaveLength(1)
      expect(server.players[0]).toBe(mockPlayers[0])
    })

    describe('token grant', () => {
      it('should grant server token to player, if it is the first player to join', () => {
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

        server.addPlayer(mockPlayers[0])

        expect(mockClients[0].sendMessage).toHaveBeenCalledWith(serverTokenMessage)
      })

      it('should not grant server token to player, if it is not the first player to join', () => {
        mockClients.push(new ClientMock(1, {}, {}) as any)
        mockPlayers.push(new Player(mockClients[1], 'username2', 4))
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

        server.addPlayer(mockPlayers[0])
        server.addPlayer(mockPlayers[1])

        expect(mockClients[1].sendMessage).not.toHaveBeenCalledWith(serverTokenMessage)
      })
    })

    it('should broadcast player list update', () => {
      const playerMsg: IServerClientMessage = {
        compression: Compression.NONE,
        data: {
          messageType: ServerClient.MessageType.PLAYER_LIST_UPDATE,
          playerListUpdate: {
            playerUpdates: [
              {
                player: {
                  username: 'username',
                  characterId: 0
                },
                playerId: 0
              }
            ]
          }
        }
      }
      const playerMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(playerMsg)).finish()

      server.addPlayer(mockPlayers[0])

      expect(server.broadcastMessageAll).toHaveBeenCalledWith(playerMessage)
    })
  })

  describe('#removePlayer', () => {
    it('should remove player')
    it('should grant new server token, if leaving player was the one holding the token')
    it('should broadcast player list update')
  })

  describe('#reorderPlayers', () => {
    it('should reorder players', () => {
      server.clients = [
        undefined,
        new ClientMock(1, {}, {}),
        new ClientMock(2, {}, {}),
        undefined,
        undefined,
        new ClientMock(5, {}, {}),
        undefined,
        new ClientMock(7, {}, {}),
        undefined
      ] as any
      server.players = [
        undefined,
        { id: 1 },
        { id: 2 },
        undefined,
        undefined,
        { id: 5 },
        undefined,
        { id: 7 },
        undefined
      ] as any
      const expected: any = [ undefined, 1, 2, 3, 4 ]

      server.reorderPlayers()

      expect(server.clients.map(client => client ? client.id : undefined)).toEqual(expected)
    })
  })
})
