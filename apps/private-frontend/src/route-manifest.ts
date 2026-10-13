// Used to construct Vue Router; runtime and Vitest verify router.getRoutes().
import type { RouteManifest } from "@training2/screen-contracts";
export const routeManifest: RouteManifest = {
  scope: "private",
  status: "implemented",
  routes: [
    {
      screenId: "ADM-LOGIN",
      path: "/login",
    },
    {
      screenId: "ADM-PRODUCTS",
      path: "/products",
    },
    {
      screenId: "ADM-PRODUCT-CREATE",
      path: "/products/new",
    },
  ],
  redirects: [
    {
      path: "/",
      to: "/products",
    },
  ],
};
