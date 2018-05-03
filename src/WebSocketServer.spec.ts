import { WebSocketServer, PLAYER_DATA_COMPRESSION_THRESHOLD } from './WebSocketServer'
import { ClientMock } from './Client.mock'

describe('WebSocketServer', () => {
  let server: WebSocketServer

  beforeEach(() => {
    server = new WebSocketServer({
      port: 3678,
      gamemode: 1,
      enableGamemodeVote: true,
      name: 'A Server',
      domain: '',
      description: 'A description'
    })
    console.info = jest.fn()
  })

  describe('#onMessage', () => {
    it('should compress player data message, if amount of players is above threshold')
  })

  describe('#addPlayer', () => {
    it('should add player')
    it('should grant server token to player, if it is the first player to join')
    it('should broadcast player list update')
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
