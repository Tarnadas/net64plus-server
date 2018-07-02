import axios from 'axios'

import * as fs from 'fs'
import * as path from 'path'

import { WebSocketServer } from './WebSocketServer'
import { WebHook } from './WebHook'
import { DEFAULT_SETTINGS } from './models/Settings.model'
import { Server } from './models/Server.model'

const UPDATE_INTERVAL = 32
const URL_IP_API = 'http://ip-api.com/json'

export let webSocketServer: WebSocketServer

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
      ip: res.query,
      country: res.country,
      countryCode: res.countryCode,
      latitude: res.lat,
      longitude: res.lon
    }
  } catch (err) {
    console.warn('It looks like you are offline. The server will be starting in offline mode')
  }
}

(async () => {
  let serverData: Server | undefined = await init()
  webSocketServer = new WebSocketServer(settings, serverData)
  if (settings.enableWebHook && serverData) {
    if (!settings.apiKey) {
      throw new Error('You must set an apiKey, if you want to be listed on the server list. Either add an apiKey or disable web hook.')
    }
    const webHook = new WebHook(settings, serverData)
  }

  const main = () => {
    webSocketServer.broadcastData()
  }
  setInterval(main, UPDATE_INTERVAL)
})()

process.on('uncaughtException', (err: Error) => {
  console.warn(`An unexpected error occured and the server is performing an automatic restart. Please report this issue:\n\n${err}`)
  process.exit(1)
})
