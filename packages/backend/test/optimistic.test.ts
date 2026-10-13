import assert from "node:assert/strict";
import { test } from "node:test";
import { createPrismaClient } from "@training2/prisma";
import { withTestDatabase } from "@training2/test-utils";
import {
  compareAndAllocate,
  readSnapshot,
} from "../experiments/optimistic-stock.ts";

test("optimistic experiment detects stale versions and succeeds after a bounded fresh read", async () =>
  withTestDatabase(async (db, url) => {
    const a = createPrismaClient(url);
    const b = createPrismaClient(url);
    try {
      const p = await db.products.create({
        data: {
          code: "OPTIMISTIC",
          name: "乐观锁实验",
          price_jpy: 100n,
          stock: 2,
        },
      });
      const snapshots = await Promise.all([
        readSnapshot(a, p.id),
        readSnapshot(b, p.id),
      ]);
      assert.equal(snapshots[0].version, snapshots[1].version);
      const results = await Promise.all([
        compareAndAllocate(a, p.id, 1, snapshots[0]),
        compareAndAllocate(b, p.id, 1, snapshots[1]),
      ]);
      assert.deepEqual([...results].sort(), ["allocated", "conflict"]);
      const loser = results[0] === "conflict" ? a : b;
      const fresh = await readSnapshot(loser, p.id);
      assert.notEqual(fresh.version, snapshots[0].version);
      assert.equal(
        await compareAndAllocate(loser, p.id, 1, fresh),
        "allocated",
      );
      assert.equal((await readSnapshot(db, p.id)).stock, 0);
      assert.equal(
        await compareAndAllocate(db, p.id, 1, await readSnapshot(db, p.id)),
        "insufficient",
      );
    } finally {
      await a.$disconnect();
      await b.$disconnect();
    }
  }));
