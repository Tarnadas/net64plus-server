import farmhash from 'farmhash'

import { TIME_UNTIL_META_RESEND } from './models/Settings.model'
import { IMeta } from './proto/ServerClientMessage'

export class MetaData {
  private metaData = new Map<number, IMeta>()

  private alreadySent: NodeJS.Timer[] = []

  public addIfNotAlreadySent (meta: IMeta): void {
    const hash = farmhash.hash32('' + meta.address + meta.length + meta.data)
    if (this.alreadySent[hash]) return
    this.metaData.set(hash, meta)
    this.alreadySent[hash] = setTimeout(() => {
      this.metaData.delete(hash)
      delete this.alreadySent[hash]
    }, TIME_UNTIL_META_RESEND)
  }

  public getMetaData (): IMeta[] {
    const res = Array.from(this.generateMetaData())
    this.metaData = new Map<number, IMeta>()
    return res
  }

  private generateMetaData = function * (this: MetaData) {
    for (const [k, v] of this.metaData) {
      yield v
    }
  }
}
