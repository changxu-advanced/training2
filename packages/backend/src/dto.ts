import { orderSchema, productSchema } from "@training2/api-contracts";
import type { PrismaClient } from "@training2/prisma";

type Product = NonNullable<
  Awaited<ReturnType<PrismaClient["products"]["findUnique"]>>
>;
type Order = NonNullable<
  Awaited<ReturnType<PrismaClient["orders"]["findUnique"]>>
>;
type Item = NonNullable<
  Awaited<ReturnType<PrismaClient["order_items"]["findFirst"]>>
>;
export function jpy(value: bigint): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("JPY outside safe integer range");
  return Number(value);
}
export function productDto(row: Product) {
  return productSchema.parse({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    priceJpy: jpy(row.price_jpy),
    stock: row.stock,
  });
}
export function orderDto(row: Order & { order_items: Item[] }) {
  return orderSchema.parse({
    id: row.id,
    status: row.status,
    items: row.order_items.map((item) => ({
      productId: item.product_id,
      productCode: item.product_code,
      productName: item.product_name,
      unitPriceJpy: jpy(item.unit_price_jpy),
      quantity: item.quantity,
    })),
    totalJpy: jpy(row.total_jpy),
    createdAt: row.created_at.toISOString(),
    confirmedAt: row.confirmed_at?.toISOString() ?? null,
    cancelledAt: row.cancelled_at?.toISOString() ?? null,
  });
}
