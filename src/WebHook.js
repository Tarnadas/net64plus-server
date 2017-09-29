import got from 'got'

import { players } from './Player'

const URL_LIST = 'http://smmdb.ddns.net/net64'
const URL_API = 'http://smmdb.ddns.net/api/net64server'
const URL_IP_API = 'http://ip-api.com/json'

const apiKey = Symbol('apiKey')

export default class WebHook {
  constructor (settings) {
    this.loop.bind(this)
    this.name = settings.name
    this.domain = settings.domain
    this.description = settings.description
    this.port = settings.port
    this[apiKey] = settings.apiKey;
    (async () => {
      try {
        const res = (await got(URL_IP_API, {
          json: true
        })).body
        if (res.query) this.ip = res.query
        if (res.country) this.country = res.country
        if (res.countryCode) this.countryCode = res.countryCode
        if (res.lat) this.lat = res.lat
        if (res.lon) this.lon = res.lon
        this.loop()
        console.log(`WebHook enabled. Your server will be displayed at ${URL_LIST}`)
      } catch (err) {
        console.log('WebHook disabled, because API service is down or you made too many requests (by restarting the server too often)')
      }
    })()
  }

  loop () {
    try {
      const body = Object.assign({}, this)
      body.toJSON = this.toJSON
      got(URL_API, {
        method: 'POST',
        headers: {
          Authorization: `APIKEY ${this[apiKey]}`
        },
        json: true,
        body
      })
    } catch (err) {
      if (err.statusCode && err.statusCode === 401) {
        console.error('Your API key seems to be wrong. Please check your settings!\nWebHook was disabled now')
        return
      } else {
        // fail silently. Server might be unreachable
        console.error(err)
      }
    }
    setTimeout(this.loop.bind(this), 10000)
  }

  toJSON () {
    return Object.assign(this, { players })
  }
}
