import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { parseApiConfig } from "@training2/config";
import { createLogger } from "@training2/logger";
import { createPrismaClient, type PrismaClient } from "@training2/prisma";
import { jsonResponse, withTestDatabase } from "@training2/test-utils";
import { createApi } from "../src/index.ts";
export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
export async function withOrders(
  run: (h: {
    db: PrismaClient;
    gateDb: PrismaClient;
    call: (
      index: number,
      path: string,
      body?: unknown,
      key?: string,
    ) => Promise<Awaited<ReturnType<typeof jsonResponse>>>;
    create: (
      index: number,
      items: { productId: string; quantity: number }[],
      key?: string,
    ) => Promise<Awaited<ReturnType<typeof jsonResponse>>>;
    logs: string[];
  }) => Promise<void>,
) {
  await withTestDatabase(async (db, url) => {
    const logs: string[] = [];
    const logger = createLogger({ sink: (line) => logs.push(line) });
    const auth = { verify: async () => ({ sub: "buyer", groups: [] }) };
    const apis = await Promise.all(
      [0, 1].map(() =>
        createApi(
          "public",
          parseApiConfig({ DATABASE_URL: url, NODE_ENV: "test" }, "public"),
          auth,
          { logger },
        ),
      ),
    );
    const gateDb = createPrismaClient(url);
    const call = (
      index: number,
      path: string,
      body?: unknown,
      key: string = randomUUID(),
    ) =>
      Promise.resolve(
        apis[index].app.request(path, {
          method: "POST",
          headers: {
            Authorization: "Bearer verified-fixture",
            "Content-Type": "application/json",
            "Idempotency-Key": key,
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
      ).then(jsonResponse);
    try {
      await run({
        db,
        gateDb,
        call,
        create: (index, items, key) => call(index, "/orders", { items }, key),
        logs,
      });
    } finally {
      await gateDb.$disconnect();
      await Promise.all(apis.map((api) => api.close()));
    }
  });
}
export async function overlap<T>(
  db: PrismaClient,
  gateDb: PrismaClient,
  lock: (tx: Tx) => Promise<unknown>,
  start: () => Promise<T>,
): Promise<T> {
  let unlock = () => {};
  let ready = () => {};
  const release = new Promise<void>((r) => {
    unlock = r;
  });
  const acquired = new Promise<void>((r) => {
    ready = r;
  });
  const holding = gateDb.$transaction(
    async (tx) => {
      await lock(tx);
      ready();
      await release;
    },
    { timeout: 10000 },
  );
  try {
    await Promise.race([
      acquired,
      holding.then(() => {
        throw new Error("Gate transaction ended before acquisition");
      }),
    ]);
    const work = start();
    let observed = false;
    const deadline = Date.now() + 1500;
    while (Date.now() < deadline) {
      const rows = await db.$queryRaw<
        { n: bigint }[]
      >`SELECT count(*) n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'`;
      if (rows[0].n >= 2n) {
        observed = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 20));
    }
    unlock();
    await holding;
    const result = await work;
    assert.ok(
      observed,
      "Two independent PostgreSQL transactions must overlap on real locks",
    );
    return result;
  } finally {
    unlock();
    await holding.catch(() => {});
  }
}
