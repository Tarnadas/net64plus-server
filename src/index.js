import WebSocketServer from './WebSocketServer'
import WebHook from './WebHook'

import fs from 'fs'
import path from 'path'

export const CLIENT_VERSION_MAJOR = 0
export const CLIENT_VERSION_MINOR = 4
export const CLIENT_VERSION_PATCH = 1

const UPDATE_INTERVAL = 24
const DEFAULT_SETTINGS = {
  port: 3678,
  enableWebHook: false,
  name: 'A Net64+ Server',
  domain: '',
  description: 'The **best** Net64+ server ever\n\n:unicorn_face:',
  apiKey: ''
}

export let gameMode = 1

let settings = DEFAULT_SETTINGS
if (process.env.TARGET_ENV !== 'win32') {
  try {
    settings = JSON.parse(fs.readFileSync(path.join(__dirname, '../settings.json')))
  } catch (err) {
    console.log('Failed to find or parse settings.json file. Using default settings instead.')
  }
}

const server = new WebSocketServer(settings.port)
if (settings.enableWebHook) {
  const webHook = new WebHook(settings)
}

const main = async () => {
  server.broadcastMemoryData()
}

main()

setInterval(main, 24);
