import ElementPlus from "element-plus";
import { createApp, ref } from "vue";
import { createWebHistory } from "vue-router";
import { japaneseLocale } from "./locale.ts";
import "element-plus/dist/index.css";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { createPublicClient } from "@training2/api-client/public";
import {
  configureBrowserAuth,
  fetchAuthSession,
  signOut,
} from "@training2/auth/browser";
import type { RouteManifest, Scope } from "@training2/screen-contracts";
import axios from "axios";
import App from "./App.vue";
import { createAdminClient } from "./admin-client.ts";
import {
  clearSession,
  draft,
  isAdministrator,
  runtimeKey,
  session,
} from "./context.ts";
import { createScreenRouter } from "./router.ts";
import "./style.css";
export async function mountFrontend(scope: Scope, manifest: RouteManifest) {
  try {
    const configResponse = await fetch("/auth-config.json");
    if (!configResponse.ok) throw new Error("config");
    configureBrowserAuth(await configResponse.json());
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, refetchOnWindowFocus: false },
        mutations: { retry: false },
      },
    });
    const router = createScreenRouter(manifest, createWebHistory());
    const refreshSession = async () => {
      try {
        const auth = await fetchAuthSession();
        const payload = auth.tokens?.accessToken?.payload;
        if (!payload?.sub) {
          if (session.sub) queryClient.clear();
          clearSession(!session.sub);
          return;
        }
        if (session.sub && session.sub !== String(payload.sub)) {
          clearSession();
          queryClient.clear();
        }
        session.sub = String(payload.sub);
        session.email = String(auth.tokens?.idToken?.payload.email ?? "");
        const groups = payload["cognito:groups"];
        session.groups = Array.isArray(groups) ? groups.map(String) : [];
      } catch {
        if (session.sub) queryClient.clear();
        clearSession(!session.sub);
      }
    };
    await refreshSession();
    router.beforeEach(async (to) => {
      if (!to.matched.length) return "/products";
      await refreshSession();
      if (to.meta.access !== "any" && !session.sub)
        return { path: "/login", query: { returnTo: to.fullPath } };
      if (to.meta.access === "admin" && !isAdministrator.value)
        return scope === "public"
          ? { path: "/products", query: { denied: "admin" } }
          : { path: "/login", query: { denied: "1" } };
      if (
        scope === "public" &&
        isAdministrator.value &&
        to.path.startsWith("/orders")
      ) {
        draft.items = [];
        draft.key = "";
        return "/products";
      }
      return true;
    });
    function authenticatedHttp(baseURL: string) {
      const http = axios.create({ baseURL, timeout: 8000 });
      const requestOwners = new WeakMap<object, string>();
      http.interceptors.request.use(async (request) => {
        const owner = session.sub;
        if (owner) {
          requestOwners.set(request, owner);
          try {
            const auth = await fetchAuthSession();
            if (session.sub !== owner) throw new Error("Session changed");
            const token = auth.tokens?.accessToken?.toString();
            if (!token) throw new Error("session");
            request.headers.set("Authorization", `Bearer ${token}`);
          } catch {
            if (session.sub === owner) {
              clearSession();
              queryClient.clear();
              if (router.currentRoute.value.meta.access !== "any")
                void router.replace("/login");
            }
            throw new Error("session");
          }
        }
        return request;
      });
      http.interceptors.response.use(
        (response) => response,
        async (error) => {
          if (error.response?.status === 401) {
            // A response from a previous account must not sign out the new session.
            const owner = error.config
              ? requestOwners.get(error.config)
              : undefined;
            if (!owner || owner !== session.sub) return Promise.reject(error);
            const returnTo = router.currentRoute.value.fullPath;
            clearSession();
            queryClient.clear();
            await signOut().catch(() => {});
            if (router.currentRoute.value.meta.access !== "any")
              await router.replace({
                path: "/login",
                query: { expired: "1", returnTo },
              });
          }
          return Promise.reject(error);
        },
      );
      return http;
    }
    const http = authenticatedHttp("/api");
    const adminClient = createAdminClient({
      endpoint: new URL("/admin-api/graphql", window.location.origin).href,
      owner: () => session.sub,
      accessToken: async () =>
        (await fetchAuthSession()).tokens?.accessToken?.toString(),
      unauthorized: async (owner) => {
        if (owner !== session.sub) return;
        const returnTo = router.currentRoute.value.fullPath;
        clearSession();
        queryClient.clear();
        await signOut().catch(() => {});
        // An expired request must never redirect a newly signed-in account.
        if (!session.sub && router.currentRoute.value.meta.access !== "any")
          await router.replace({
            path: "/login",
            query: { expired: "1", returnTo },
          });
      },
    });
    const logout = async () => {
      clearSession();
      queryClient.clear();
      await signOut();
      await router.replace("/login");
    };
    const app = createApp(App);
    app.provide(runtimeKey, {
      scope,
      catalogConnected: ref(false),
      router,
      queryClient,
      publicClient: createPublicClient(http),
      adminClient,
      refreshSession,
      logout,
    });
    app.use(router);
    app.use(ElementPlus, { locale: japaneseLocale });
    app.use(VueQueryPlugin, { queryClient });
    await router.isReady();
    app.mount("#app");
  } catch {
    const root = document.querySelector("#app");
    if (root)
      root.textContent =
        "認証設定を読み込めません。管理者に確認してから再読み込みしてください。";
  }
}
