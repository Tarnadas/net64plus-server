import { WebSocketServer } from './WebSocketServer'
import { WebHook } from './WebHook'
import { DEFAULT_SETTINGS } from './models/Settings.model'

import * as fs from 'fs'
import * as path from 'path'

export const CLIENT_VERSION_MAJOR = 0
export const CLIENT_VERSION_MINOR = 4

const UPDATE_INTERVAL = 32

export let gameMode = 1

let settings = DEFAULT_SETTINGS
if (process.env.TARGET_ENV !== 'win32') {
  try {
    settings = JSON.parse(fs.readFileSync(path.join(__dirname, '../settings.json'), {
      encoding: 'utf8'
    }))
  } catch (err) {
    console.log('Failed to find or parse settings.json file. Using default settings instead.')
  }
}

export const webSocketServer = new WebSocketServer(settings.port)
if (settings.enableWebHook) {
  const webHook = new WebHook(settings)
}

let performRestart = false
const main = () => {
  if (performRestart) {
    webSocketServer.restart()
    performRestart = false
    return
  }
  webSocketServer.broadcastData()
}
setInterval(main, UPDATE_INTERVAL)

/* process.on('uncaughtException', (err: Error) => {
  performRestart = true
  console.warn(`An unexpected error occured and the server is performing an automatic restart. Please report this issue:\n\n${err}`)
}) */
