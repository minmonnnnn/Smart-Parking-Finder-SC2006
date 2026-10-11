import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ApiException, errorHandler } from './index.js';

const createApp = (environment: string, route: express.RequestHandler) => {
  const app = express();
  app.set('env', environment);
  app.use(express.json());
  app.post('/', route);
  app.use(errorHandler);
  return app;
};

describe('errorHandler', () => {
  it('maps malformed JSON to a validation error', async () => {
    const app = createApp('development', (_request, response) => {
      response.sendStatus(204);
    });

    const result = await request(app)
      .post('/')
      .set('Content-Type', 'application/json')
      .send('{ invalid json');

    expect(result.status).toBe(400);
    expect(result.body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' },
    });
  });

  it('serializes ApiException status, code, message, and details outside production', async () => {
    const app = createApp('development', () => {
      throw new ApiException(422, 'VALIDATION_ERROR', 'Invalid input', {
        field: 'email',
      });
    });

    const result = await request(app).post('/').send({});

    expect(result.status).toBe(422);
    expect(result.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: { field: 'email' },
      },
    });
  });

  it('omits ApiException details in production', async () => {
    const app = createApp('production', () => {
      throw new ApiException(403, 'UNAUTHORIZED', 'Access denied', {
        reason: 'sensitive',
      });
    });

    const result = await request(app).post('/').send({});

    expect(result.status).toBe(403);
    expect(result.body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Access denied' },
    });
  });

  it('does not expose an unknown error message', async () => {
    const app = createApp('development', () => {
      throw new Error('database credentials leaked');
    });

    const result = await request(app).post('/').send({});

    expect(result.status).toBe(500);
    expect(result.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
    expect(JSON.stringify(result.body)).not.toContain('database credentials leaked');
  });
});