import Packet, { PACKET_TYPE } from './Packet'

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
    }
  }
}
