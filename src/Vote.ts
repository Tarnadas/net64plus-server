import { webSocketServer } from './globals'
import { Client } from './Client'
import { IServerClientMessage, Compression, ServerClient, Chat, ServerClientMessage } from './proto/ServerClientMessage'

export class Vote {
  public static lastVotes: {[key: string]: number} = {}

  private votes: {[vote: number]: number} = {}

  private readonly clientsAlreadyVoted: number[] = []

  private readonly timer: NodeJS.Timer

  constructor (
    private readonly timeout: number,
    private readonly onSuccess: (winner: number) => void,
    private readonly onReject: () => void
  ) {
    this.timer = setTimeout(this.onVoteEnd, timeout)
  }

  private readonly onVoteEnd = () => {
    let winners: number[] = []
    let maxVote = 0
    const voteEntries = Object.entries(this.votes)
    for (const [key, vote] of voteEntries) {
      const i = Number(key)
      if (vote > maxVote) {
        maxVote = vote
        winners = [i]
      } else if (vote === maxVote) {
        winners.push(i)
      }
    }
    const voteAmount = voteEntries.reduce((sum, vote) => sum + vote[1], 0)
    if (voteAmount >= Math.ceil(webSocketServer.clients.filter(client => !!client).length / 2)) {
      this.onSuccess(winners[Math.floor(Math.random() * winners.length)])
    } else {
      this.onReject()
    }
  }

  public acceptVote (client: Client, vote: number): void {
    const clientId = client.id
    if (this.clientsAlreadyVoted.includes(clientId)) return
    const command: IServerClientMessage = {
      compression: Compression.NONE,
      data: {
        messageType: ServerClient.MessageType.CHAT,
        chat: {
          chatType: Chat.ChatType.COMMAND,
          message: 'Vote accepted!'
        }
      }
    }
    const commandMessage = ServerClientMessage.encode(ServerClientMessage.fromObject(command)).finish()
    client.sendMessage(commandMessage)
    this.clientsAlreadyVoted.push(clientId)
    this.votes[vote] = (this.votes[vote] || 0) + 1
    const clientsWithoutVotes =
      webSocketServer.clients.filter(client => client).length - this.clientsAlreadyVoted.length
    if (clientsWithoutVotes === 0) {
      this.onVoteEnd()
      clearTimeout(this.timer)
    }
  }
}
