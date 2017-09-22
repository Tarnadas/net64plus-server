import { gameMode } from './index'
import Packet, { PACKET_TYPE } from './Packet'
import { GAME_MODE_OFFSET } from './GameMode'

export default class Client {
  constructor (id, ws, onDisconnect, onChatMessage) {
    this.sendPacket = this.sendPacket.bind(this)
    this.onDisconnect = onDisconnect.bind(this, id)
    this.onChatMessage = onChatMessage
    this.onMessage = this.onMessage.bind(this)

    this.id = id
    this.ws = ws
    ws.on('close', this.onDisconnect)
    ws.on('message', this.onMessage)
    ws.send('something')
  }

  sendPacket (type, payload) {
    const packet = Packet.create(type, payload)
    console.log('send message:')
    console.log(packet)
    this.ws.send(packet)
  }

  onMessage (msg) {
    console.log('received message:')
    console.log(Buffer.from(msg))

    const bytes = new Uint8Array(msg)
    if (bytes[0] === PACKET_TYPE.PING) {
      // just send it back
      this.ws.send(msg)
    } else if (bytes[0] === PACKET_TYPE.CHAT_MESSAGE) {
      this.onChatMessage(msg)
    } else if (bytes[0] === PACKET_TYPE.HANDSHAKE) {
      msg = Buffer.from(msg)
      this.major = msg.readUInt8(1)
      this.minor = msg.readUInt8(2)
      this.characterId = msg.readUInt8(3)
      this.username = msg.slice(5, 5 + msg.readUInt8(4)).toString('utf8')

      // send ID back to client
      const payload = Buffer.allocUnsafe(1)
      payload.writeUInt8(this.id, 0)
      this.ws.send(Packet.create(PACKET_TYPE.MEMORY_WRITE, payload))

      // send current game mode
      const gameModePayload = Buffer.allocUnsafe(8)
      gameModePayload.writeUInt32LE(GAME_MODE_OFFSET, 0)
      gameModePayload.writeUInt32LE(gameMode, 4)
      this.ws.send(Packet.create(PACKET_TYPE.MEMORY_WRITE, gameModePayload))
    }
  }
}
