import { Client } from './Client'

export class ClientMock implements Partial<Client> {
  constructor (public id: number, private readonly server: any, public readonly ws: any) {
    this.id = id
    this.server = server
    this.ws = ws
  }

  public sendMessage = jest.fn()
  public sendPlayerReorder = jest.fn()
}
