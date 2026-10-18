import { apiRequest } from '../../lib/apiClient'
import type { CarparkDetails } from '@smart-parking/shared-types'
import type { WeatherInfo } from '@smart-parking/shared-types'

/**
 * Fetches full details for a single carpark, including static info and live availability.
 * @param carParkNo - The HDB carpark code (e.g. "HG9")
 * @returns Carpark static data combined with current availability
 */
export async function getCarparkDetails(carParkNo: string): Promise<CarparkDetails> {
  return apiRequest<CarparkDetails>(`/api/carparks/${encodeURIComponent(carParkNo)}`)
}

/**
 * Fetches the current weather condition at the given coordinates.
 * @param lat - Latitude of the location
 * @param lng - Longitude of the location
 * @returns Current weather including rain forecast and condition label
 */
export async function getWeather(lat: number, lng: number): Promise<WeatherInfo> {
  return apiRequest<WeatherInfo>(`/api/weather?lat=${lat}&lng=${lng}`)
}
