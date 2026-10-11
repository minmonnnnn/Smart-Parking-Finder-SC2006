import type {
  CreateFavouriteRequest,
  FavouriteLocation,
  LoginResponse,
  RegisterRequest,
  User,
} from './user.js'

const registration: RegisterRequest = {
  email: 'driver@example.com',
  password: 'StrongPass1!',
  name: 'Driver',
  vehicleType: 'EV',
}
const login: LoginResponse = { userId: 'user-1', token: 'token' }
const user: User = {
  id: login.userId,
  email: registration.email,
  name: registration.name,
  vehicleType: registration.vehicleType,
  createdAt: '2026-09-30T00:00:00.000Z',
}
const input: CreateFavouriteRequest = {
  locationName: 'Home',
  address: '1 Example Road',
  latitude: 1.3521,
  longitude: 103.8198,
}
const favourite: FavouriteLocation = {
  id: 1,
  userId: user.id,
  ...input,
  createdAt: user.createdAt,
}
void favourite
