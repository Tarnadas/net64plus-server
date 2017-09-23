import { Server } from 'uws'

import Client from './Client'
import Packet, { PACKET_TYPE } from './Packet'

const clients = []

export default class WebSocketServer {
  constructor (port) {
    this.onConnection = this.onConnection.bind(this)
    this.onDisconnect = this.onDisconnect.bind(this)
    this.onPlayerCountUpdate = this.onPlayerCountUpdate.bind(this)
    this.onChatMessage = this.onChatMessage.bind(this)

    this.server = new Server({ port })
    this.server.on('connection', this.onConnection)
  }

  broadcastPlayerData () {
    for (let i in clients) {
      for (let j in clients) {
        if (i !== j && clients[i].connected && clients[j].playerData) {
          clients[i].ws.send(Packet.create(PACKET_TYPE.PLAYER_DATA, clients[j].playerData))
        }
      }
    }
  }

  onConnection (ws) {
    const id = clients.length
    if (id >= 255) {
      // server full
      return
    }
    clients[id] = new Client(id + 1, ws, this.onDisconnect, this.onChatMessage)
    this.onPlayerCountUpdate()
    console.log('a user connected')
  }

  onDisconnect (id) {
    clients[id - 1] = clients[clients.length - 1]
    delete clients[clients.length - 1]
    const idBuf = Buffer.allocUnsafe(1)
    idBuf.writeUInt8(id, 0)
    clients[id - 1].ws.send(Packet.create(PACKET_TYPE.HANDSHAKE, idBuf))
    this.onPlayerCountUpdate()
    console.log('a user disconnected')
  }

  onPlayerCountUpdate () {
    const countBuf = Buffer.allocUnsafe(1)
    countBuf.writeUInt8(clients.length, 0)
    const countPacket = Packet.create(PACKET_TYPE.PLAYER_COUNT, countBuf)
    for (const client of clients) {
      client.ws.send(countPacket)
    }
  }

  onChatMessage (msg) {
    // broadcast to all clients
    for (const client of clients) {
      client.ws.send(msg)
    }
  }
}
