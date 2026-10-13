// Planned route declarations; Step9 must use and verify actual Vue Router routes.
import type { RouteManifest } from "@training2/screen-contracts";
export const routeManifest: RouteManifest = {
  scope: "private",
  status: "planned",
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
