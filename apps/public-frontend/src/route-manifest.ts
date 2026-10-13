// Used to construct Vue Router; runtime and Vitest verify router.getRoutes().
import type { RouteManifest } from "@training2/screen-contracts";
export const routeManifest: RouteManifest = {
  scope: "public",
  status: "implemented",
  routes: [
    {
      screenId: "PUB-LOGIN",
      path: "/login",
    },
    {
      screenId: "PUB-PRODUCTS",
      path: "/products",
    },
    {
      screenId: "PUB-ORDER-CREATE",
      path: "/orders/new",
    },
    {
      screenId: "PUB-ORDER",
      path: "/orders/:id",
    },
  ],
  redirects: [
    {
      path: "/",
      to: "/products",
    },
  ],
};
