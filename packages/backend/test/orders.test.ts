import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { parseApiConfig } from "@training2/config";
import { createLogger } from "@training2/logger";
import { createPrismaClient } from "@training2/prisma";
import { jsonResponse, withTestDatabase } from "@training2/test-utils";
import { createApi } from "../src/index.ts";

const asyncRequest = (
  api: Awaited<ReturnType<typeof createApi>>,
  path: string,
  options: RequestInit,
) => Promise.resolve(api.app.request(path, options));
const auth = {
  verify: async (sub: string) => ({
    sub,
    groups: sub === "admin" ? ["admin"] : [],
  }),
};
const logger = createLogger({ sink: () => {} });
test("AC-O/S: real orders enforce snapshot pricing, idempotency, ownership and atomic inventory transitions", async () =>
  withTestDatabase(async (prisma, url) => {
    const api = await createApi(
      "public",
      parseApiConfig({ DATABASE_URL: url, NODE_ENV: "test" }, "public"),
      auth,
      { logger },
    );
    const request = (
      path: string,
      method = "GET",
      body?: unknown,
      owner = "buyer",
      key: string = randomUUID(),
    ) =>
      asyncRequest(api, path, {
        method,
        headers: {
          ...(owner ? { Authorization: "Bearer " + owner } : {}),
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    const create = (
      items: unknown[],
      key: string = randomUUID(),
      owner = "buyer",
    ) => request("/orders", "POST", { items }, owner, key).then(jsonResponse);
    try {
      const p = await prisma.products.create({
        data: { code: "ORDER-A", name: "原始商品", price_jpy: 500n, stock: 5 },
      });
      const q = await prisma.products.create({
        data: { code: "ORDER-B", name: "不足商品", price_jpy: 100n, stock: 0 },
      });
      const key: string = randomUUID();
      const items = [
        { productId: p.id, quantity: 2 },
        { productId: q.id, quantity: 1 },
      ];
      const draft = await create(items, key);
      assert.equal(draft.status, 201);
      assert.equal(draft.body.status, "draft");
      assert.equal(draft.body.totalJpy, 1100);
      assert.equal(
        (await prisma.products.findUniqueOrThrow({ where: { id: p.id } }))
          .stock,
        5,
      );
      const repeated = await create([...items].reverse(), key.toUpperCase());
      assert.equal(repeated.status, 200);
      assert.equal(repeated.body.id, draft.body.id);
      assert.equal(
        (await create([{ productId: p.id, quantity: 1 }], key)).status,
        409,
      );
      assert.equal((await create(items, key, "other")).status, 201);
      const before = await prisma.orders.count();
      assert.equal(
        (
          await request("/orders", "POST", {
            items: [{ productId: p.id, quantity: 1 }],
            owner: "other",
            totalJpy: 0,
          })
        ).status,
        400,
      );
      for (const invalid of [
        [],
        [{ productId: p.id, quantity: 0 }],
        [
          { productId: p.id, quantity: 1 },
          { productId: p.id.toUpperCase(), quantity: 1 },
        ],
        [{ productId: p.id, quantity: 1, priceJpy: 0 }],
      ])
        assert.equal((await create(invalid)).status, 400);
      assert.equal(
        (
          await create([
            { productId: p.id, quantity: 1 },
            { productId: randomUUID(), quantity: 1 },
          ])
        ).status,
        404,
      );
      assert.equal(await prisma.orders.count(), before);
      for (const owner of ["other", "admin"])
        for (const action of ["", "/confirm", "/cancel"])
          assert.equal(
            (
              await request(
                "/orders/" + draft.body.id + action,
                action ? "POST" : "GET",
                undefined,
                owner,
              )
            ).status,
            404,
          );
      for (const action of ["", "/confirm", "/cancel"])
        assert.equal(
          (
            await request(
              "/orders/" + draft.body.id + action,
              action ? "POST" : "GET",
              undefined,
              "",
            )
          ).status,
          401,
        );
      assert.equal((await create(items, randomUUID(), "")).status, 401);
      const shortage = await request(
        "/orders/" + draft.body.id + "/confirm",
        "POST",
      ).then(jsonResponse);
      assert.equal(shortage.status, 409);
      assert.equal(shortage.body.error.code, "INSUFFICIENT_STOCK");
      assert.equal(
        (await prisma.products.findUniqueOrThrow({ where: { id: p.id } }))
          .stock,
        5,
      );
      assert.equal(
        (
          await prisma.orders.findUniqueOrThrow({
            where: { id: draft.body.id },
          })
        ).status,
        "draft",
      );
      const cancelDraft = await request(
        "/orders/" + draft.body.id + "/cancel",
        "POST",
      ).then(jsonResponse);
      assert.equal(cancelDraft.body.status, "cancelled");
      assert.equal(
        (await prisma.products.findUniqueOrThrow({ where: { id: p.id } }))
          .stock,
        5,
      );
      assert.equal(
        (await request("/orders/" + draft.body.id + "/confirm", "POST")).status,
        409,
      );
      const own = await create([{ productId: p.id, quantity: 2 }]);
      await prisma.products.update({
        where: { id: p.id },
        data: { price_jpy: 900n, name: "新名称" },
      });
      const confirmed = await request(
        "/orders/" + own.body.id + "/confirm",
        "POST",
      ).then(jsonResponse);
      assert.equal(confirmed.status, 200);
      assert.equal(confirmed.body.totalJpy, 1000);
      assert.equal(confirmed.body.items[0].productName, "原始商品");
      assert.equal(
        (await prisma.products.findUniqueOrThrow({ where: { id: p.id } }))
          .stock,
        3,
      );
      assert.equal(
        (await request("/orders/" + own.body.id + "/confirm", "POST")).status,
        200,
      );
      assert.equal(
        (await prisma.products.findUniqueOrThrow({ where: { id: p.id } }))
          .stock,
        3,
      );
      for (let i = 0; i < 2; i++)
        assert.equal(
          (await request("/orders/" + own.body.id + "/cancel", "POST")).status,
          200,
        );
      assert.equal(
        (await prisma.products.findUniqueOrThrow({ where: { id: p.id } }))
          .stock,
        5,
      );
      const read = await request("/orders/" + own.body.id).then(jsonResponse);
      assert.equal(read.body.status, "cancelled");
      assert.ok(!("owner_sub" in read.body));
    } finally {
      await api.close();
    }
  }));
test("AC-C01/C07: independent PostgreSQL connections overlap while locked; no oversell or duplicate creation", async () =>
  withTestDatabase(async (prisma, url) => {
    const a = await createApi(
      "public",
      parseApiConfig({ DATABASE_URL: url, NODE_ENV: "test" }, "public"),
      auth,
      { logger },
    );
    const b = await createApi(
      "public",
      parseApiConfig({ DATABASE_URL: url, NODE_ENV: "test" }, "public"),
      auth,
      { logger },
    );
    const blocker = createPrismaClient(url);
    const p = await prisma.products.create({
      data: { code: "ONE-LEFT", name: "最后一件", price_jpy: 100n, stock: 1 },
    });
    const call = (
      api: typeof a,
      path: string,
      body?: unknown,
      key: string = randomUUID(),
      owner = "buyer",
    ) =>
      asyncRequest(api, path, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + owner,
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }).then(jsonResponse);
    let unlock = () => {};
    let lockReady = () => {};
    const release = new Promise<void>((r) => {
      unlock = r;
    });
    const ready = new Promise<void>((r) => {
      lockReady = r;
    });
    let held: Promise<void> | undefined;
    try {
      const key: string = randomUUID();
      const same = await Promise.all([
        call(a, "/orders", { items: [{ productId: p.id, quantity: 1 }] }, key),
        call(b, "/orders", { items: [{ productId: p.id, quantity: 1 }] }, key),
      ]);
      assert.deepEqual(same.map((r) => r.status).sort(), [200, 201]);
      assert.equal(same[0].body.id, same[1].body.id);
      assert.equal(await prisma.orders.count(), 1);
      const second = await call(
        b,
        "/orders",
        {
          items: [{ productId: p.id, quantity: 1 }],
        },
        randomUUID(),
        "buyer-b",
      );
      held = blocker.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM public.products WHERE id=${p.id}::uuid FOR UPDATE`;
          lockReady();
          await release;
        },
        { timeout: 10000 },
      );
      await ready;
      const concurrent = Promise.all([
        call(a, "/orders/" + same[0].body.id + "/confirm"),
        call(
          b,
          "/orders/" + second.body.id + "/confirm",
          undefined,
          randomUUID(),
          "buyer-b",
        ),
      ]);
      const deadline = Date.now() + 1500;
      let overlap = false;
      while (Date.now() < deadline) {
        const rows = await prisma.$queryRaw<
          { n: bigint }[]
        >`SELECT count(*) AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'`;
        if (rows[0].n >= 2n) {
          overlap = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 20));
      }
      unlock();
      await held;
      const results = await concurrent;
      assert.ok(
        overlap,
        "Both independent order transactions must actually wait on PostgreSQL locks",
      );
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
      assert.equal(
        (await prisma.products.findUniqueOrThrow({ where: { id: p.id } }))
          .stock,
        0,
      );
      assert.equal(
        await prisma.orders.count({ where: { status: "confirmed" } }),
        1,
      );
    } finally {
      unlock();
      await held?.catch(() => {});
      await blocker.$disconnect();
      await a.close();
      await b.close();
    }
  }));
