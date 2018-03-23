import { webSocketServer } from '.'

export class Vote {
  public static lastVotes: {[key: string]: number} = {}

  private votes: {[vote: number]: number} = {}

  private clientsAlreadyVoted: number[] = []

  private timer: NodeJS.Timer

  constructor (private timeout: number, private onSuccess: (winner: number) => void) {
    this.timer = setTimeout(this.onVoteEnd, timeout)
  }

  private onVoteEnd = () => {
    let winners: number[] = []
    let maxVote = 0
    for (const [key, vote] of Object.entries(this.votes)) {
      const i = Number(key)
      if (vote > maxVote) {
        maxVote = vote
        winners = [i]
      } else if (vote === maxVote) {
        winners.push(i)
      }
    }
    this.onSuccess(winners[Math.floor(Math.random() * winners.length)])
  }

  public acceptVote (clientId: number, vote: number): void {
    if (this.clientsAlreadyVoted.includes(clientId)) return
    this.clientsAlreadyVoted.push(clientId)
    this.votes[vote] = (this.votes[vote] || 0) + 1
    const clientsWithoutVotes = webSocketServer.clients.length - this.clientsAlreadyVoted.length
    if (clientsWithoutVotes === 0) {
      this.onVoteEnd()
      clearTimeout(this.timer)
    }
  }
}
