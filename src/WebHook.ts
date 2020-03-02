import axios from 'axios'

import { webSocketServer } from './globals'
import { Settings } from './models/Settings.model'
import { Server } from './models/Server.model'

export const URL_API = 'https://smmdb.net/api/net64server'

if (process.env.NODE_ENV === 'test') {
  // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
  // @ts-ignore
  axios = axios.default
}

export class WebHook {
  private readonly version: string

  private readonly compatVersion: string

  private id?: string

  private readonly ip: string

  private readonly port: number

  private readonly domain: string

  private readonly name: string

  private readonly description: string

  private readonly country: string

  private readonly countryCode: string

  private readonly latitude: number

  private readonly longitude: number

  private readonly passwordRequired: boolean

  private readonly apiKey: string

  private readonly isDedicated: boolean

  constructor (
    { name, domain, description, port, passwordRequired, apiKey }: Omit<Settings, 'gamemode'>,
    { ip, country, countryCode, latitude, longitude }: Server
  ) {
    this.version = process.env.VERSION!
    this.compatVersion = process.env.COMPAT_VERSION!
    this.ip = ip
    this.port = port
    this.domain = domain
    this.name = name
    this.description = description
    this.country = country
    this.countryCode = countryCode
    this.latitude = latitude
    this.longitude = longitude
    this.passwordRequired = passwordRequired
    this.apiKey = apiKey!
    this.isDedicated = !process.env.IS_EXECUTABLE
    this.loop()
  }

  private readonly loop = async () => {
    try {
      const body = Object.assign({}, this)
      body.toJSON = this.toJSON
      const url = `${URL_API}${this.id ? `?id=${this.id}` : ''}`
      const res = (await axios.post(
        url,
        body,
        {
          timeout: 10000,
          headers: this.apiKey ? {
            Authorization: `APIKEY ${this.apiKey}`
          } : {},
          responseType: 'json'
        }
      )).data
      this.id = res.id
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.warn('WARNING: Your API key seems to be wrong. Please check your settings!\nYour server won\'t be publicly visible')
        return
      } else {
        // fail silently. Server might be unreachable
      }
    }
    setTimeout(this.loop, 10000)
  }

  private toJSON () {
    return Object.assign(this, {
      players: webSocketServer.players.filter(player => player),
      gameMode: webSocketServer.gameMode || 0
    })
  }
}
