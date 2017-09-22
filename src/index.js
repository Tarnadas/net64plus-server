import WebSocketServer from './WebSocketServer'
import { GAME_MODE } from './GameMode'

const PORT = 8080
const UPDATE_INTERVAL = 64

export const server = new WebSocketServer(PORT)
export const memory = Buffer.alloc(0x240)

export let gameMode = GAME_MODE.NORMAL

const main = async () => {
  setTimeout(main, UPDATE_INTERVAL)
}
main()
