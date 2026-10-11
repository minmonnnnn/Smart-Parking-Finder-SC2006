import type { CreateFavouriteRequest, RenameFavouriteRequest } from '@smart-parking/shared-types'
import { ApiException } from '../../lib/errors/index.js'

function invalid(message: string): never {
  throw new ApiException(400, 'VALIDATION_ERROR', message)
}

function bodyWithKeys(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return invalid('Invalid request body')
  }
  const body = value as Record<string, unknown>
  if (Object.keys(body).some((key) => !keys.includes(key))) return invalid('Invalid request body')
  return body
}

function nonblank(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) return invalid(`Invalid ${field}`)
  return value.trim()
}

function coordinate(value: unknown, limit: number, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > limit) {
    return invalid(`Invalid ${field}`)
  }
  return value
}

export function parseCreateFavouriteRequest(value: unknown): CreateFavouriteRequest {
  const body = bodyWithKeys(value, ['locationName', 'address', 'latitude', 'longitude'])
  return {
    locationName: nonblank(body.locationName, 'location name'),
    address: nonblank(body.address, 'address'),
    latitude: coordinate(body.latitude, 90, 'latitude'),
    longitude: coordinate(body.longitude, 180, 'longitude'),
  }
}

export function parseRenameFavouriteRequest(value: unknown): RenameFavouriteRequest {
  const body = bodyWithKeys(value, ['locationName'])
  if (Object.keys(body).length !== 1) return invalid('Invalid request body')
  return { locationName: nonblank(body.locationName, 'location name') }
}

export function parseFavouriteId(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) return invalid('Invalid favourite ID')
  const id = Number(value)
  if (!Number.isSafeInteger(id)) return invalid('Invalid favourite ID')
  return id
}
