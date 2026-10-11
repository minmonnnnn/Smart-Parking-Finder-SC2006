import type { ErrorRequestHandler } from 'express';
import { ApiException } from './api-exception.js';

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