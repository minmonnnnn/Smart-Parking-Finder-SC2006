import type { ApiErrorCode } from '@smart-parking/shared-types';

/** Error with the HTTP status and shared API code to return to the caller. */
export class ApiException extends Error {
  /**
   * @param status HTTP status for the response.
   * @param code Shared code describing the error.
   * @param message Message describing the failure.
   * @param details Optional diagnostic data; the middleware omits it in production.
   */
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiException';
  }
}