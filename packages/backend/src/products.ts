import {
  ApiFailure,
  type ContractApp,
  privateRoutes,
  publicRoutes,
} from "@training2/api-contracts";
import type { ProductInput } from "@training2/api-contracts/inputs";
import type { PrismaClient } from "@training2/prisma";
import { productDto } from "./dto.ts";
import { transaction } from "./orders.ts";
export async function registerProduct(
  prisma: PrismaClient,
  input: ProductInput,
) {
  try {
    return productDto(
      await prisma.products.create({
        data: {
          code: input.code,
          name: input.name,
          description: input.description,
          price_jpy: BigInt(input.priceJpy),
          stock: input.stock,
        },
      }),
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    )
      throw new ApiFailure(
        409,
        "DUPLICATE_PRODUCT",
        "Product code already exists",
      );
    throw error;
  }
}
export async function listProducts(
  prisma: PrismaClient,
  query: {
    page: number;
    pageSize: number;
    code?: string;
    name?: string;
    inStock?: "true" | "false";
  },
) {
  const code = query.code?.trim().toUpperCase();
  const name = query.name?.trim();
  // Prisma contains is ILIKE; escape SQL wildcard characters to preserve literal substring semantics.
  const literal = name?.replace(/[\\%_]/g, (match) => "\\" + match);
  const where = {
    ...(query.inStock === "true" ? { stock: { gt: 0 } } : {}),
    ...(code ? { code } : {}),
    ...(literal
      ? { name: { contains: literal, mode: "insensitive" as const } }
      : {}),
  };
  return prisma.$transaction(
    async (tx) => {
      const total = await tx.products.count({ where });
      const offset = BigInt(query.page - 1) * BigInt(query.pageSize);
      const rows =
        offset >= BigInt(total)
          ? []
          : await tx.products.findMany({
              where,
              orderBy: { code: "asc" },
              skip: Number(offset),
              take: query.pageSize,
            });
      return {
        items: rows.map(productDto),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
export async function getProduct(prisma: PrismaClient, id: string) {
  const product = await prisma.products.findUnique({ where: { id } });
  if (!product) throw new ApiFailure(404, "NOT_FOUND", "Product not found");
  return productDto(product);
}
export async function restockProduct(
  prisma: PrismaClient,
  owner: string,
  id: string,
  key: string,
  quantity: number,
) {
  id = id.toLowerCase();
  key = key.toLowerCase();
  return transaction(prisma, async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"restock:" + owner + ":" + key},0))`;
    const previous = await tx.product_restocks.findUnique({
      where: {
        owner_sub_idempotency_key: { owner_sub: owner, idempotency_key: key },
      },
    });
    if (previous) {
      if (previous.product_id !== id || previous.quantity !== quantity)
        throw new ApiFailure(
          409,
          "IDEMPOTENCY_CONFLICT",
          "Key was used with different restock input",
        );
      return productDto(await tx.products.findUniqueOrThrow({ where: { id } }));
    }
    // UPDATE acquires the same product row lock as order confirmation; never overwrite a stale snapshot.
    const result = await tx.products.updateMany({
      where: { id, stock: { lte: 1000000 - quantity } },
      data: { stock: { increment: quantity } },
    });
    if (!result.count) {
      if (!(await tx.products.findUnique({ where: { id } })))
        throw new ApiFailure(404, "NOT_FOUND", "Product not found");
      throw new ApiFailure(400, "INVALID_INPUT", "Stock limit exceeded");
    }
    await tx.product_restocks.create({
      data: {
        owner_sub: owner,
        idempotency_key: key,
        product_id: id,
        quantity,
      },
    });
    return productDto(await tx.products.findUniqueOrThrow({ where: { id } }));
  });
}
export function bindProductRoutes(
  app: ContractApp,
  scope: "public" | "private",
  prisma: PrismaClient,
): readonly string[] {
  if (scope === "private") {
    app.openapi(privateRoutes[0], async (c) =>
      c.json(await registerProduct(prisma, c.req.valid("json")), 201),
    );
    app.openapi(privateRoutes[1], async (c) =>
      c.json(await listProducts(prisma, c.req.valid("query")), 200),
    );
    app.openapi(privateRoutes[2], async (c) =>
      c.json(await getProduct(prisma, c.req.valid("param").id), 200),
    );
    app.openapi(privateRoutes[3], async (c) =>
      c.json(
        await restockProduct(
          prisma,
          c.get("principal").sub,
          c.req.valid("param").id,
          c.req.valid("header")["idempotency-key"],
          c.req.valid("json").quantity,
        ),
        200,
      ),
    );
    return ["registerProduct", "listProducts", "getProduct", "restockProduct"];
  }
  app.openapi(publicRoutes[0], async (c) =>
    c.json(await listProducts(prisma, c.req.valid("query")), 200),
  );
  app.openapi(publicRoutes[1], async (c) => {
    const row = await prisma.products.findUnique({
      where: { id: c.req.valid("param").id },
      select: { id: true, stock: true },
    });
    if (!row) throw new ApiFailure(404, "NOT_FOUND", "Product not found");
    return c.json({ productId: row.id, stock: row.stock }, 200);
  });
  return ["searchProducts", "getStock"];
}
