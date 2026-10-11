import type { RequestHandler } from 'express'
import { ApiException } from '../../lib/errors/index.js'
import type { AuthGateway } from './auth.types.js'

// Mount with router.use(createRequireAuth(gateway)) before protected routes.
// Successful verification sets request.auth.userId; never trust a body-supplied owner ID.
export function createRequireAuth(gateway: AuthGateway): RequestHandler {
  return async (request, _response, next) => {
    const authorizationCount = request.rawHeaders.filter((header, index) =>
      index % 2 === 0 && header.toLowerCase() === 'authorization',
    ).length
    if (authorizationCount !== 1) throw new ApiException(401, 'UNAUTHORIZED', 'Unauthorized')

    const match = /^Bearer ([^\s,]+)$/i.exec(request.headers.authorization ?? '')
    if (!match) throw new ApiException(401, 'UNAUTHORIZED', 'Unauthorized')

    let auth: { userId: string } | null
    try {
      auth = await gateway.verifyToken(match[1]!)
    } catch {
      throw new ApiException(503, 'EXTERNAL_SERVICE_UNAVAILABLE', 'Authentication service unavailable')
    }
    if (!auth) throw new ApiException(401, 'UNAUTHORIZED', 'Unauthorized')
    request.auth = auth
    next()
  }
}
