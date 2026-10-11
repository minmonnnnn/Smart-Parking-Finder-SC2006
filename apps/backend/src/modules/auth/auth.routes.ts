import { Router } from 'express'
import { createAuthService } from './auth.service.js'
import type { AuthGateway } from './auth.types.js'
import { createRequireAuth } from './auth.middleware.js'
import { parseLoginRequest, parseRegisterRequest, parseUpdateProfileRequest } from './auth.validation.js'

export function createAuthRouter(dependencies: { gateway: AuthGateway }): Router {
  const router = Router()
  const service = createAuthService(dependencies.gateway)

  router.post('/register', async (request, response) => {
    const input = parseRegisterRequest(request.body)
    response.status(201).json(await service.register(input))
  })

  router.post('/login', async (request, response) => {
    const input = parseLoginRequest(request.body)
    response.json(await service.login(input))
  })

  return router
}

export function createUsersRouter(dependencies: { gateway: AuthGateway }): Router {
  const router = Router()
  const service = createAuthService(dependencies.gateway)
  router.use(createRequireAuth(dependencies.gateway))

  router.get('/me', async (request, response) => {
    response.json(await service.getProfile(request.auth!.userId))
  })

  router.put('/me', async (request, response) => {
    const patch = parseUpdateProfileRequest(request.body)
    response.json(await service.updateProfile(request.auth!.userId, patch))
  })

  router.delete('/me', async (request, response) => {
    await service.deleteAccount(request.auth!.userId)
    response.status(204).end()
  })

  return router
}
