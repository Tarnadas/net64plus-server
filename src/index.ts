import axios from 'axios'

import { webSocketServer, setWebSocketServer } from './globals'
import { WebSocketServer } from './WebSocketServer'
import { WebHook } from './WebHook'
import { Server } from './models/Server.model'
import { Arguments } from './Arguments'

const UPDATE_INTERVAL = 32
const PORT_CHECK_API = 'https://smmdb.ddns.net/api/v2/net64/portcheck'

const args = new Arguments()
const settings = args.settings

const portCheck = async (port: number): Promise<Server | undefined> => {
  console.info(`Checking whether port ${port} is open...`)
  try {
    const url = `${PORT_CHECK_API}?port=${port}`
    const res = (await axios.get(url, {
      timeout: 10000,
      responseType: 'json'
    })).data
    console.info('Looks like we got in there')
    return res
  } catch (err) {
    if (err.response && err.response.status === 400 && err.response.data === 'Port is closed') {
      return
    }
    console.warn(`WARNING: Port check did not succeed. We could not check whether you set up proper port forwarding, sorry.`)
  }
}

(async () => {
  setWebSocketServer(new WebSocketServer(settings))
  let serverData: Server | undefined = await portCheck(settings.port)
  const isOnline = !!serverData
  if (!isOnline) {
    if (settings.enableWebHook) {
      console.warn(`ERROR: Cannot host a public server if Port check failed.`)
      process.exit(1)
    } else {
      console.warn(`WARNING: Port check failed.`)
    }
  }
  if (isOnline) {
    if (settings.enableWebHook) {
      if (!settings.apiKey) {
        console.error('ERROR: You must set an apiKey, if you want to be listed on the server list. Either add an apiKey or disable web hook.')
        process.exit(1)
      }
      const webHook = new WebHook(settings, serverData!)
    }
  }
  webSocketServer.start(serverData)

  const main = () => {
    webSocketServer.broadcastData()
  }
  setInterval(main, UPDATE_INTERVAL)
})()

process.on('uncaughtException', (err: Error) => {
  console.warn(`An unexpected error occured and the server is performing an automatic restart. Please report this issue:\n\n${err}`)
  process.exit(1)
})
