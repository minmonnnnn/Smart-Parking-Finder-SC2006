import type { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse, UpdateProfileRequest, User } from '@smart-parking/shared-types'
import { ApiException } from '../../lib/errors/index.js'
import { AuthGatewayError, type AuthGateway } from './auth.types.js'

function unavailable(): ApiException {
  return new ApiException(503, 'EXTERNAL_SERVICE_UNAVAILABLE', 'Authentication service unavailable')
}

/**
 * Creates the authentication service used to coordinate user
 * registration, login, profile management, and account deletion.
 *
 * The service depends on AuthGateway rather than a concrete
 * authentication provider so that authentication infrastructure
 * can be replaced without changing the application logic.
 *
 * @param gateway Authentication and profile persistence gateway.
 */

export function createAuthService(gateway: AuthGateway) {
  return {
    /**
     * Registers a new user and creates the corresponding profile.
     *
     * If profile creation fails after the authentication account is created, the service attempts to remove the new auth user
     * to avoid leaving an incomplete account.
     *
     * @throws ApiException if the account already exists or the authentication service is unavailable.
     */
    async register(input: RegisterRequest): Promise<RegisterResponse> {
      let userId: string
      try {
        ;({ userId } = await gateway.register(input))
      } catch (error) {
        if (error instanceof AuthGatewayError && error.kind === 'ACCOUNT_EXISTS') {
          throw new ApiException(409, 'ACCOUNT_ALREADY_EXISTS', 'Account already exists')
        }
        throw unavailable()
      }

      try {
        await gateway.createProfile(userId, { name: input.name, vehicleType: input.vehicleType })
      } catch {
        try {
          await gateway.removeAuthUser(userId)
        } catch {
          // Keep the profile failure response stable; the failed rollback needs operator attention.
        }
        throw unavailable()
      }
      return { userId, email: input.email, name: input.name }
    },

    /**
     * Authenticates a user using the supplied credentials
     * @throws ApiException if the credentials are invalid or the authentication provider is unavailable.
     */
    async login(input: LoginRequest): Promise<LoginResponse> {
      try {
        return await gateway.login(input)
      } catch (error) {
        if (error instanceof AuthGatewayError && error.kind === 'INVALID_CREDENTIALS') {
          throw new ApiException(401, 'UNAUTHORIZED', 'Invalid credentials')
        }
        throw unavailable()
      }
    },

    async getProfile(userId: string): Promise<User> {
      let profile: User | null
      try {
        profile = await gateway.getProfile(userId)
      } catch {
        throw unavailable()
      }
      if (!profile) throw new ApiException(404, 'NOT_FOUND', 'Profile not found')
      return profile
    },

    async updateProfile(userId: string, patch: UpdateProfileRequest): Promise<User> {
      let profile: User | null
      try {
        profile = await gateway.updateProfile(userId, patch)
      } catch {
        throw unavailable()
      }
      if (!profile) throw new ApiException(404, 'NOT_FOUND', 'Profile not found')
      return profile
    },

    async deleteAccount(userId: string): Promise<void> {
      try {
        await gateway.removeAuthUser(userId)
      } catch {
        throw unavailable()
      }
    },
  }
}
