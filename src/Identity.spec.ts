import { Identity, PASSWORD_THROTTLE_INCREASE, PASSWORD_THROTTLE_RESET } from './Identity'
import { Client } from './Client'
import { ClientMock } from './Client.mock'

describe('Identity', () => {
  let identity: Identity
  let client: Client

  beforeEach(() => {
    client = new ClientMock(1, {}, {}) as any
    identity = Identity.getIdentity(client, '127.0.0.1')
  })

  beforeEach(() => {
    jest.useFakeTimers()
    Identity.Identities = {}
  })

  describe('#getPasswordThrottle', () => {
    beforeEach(() => {
      expect(identity.canSendPassword).toBe(true)
    })

    it('should return password throttle', () => {
      const res = identity.getPasswordThrottle()

      expect(res).toEqual(PASSWORD_THROTTLE_INCREASE)
    })

    it('should increase password throttle', () => {
      for (let i = 1; i < 5; i++) {
        const throttle = identity.getPasswordThrottle()
        jest.advanceTimersByTime(throttle)

        expect(throttle).toEqual(PASSWORD_THROTTLE_INCREASE * i)
      }
    })

    it('should set #canSendPassword to false', () => {
      identity.getPasswordThrottle()

      expect(identity.canSendPassword).toBe(false)
    })

    it('should set #canSendPassword to true after throttling phase', () => {
      const throttle = identity.getPasswordThrottle()
      jest.advanceTimersByTime(throttle)

      expect(identity.canSendPassword).toBe(true)
    })

    it('should not set #canSendPassword to true after throttling phase is almost over', () => {
      const throttle = identity.getPasswordThrottle()
      jest.advanceTimersByTime(throttle - 1)

      expect(identity.canSendPassword).toBe(false)
    })

    it('should reset password throttle after reset throttle phase', () => {
      identity.getPasswordThrottle()
      jest.advanceTimersByTime(PASSWORD_THROTTLE_RESET)
      const throttle = identity.getPasswordThrottle()

      expect(throttle).toEqual(PASSWORD_THROTTLE_INCREASE)
    })

    it('should throw error, if called during throttling phase', () => {
      identity.getPasswordThrottle()

      expect(identity.getPasswordThrottle).toThrow()
    })
  })
})
