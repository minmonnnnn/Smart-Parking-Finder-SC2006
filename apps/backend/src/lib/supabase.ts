import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { User, VehicleType } from '@smart-parking/shared-types'
import type { BackendEnv } from '../config/env.js'
import { AuthGatewayError, type AuthGateway } from '../modules/auth/auth.types.js'

type Clients = { adminClient: SupabaseClient; loginClient: SupabaseClient }
type ProfileRow = { id: string; name: string; vehicle_type: VehicleType; created_at: string }

function mapProfile(row: ProfileRow, email: string): User {
  return {
    id: row.id,
    email,
    name: row.name,
    vehicleType: row.vehicle_type,
    createdAt: row.created_at,
  }
}

async function safe<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action()
  } catch (error) {
    if (error instanceof AuthGatewayError) throw error
    throw new AuthGatewayError('UNAVAILABLE')
  }
}

export function createSupabaseClients(env: Pick<BackendEnv, 'supabaseUrl' | 'supabaseServiceRoleKey'>): Clients {
  const options = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
  return {
    adminClient: createClient(env.supabaseUrl, env.supabaseServiceRoleKey, options),
    loginClient: createClient(env.supabaseUrl, env.supabaseServiceRoleKey, options),
  }
}

export function createSupabaseAuthGateway({ adminClient, loginClient }: Clients): AuthGateway {
  async function profileEmail(userId: string): Promise<string> {
    const { data, error } = await adminClient.auth.admin.getUserById(userId)
    if (error || !data.user?.email) throw new AuthGatewayError('UNAVAILABLE')
    return data.user.email
  }

  return {
    register: (input) => safe(async () => {
      const { data, error } = await adminClient.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
      })
      if (error) {
        const duplicate = error.code === 'email_exists' || error.code === 'user_already_exists'
        throw new AuthGatewayError(duplicate ? 'ACCOUNT_EXISTS' : 'UNAVAILABLE')
      }
      if (!data.user) throw new AuthGatewayError('UNAVAILABLE')
      return { userId: data.user.id }
    }),

    createProfile: (userId, input) => safe(async () => {
      const { error } = await adminClient.from('profiles').insert({
        id: userId,
        name: input.name,
        vehicle_type: input.vehicleType,
      })
      if (error) throw new AuthGatewayError('UNAVAILABLE')
    }),

    removeAuthUser: (userId) => safe(async () => {
      const { error } = await adminClient.auth.admin.deleteUser(userId)
      if (error) throw new AuthGatewayError('UNAVAILABLE')
    }),

    login: (input) => safe(async () => {
      const { data, error } = await loginClient.auth.signInWithPassword(input)
      if (error) {
        throw new AuthGatewayError(error.code === 'invalid_credentials' ? 'INVALID_CREDENTIALS' : 'UNAVAILABLE')
      }
      if (!data.user || !data.session?.access_token) throw new AuthGatewayError('UNAVAILABLE')
      return { userId: data.user.id, token: data.session.access_token }
    }),

    verifyToken: (token) => safe(async () => {
      const { data, error } = await adminClient.auth.getUser(token)
      if (error) {
        if (error.code === 'bad_jwt' || error.status === 401 || error.status === 403) return null
        throw new AuthGatewayError('UNAVAILABLE')
      }
      return data.user ? { userId: data.user.id } : null
    }),

    getProfile: (userId) => safe(async () => {
      const { data, error } = await adminClient.from('profiles')
        .select('id, name, vehicle_type, created_at')
        .eq('id', userId)
        .maybeSingle()
      if (error) throw new AuthGatewayError('UNAVAILABLE')
      if (!data) return null
      return mapProfile(data as ProfileRow, await profileEmail(userId))
    }),

    updateProfile: (userId, patch) => safe(async () => {
      const email = await profileEmail(userId)
      const { data, error } = await adminClient.from('profiles')
        .update({
          ...(patch.name === undefined ? {} : { name: patch.name }),
          ...(patch.vehicleType === undefined ? {} : { vehicle_type: patch.vehicleType }),
        })
        .eq('id', userId)
        .select('id, name, vehicle_type, created_at')
        .maybeSingle()
      if (error) throw new AuthGatewayError('UNAVAILABLE')
      if (!data) return null
      return mapProfile(data as ProfileRow, email)
    }),
  }
}
