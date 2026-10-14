/** Weather forecast for a location. GET /api/weather. FR24–FR27 */
export interface WeatherInfo {
  /** Human-readable forecast, e.g. "Partly Cloudy", "Heavy Thundery Showers" */
  condition: string
  /** True when rain or thunder is in the forecast — drives FR26 sheltered-carpark preference */
  rainExpected: boolean
  /** One-line summary suitable for the navigation page banner */
  forecastSummary: string
  /** ISO 8601 timestamp when this forecast was retrieved */
  retrievedAt: string
}
