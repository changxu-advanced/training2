import type { QueryClient } from "@tanstack/vue-query";
import type { createPrivateClient } from "@training2/api-client/private";
import type { createPublicClient } from "@training2/api-client/public";
import type { Scope } from "@training2/screen-contracts";
import { type InjectionKey, inject, type Ref, reactive } from "vue";
import type { Router } from "vue-router";
export const session = reactive({ sub: "", email: "", groups: [] as string[] });
export type Selection = {
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
};
export const draft = reactive({ items: [] as Selection[], key: "" });
export type Runtime = {
  scope: Scope;
  catalogConnected: Ref<boolean>;
  router: Router;
  queryClient: QueryClient;
  publicClient: ReturnType<typeof createPublicClient>;
  privateClient: ReturnType<typeof createPrivateClient>;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
};
export const runtimeKey: InjectionKey<Runtime> = Symbol("training2-runtime");
export function useRuntime() {
  const value = inject(runtimeKey);
  if (!value) throw new Error("Frontend runtime unavailable");
  return value;
}
export function clearSession(preserveDraft = false) {
  session.sub = "";
  session.email = "";
  session.groups = [];
  if (!preserveDraft) {
    draft.items = [];
    draft.key = "";
  }
}
