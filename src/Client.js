import Player from './Player'
import Packet, { PACKET_TYPE } from './Packet'

export default class Client {
  constructor (id, ws, onDisconnect, onChatMessage) {
    this.onChatMessage = onChatMessage

    this.id = id
    this.ws = ws
    ws.on('close', onDisconnect.bind(this))
    ws.on('message', this.onMessage.bind(this))
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
    this.player = new Player(this, Buffer.from(msg))
  }

  onPlayerData (msg) {
    console.log(`set player data ${this.id} ${this.player.username}: ${Buffer.from(msg).slice(1).toString()}`)
    this.player.playerData = Buffer.from(msg).slice(1)
  }

  onCharacterSwitch (msg) {
    msg = Buffer.from(msg)
    this.player.switchCharacter(msg.readUInt8(1))
  }
}
