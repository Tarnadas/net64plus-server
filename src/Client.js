import { webSocketServer } from '.'
import Player from './Player'
import Packet, { PACKET_TYPE } from './Packet'

export default class Client {
  constructor (id, server, ws) {
    this.id = id
    this.server = server
    this.ws = ws
    ws.on('close', this.onDisconnect.bind(this, server))
    ws.on('message', this.onMessage.bind(this))
  }

  sendPacket (type, payload) {
    const packet = Packet.create(type, payload)
    this.ws.send(packet)
  }

  onDisconnect (server) {
    if (webSocketServer !== server) return
    const id = this.id
    const clients = server.clients
    const last = clients.length - 1
    clients[last].id = id
    if (!clients[last]) {
      console.error('CLIENTS', JSON.stringify(clients))
      return
    }
    clients[id - 1] = clients[last]
    if (clients[last].player) {
      const players = server.players
      players[id - 1] = players[last]
      players.splice(-1, 1)
    }
    clients.splice(-1, 1)
    if (clients[id - 1]) {
      const idBuf = Buffer.allocUnsafe(1)
      idBuf.writeUInt8(id, 0)
      clients[id - 1].ws.send(Packet.create(PACKET_TYPE.HANDSHAKE, idBuf))
    }
    console.log(`Active users: ${clients.length}/24`)
  }

  onMessage (msg) {
    const bytes = new Uint8Array(msg)
    switch (bytes[0]) {
      case PACKET_TYPE.PING:
        this.ws.send(msg)
        break
      case PACKET_TYPE.CHAT_MESSAGE:
        this.onChatMessage(msg)
        break
      case PACKET_TYPE.HANDSHAKE:
        this.onHandshake(msg)
        break
      case PACKET_TYPE.PLAYER_DATA:
        this.onMemoryData(msg)
        break
      case PACKET_TYPE.CHARACTER_SWITCH:
        this.onCharacterSwitch(msg)
        break
    }
  }

  onChatMessage (msg) {
    for (const player of this.server.players) {
      player.client.ws.send(msg)
    }
  }

  onHandshake (msg) {
    try {
      this.player = new Player(this, Buffer.from(msg))
      webSocketServer.addPlayer(this.id - 1, this.player)
    } catch (err) {
      console.error(err)
    }
  }

  onPlayerData (msg) {
    if (!this.player) return
    try {
      Buffer.from(msg).slice(1).copy(this.player.playerData)
    } catch (err) {
      this.ws.close()
      console.error(err)
    }
  }

  onCharacterSwitch (msg) {
    msg = Buffer.from(msg)
    this.player.switchCharacter(msg.readUInt8(1))
  }
}
