import { Router } from 'express'
import { createRequireAuth } from '../auth/auth.middleware.js'
import type { AuthGateway } from '../auth/auth.types.js'
import { createFavouritesService, type FavouriteGateway } from './favourites.service.js'
import { parseCreateFavouriteRequest, parseFavouriteId, parseRenameFavouriteRequest } from './favourites.validation.js'

export function createFavouritesRouter(dependencies: {
  authGateway: AuthGateway
  gateway: FavouriteGateway
}): Router {
  const router = Router()
  const service = createFavouritesService(dependencies.gateway)
  router.use(createRequireAuth(dependencies.authGateway))

  router.get('/', async (request, response) => {
    response.json(await service.list(request.auth!.userId))
  })

  router.post('/', async (request, response) => {
    const input = parseCreateFavouriteRequest(request.body)
    response.status(201).json(await service.create(request.auth!.userId, input))
  })

  router.patch('/:id', async (request, response) => {
    const id = parseFavouriteId(request.params.id!)
    const input = parseRenameFavouriteRequest(request.body)
    response.json(await service.rename(request.auth!.userId, id, input))
  })

  router.delete('/:id', async (request, response) => {
    const id = parseFavouriteId(request.params.id!)
    await service.delete(request.auth!.userId, id)
    response.status(204).end()
  })

  return router
}
