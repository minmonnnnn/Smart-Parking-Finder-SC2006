import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { PropsWithChildren } from 'react'
import type { LoginResponse, RegisterResponse, UpdateProfileRequest, User } from '@smart-parking/shared-types'
import { apiRequest } from '../../lib/apiClient'
import { clearSession, loadSession, saveSession } from './authStorage'
import type { AuthContextValue, AuthSession, LoginRequest, RegisterRequest } from './auth.types'

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(() => loadSession())
  const sessionRef = useRef(session)
  const authOperationRef = useRef(0)
  const profileOperationRef = useRef(0)
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => session !== null)
  const [error, setError] = useState<Error | null>(null)

  const loadProfile = useCallback(async (): Promise<User> => {
    const requestSession = session
    if (!requestSession || sessionRef.current !== requestSession) throw new Error('Not authenticated')
    const operation = ++profileOperationRef.current
    setLoading(true)
    setError(null)
    try {
      const result = await apiRequest<User>('/api/users/me', { token: requestSession.token })
      if (sessionRef.current === requestSession && profileOperationRef.current === operation) setProfile(result)
      return result
    } catch (cause) {
      const nextError = cause instanceof Error ? cause : new Error('Profile request failed')
      if (sessionRef.current === requestSession && profileOperationRef.current === operation) setError(nextError)
      throw nextError
    } finally {
      if (sessionRef.current === requestSession && profileOperationRef.current === operation) setLoading(false)
    }
  }, [session])

  useEffect(() => {
    if (session) void Promise.resolve().then(loadProfile).catch(() => undefined)
  }, [session, loadProfile])

  const register = useCallback(async (input: RegisterRequest): Promise<RegisterResponse> => {
    setLoading(true)
    setError(null)
    try {
      const result = await apiRequest<RegisterResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      return result
    } catch (cause) {
      const nextError = cause instanceof Error ? cause : new Error('Registration failed')
      setError(nextError)
      throw nextError
    } finally {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (input: LoginRequest): Promise<void> => {
    const operation = ++authOperationRef.current
    setLoading(true)
    setError(null)
    try {
      const result = await apiRequest<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      if (authOperationRef.current !== operation) return
      const nextSession = { userId: result.userId, token: result.token }
      sessionRef.current = nextSession
      profileOperationRef.current += 1
      saveSession(nextSession)
      setSession(nextSession)
      setProfile(null)
    } catch (cause) {
      const nextError = cause instanceof Error ? cause : new Error('Login failed')
      if (authOperationRef.current === operation) setError(nextError)
      throw nextError
    } finally {
      if (authOperationRef.current === operation) setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    authOperationRef.current += 1
    profileOperationRef.current += 1
    sessionRef.current = null
    clearSession()
    setSession(null)
    setProfile(null)
    setError(null)
    setLoading(false)
  }, [])

  const updateProfile = useCallback(async (input: UpdateProfileRequest): Promise<User> => {
    const requestSession = sessionRef.current
    if (!requestSession) throw new Error('Not authenticated')
    const operation = ++profileOperationRef.current
    setLoading(true)
    setError(null)
    try {
      const result = await apiRequest<User>('/api/users/me', {
        method: 'PUT',
        token: requestSession.token,
        body: JSON.stringify(input),
      })
      if (sessionRef.current === requestSession && profileOperationRef.current === operation) setProfile(result)
      return result
    } catch (cause) {
      const nextError = cause instanceof Error ? cause : new Error('Profile update failed')
      if (sessionRef.current === requestSession && profileOperationRef.current === operation) setError(nextError)
      throw nextError
    } finally {
      if (sessionRef.current === requestSession && profileOperationRef.current === operation) setLoading(false)
    }
  }, [])

  const deleteAccount = useCallback(async (): Promise<void> => {
    const requestSession = sessionRef.current
    if (!requestSession) throw new Error('Not authenticated')
    const operation = ++authOperationRef.current
    setLoading(true)
    setError(null)
    try {
      await apiRequest<void>('/api/users/me', { method: 'DELETE', token: requestSession.token })
      if (authOperationRef.current === operation && sessionRef.current === requestSession) {
        profileOperationRef.current += 1
        sessionRef.current = null
        clearSession()
        setSession(null)
        setProfile(null)
        setLoading(false)
      }
    } catch (cause) {
      const nextError = cause instanceof Error ? cause : new Error('Account deletion failed')
      if (authOperationRef.current === operation && sessionRef.current === requestSession) setError(nextError)
      throw nextError
    } finally {
      if (authOperationRef.current === operation && sessionRef.current === requestSession) setLoading(false)
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    session, profile, loading, error, register, login, logout, loadProfile, updateProfile, deleteAccount,
  }), [session, profile, loading, error, register, login, logout, loadProfile, updateProfile, deleteAccount])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
