import ElementPlus from "element-plus";
import { createApp } from "vue";
import { createWebHistory } from "vue-router";
import "element-plus/dist/index.css";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { createPrivateClient } from "@training2/api-client/private";
import { createPublicClient } from "@training2/api-client/public";
import {
  configureBrowserAuth,
  fetchAuthSession,
  signOut,
} from "@training2/auth/browser";
import type { RouteManifest, Scope } from "@training2/screen-contracts";
import axios from "axios";
import App from "./App.vue";
import { clearSession, runtimeKey, session } from "./context.ts";
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
      if (to.meta.access === "admin" && !session.groups.includes("admin"))
        return { path: "/login", query: { denied: "1" } };
      return true;
    });
    const http = axios.create({ baseURL: "/api", timeout: 8000 });
    http.interceptors.request.use(async (request) => {
      if (session.sub) {
        try {
          const auth = await fetchAuthSession();
          const token = auth.tokens?.accessToken?.toString();
          if (!token) throw new Error("session");
          request.headers.set("Authorization", `Bearer ${token}`);
        } catch {
          clearSession();
          queryClient.clear();
          if (router.currentRoute.value.meta.access !== "any")
            void router.replace("/login");
          throw new Error("session");
        }
      }
      return request;
    });
    http.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
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
    const logout = async () => {
      await signOut();
      clearSession();
      queryClient.clear();
      await router.replace("/login");
    };
    const app = createApp(App);
    app.provide(runtimeKey, {
      scope,
      router,
      queryClient,
      publicClient: createPublicClient(http),
      privateClient: createPrivateClient(http),
      refreshSession,
      logout,
    });
    app.use(router);
    app.use(ElementPlus);
    app.use(VueQueryPlugin, { queryClient });
    await router.isReady();
    app.mount("#app");
  } catch {
    const root = document.querySelector("#app");
    if (root)
      root.textContent = "登录配置暂不可用。请初始化本地认证后刷新页面。";
  }
}
