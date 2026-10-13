import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { overlap, withOrders } from "./concurrency-helper.ts";

test("AC-C02..C05/C07: overlapping confirm/cancel, ordered multi-product locks and idempotency conflicts", async () =>
  withOrders(async ({ db, gateDb, call, create }) => {
    const product = await db.products.create({
      data: { code: "STATE-RACE", name: "状态竞争", price_jpy: 100n, stock: 5 },
    });
    const initial = await create(0, [{ productId: product.id, quantity: 2 }]);
    const orderId = initial.body.id;
    const stock = async () =>
      (await db.products.findUniqueOrThrow({ where: { id: product.id } }))
        .stock;
    const orderGate = () =>
      overlap(
        db,
        gateDb,
        (tx) =>
          tx.$queryRaw`SELECT id FROM public.orders WHERE id=${orderId}::uuid FOR UPDATE`,
        () =>
          Promise.all([
            call(0, "/orders/" + orderId + "/confirm"),
            call(1, "/orders/" + orderId + "/confirm"),
          ]),
      );
    const confirms = await orderGate();
    assert.deepEqual(
      confirms.map((r) => r.status),
      [200, 200],
    );
    assert.equal(await stock(), 3);
    const cancels = await overlap(
      db,
      gateDb,
      (tx) =>
        tx.$queryRaw`SELECT id FROM public.orders WHERE id=${orderId}::uuid FOR UPDATE`,
      () =>
        Promise.all([
          call(0, "/orders/" + orderId + "/cancel"),
          call(1, "/orders/" + orderId + "/cancel"),
        ]),
    );
    assert.deepEqual(
      cancels.map((r) => r.status),
      [200, 200],
    );
    assert.equal(await stock(), 5);
    const mixed = await create(0, [{ productId: product.id, quantity: 2 }]);
    const race = await overlap(
      db,
      gateDb,
      (tx) =>
        tx.$queryRaw`SELECT id FROM public.orders WHERE id=${mixed.body.id}::uuid FOR UPDATE`,
      () =>
        Promise.all([
          call(0, "/orders/" + mixed.body.id + "/confirm"),
          call(1, "/orders/" + mixed.body.id + "/cancel"),
        ]),
    );
    assert.ok([200, 409].includes(race[0].status));
    assert.equal(race[1].status, 200);
    assert.equal(
      (await db.orders.findUniqueOrThrow({ where: { id: mixed.body.id } }))
        .status,
      "cancelled",
    );
    assert.equal(await stock(), 5);
    const rows = await Promise.all(
      ["MULTI-A", "MULTI-B"].map((code) =>
        db.products.create({
          data: { code, name: code, price_jpy: 100n, stock: 1 },
        }),
      ),
    );
    const ids = rows.map((r) => r.id).sort();
    const one = await create(
      0,
      ids.map((productId) => ({ productId, quantity: 1 })),
    );
    const two = await create(
      1,
      [...ids].reverse().map((productId) => ({ productId, quantity: 1 })),
    );
    const allocations = await overlap(
      db,
      gateDb,
      (tx) =>
        tx.$queryRaw`SELECT id FROM public.products WHERE id=${ids[0]}::uuid FOR UPDATE`,
      () =>
        Promise.all([
          call(0, "/orders/" + one.body.id + "/confirm"),
          call(1, "/orders/" + two.body.id + "/confirm"),
        ]),
    );
    assert.deepEqual(allocations.map((r) => r.status).sort(), [200, 409]);
    assert.deepEqual(
      (await db.products.findMany({ where: { id: { in: ids } } })).map(
        (r) => r.stock,
      ),
      [0, 0],
    );
    assert.equal(
      await db.orders.count({
        where: { id: { in: [one.body.id, two.body.id] }, status: "confirmed" },
      }),
      1,
    );
    for (const different of [false, true]) {
      const key = randomUUID();
      const repeated = await overlap(
        db,
        gateDb,
        (tx) =>
          tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"buyer:" + key},0))`,
        () =>
          Promise.all([
            create(0, [{ productId: product.id, quantity: 1 }], key),
            create(
              1,
              [{ productId: product.id, quantity: different ? 2 : 1 }],
              key,
            ),
          ]),
      );
      assert.deepEqual(
        repeated.map((r) => r.status).sort(),
        different ? [201, 409] : [200, 201],
      );
      assert.equal(
        await db.orders.count({
          where: { owner_sub: "buyer", idempotency_key: key },
        }),
        1,
      );
    }
  }));
