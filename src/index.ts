import axios from 'axios'

import * as fs from 'fs'
import * as path from 'path'

import { WebSocketServer } from './WebSocketServer'
import { WebHook } from './WebHook'
import { DEFAULT_SETTINGS } from './models/Settings.model'
import { Server } from './models/Server.model'

const UPDATE_INTERVAL = 128
const URL_IP_API = 'http://freegeoip.net/json/'

export let webSocketServer: WebSocketServer
export const setWebSocketServer = (server: WebSocketServer) => {
  webSocketServer = server
}

let settings = DEFAULT_SETTINGS
if (process.env.TARGET_ENV !== 'win32') {
  try {
    settings = JSON.parse(fs.readFileSync(path.join(__dirname, '../settings.json'), {
      encoding: 'utf8'
    }))
  } catch (err) {
    console.info('Failed to find or parse settings.json file. Using default settings instead.')
  }
}

const init = async () => {
  try {
    const res = (await axios.get(URL_IP_API, {
      responseType: 'json'
    })).data
    return {
      ip: res.ip,
      country: res.country_name,
      countryCode: res.country_code,
      latitude: res.latitude,
      longitude: res.longitude
    }
  } catch (err) {
    console.error('It looks like you are offline. The server won\'t be able to start until you have an internet connection.')
    throw err
  }
}

(async () => {
  let serverData: Server = await init()
  webSocketServer = new WebSocketServer(settings, serverData)
  if (settings.enableWebHook) {
    if (!settings.apiKey) {
      throw new Error('You must set an apiKey, if you want to be listed on the server list. Either add an apiKey or disable web hook.')
    }
    const webHook = new WebHook(settings, serverData)
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
})()

/* process.on('uncaughtException', (err: Error) => {
  performRestart = true
  console.warn(`An unexpected error occured and the server is performing an automatic restart. Please report this issue:\n\n${err}`)
}) */
