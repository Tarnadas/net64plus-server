import WebSocketServer from './WebSocketServer'

export const VERSION_MAJOR = 0
export const VERSION_MINOR = 3

const PORT = 3678
const UPDATE_INTERVAL = 16

const server = new WebSocketServer(PORT)

export let gameMode = 1

const main = async () => {
  server.broadcastPlayerData()
  setTimeout(main, UPDATE_INTERVAL)
}
main()
