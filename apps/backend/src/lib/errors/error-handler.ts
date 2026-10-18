import type { ErrorRequestHandler } from 'express';
import { ApiException } from './api-exception.js';

/**
 * Sends errors using the shared API response shape. Malformed JSON returns
 * 400; ApiException keeps its status and code, with details omitted in
 * production. Other errors return a generic 500 without the original message.
 *
 * @param error Error passed to Express error middleware.
 * @param request Used to check whether the app is in production.
 * @param response Sends the error status and body.
 * @param _next Express continuation callback, unused here.
 */
export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  void _next;

  if (
    error instanceof SyntaxError &&
    'type' in error &&
    error.type === 'entity.parse.failed'
  ) {
    response.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' },
    });
    return;
  }

  if (error instanceof ApiException) {
    response.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined || request.app.get('env') === 'production'
          ? {}
          : { details: error.details }),
      },
    });
    return;
  }

  response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  });
};