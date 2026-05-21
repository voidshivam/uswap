import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { Suspense, lazy } from "react";

import { Layout } from "@/components/Layout";
import { BearLoader } from "@/components/Bear";
import { Toaster } from "@/components/ui/sonner";

const LandingPage = lazy(() =>
  import("@/pages/LandingPage").then((m) => ({ default: m.LandingPage })),
);
const SwapPage = lazy(() =>
  import("@/pages/SwapPage").then((m) => ({ default: m.SwapPage })),
);
const TrackPage = lazy(() =>
  import("@/pages/TrackPage").then((m) => ({ default: m.TrackPage })),
);

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <BearLoader />
    </div>
  );
}

const rootRoute = createRootRoute({ component: Layout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <LandingPage />
    </Suspense>
  ),
});

const swapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/swap",
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <SwapPage />
    </Suspense>
  ),
});

const trackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/track",
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <TrackPage />
    </Suspense>
  ),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  swapRoute,
  trackRoute,
]);
const router = createRouter({ routeTree, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  );
}
