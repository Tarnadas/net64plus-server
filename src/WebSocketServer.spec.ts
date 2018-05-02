import { WebSocketServer, PLAYER_DATA_COMPRESSION_THRESHOLD } from './WebSocketServer'

describe('WebSocketServer', () => {
  describe('#onMessage', () => {
    it('should compress player data message, if amount of players is above threshold', () => {})
  })

  describe('#addPlayer', () => {
    it('should add player', () => {})
    it('should grant server token to player, if it is the first player to join', () => {})
    it('should broadcast player list update', () => {})
  })

  describe('#removePlayer', () => {
    it('should remove player', () => {})
    it('should grant new server token, if leaving player was the one holding the token', () => {})
    it('should broadcast player list update', () => {})
  })
})
