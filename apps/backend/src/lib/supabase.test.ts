import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { AuthGatewayError } from '../modules/auth/auth.types.js'
import { createSupabaseAuthGateway } from './supabase.js'

const registration = {
  email: 'driver@example.com', password: 'Password1', name: 'Driver', vehicleType: 'EV' as const,
}

function client(overrides: {
  createUser?: (input: unknown) => Promise<unknown>
  deleteUser?: (userId: string) => Promise<unknown>
  signInWithPassword?: (input: unknown) => Promise<unknown>
  getUser?: (token: string) => Promise<unknown>
  insert?: (input: unknown) => Promise<unknown>
} = {}): SupabaseClient {
  return {
    auth: {
      admin: {
        createUser: overrides.createUser ?? (async () => ({ data: { user: { id: 'user-1' } }, error: null })),
        deleteUser: overrides.deleteUser ?? (async () => ({ error: null })),
      },
      signInWithPassword: overrides.signInWithPassword ?? (async () => ({
        data: { user: { id: 'user-1' }, session: { access_token: 'access-token' } }, error: null,
      })),
      getUser: overrides.getUser ?? (async () => ({ data: { user: { id: 'user-1' } }, error: null })),
    },
    from: () => ({ insert: overrides.insert ?? (async () => ({ error: null })) }),
  } as unknown as SupabaseClient
}

describe('Supabase auth gateway', () => {
  it('creates a confirmed identity and inserts the profile', async () => {
    let created: unknown
    let inserted: unknown
    const adminClient = client({
      createUser: async (input) => { created = input; return { data: { user: { id: 'user-1' } }, error: null } },
      insert: async (input) => { inserted = input; return { error: null } },
    })
    const gateway = createSupabaseAuthGateway({ adminClient, loginClient: client() })

    expect(await gateway.register(registration)).toEqual({ userId: 'user-1' })
    await gateway.createProfile('user-1', { name: 'Driver', vehicleType: 'EV' })
    expect(created).toEqual({ email: 'driver@example.com', password: 'Password1', email_confirm: true })
    expect(inserted).toEqual({ id: 'user-1', name: 'Driver', vehicle_type: 'EV' })
  })

  it('maps duplicate email codes without leaking the provider message', async () => {
    const adminClient = client({
      createUser: async () => ({ data: { user: null }, error: {
        code: 'email_exists', status: 422, message: 'private provider text',
      } }),
    })
    const gateway = createSupabaseAuthGateway({ adminClient, loginClient: client() })
    await expect(gateway.register(registration)).rejects.toMatchObject({
      kind: 'ACCOUNT_EXISTS', message: 'ACCOUNT_EXISTS',
    })
  })

  it('maps invalid credentials and returns the access token on success', async () => {
    const adminClient = client()
    const invalidLogin = client({ signInWithPassword: async () => ({
      data: { user: null, session: null },
      error: { code: 'invalid_credentials', status: 400, message: 'private provider text' },
    }) })
    await expect(createSupabaseAuthGateway({ adminClient, loginClient: invalidLogin }).login({
      email: registration.email, password: registration.password,
    })).rejects.toMatchObject({ kind: 'INVALID_CREDENTIALS' })
    expect(await createSupabaseAuthGateway({ adminClient, loginClient: client() }).login({
      email: registration.email, password: registration.password,
    })).toEqual({ userId: 'user-1', token: 'access-token' })
  })

  it('distinguishes rejected tokens from provider outages', async () => {
    const invalid = client({ getUser: async () => ({
      data: { user: null }, error: { code: 'bad_jwt', status: 401, message: 'private provider text' },
    }) })
    expect(await createSupabaseAuthGateway({ adminClient: invalid, loginClient: client() }).verifyToken('bad'))
      .toBeNull()
    const outage = client({ getUser: async () => ({
      data: { user: null }, error: { code: 'unexpected_failure', status: 503, message: 'private provider text' },
    }) })
    await expect(createSupabaseAuthGateway({ adminClient: outage, loginClient: client() }).verifyToken('token'))
      .rejects.toEqual(new AuthGatewayError('UNAVAILABLE'))
  })

  it('removes an identity and maps profile failures', async () => {
    let removed: string | undefined
    const adminClient = client({
      deleteUser: async (userId) => { removed = userId; return { error: null } },
      insert: async () => ({ error: { message: 'private provider text' } }),
    })
    const gateway = createSupabaseAuthGateway({ adminClient, loginClient: client() })
    await gateway.removeAuthUser('user-1')
    expect(removed).toBe('user-1')
    await expect(gateway.createProfile('user-1', { name: 'Driver', vehicleType: 'EV' }))
      .rejects.toEqual(new AuthGatewayError('UNAVAILABLE'))
  })

  it('rejects account deletion when the provider returns an error or throws', async () => {
    for (const deleteUser of [
      async () => ({ error: { message: 'private provider text' } }),
      async () => { throw new Error('private network failure') },
    ]) {
      const gateway = createSupabaseAuthGateway({ adminClient: client({ deleteUser }), loginClient: client() })
      await expect(gateway.removeAuthUser('user-1')).rejects.toEqual(new AuthGatewayError('UNAVAILABLE'))
    }
  })
})
