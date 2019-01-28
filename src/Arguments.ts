import { ArgumentParser } from 'argparse'

import * as fs from 'fs'
import * as path from 'path'

import { Settings, DEFAULT_SETTINGS } from './models/Settings.model'

export class Arguments {
  public settings: Settings

  private parser = new ArgumentParser({
    addHelp: true,
    description: 'Net64+ server'
  })

  constructor () {
    let settings: Settings | undefined
    let settingsPath = path.join(__dirname, '../settings.json')
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, {
        encoding: 'utf8'
      }))
    } catch (err) {
      fs.writeFileSync(settingsPath, JSON.stringify(DEFAULT_SETTINGS))
      console.info('Failed to find or parse settings.json file. Using default settings instead and created a settings.json just for you.')
    }

    this.parser.addArgument([ '--port', '-P' ], {
      type: (int: string) => parseInt(int)
    })
    this.parser.addArgument([ '--gamemode', '-g' ])
    this.parser.addArgument([ '--disableGamemodeVote', '-G' ], {
      action: 'storeFalse'
    })
    this.parser.addArgument([ '--passwordRequired', '-pr' ], {
      action: 'storeTrue'
    })
    this.parser.addArgument([ '--password', '-p' ])
    this.parser.addArgument([ '--name', '-n' ])
    this.parser.addArgument([ '--domain', '-D' ])
    this.parser.addArgument([ '--description', '-d' ])
    this.parser.addArgument([ '--enableWebHook', '-w' ], {
      action: 'storeTrue'
    })
    this.parser.addArgument([ '--apiKey', '-k' ])
    const parsed = this.parser.parseArgs() as Settings

    this.settings = {} as any
    Object.entries(DEFAULT_SETTINGS).forEach(([ key, defaultValue ]: [ string, any ]) => {
      // @ts-ignore
      this.settings[key] = parsed[key] || (settings ? settings[key] : null) || defaultValue
    })
  }
}
