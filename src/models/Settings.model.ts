export interface Settings {
  port: number
  gamemode: number
  enableGamemodeVote: boolean
  passwordRequired: boolean
  password: string
  name: string
  domain: string
  description: string
  enableWebHook?: boolean
  apiKey?: string
  verbose?: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  port: 3678,
  gamemode: 1,
  enableGamemodeVote: true,
  passwordRequired: false,
  password: '',
  name: 'A Net64+ Server',
  domain: '',
  description: 'The **best** Net64+ server ever\n\n:unicorn_face:',
  enableWebHook: false,
  apiKey: '',
  verbose: false
}

export const TIME_UNTIL_META_RESEND = 10000
