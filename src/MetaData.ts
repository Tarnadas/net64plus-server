import farmhash from 'farmhash'

import { TIME_UNTIL_META_RESEND } from './models/Settings.model'
import { IMeta } from './proto/ServerClientMessage'

export class MetaData {
  private metaData: IMeta[] = []

  private alreadySent: NodeJS.Timer[] = []

  public addIfNotAlreadySent (meta: IMeta): void {
    const hash = farmhash.hash32('' + meta.address + meta.length + meta.data)
    if (this.alreadySent[hash]) return
    this.metaData[hash] = meta
    this.alreadySent[hash] = setTimeout(() => {
      delete this.metaData[hash]
      delete this.alreadySent[hash]
    }, TIME_UNTIL_META_RESEND)
  }

  public getMetaData (): IMeta[] {
    return this.metaData.filter(meta => meta)
  }
}
