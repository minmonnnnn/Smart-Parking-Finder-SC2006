import { apiRequest } from '../../lib/apiClient'
import type { CarparkDetails } from '@smart-parking/shared-types'
import type { WeatherInfo } from '@smart-parking/shared-types'

export async function getCarparkDetails(carParkNo: string): Promise<CarparkDetails> {
  return apiRequest<CarparkDetails>(`/api/carparks/${encodeURIComponent(carParkNo)}`)
}

export async function getWeather(lat: number, lng: number): Promise<WeatherInfo> {
  return apiRequest<WeatherInfo>(`/api/weather?lat=${lat}&lng=${lng}`)
}
