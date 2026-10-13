import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { applyMigrations } from "../../postgres/scripts/migrate.ts";
import { withTemporaryDatabase } from "../../postgres/scripts/temporary-database.ts";
import { createPrismaClient } from "../src/index.ts";

test("AC-D01 generated Prisma Client reads/writes migrated PostgreSQL and rolls back", async () => {
  await withTemporaryDatabase(async (client, url) => {
    await applyMigrations(client);
    const prisma = createPrismaClient(url);
    try {
      const code = `PRISMA-${randomUUID().slice(0, 8).toUpperCase()}`;
      const created = await prisma.products.create({
        data: { code, name: "Prisma测试商品", price_jpy: 500n, stock: 2 },
      });
      assert.equal(
        (await prisma.products.findUniqueOrThrow({ where: { id: created.id } }))
          .price_jpy,
        500n,
      );
      await assert.rejects(
        () =>
          prisma.$transaction(async (tx) => {
            await tx.products.update({
              where: { id: created.id },
              data: { stock: 1 },
            });
            throw new Error("rollback fixture");
          }),
        /rollback fixture/,
      );
      assert.equal(
        (await prisma.products.findUniqueOrThrow({ where: { id: created.id } }))
          .stock,
        2,
      );
    } finally {
      await prisma.$disconnect();
    }
  });
});
