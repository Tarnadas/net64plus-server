import { Server } from 'uws'

import Client from './Client'
import Packet, { PACKET_TYPE } from './Packet'

const clients = []

export default class WebSocketServer {
  constructor (port) {
    this.onConnection = this.onConnection.bind(this)
    this.onDisconnect = this.onDisconnect.bind(this)
    this.onChatMessage = this.onChatMessage.bind(this)

    this.server = new Server({ port })
    this.server.on('connection', this.onConnection)
  }

  broadcastPlayerData () {
    for (let i in clients) {
      for (let j in clients) {
        if (i !== j && clients[i] && clients[j] && clients[j].playerData) {
          clients[i].ws.send(Packet.create(PACKET_TYPE.PLAYER_DATA, clients[j].playerData))
        }
      }
    }
  }

  onConnection (ws) {
    for (let i = 0; i < 24; i++) {
      if (!clients[i]) {
        clients[i] = new Client(i + 1, ws, this.onDisconnect, this.onChatMessage)
        console.log('a user connected')
        return
      }
    }
    // server full
  }

  onDisconnect (id) {
    delete clients[id - 1]
    console.log('a user disconnected')
  }

  onChatMessage (msg) {
    // broadcast to all clients
    for (const client of clients) {
      client.ws.send(msg)
    }
  }
}
