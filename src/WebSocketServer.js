import zlib from 'zlib'

import Client from './Client'
import Packet, { PACKET_TYPE } from './Packet'

let Server
if (process.env.TARGET_ENV === 'win32') {
  Server = require('../compile/uws').Server
} else {
  Server = require('uws').Server
}

export default class WebSocketServer {
  constructor (port) {
    this.onConnection = this.onConnection.bind(this)
    this.port = port
    this.init()
  }

  init () {
    this.server = new Server({ port: this.port }, () => {
      console.log(`\nNet64+ ${process.env.VERSION} server successfully started!\nAccepting connections on Port ${this.port}`)
      if (process.env.TARGET_ENV === 'win32') {
        console.log('Connect locally via direct connect 127.0.0.1\nTo accept external connections, your Port must be forwarded.\nTo join via LAN, others must use your LAN IP address: win + "cmd" > ipconfig > IPv4 Address or via Hamachi network and IP')
        console.log('\nThis is a precompiled version of the Net64+ server. It has the limitation, that it cannot be displayed on the public server list. It is only meant to be used for user servers!\n')
      }
    })
    this.server.on('connection', this.onConnection)
    this.clients = []
    this.players = []
  }

  restart () {
    this.server.close()
    this.server = null
    this.init()
  }

  addPlayer (clientId, player) {
    this.players[clientId] = player
  }

  broadcastPlayerData () {
    const playerPacket = Packet.create(PACKET_TYPE.PLAYER_DATA, zlib.gzipSync(Buffer.concat(
      this.players
        .filter(player => player && player.playerData.readUInt8(3) !== 0)
        .map(player => {
          player.playerData.writeUInt8(player.client.id, 3)
          return player.playerData
        })
    )))
    for (const player of this.players) {
      if (!player) continue
      player.client.ws.send(playerPacket, {
        binary: true
      })
    }
  }

  onConnection (ws) {
    const id = this.clients.length
    if (id >= 24) {
      ws.send(Packet.create(PACKET_TYPE.SERVER_FULL))
      return
    }
    this.clients[id] = new Client(id + 1, this, ws)
    console.log(`Active users: ${this.clients.length}/24`)
  }
}
