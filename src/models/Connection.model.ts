export class ConnectionError extends Error {
  constructor (public message: string, public errorType: number) {
    super(message)
    Object.setPrototypeOf(this, ConnectionError)
  }
}
