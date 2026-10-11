import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { AuthGatewayError } from '../modules/auth/auth.types.js'
import { createSupabaseAuthGateway } from './supabase.js'

const row = {
  id: 'user-1',
  name: 'Driver',
  vehicle_type: 'EV',
  created_at: '2026-09-30T00:00:00.000Z',
}

function client(options: {
  row?: typeof row | null
  queryError?: unknown
  user?: { email?: string } | null
  userError?: unknown
  onUpdate?: (patch: unknown) => void
  onFilter?: (field: string, value: string) => void
} = {}): SupabaseClient {
  const result = { data: options.row === undefined ? row : options.row, error: options.queryError ?? null }
  const query = {
    maybeSingle: async () => result,
    eq: (field: string, value: string) => { options.onFilter?.(field, value); return query },
    select: () => query,
  }
  return {
    auth: { admin: { getUserById: async () => ({
      data: { user: options.user === undefined ? { email: 'driver@example.com' } : options.user },
      error: options.userError ?? null,
    }) } },
    from: () => ({
      select: () => query,
      update: (patch: unknown) => { options.onUpdate?.(patch); return query },
    }),
  } as unknown as SupabaseClient
}

function gateway(adminClient: SupabaseClient) {
  return createSupabaseAuthGateway({ adminClient, loginClient: adminClient })
}

describe('Supabase profile gateway', () => {
  it('maps a profile row and auth email to the camelCase User', async () => {
    const filters: unknown[] = []
    const authGateway = gateway(client({ onFilter: (field, value) => filters.push([field, value]) }))
    await expect(authGateway.getProfile('user-1')).resolves.toEqual({
      id: 'user-1', email: 'driver@example.com', name: 'Driver', vehicleType: 'EV',
      createdAt: '2026-09-30T00:00:00.000Z',
    })
    expect(filters).toEqual([['id', 'user-1']])
  })

  it('writes only supplied snake_case fields and maps the returned profile', async () => {
    const updates: unknown[] = []
    const authGateway = gateway(client({
      row: { ...row, vehicle_type: 'Hybrid' },
      onUpdate: (patch) => updates.push(patch),
    }))
    await expect(authGateway.updateProfile('user-1', { vehicleType: 'Hybrid' })).resolves.toEqual({
      id: 'user-1', email: 'driver@example.com', name: 'Driver', vehicleType: 'Hybrid',
      createdAt: '2026-09-30T00:00:00.000Z',
    })
    expect(updates).toEqual([{ vehicle_type: 'Hybrid' }])
  })

  it('returns null for a missing profile', async () => {
    await expect(gateway(client({ row: null })).getProfile('user-1')).resolves.toBeNull()
    await expect(gateway(client({ row: null })).updateProfile('user-1', { name: 'Driver' })).resolves.toBeNull()
  })

  it('converts profile and identity failures to an unavailable gateway error', async () => {
    await expect(gateway(client({ queryError: { message: 'private provider text' } })).getProfile('user-1'))
      .rejects.toEqual(new AuthGatewayError('UNAVAILABLE'))
    await expect(gateway(client({ userError: { message: 'private provider text' } })).getProfile('user-1'))
      .rejects.toEqual(new AuthGatewayError('UNAVAILABLE'))
  })

  it('does not update the profile when its auth email cannot be loaded', async () => {
    const updates: unknown[] = []
    const authGateway = gateway(client({
      userError: { message: 'private provider text' },
      onUpdate: (patch) => updates.push(patch),
    }))
    await expect(authGateway.updateProfile('user-1', { name: 'New Driver' }))
      .rejects.toEqual(new AuthGatewayError('UNAVAILABLE'))
    expect(updates).toEqual([])
  })
})
