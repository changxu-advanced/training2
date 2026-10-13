import {
  ApiFailure,
  type ContractApp,
  privateRoutes,
  publicRoutes,
} from "@training2/api-contracts";
import type { ProductInput } from "@training2/api-contracts/inputs";
import type { PrismaClient } from "@training2/prisma";
import { productDto } from "./dto.ts";
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
  query: { page: number; pageSize: number; code?: string; name?: string },
) {
  const code = query.code?.trim().toUpperCase();
  const name = query.name?.trim();
  // Prisma contains is ILIKE; escape SQL wildcard characters to preserve literal substring semantics.
  const literal = name?.replace(/[\\%_]/g, (match) => "\\" + match);
  const where = {
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
    return ["registerProduct", "listProducts"];
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
