import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';
import { NavigationPage } from './pages/NavigationPage';

const rootRoute = createRootRoute({
  component: () => (
    <div>
      <Outlet />
    </div>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <div>Home / Search Page (Min)</div>,
});

const navigationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/navigation',
  component: NavigationPage,
});

const routeTree = rootRoute.addChildren([indexRoute, navigationRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

