import { describe, expect, it } from 'vitest'
import { ApiException } from '../../lib/errors/index.js'
import {
  parseLoginRequest,
  parseRegisterRequest,
  parseUpdateProfileRequest,
} from './auth.validation.js'

const validRegistration = {
  email: 'Driver@Example.com',
  password: 'Password1',
  name: ' Driver ',
  vehicleType: 'EV',
}

function expectValidationError(action: () => unknown) {
  try {
    action()
    throw new Error('Expected validation to fail')
  } catch (error) {
    expect(error).toBeInstanceOf(ApiException)
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' })
    expect((error as Error).message).not.toContain('Password1')
    expect(JSON.stringify(error)).not.toContain('Password1')
  }
}

describe('auth request validation', () => {
  it('normalizes email and trims a nonblank name', () => {
    expect(parseRegisterRequest({ ...validRegistration, email: '  Driver@Example.com  ' })).toEqual({
      ...validRegistration,
      email: 'driver@example.com',
      name: 'Driver',
    })
    expect(parseLoginRequest({ email: ' Driver@Example.com ', password: 'Password1' })).toEqual({
      email: 'driver@example.com',
      password: 'Password1',
    })
  })

  it.each(['EV', 'Petrol', 'Hybrid'])('accepts %s vehicle type', (vehicleType) => {
    expect(parseRegisterRequest({ ...validRegistration, vehicleType }).vehicleType).toBe(vehicleType)
  })

  it.each(['Electric', '', null, 1])('rejects invalid vehicle type %s', (vehicleType) => {
    expectValidationError(() => parseRegisterRequest({ ...validRegistration, vehicleType }))
  })

  it.each(['', ' ', 2, null])('rejects a missing or blank name %s', (name) => {
    expectValidationError(() => parseRegisterRequest({ ...validRegistration, name }))
  })

  it.each(['Short1', 'lowercase1', 'UPPERCASE1', 'NoNumbers'])('requires a strong password', (password) => {
    expectValidationError(() => parseRegisterRequest({ ...validRegistration, password }))
  })

  it('rejects missing fields and invalid email without exposing the password', () => {
    expectValidationError(() => parseRegisterRequest({ email: 'driver@example.com', password: 'Password1' }))
    expectValidationError(() => parseRegisterRequest({ ...validRegistration, email: 'bad-email' }))
    expectValidationError(() => parseLoginRequest({ email: validRegistration.email }))
    expectValidationError(() => parseLoginRequest({ email: 'bad-email', password: 'Password1' }))
  })

  it.each([null, [], 'text', 42, { ...validRegistration, extra: true }])(
    'rejects unknown registration body shape %s',
    (body) => expectValidationError(() => parseRegisterRequest(body)),
  )

  it('validates profile changes and rejects empty or unknown updates', () => {
    expect(parseUpdateProfileRequest({ name: ' Driver ', vehicleType: 'Hybrid' })).toEqual({
      name: 'Driver',
      vehicleType: 'Hybrid',
    })
    expectValidationError(() => parseUpdateProfileRequest({}))
    expectValidationError(() => parseUpdateProfileRequest({ name: ' ' }))
    expectValidationError(() => parseUpdateProfileRequest({ name: undefined }))
    expectValidationError(() => parseUpdateProfileRequest({ extra: true }))
  })
})
