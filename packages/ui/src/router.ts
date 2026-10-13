import { type RouteManifest, screens } from "@training2/screen-contracts";
import { validateActualRoutes } from "@training2/screen-contracts/validate";
import {
  createMemoryHistory,
  createRouter,
  type RouterHistory,
} from "vue-router";
import LoginPage from "./pages/LoginPage.vue";
import OrderCreatePage from "./pages/OrderCreatePage.vue";
import OrderPage from "./pages/OrderPage.vue";
import ProductFormPage from "./pages/ProductFormPage.vue";
import ProductsPage from "./pages/ProductsPage.vue";
export function createScreenRouter(
  manifest: RouteManifest,
  history: RouterHistory = createMemoryHistory(),
) {
  const components: Record<string, typeof LoginPage> = {
    "PUB-LOGIN": LoginPage,
    "ADM-LOGIN": LoginPage,
    "PUB-PRODUCTS": ProductsPage,
    "ADM-PRODUCTS": ProductsPage,
    "ADM-PRODUCT-CREATE": ProductFormPage,
    "PUB-ORDER-CREATE": OrderCreatePage,
    "PUB-ORDER": OrderPage,
  };
  const router = createRouter({
    history,
    routes: [
      ...manifest.redirects.map((r) => ({ path: r.path, redirect: r.to })),
      ...manifest.routes.map((r) => ({
        path: r.path,
        name: r.screenId,
        component: components[r.screenId],
        meta: {
          screenId: r.screenId,
          access: screens.find((s) => s.id === r.screenId)?.access,
        },
      })),
    ],
  });
  validateActualRoutes(screens, manifest.scope, router.getRoutes());
  return router;
}
