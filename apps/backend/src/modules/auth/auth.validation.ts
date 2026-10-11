import type {
  LoginRequest,
  RegisterRequest,
  UpdateProfileRequest,
  VehicleType,
} from '@smart-parking/shared-types'
import { ApiException } from '../../lib/errors/index.js'

function invalid(message: string): never {
  throw new ApiException(400, 'VALIDATION_ERROR', message)
}

function bodyWithKeys(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return invalid('Invalid request body')
  }
  const body = value as Record<string, unknown>
  if (Object.keys(body).some((key) => !allowed.includes(key))) {
    return invalid('Invalid request body')
  }
  return body
}

function emailFrom(value: unknown): string {
  if (typeof value !== 'string') return invalid('Invalid email')
  const email = value.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return invalid('Invalid email')
  return email
}

function nameFrom(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return invalid('Invalid name')
  return value.trim()
}

function vehicleTypeFrom(value: unknown): VehicleType {
  if (value !== 'EV' && value !== 'Petrol' && value !== 'Hybrid') {
    return invalid('Invalid vehicle type')
  }
  return value
}

export function parseRegisterRequest(value: unknown): RegisterRequest {
  const body = bodyWithKeys(value, ['email', 'password', 'name', 'vehicleType'])
  const email = emailFrom(body.email)
  const name = nameFrom(body.name)
  const vehicleType = vehicleTypeFrom(body.vehicleType)
  const password = body.password
  if (
    typeof password !== 'string' ||
    password.length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    return invalid('Password must have at least eight characters, uppercase, lowercase, and a number')
  }
  return { email, password, name, vehicleType }
}

export function parseLoginRequest(value: unknown): LoginRequest {
  const body = bodyWithKeys(value, ['email', 'password'])
  const email = emailFrom(body.email)
  if (typeof body.password !== 'string' || !body.password) return invalid('Invalid password')
  return { email, password: body.password }
}

export function parseUpdateProfileRequest(value: unknown): UpdateProfileRequest {
  const body = bodyWithKeys(value, ['name', 'vehicleType'])
  if (!Object.keys(body).length) return invalid('Invalid request body')
  return {
    ...(Object.hasOwn(body, 'name') ? { name: nameFrom(body.name) } : {}),
    ...(Object.hasOwn(body, 'vehicleType') ? { vehicleType: vehicleTypeFrom(body.vehicleType) } : {}),
  }
}
