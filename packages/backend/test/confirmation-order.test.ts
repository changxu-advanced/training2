import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { withTestDatabase } from "@training2/test-utils";
import { changeOrder, createOrder } from "../src/orders.ts";

test("confirmation priority follows successful confirmation, not draft creation; distinct buyers cannot oversell", async () =>
  withTestDatabase(async (db) => {
    const p = await db.products.create({
      data: { code: "PRIORITY", name: "優先順検証", price_jpy: 100n, stock: 1 },
    });
    const a = (
      await createOrder(db, "buyer-a", randomUUID(), {
        items: [{ productId: p.id, quantity: 1 }],
      })
    ).order;
    const b = (
      await createOrder(db, "buyer-b", randomUUID(), {
        items: [{ productId: p.id, quantity: 1 }],
      })
    ).order;
    assert.equal(
      (await changeOrder(db, "buyer-b", b.id, "confirm")).status,
      "confirmed",
    );
    await assert.rejects(
      () => changeOrder(db, "buyer-a", a.id, "confirm"),
      (e) =>
        e instanceof Error && "code" in e && e.code === "INSUFFICIENT_STOCK",
    );
    assert.equal(
      (await db.products.findUniqueOrThrow({ where: { id: p.id } })).stock,
      0,
    );
    await changeOrder(db, "buyer-b", b.id, "confirm");
    await changeOrder(db, "buyer-b", b.id, "cancel");
    await changeOrder(db, "buyer-b", b.id, "cancel");
    assert.equal(
      (await db.products.findUniqueOrThrow({ where: { id: p.id } })).stock,
      1,
    );
    assert.equal(
      (await changeOrder(db, "buyer-a", a.id, "confirm")).status,
      "confirmed",
    );
    assert.equal(
      (await db.products.findUniqueOrThrow({ where: { id: p.id } })).stock,
      0,
    );
  }));
