import { CLIENT_VERSION_MAJOR, CLIENT_VERSION_MINOR, gameMode } from './index'
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
    if (this.major !== CLIENT_VERSION_MAJOR || this.minor !== CLIENT_VERSION_MINOR) {
      const payload = Buffer.allocUnsafe(2)
      payload.writeUInt8(CLIENT_VERSION_MAJOR, 0)
      payload.writeUInt8(CLIENT_VERSION_MINOR, 1)
      client.ws.send(Packet.create(PACKET_TYPE.WRONG_VERSION, payload))
      return
    }
    this.characterId = msg.readUInt8(3)
    this.characterName = CHARACTER[this.characterId]
    const usernameOffset = 5 + msg.readUInt8(4)
    this.username = msg.slice(5, usernameOffset).toString('utf8')
    this.playerData = Buffer.alloc(0x18)

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

  switchCharacter (characterId) {
    this.characterId = characterId
    this.characterName = CHARACTER[characterId]
  }
}
