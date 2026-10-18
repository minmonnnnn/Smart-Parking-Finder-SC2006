/** Error response shape used by backend endpoints. */
export interface ApiError {
  error: {
    /** Machine-readable error code. */
    code: ApiErrorCode;
    /** Human-readable message describing the failure. */
    message: string;
    /** Optional additional information about the error. */
    details?: unknown;
  };
}

/**
 * Error codes shared by backend endpoints. FR41–FR43 cover destination,
 * no-carpark, and external-service errors.
 */
export type ApiErrorCode =
  | "DESTINATION_NOT_FOUND" // FR41
  | "NO_CARPARKS_FOUND" // FR42
  | "EXTERNAL_SERVICE_UNAVAILABLE" // FR43 — data.gov.sg/LTA/weather/maps down
  | "ACCOUNT_ALREADY_EXISTS" // FR1
  | "FAVOURITE_ALREADY_EXISTS" // FR35
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";
