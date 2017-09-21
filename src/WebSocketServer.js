import { Server } from 'uws'

import Client from './Client'
import { PACKET_TYPE } from './Packet'

const clients = []

export default class WebSocketServer {
  constructor (port) {
    this.server = new Server({ port })
    this.server.on('connection', ws => {
      let id = -1
      for (let i = 0; i < 24; i++) {
        if (!clients[i]) {
          clients[i] = new Client(i, ws, this.onDisconnect, this.onChatMessage)
          id = i
          break
        }
      }
      if (id !== -1) {
        // send ID back to client
        const payload = Buffer.allocUnsafe(1)
        payload.writeUInt8(id, 0)
        clients[id].sendPacket(PACKET_TYPE.MEMORY_WRITE, payload)
        console.log('a user connected')
      } else {
        // server full
      }
    })
  }

  onDisconnect (id) {
    delete clients[id]
    console.log('a user disconnected')
  }

  onChatMessage (msg) {
    // broadcast to all clients
    for (const client of clients) {
      client.ws.send(msg)
    }
  }
}
