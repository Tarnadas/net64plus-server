import { gameMode } from './index'
import Packet, { PACKET_TYPE } from './Packet'

const CHARACTER = [
  'Mario', 'Luigi', 'Yoshi', 'Wario', 'Peach', 'Toad', 'Waluigi', 'Rosalina'
]

export default class Client {
  constructor (id, ws, onDisconnect, onChatMessage) {
    this.sendPacket = this.sendPacket.bind(this)
    this.onDisconnect = onDisconnect.bind(this, id)
    this.onChatMessage = onChatMessage
    this.onMessage = this.onMessage.bind(this)
    this.onHandshake = this.onHandshake.bind(this)
    this.onPlayerData = this.onPlayerData.bind(this)
    this.onCharacterSwitch = this.onCharacterSwitch.bind(this)

    this.id = id
    this.ws = ws
    ws.on('close', this.onDisconnect)
    ws.on('message', this.onMessage)
    ws.send('something')
  }

  sendPacket (type, payload) {
    const packet = Packet.create(type, payload)
    this.ws.send(packet)
  }

  onMessage (msg) {
    const bytes = new Uint8Array(msg)
    if (bytes[0] === PACKET_TYPE.PING) {
      // just send it back
      this.ws.send(msg)
    } else if (bytes[0] === PACKET_TYPE.CHAT_MESSAGE) {
      this.onChatMessage(msg)
    } else if (bytes[0] === PACKET_TYPE.HANDSHAKE) {
      this.onHandshake(msg)
    } else if (bytes[0] === PACKET_TYPE.PLAYER_DATA) {
      this.onPlayerData(msg)
    } else if (bytes[0] === PACKET_TYPE.CHARACTER_SWITCH) {
      this.onCharacterSwitch(msg)
    }
  }

  onHandshake (msg) {
    msg = Buffer.from(msg)
    this.major = msg.readUInt8(1)
    this.minor = msg.readUInt8(2)
    this.characterId = msg.readUInt8(3)
    this.characterName = CHARACTER[this.characterId]
    this.username = msg.slice(5, 5 + msg.readUInt8(4)).toString('utf8')

    // send ID back to client
    const payload = Buffer.allocUnsafe(1)
    payload.writeUInt8(this.id, 0)
    this.ws.send(Packet.create(PACKET_TYPE.HANDSHAKE, payload))

    // send current game mode
    const gameModePayload = Buffer.allocUnsafe(1)
    gameModePayload.writeUInt8(gameMode, 0)
    this.ws.send(Packet.create(PACKET_TYPE.GAME_MODE, gameModePayload))
  }

  onPlayerData (msg) {
    msg = Buffer.from(msg)
    msg.writeUInt8(this.id, 4)
    this.playerData = msg.slice(1)
  }

  onCharacterSwitch (msg) {
    msg = Buffer.from(msg)
    this.characterId = msg.readUInt8(1)
    this.characterName = CHARACTER[this.characterId]
  }
}
