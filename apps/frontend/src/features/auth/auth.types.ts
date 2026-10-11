import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  UpdateProfileRequest,
  User,
} from '@smart-parking/shared-types'

export interface AuthSession {
  userId: string
  token: string
}

export interface AuthContextValue {
  session: AuthSession | null
  profile: User | null
  loading: boolean
  error: Error | null
  register(input: RegisterRequest): Promise<RegisterResponse>
  login(input: LoginRequest): Promise<void>
  logout(): void
  loadProfile(): Promise<User>
  updateProfile(input: UpdateProfileRequest): Promise<User>
  deleteAccount(): Promise<void>
}

export type { LoginRequest, RegisterRequest, UpdateProfileRequest, User }
export type { LoginResponse, RegisterResponse }
