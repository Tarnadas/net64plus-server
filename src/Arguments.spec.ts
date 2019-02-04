import * as fs from 'fs'
import * as path from 'path'

import { Arguments } from './Arguments'

describe('Arguments', () => {
  let args: Arguments

  beforeEach(() => {
    process.argv = process.argv.slice(0, 2)
  })

  it('should be created', () => {
    args = new Arguments()

    expect(args).toBeDefined()
  })

  it('should match snapshot', () => {
    args = new Arguments()

    expect(args.settings).toMatchSnapshot()
  })

  describe('with command line options', () => {
    it('should set number', () => {
      process.argv = process.argv.concat('--port', '1337')

      args = new Arguments()

      expect(args.settings.port).toEqual(1337)
    })

    it('should set string', () => {
      process.argv = process.argv.concat('--name', 'server')

      args = new Arguments()

      expect(args.settings.name).toEqual('server')
    })

    it('should set boolean', () => {
      process.argv = process.argv.concat('--disableGamemodeVote')

      args = new Arguments()

      expect(args.settings.enableGamemodeVote).toBe(false)
    })
  })

  describe('with JSON options', () => {
    beforeEach(() => {
      jest.mock('fs')
    })

    it('should set number', () => {
      const mockSettings = JSON.stringify({
        port: 1337
      })
      jest.spyOn(fs, 'readFileSync').mockImplementationOnce(() => mockSettings)

      args = new Arguments()

      expect(args.settings.port).toEqual(1337)
    })

    it('should set string', () => {
      const mockSettings = JSON.stringify({
        name: 'server'
      })
      jest.spyOn(fs, 'readFileSync').mockImplementationOnce(() => mockSettings)

      args = new Arguments()

      expect(args.settings.name).toEqual('server')
    })

    it('should set boolean', () => {
      const mockSettings = JSON.stringify({
        enableGamemodeVote: false
      })
      jest.spyOn(fs, 'readFileSync').mockImplementationOnce(() => mockSettings)

      args = new Arguments()

      expect(args.settings.enableGamemodeVote).toBe(false)
    })
  })
})
