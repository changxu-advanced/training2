import {
  ApiFailure,
  type ContractApp,
  publicRoutes,
} from "@training2/api-contracts";
import { type OrderInput, orderInput } from "@training2/api-contracts/inputs";
import type { PrismaClient } from "@training2/prisma";
import { orderDto } from "./dto.ts";

type Transaction = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
const include = { order_items: { orderBy: { product_id: "asc" as const } } };
function missing() {
  return new ApiFailure(404, "NOT_FOUND", "Order not found");
}
function canonical(input: OrderInput) {
  const items = input.items
    .map((i) => ({
      productId: i.productId.toLowerCase(),
      quantity: i.quantity,
    }))
    .sort((a, b) =>
      a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0,
    );
  if (new Set(items.map((i) => i.productId)).size !== items.length)
    throw new ApiFailure(400, "INVALID_INPUT", "Duplicate product in order");
  return items;
}
function retryable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const failure = error as {
    code?: string;
    meta?: {
      code?: string;
      driverAdapterError?: { cause?: { originalCode?: string } };
    };
  };
  return (
    failure.code === "P2034" ||
    ["40001", "40P01", "55P03"].includes(
      failure.meta?.code ??
        failure.meta?.driverAdapterError?.cause?.originalCode ??
        "",
    )
  );
}
async function transaction<T>(
  prisma: PrismaClient,
  run: (tx: Transaction) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL lock_timeout = '2s'`;
          return run(tx);
        },
        { timeout: 10000, maxWait: 5000, isolationLevel: "ReadCommitted" },
      );
    } catch (error) {
      if (!retryable(error)) throw error;
      if (attempt === 2)
        throw new ApiFailure(
          503,
          "TEMPORARILY_UNAVAILABLE",
          "Please retry this operation",
        );
      await new Promise((resolve) =>
        setTimeout(resolve, 20 + Math.random() * 40),
      );
    }
  }
}
export async function createOrder(
  prisma: PrismaClient,
  owner: string,
  key: string,
  input: OrderInput,
) {
  const items = canonical(input);
  key = key.toLowerCase();
  return transaction(prisma, async (tx) => {
    // Database transaction-level advisory lock serializes the same owner/key, including concurrent first requests.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${owner + ":" + key},0))`;
    const existing = await tx.orders.findUnique({
      where: {
        owner_sub_idempotency_key: { owner_sub: owner, idempotency_key: key },
      },
      include,
    });
    if (existing) {
      if (
        JSON.stringify(
          canonical(orderInput.parse({ items: existing.request_items })),
        ) !== JSON.stringify(items)
      )
        throw new ApiFailure(
          409,
          "IDEMPOTENCY_CONFLICT",
          "Key was used with different items",
        );
      return { order: orderDto(existing), created: false };
    }
    const snapshots = [];
    let total = 0n;
    for (const item of items) {
      const rows = await tx.$queryRaw<
        { id: string; code: string; name: string; price_jpy: bigint }[]
      >`SELECT id,code,name,price_jpy FROM public.products WHERE id=${item.productId}::uuid FOR SHARE`;
      const product = rows[0];
      if (!product) throw new ApiFailure(404, "NOT_FOUND", "Product not found");
      total += product.price_jpy * BigInt(item.quantity);
      snapshots.push({
        product_id: product.id,
        product_code: product.code,
        product_name: product.name,
        unit_price_jpy: product.price_jpy,
        quantity: item.quantity,
      });
    }
    const order = await tx.orders.create({
      data: {
        owner_sub: owner,
        idempotency_key: key,
        request_items: items,
        total_jpy: total,
        order_items: { create: snapshots },
      },
      include,
    });
    return { order: orderDto(order), created: true };
  });
}
export async function readOrder(
  prisma: PrismaClient,
  owner: string,
  id: string,
) {
  const row = await prisma.orders.findFirst({
    where: { id, owner_sub: owner },
    include,
  });
  if (!row) throw missing();
  return orderDto(row);
}
export async function changeOrder(
  prisma: PrismaClient,
  owner: string,
  id: string,
  action: "confirm" | "cancel",
) {
  return transaction(prisma, async (tx) => {
    const owned = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM public.orders WHERE id=${id}::uuid AND owner_sub=${owner} FOR UPDATE`;
    if (!owned.length) throw missing();
    const order = await tx.orders.findUniqueOrThrow({ where: { id }, include });
    if (action === "confirm" && order.status === "cancelled")
      throw new ApiFailure(
        409,
        "INVALID_ORDER_STATE",
        "Cancelled order cannot be confirmed",
      );
    if (
      (action === "confirm" && order.status === "confirmed") ||
      (action === "cancel" && order.status === "cancelled")
    )
      return orderDto(order);
    if (action === "confirm" || order.status === "confirmed") {
      // Acquire all stock locks in UUID order before changing any stock.
      for (const item of order.order_items) {
        const rows = await tx.$queryRaw<
          { stock: number }[]
        >`SELECT stock FROM public.products WHERE id=${item.product_id}::uuid FOR UPDATE`;
        if (!rows.length)
          throw new ApiFailure(404, "NOT_FOUND", "Product not found");
        if (action === "confirm" && rows[0].stock < item.quantity)
          throw new ApiFailure(409, "INSUFFICIENT_STOCK", "Insufficient stock");
      }
      for (const item of order.order_items)
        await tx.products.update({
          where: { id: item.product_id },
          data: {
            stock:
              action === "confirm"
                ? { decrement: item.quantity }
                : { increment: item.quantity },
          },
        });
    }
    const changed = await tx.orders.update({
      where: { id },
      data:
        action === "confirm"
          ? { status: "confirmed", confirmed_at: new Date() }
          : { status: "cancelled", cancelled_at: new Date() },
      include,
    });
    return orderDto(changed);
  });
}
export async function listOrders(
  prisma: PrismaClient,
  owner: string,
  query: {
    page: number;
    pageSize: number;
    status?: "draft" | "confirmed" | "cancelled";
  },
) {
  const where = {
    owner_sub: owner,
    ...(query.status ? { status: query.status } : {}),
  };
  return prisma.$transaction(
    async (tx) => {
      const total = await tx.orders.count({ where });
      const offset = BigInt(query.page - 1) * BigInt(query.pageSize);
      const rows =
        offset >= BigInt(total)
          ? []
          : await tx.orders.findMany({
              where,
              orderBy: [{ created_at: "desc" }, { id: "desc" }],
              skip: Number(offset),
              take: query.pageSize,
              include: {
                order_items: {
                  orderBy: { product_id: "asc" },
                  include: { products: { select: { stock: true } } },
                },
              },
            });
      return {
        items: rows.map((row) => ({
          ...orderDto(row),
          canConfirm:
            row.status === "draft" &&
            row.order_items.every(
              (item) => item.products.stock >= item.quantity,
            ),
        })),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
export function bindOrderRoutes(
  app: ContractApp,
  prisma: PrismaClient,
): readonly string[] {
  app.openapi(publicRoutes[2], async (c) => {
    const result = await createOrder(
      prisma,
      c.get("principal").sub,
      c.req.valid("header")["idempotency-key"],
      c.req.valid("json"),
    );
    return result.created
      ? c.json(result.order, 201)
      : c.json(result.order, 200);
  });
  app.openapi(publicRoutes[3], async (c) =>
    c.json(
      await readOrder(prisma, c.get("principal").sub, c.req.valid("param").id),
      200,
    ),
  );
  app.openapi(publicRoutes[4], async (c) =>
    c.json(
      await changeOrder(
        prisma,
        c.get("principal").sub,
        c.req.valid("param").id,
        "confirm",
      ),
      200,
    ),
  );
  app.openapi(publicRoutes[5], async (c) =>
    c.json(
      await changeOrder(
        prisma,
        c.get("principal").sub,
        c.req.valid("param").id,
        "cancel",
      ),
      200,
    ),
  );
  app.openapi(publicRoutes[6], async (c) =>
    c.json(
      await listOrders(prisma, c.get("principal").sub, c.req.valid("query")),
      200,
    ),
  );
  return [
    "createOrder",
    "getOrder",
    "confirmOrder",
    "cancelOrder",
    "listOrders",
  ];
}
