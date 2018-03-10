import axios from 'axios'

import { webSocketServer } from '.'
import { Settings } from './models/Settings.model'

const URL_LIST = 'https://smmdb.ddns.net/net64'
const URL_API = 'https://smmdb.ddns.net/api/net64server'
const URL_IP_API = 'http://ip-api.com/json'

const apiKey = Symbol('apiKey')

export class WebHook {
  private name: string

  private ip?: string

  private domain: string

  private description: string

  private port: number

  private apiKey?: string

  private country?: string

  private countryCode?: string

  private latitude?: number

  private longitude?: number

  constructor ({ name, domain, description, port, apiKey }: Settings) {
    this.loop = this.loop.bind(this)
    this.name = name
    this.domain = domain
    this.description = description
    this.port = port
    this.apiKey = apiKey
    this.init()
  }

  private async init (): Promise<void> {
    try {
      const res = (await axios.get(URL_IP_API, {
        responseType: 'json'
      })).data
      if (res.query) this.ip = res.query
      if (res.country) this.country = res.country
      if (res.countryCode) this.countryCode = res.countryCode
      if (res.lat) this.latitude = res.lat
      if (res.lon) this.longitude = res.lon
      this.loop(true)
    } catch (err) {
      console.warn('WebHook disabled, because API service is down or you made too many requests (by restarting the server too often)')
    }
  }

  private loop = async (firstRun = false) => {
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
    return Object.assign(this, { players: webSocketServer.players.filter(player => player) })
  }
}
