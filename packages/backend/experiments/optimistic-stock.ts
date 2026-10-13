import type { PrismaClient } from "@training2/prisma";
// Test-only CAS comparison using PostgreSQL xmin. Never imported by the production API.
export type StockSnapshot = { stock: number; version: string };
export async function readSnapshot(db: PrismaClient, id: string) {
  const rows = await db.$queryRaw<
    StockSnapshot[]
  >`SELECT stock,xmin::text AS version FROM products WHERE id=${id}::uuid`;
  if (!rows.length) throw new Error("Product missing");
  return rows[0];
}
export async function compareAndAllocate(
  db: PrismaClient,
  id: string,
  quantity: number,
  snapshot: StockSnapshot,
) {
  if (!Number.isSafeInteger(quantity) || quantity < 1)
    throw new Error("Invalid quantity");
  if (snapshot.stock < quantity) return "insufficient" as const;
  const rows = await db.$queryRaw<
    { stock: number }[]
  >`UPDATE products SET stock=stock-${quantity} WHERE id=${id}::uuid AND xmin::text=${snapshot.version} AND stock>=${quantity} RETURNING stock`;
  return rows.length ? ("allocated" as const) : ("conflict" as const);
}
