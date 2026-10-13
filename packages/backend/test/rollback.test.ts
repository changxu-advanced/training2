import assert from "node:assert/strict";
import { test } from "node:test";
import { withOrders } from "./concurrency-helper.ts";

test("AC-C06/C08: real mid-write failure rolls back/releases locks; serialization retry is bounded", async () =>
  withOrders(async ({ db, call, create, logs }) => {
    const ids = [
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
    ];
    await db.products.createMany({
      data: ids.map((id, i) => ({
        id,
        code: i ? "FAULT-LAST" : "FAULT-FIRST",
        name: "故障夹具",
        price_jpy: 100n,
        stock: 2,
      })),
    });
    for (const sql of [
      "CREATE SEQUENCE partial_attempts",
      "CREATE FUNCTION fail_partial() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.stock<OLD.stock AND OLD.code IN ('FAULT-FIRST','FAULT-LAST') THEN PERFORM nextval('partial_attempts'); IF OLD.code='FAULT-LAST' THEN RAISE EXCEPTION 'private-fault-marker' USING ERRCODE='XX000'; END IF; END IF; RETURN NEW; END $$",
      "CREATE TRIGGER partial_failure BEFORE UPDATE OF stock ON products FOR EACH ROW EXECUTE FUNCTION fail_partial()",
    ])
      await db.$executeRawUnsafe(sql);
    const order = await create(
      0,
      [...ids].reverse().map((productId) => ({ productId, quantity: 1 })),
    );
    const failed = await call(0, "/orders/" + order.body.id + "/confirm");
    assert.equal(failed.status, 500);
    assert.ok(!JSON.stringify(failed.body).includes("private-fault-marker"));
    assert.ok(!logs.join("").includes("private-fault-marker"));
    assert.deepEqual(
      (await db.products.findMany({ where: { id: { in: ids } } })).map(
        (p) => p.stock,
      ),
      [2, 2],
    );
    assert.equal(
      (await db.orders.findUniqueOrThrow({ where: { id: order.body.id } }))
        .status,
      "draft",
    );
    const attempts = await db.$queryRaw<
      { last_value: bigint }[]
    >`SELECT last_value FROM partial_attempts`;
    assert.equal(
      attempts[0].last_value,
      2n,
      "Failure must follow an actual first stock write",
    );
    await db.$executeRawUnsafe("DROP TRIGGER partial_failure ON products");
    assert.equal(
      (await call(1, "/orders/" + order.body.id + "/confirm")).status,
      200,
    );
    assert.deepEqual(
      (await db.products.findMany({ where: { id: { in: ids } } })).map(
        (p) => p.stock,
      ),
      [1, 1],
    );
    for (const sql of [
      "CREATE SEQUENCE once_attempts",
      "CREATE SEQUENCE always_attempts",
      "CREATE FUNCTION fail_serialization() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE n bigint; BEGIN IF NEW.stock<OLD.stock THEN IF OLD.code='RETRY-ONCE' THEN n:=nextval('once_attempts'); IF n=1 THEN RAISE EXCEPTION 'private-serialization-marker' USING ERRCODE='40001'; END IF; ELSIF OLD.code='RETRY-ALWAYS' THEN PERFORM nextval('always_attempts'); RAISE EXCEPTION 'private-serialization-marker' USING ERRCODE='40001'; END IF; END IF; RETURN NEW; END $$",
      "CREATE TRIGGER serialization_failure BEFORE UPDATE OF stock ON products FOR EACH ROW EXECUTE FUNCTION fail_serialization()",
    ])
      await db.$executeRawUnsafe(sql);
    for (const always of [false, true]) {
      const p = await db.products.create({
        data: {
          code: always ? "RETRY-ALWAYS" : "RETRY-ONCE",
          name: "重试夹具",
          price_jpy: 100n,
          stock: 2,
        },
      });
      const draft = await create(0, [{ productId: p.id, quantity: 1 }]);
      const result = await call(0, "/orders/" + draft.body.id + "/confirm");
      assert.equal(
        result.status,
        always ? 503 : 200,
        JSON.stringify(result.body),
      );
      assert.equal(
        (await db.products.findUniqueOrThrow({ where: { id: p.id } })).stock,
        always ? 2 : 1,
      );
      assert.equal(
        (await db.orders.findUniqueOrThrow({ where: { id: draft.body.id } }))
          .status,
        always ? "draft" : "confirmed",
      );
      const count = always
        ? await db.$queryRaw<
            { last_value: bigint }[]
          >`SELECT last_value FROM always_attempts`
        : await db.$queryRaw<
            { last_value: bigint }[]
          >`SELECT last_value FROM once_attempts`;
      assert.equal(count[0].last_value, always ? 3n : 2n);
    }
  }));
