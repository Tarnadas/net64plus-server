import WebSocketServer from './WebSocketServer'
import WebHook from './WebHook'

import fs from 'fs'
import path from 'path'

export const CLIENT_VERSION_MAJOR = 0
export const CLIENT_VERSION_MINOR = 4
export const CLIENT_VERSION_PATCH = 1

const UPDATE_INTERVAL = 24

export let gameMode = 1

try {
  const settings = JSON.parse(fs.readFileSync(path.join(__dirname, '../settings.json')))

  const server = new WebSocketServer(settings.port)
  if (settings.enableWebHook) {
    const webHook = new WebHook(settings)
  }

  const main = async () => {
    server.broadcastPlayerData()
    setTimeout(main, UPDATE_INTERVAL)
  }
  main()
} catch (err) {
  console.error('No settings.json provided')
}
