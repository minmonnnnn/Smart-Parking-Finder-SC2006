import 'dotenv/config'
import { createApp } from './app.js'
import { loadEnv } from './config/env.js'
import { createSupabaseAuthGateway, createSupabaseClients } from './lib/supabase.js'
import { createSupabaseFavouritesGateway } from './lib/supabase-favourites.js'
import { createAuthRouter, createUsersRouter } from './modules/auth/auth.routes.js'
import { createFavouritesRouter } from './modules/favourites/favourites.routes.js'
import routingRouter from './modules/routing/routing.routes.js'
import { createSearchRouter } from './modules/search/search.routes.js'
import weatherRouter from './modules/weather/weather.routes.js'

const env = loadEnv(process.env)
const clients = createSupabaseClients(env)
const authGateway = createSupabaseAuthGateway(clients)
const favouritesGateway = createSupabaseFavouritesGateway(clients.adminClient)
createApp({
  frontendOrigin: env.frontendOrigin,
  auth: createAuthRouter({ gateway: authGateway }),
  users: createUsersRouter({ gateway: authGateway }),
  favourites: createFavouritesRouter({ authGateway, gateway: favouritesGateway }),
  routing: routingRouter,
  search: createSearchRouter(clients.adminClient),
  weather: weatherRouter,
}).listen(env.port)
