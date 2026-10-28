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
import availabilityRouter from './modules/availability/routes.js'
import { createAlertRouter } from './modules/availability/alerts.routes.js'
import { startAvailabilityPoller } from './modules/availability/poller.js'
import type { AvailabilityNotification } from './modules/availability/alerts.service.js'

const env = loadEnv(process.env)
const clients = createSupabaseClients(env)
const authGateway = createSupabaseAuthGateway(clients)
const favouritesGateway = createSupabaseFavouritesGateway(clients.adminClient)

// Notification logger for real-time carpark availability tier changes
const logAvailabilityNotification = async (notification: AvailabilityNotification) => {
  const timestamp = new Date().toLocaleTimeString('en-SG', { hour12: false })
  console.log(
    `[${timestamp}] 🔔 [AVAILABILITY ALERT] Alert #${notification.alertId} for User "${notification.userId}": Carpark "${notification.carParkNo}" status changed from "${notification.previousStatus}" to "${notification.currentStatus}"!`
  )
}

// Start background poller to fetch real-time Singapore carpark availability from data.gov.sg
startAvailabilityPoller(logAvailabilityNotification)

createApp({
  frontendOrigin: env.frontendOrigin,
  auth: createAuthRouter({ gateway: authGateway }),
  users: createUsersRouter({ gateway: authGateway }),
  favourites: createFavouritesRouter({ authGateway, gateway: favouritesGateway }),
  routing: routingRouter,
  search: createSearchRouter(clients.adminClient),
  weather: weatherRouter,
  availability: availabilityRouter,
  alerts: createAlertRouter(authGateway.verifyToken),
}).listen(env.port, () => {
  console.log(`Backend listening on http://localhost:${env.port}`)
})
