import type { LoginRequest, RegisterRequest, UpdateProfileRequest, User } from '@smart-parking/shared-types'

export interface AuthGateway {
  register(input: RegisterRequest): Promise<{ userId: string }>
  createProfile(userId: string, input: Pick<RegisterRequest, 'name' | 'vehicleType'>): Promise<void>
  removeAuthUser(userId: string): Promise<void>
  login(input: LoginRequest): Promise<{ userId: string; token: string }>
  verifyToken(token: string): Promise<{ userId: string } | null>
  getProfile(userId: string): Promise<User | null>
  updateProfile(userId: string, patch: UpdateProfileRequest): Promise<User | null>
}

export interface AuthContext { userId: string }

export type AuthGatewayErrorKind = 'ACCOUNT_EXISTS' | 'INVALID_CREDENTIALS' | 'UNAVAILABLE'

export class AuthGatewayError extends Error {
  constructor(public readonly kind: AuthGatewayErrorKind) {
    super(kind)
    this.name = 'AuthGatewayError'
  }
}
