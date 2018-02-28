export interface Settings {
  port: number
  name: string
  domain: string
  description: string
  enableWebHook?: boolean
  apiKey?: string
}

export const DEFAULT_SETTINGS: Settings = {
  port: 3678,
  name: 'A Net64+ Server',
  domain: '',
  description: 'The **best** Net64+ server ever\n\n:unicorn_face:',
  enableWebHook: false,
  apiKey: ''
}

export const TIME_UNTIL_META_RESEND = 10000
