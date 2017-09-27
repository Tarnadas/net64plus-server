import WebSocketServer from './WebSocketServer'

const PORT = 3678
const UPDATE_INTERVAL = 32

const server = new WebSocketServer(PORT)

export let gameMode = 1

const main = async () => {
  server.broadcastPlayerData()
  setTimeout(main, UPDATE_INTERVAL)
}
main()
