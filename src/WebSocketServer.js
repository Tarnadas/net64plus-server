import { Server } from 'uws'

import Client from './Client'

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
