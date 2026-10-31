import "dotenv/config";
import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import {
  createSupabaseAuthGateway,
  createSupabaseClients,
} from "./lib/supabase.js";
import { createSupabaseFavouritesGateway } from "./lib/supabase-favourites.js";
import {
  createAuthRouter,
  createUsersRouter,
} from "./modules/auth/auth.routes.js";
import { createFavouritesRouter } from "./modules/favourites/favourites.routes.js";
import routingRouter from "./modules/routing/routing.routes.js";
import { createSearchRouter } from "./modules/search/search.routes.js";
import weatherRouter from "./modules/weather/weather.routes.js";
import { createAvailabilityRepository } from "./modules/availability/repository.js";
import { createAvailabilityRouter } from "./modules/availability/routes.js";
import { createAlertRepository } from "./modules/availability/alerts.repository.js";
import { createAlertRouter } from "./modules/availability/alerts.routes.js";
import {
  AvailabilityAlertSubject,
  ConsoleAlertObserver,
} from "./modules/availability/observers/index.js";
import { startAvailabilityPoller } from "./modules/availability/poller.js";
import { loadHdbLtaCapacities } from "./modules/availability/lta-capacities.js";

const env = loadEnv(process.env);
const clients = createSupabaseClients(env);
const authGateway = createSupabaseAuthGateway(clients);
const favouritesGateway = createSupabaseFavouritesGateway(clients.adminClient);

const availabilityRepository = createAvailabilityRepository(
  clients.adminClient,
);
const alertRepository = createAlertRepository(clients.adminClient);

// Initialize GoF Observer Pattern: Subject and Concrete Observers
const alertSubject = new AvailabilityAlertSubject();
alertSubject.attach(new ConsoleAlertObserver());

const server = createApp({
  frontendOrigin: env.frontendOrigin,
  auth: createAuthRouter({ gateway: authGateway }),
  users: createUsersRouter({ gateway: authGateway }),
  favourites: createFavouritesRouter({
    authGateway,
    gateway: favouritesGateway,
  }),
  routing: routingRouter,
  search: createSearchRouter(clients.adminClient),
  weather: weatherRouter,
  availability: createAvailabilityRouter(availabilityRepository),
  alerts: createAlertRouter({
    verifyToken: authGateway.verifyToken,
    alerts: alertRepository,
    availability: availabilityRepository,
  }),
}).listen(env.port, () => {
  console.log(`Backend listening on http://localhost:${env.port}`);
});

const ltaAccountKey = process.env.LTA_DATAMALL_API_KEY?.trim();

const stopAvailabilityPoller = startAvailabilityPoller(availabilityRepository, {
  ...(ltaAccountKey
    ? {
        lta: {
          accountKey: ltaAccountKey,
          loadHdbCapacities: () => loadHdbLtaCapacities(clients.adminClient),
        },
      }
    : {}),
  checkAlerts: () =>
    alertSubject.checkAlerts({
      alerts: alertRepository,
      availability: availabilityRepository,
    }),
});

function shutdown(): void {
  stopAvailabilityPoller();
  server.close();
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
