import { gameMode } from './index'
import Packet, { PACKET_TYPE } from './Packet'

const CHARACTER = [
  'Mario', 'Luigi', 'Yoshi', 'Wario', 'Peach', 'Toad', 'Waluigi', 'Rosalina'
]

export const players = []

export default class Player {
  constructor (client, msg) {
    this.client = client
    this.major = msg.readUInt8(1)
    this.minor = msg.readUInt8(2)
    this.characterId = msg.readUInt8(3)
    this.characterName = CHARACTER[this.characterId]
    const usernameOffset = 5 + msg.readUInt8(4)
    this.username = msg.slice(5, usernameOffset).toString('utf8')

    // send ID back to client
    const payload = Buffer.allocUnsafe(1)
    payload.writeUInt8(client.id, 0)
    client.ws.send(Packet.create(PACKET_TYPE.HANDSHAKE, payload))

    // send current game mode
    const gameModePayload = Buffer.allocUnsafe(1)
    gameModePayload.writeUInt8(gameMode, 0)
    client.ws.send(Packet.create(PACKET_TYPE.GAME_MODE, gameModePayload))

    players[client.id - 1] = this
  }

  setPlayerData (playerData) {
    this.playerData = playerData
  }

  switchCharacter (characterId) {
    this.characterId = characterId
    this.characterName = CHARACTER[characterId]
  }
}
