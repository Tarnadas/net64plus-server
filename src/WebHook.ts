import axios from 'axios'

import { webSocketServer } from './globals'
import { Settings } from './models/Settings.model'
import { Server } from './models/Server.model'

const URL_LIST = 'https://smmdb.ddns.net/net64'
export const URL_API = 'https://smmdb.ddns.net/api/net64server'

const apiKey = Symbol('apiKey')

if (process.env.NODE_ENV === 'test') {
  // @ts-ignore
  axios = axios.default
}

export class WebHook {
  private version: string

  private compatVersion: string

  private ip: string

  private port: number

  private domain: string

  private name: string

  private description: string

  private country: string

  private countryCode: string

  private latitude: number

  private longitude: number

  private passwordRequired: boolean

  private apiKey: string

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
    this.loop()
  }

  private loop = async () => {
    try {
      const body = Object.assign({}, this)
      body.toJSON = this.toJSON
      await axios.post(
        URL_API,
        body,
        {
          headers: this.apiKey ? {
            'Authorization': `APIKEY ${this.apiKey}`
          } : {}
        }
      )
    } catch (err) {
      if (err.response && err.response.status === 401) {
        console.error('Your API key seems to be wrong. Please check your settings!\nWebHook was disabled now')
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
