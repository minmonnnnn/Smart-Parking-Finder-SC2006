export type VehicleType = 'EV' | 'Petrol' | 'Hybrid'

export interface User {
  id: string
  email: string
  name: string
  vehicleType: VehicleType
  createdAt: string
}

export interface FavouriteLocation {
  id: number
  userId: string
  locationName: string
  address: string
  latitude: number
  longitude: number
  createdAt: string
}

export interface RegisterRequest {
  email: string
  password: string
  name: string
  vehicleType: VehicleType
}
export type RegisterResponse = Pick<User, 'email' | 'name'> & { userId: string }
export interface LoginRequest { email: string; password: string }
export interface LoginResponse { userId: string; token: string }
export type UpdateProfileRequest = Partial<Pick<User, 'name' | 'vehicleType'>>
export type CreateFavouriteRequest = Pick<FavouriteLocation,
  'locationName' | 'address' | 'latitude' | 'longitude'>
export type RenameFavouriteRequest = Pick<FavouriteLocation, 'locationName'>
