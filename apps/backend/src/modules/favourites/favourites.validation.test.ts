import { describe, expect, it } from 'vitest'
import { parseCreateFavouriteRequest, parseFavouriteId, parseRenameFavouriteRequest } from './favourites.validation.js'

function validationError(action: () => unknown) {
  expect(action).toThrowError(expect.objectContaining({ code: 'VALIDATION_ERROR', status: 400 }))
}

describe('favourite validation', () => {
  const valid = { locationName: ' Home ', address: ' 1 Main St ', latitude: 1.3, longitude: 103.8 }

  it('trims text and accepts boundary coordinates', () => {
    expect(parseCreateFavouriteRequest({ ...valid, latitude: -90, longitude: 180 })).toEqual({
      locationName: 'Home', address: '1 Main St', latitude: -90, longitude: 180,
    })
  })

  it.each([
    { ...valid, locationName: ' ' },
    { ...valid, address: '' },
    { ...valid, latitude: Infinity },
    { ...valid, latitude: -90.1 },
    { ...valid, longitude: 180.1 },
    { ...valid, longitude: NaN },
    { ...valid, unexpected: true },
    null,
  ])('rejects invalid create input %#', (input) => {
    validationError(() => parseCreateFavouriteRequest(input))
  })

  it('accepts only one nonblank name for rename', () => {
    expect(parseRenameFavouriteRequest({ locationName: ' Work ' })).toEqual({ locationName: 'Work' })
    for (const input of [{}, { locationName: ' ' }, { locationName: 'Work', address: 'Other' }, null]) {
      validationError(() => parseRenameFavouriteRequest(input))
    }
  })

  it('accepts positive integer URL IDs only', () => {
    expect(parseFavouriteId('42')).toBe(42)
    for (const value of ['0', '-1', '1.5', '1e3', 'NaN', '9007199254740992']) {
      validationError(() => parseFavouriteId(value))
    }
  })
})
