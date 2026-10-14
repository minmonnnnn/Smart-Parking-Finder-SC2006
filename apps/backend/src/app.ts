import express, { type Express, type Router } from 'express'
import cors from 'cors'
import { ApiException, errorHandler } from './lib/errors/index.js'

export interface AppDependencies {
  frontendOrigin?: string
  auth?: Router
  users?: Router
  favourites?: Router
  routing?: Router
  search?: Router
  weather?: Router
}

export function createApp(dependencies: AppDependencies): Express {
  const app = express()
  app.use(cors({ origin: [dependencies.frontendOrigin ?? 'http://localhost:5173'] }))
  app.use(express.json())
  app.get('/health', (_request, response) => {
    response.json({ ok: true })
  })

  if (dependencies.auth) app.use('/api/auth', dependencies.auth)
  if (dependencies.users) app.use('/api/users', dependencies.users)
  if (dependencies.favourites) app.use('/api/favourites', dependencies.favourites)
  if (dependencies.routing) app.use('/api/routes', dependencies.routing)
  if (dependencies.search) app.use('/api', dependencies.search)
  if (dependencies.weather) app.use('/api/weather', dependencies.weather)

  app.use((_request, _response, next) => {
    next(new ApiException(404, 'NOT_FOUND', 'Not found'))
  })
  app.use(errorHandler)

  return app
}
