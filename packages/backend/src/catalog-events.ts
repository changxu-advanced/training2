import {
  ApiFailure,
  type ContractApp,
  catalogEventsRoute,
} from "@training2/api-contracts";
import type { createLogger } from "@training2/logger";
import { streamSSE } from "hono/streaming";
import { Client } from "pg";

export async function createCatalogEvents(
  url: string,
  logger: ReturnType<typeof createLogger>,
) {
  const subscribers = new Set<(event: "catalog" | "unavailable") => void>();
  let client: Client;
  let stopped = false;
  let listening = false;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const connect = async () => {
    const next = new Client({
      connectionString: url,
      connectionTimeoutMillis: 5000,
    });
    client = next;
    let lost = false;
    const disconnect = () => {
      if (lost || stopped) return;
      lost = true;
      listening = false;
      for (const notify of subscribers) notify("unavailable");
      logger.warn("Catalog listener disconnected");
      void next.end().catch(() => {});
      retry = setTimeout(() => {
        void connect().catch(() => {});
      }, 1000);
      retry.unref();
    };
    next.on("error", disconnect);
    next.on("end", disconnect);
    next.on("notification", (message) => {
      if (message.channel === "training2_catalog")
        for (const notify of subscribers) notify("catalog");
    });
    try {
      await next.connect();
      await next.query("LISTEN training2_catalog");
      listening = true;
      for (const notify of subscribers) notify("catalog");
    } catch (error) {
      disconnect();
      throw error;
    }
  };
  try {
    await connect();
  } catch (error) {
    stopped = true;
    if (retry) clearTimeout(retry);
    await client!.end().catch(() => {});
    throw error;
  }
  return {
    bind(app: ContractApp) {
      app.openapi(catalogEventsRoute, (c) => {
        if (!listening || stopped)
          throw new ApiFailure(
            503,
            "TEMPORARILY_UNAVAILABLE",
            "Catalog listener reconnecting",
          );
        c.header("Cache-Control", "no-cache, no-transform");
        c.header("X-Accel-Buffering", "no");
        return streamSSE(c, async (stream) => {
          let pending = true;
          let done = stopped;
          let wake: (() => void) | undefined;
          const notify = (event: "catalog" | "unavailable") => {
            if (event === "unavailable") done = true;
            pending = true;
            wake?.();
          };
          subscribers.add(notify);
          stream.onAbort(() => {
            done = true;
            wake?.();
          });
          try {
            while (!done) {
              if (pending) {
                pending = false;
                await stream.writeSSE({
                  event: "catalog",
                  data: "changed",
                  retry: 1000,
                });
              } else await stream.writeSSE({ event: "heartbeat", data: "ok" });
              await new Promise<void>((resolve) => {
                const timer = setTimeout(finish, 15000);
                function finish() {
                  clearTimeout(timer);
                  wake = undefined;
                  resolve();
                }
                wake = finish;
                if (pending || done) finish();
              });
            }
          } finally {
            subscribers.delete(notify);
          }
        });
      });
    },
    async close() {
      stopped = true;
      if (retry) clearTimeout(retry);
      for (const notify of subscribers) notify("unavailable");
      await client.end();
    },
  };
}
