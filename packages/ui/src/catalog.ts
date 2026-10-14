import type { QueryClient } from "@tanstack/vue-query";
import { onMounted, onUnmounted, ref } from "vue";
// One stream per mounted frontend; coalesced invalidation preserves cached DOM.
export function useCatalog(queryClient: QueryClient) {
  const connected = ref(false);
  let events: EventSource;
  let timer: ReturnType<typeof setInterval>;
  let burst: ReturnType<typeof setTimeout> | undefined;
  let queued = false;
  let refreshing = false;
  let stopped = false;
  const refresh = async () => {
    if (refreshing) {
      queued = true;
      return;
    }
    refreshing = true;
    try {
      await Promise.all(
        ["products", "selection-stock", "order-stock", "order"].map((key) =>
          queryClient.invalidateQueries(
            { queryKey: [key] },
            { cancelRefetch: false },
          ),
        ),
      );
    } finally {
      refreshing = false;
      if (queued && !stopped) {
        queued = false;
        void refresh();
      }
    }
  };
  const schedule = () => {
    if (!burst)
      burst = setTimeout(() => {
        burst = undefined;
        void refresh();
      }, 100);
  };
  const focus = () => {
    if (document.visibilityState === "visible") schedule();
  };
  onMounted(() => {
    events = new EventSource("/api/catalog/events");
    events.onopen = () => {
      connected.value = true;
      schedule();
    };
    events.onerror = () => {
      connected.value = false;
      schedule();
    };
    events.addEventListener("catalog", schedule);
    timer = setInterval(schedule, 30000);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
  });
  onUnmounted(() => {
    stopped = true;
    events?.close();
    clearInterval(timer);
    if (burst) clearTimeout(burst);
    window.removeEventListener("focus", focus);
    document.removeEventListener("visibilitychange", focus);
  });
  return connected;
}
