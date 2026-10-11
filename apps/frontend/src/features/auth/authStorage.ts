import type { AuthSession } from './auth.types'

export const AUTH_STORAGE_KEY = 'smart-parking.auth'

export function loadSession(): AuthSession | null {
  const stored = localStorage.getItem(AUTH_STORAGE_KEY)
  if (!stored) return null

  try {
    const value: unknown = JSON.parse(stored)
    if (typeof value === 'object' && value !== null &&
      typeof Reflect.get(value, 'userId') === 'string' &&
      typeof Reflect.get(value, 'token') === 'string') {
      const session = { userId: Reflect.get(value, 'userId'), token: Reflect.get(value, 'token') }
      saveSession(session)
      return session
    }
  } catch {
    // Invalid persisted data is discarded below.
  }

  localStorage.removeItem(AUTH_STORAGE_KEY)
  return null
}

export function saveSession(session: AuthSession): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ userId: session.userId, token: session.token }))
}

export function clearSession(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY)
}
