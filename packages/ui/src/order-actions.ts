import { useMutation } from "@tanstack/vue-query";
import { ElMessageBox } from "element-plus";
import { computed, ref } from "vue";
import { useRuntime } from "./context.ts";
import { apiMessage } from "./helpers.ts";
export function useOrderActions() {
  const runtime = useRuntime();
  const asking = ref(false);
  const error = ref("");
  const operation = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string;
      action: "confirm" | "cancel";
    }) =>
      action === "confirm"
        ? runtime.publicClient.confirmOrder({ path: { id } })
        : runtime.publicClient.cancelOrder({ path: { id } }),
    onSuccess: async (updated) => {
      runtime.queryClient.setQueryData(["order", updated.id], updated);
      await Promise.all(
        ["orders", "products", "order-stock", "selection-stock"].map((key) =>
          runtime.queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
    },
    onError: (failure) => {
      error.value = apiMessage(failure);
      void runtime.queryClient.invalidateQueries({ queryKey: ["orders"] });
      void runtime.queryClient.invalidateQueries({ queryKey: ["order-stock"] });
    },
  });
  const busy = computed(() => asking.value || operation.isPending.value);
  async function request(
    id: string,
    action: "confirm" | "cancel",
    allowed: () => boolean = () => true,
  ) {
    if (busy.value || !allowed()) return;
    asking.value = true;
    error.value = "";
    try {
      await ElMessageBox.confirm(
        action === "confirm"
          ? "この注文を確定しますか？確定すると在庫を確保します。"
          : "この注文をキャンセルしますか？確定済みの場合は在庫を戻します。",
        action === "confirm" ? "注文確定の確認" : "注文キャンセルの確認",
        {
          confirmButtonText:
            action === "confirm" ? "注文を確定" : "注文をキャンセル",
          cancelButtonText: "戻る",
          type: "warning",
          closeOnClickModal: false,
        },
      );
    } catch {
      asking.value = false;
      return;
    }
    asking.value = false;
    // Stock or state may change while the confirmation dialog is open.
    if (!allowed()) {
      error.value =
        "在庫または注文状態が変更されました。最新の内容をご確認ください。";
      return;
    }
    operation.mutate({ id, action });
  }
  return { busy, error, operation, request };
}
