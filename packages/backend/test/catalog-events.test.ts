import assert from "node:assert/strict";
import { test } from "node:test";
import { parseApiConfig } from "@training2/config";
import { createLogger } from "@training2/logger";
import { withTestDatabase } from "@training2/test-utils";
import { Client } from "pg";
import { createApi } from "../src/index.ts";

test("catalog invalidation is commit-only, cross-connection and stream-safe", async () =>
  withTestDatabase(async (db, url) => {
    const listener = new Client({ connectionString: url });
    await listener.connect();
    await listener.query("LISTEN training2_catalog");
    const notices: string[] = [];
    listener.on("notification", (n) => notices.push(n.payload ?? ""));
    const api = await createApi(
      "public",
      parseApiConfig({ DATABASE_URL: url, NODE_ENV: "test" }, "public"),
      { verify: async () => ({ sub: "buyer", groups: [] }) },
      { logger: createLogger({ sink: () => {} }) },
    );
    const controller = new AbortController();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const response = await api.app.request("/catalog/events", {
        signal: controller.signal,
      });
      assert.equal(response.status, 200);
      assert.ok(
        response.headers.get("content-type")?.includes("text/event-stream"),
      );
      assert.ok(response.body);
      reader = response.body.getReader();
      const first = await reader.read();
      assert.match(new TextDecoder().decode(first.value), /event: catalog/);
      await assert.rejects(() =>
        db.$transaction(async (tx) => {
          await tx.products.create({
            data: {
              code: "ROLLBACK-NOTIFY",
              name: "rollback",
              price_jpy: 1n,
              stock: 1,
            },
          });
          throw Error("rollback");
        }),
      );
      await new Promise((r) => setTimeout(r, 80));
      assert.equal(notices.length, 0);
      await db.products.create({
        data: {
          code: "COMMIT-NOTIFY",
          name: "committed",
          price_jpy: 1n,
          stock: 1,
        },
      });
      const frame = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(Error("missing SSE")), 2000).unref(),
        ),
      ]);
      assert.match(new TextDecoder().decode(frame.value), /data: changed/);
      // Independent listener callbacks can run after the API stream callback.
      const deadline = Date.now() + 2000;
      while (!notices.length && Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, 10));
      assert.deepEqual(notices, ["changed"]);
    } finally {
      controller.abort();
      await reader?.cancel();
      await api.close();
      await listener.end();
    }
  }));
