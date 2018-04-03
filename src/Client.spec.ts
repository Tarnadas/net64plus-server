import { webSocketServer } from '.'
import { Client, CONNECTION_TIMEOUT } from './Client'

const addClient = (client: Client) => {
  webSocketServer.clients[client.id] = client
}

describe('Client', () => {
  let client: Client

  beforeEach(() => {
    jest.useFakeTimers()
    webSocketServer! = {
      clients: [],
      players: []
    } as any
    client = new Client(1, {
      on: jest.fn()
    } as any)
    addClient(client)
  })

  it('should automatically disconnect, if no handshake and player data gets received in timeout interval', () => {
    expect(webSocketServer.clients[client.id]).toBeDefined()
    jest.advanceTimersByTime(CONNECTION_TIMEOUT)

    expect(webSocketServer.clients[client.id]).toBeUndefined()
  })
})
