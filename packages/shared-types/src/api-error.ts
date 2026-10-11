export interface ApiError {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
}

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
