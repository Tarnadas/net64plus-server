import { WebHook, URL_API } from './WebHook'
import mockAxios from 'jest-mock-axios'

beforeEach(() => {
  console.error = jest.fn()
})

afterEach(() => {
  mockAxios.reset()
})

describe('WebHook', () => {
  let webHook: WebHook

  beforeEach(() => {
    process.env.VERSION = '2.0'
    process.env.COMPAT_VERSION = '1.0'
    webHook = new WebHook(
      {
        name: 'name',
        domain: 'domain',
        description: 'description',
        port: 3678,
        passwordRequired: false,
        apiKey: 'apiKey'
      } as any,
      {
        ip: '127.0.0.1',
        country: 'Germany',
        countryCode: 'DE',
        latitude: 8,
        longitude: 42
      }
    )
  })

  it('should send post data to server', () => {
    const expectedBody = {
      name: 'name',
      domain: 'domain',
      description: 'description',
      port: 3678,
      passwordRequired: false,
      apiKey: 'apiKey',
      ip: '127.0.0.1',
      country: 'Germany',
      countryCode: 'DE',
      latitude: 8,
      longitude: 42,
      version: '2.0',
      compatVersion: '1.0'
    }
    const expectedHeaders = {
      headers: {
        Authorization: 'APIKEY apiKey'
      },
      responseType: 'json',
      timeout: 10000
    }

    expect(mockAxios.post).toHaveBeenCalledWith(URL_API, expect.objectContaining(expectedBody), expectedHeaders)
  })

  it('should display error message on wrong apiKey', async () => {
    mockAxios.mockError({
      response: {
        status: 401
      }
    })
    await new Promise((resolve) => setTimeout(resolve(), 0))

    expect(console.error).toHaveBeenCalledWith('Your API key seems to be wrong. Please check your settings!\nYour server won\'t be publicly visible')
  })
})
