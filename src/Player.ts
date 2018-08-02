import { webSocketServer } from './globals'
import { Client } from './Client'
import { Characters } from './models/Characters.model'

export const PLAYER_DATA_LENGTH = 0x1C

export class Player {
  public characterName!: string

  private _playerData!: Uint8Array

  public get playerData (): Uint8Array {
    return this._playerData
  }

  public set playerData (playerData: Uint8Array) {
    if (this.client.id === 1) {
      playerData[0x16] = webSocketServer.gameMode
    }
    this._playerData = playerData
  }

  private _characterId!: number

  public get characterId (): number {
    return this._characterId
  }

  public set characterId (characterId: number) {
    this._characterId = characterId
    this.characterName = Characters[this.characterId]
  }

  constructor (public client: Client, public username: string, characterId: number) {
    this.characterId = characterId
    this.playerData = Buffer.alloc(PLAYER_DATA_LENGTH)
    this.toJSON = this.toJSON
  }

  private toJSON () {
    return {
      username: this.username,
      characterId: this._characterId
    }
  }
}
