import { WebSocketServer } from './WebSocketServer'

export let webSocketServer: WebSocketServer
export function setWebSocketServer (server: WebSocketServer): void {
  webSocketServer = server
}
