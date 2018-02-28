import { Client } from './Client'
import { Characters } from './models/Characters.model'

export class Player {
  public characterName!: string

  public playerData: Uint8Array

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
    this.playerData = Buffer.alloc(0x18)
  }
}
