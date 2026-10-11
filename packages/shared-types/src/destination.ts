// Destination search types. Owner: Min. FR3–FR7, UC-01.

/** One autocomplete suggestion. GET /api/destinations/search?query= returns DestinationSuggestion[]. FR3, FR4 */
export interface DestinationSuggestion {
  /** Google Places place ID. Pass it to /api/destinations/:placeId/resolve. */
  placeId: string
  /** Main text, e.g. "Bishan Park" */
  name: string
  /** Secondary text, e.g. "1384 Ang Mo Kio Ave 1, Singapore" */
  address: string
}

/** A selected destination with coordinates. GET /api/destinations/:placeId/resolve. FR5, FR6 */
export interface Destination extends DestinationSuggestion {
  latitude: number
  longitude: number
}

/** A point on the map, e.g. the user's current location (FR7) used as the trip origin. */
export interface Coordinates {
  latitude: number
  longitude: number
}
