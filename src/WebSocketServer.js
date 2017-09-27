import { Server } from 'uws'

import zlib from 'zlib'

import { players } from './Player'
import Client from './Client'
import Packet, { PACKET_TYPE } from './Packet'

const clients = []

export default class WebSocketServer {
  constructor (port) {
    this.onConnection = this.onConnection.bind(this)
    this.onChatMessage = this.onChatMessage.bind(this)

    this.server = new Server({ port })
    this.server.on('connection', this.onConnection)
  }

  broadcastPlayerData () {
    const playerPacket = Packet.create(PACKET_TYPE.PLAYER_DATA, zlib.gzipSync(Buffer.concat(
      Array.from((function * () {
        for (const player of players) {
          if (player.playerData) yield player.playerData
        }
      })())
    )))
    for (let player of players) {
      player.client.ws.send(playerPacket)
    }
  }

  onConnection (ws) {
    const id = clients.length
    if (id >= 24) {
      // server full
      return
    }
    clients[id] = new Client(id + 1, ws, this.onDisconnect, this.onChatMessage)
    console.log('a user connected')
    console.log(`active users: ${clients.length}/24`)
  }

  onDisconnect () {
    const id = this.id
    console.log('before dc')
    console.log(clients)
    const last = clients.length - 1
    clients[last].id = id
    clients[id - 1] = clients[last]
    if (clients[last].player) {
      players[id - 1] = players[last]
      players.splice(-1, 1)
    }
    clients.splice(-1, 1)
    if (clients[id - 1]) {
      const idBuf = Buffer.allocUnsafe(1)
      idBuf.writeUInt8(id, 0)
      clients[id - 1].ws.send(Packet.create(PACKET_TYPE.HANDSHAKE, idBuf))
    }
    console.log('a user disconnected')
    console.log(`active users: ${clients.length}/24`)
    console.log('after dc')
    console.log(clients)
  }

  onChatMessage (msg) {
    // broadcast to all players
    for (const player of players) {
      player.client.ws.send(msg)
    }
  }
}
