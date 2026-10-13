import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createContractApp, errorSchema } from "@training2/api-contracts";
import { parseApiConfig } from "@training2/config";
import { createLogger } from "@training2/logger";
import { jsonResponse, withTestDatabase } from "@training2/test-utils";
import { jpy, orderDto, productDto } from "../src/dto.ts";
import { createApi } from "../src/index.ts";

const auth = {
  verify: async (token: string) => ({
    sub: token,
    groups: token === "admin" ? ["admin"] : [],
  }),
};
test("both API runtimes connect to real PostgreSQL, check auth/CORS and project safe DTOs", async () => {
  await withTestDatabase(async (prisma, url) => {
    const lines: string[] = [];
    const logger = createLogger({ sink: (line) => lines.push(line) });
    const product = await prisma.products.create({
      data: { code: "DTO-TEST", name: "商品", price_jpy: 500n, stock: 2 },
    });
    const dto = productDto(product);
    assert.equal(dto.priceJpy, 500);
    assert.ok(!("created_at" in dto));
    const order = await prisma.orders.create({
      data: {
        owner_sub: "private-owner",
        idempotency_key: randomUUID(),
        request_items: [{ productId: product.id, quantity: 2 }],
        total_jpy: 1000n,
        order_items: {
          create: {
            product_id: product.id,
            product_code: product.code,
            product_name: product.name,
            unit_price_jpy: 500n,
            quantity: 2,
          },
        },
      },
      include: { order_items: true },
    });
    const converted = orderDto(order);
    assert.equal(converted.totalJpy, 1000);
    assert.equal(converted.createdAt, order.created_at.toISOString());
    assert.equal(converted.items[0].unitPriceJpy, 500);
    assert.ok(!JSON.stringify(converted).includes("private-owner"));
    assert.throws(() => jpy(9007199254740992n));
    for (const scope of ["public", "private"] as const) {
      const runtime = await createApi(
        scope,
        parseApiConfig({ DATABASE_URL: url, NODE_ENV: "test" }, scope),
        auth,
        { logger },
      );
      try {
        const health = await jsonResponse(await runtime.app.request("/health"));
        assert.equal(health.status, 200);
        assert.equal(health.body.database, "ok");
        assert.ok(health.requestId);
        const protectedPath =
          scope === "public" ? `/orders/${order.id}` : "/products";
        const missing = await jsonResponse(
          await runtime.app.request(protectedPath),
        );
        assert.equal(missing.status, 401);
        assert.equal(errorSchema.safeParse(missing.body).success, true);
        assert.equal(missing.body.error.requestId, missing.requestId);
        assert.equal(
          (
            await runtime.app.request("/products", {
              headers: { Authorization: "Bearer buyer" },
            })
          ).status,
          scope === "public" ? 200 : 403,
        );
        assert.equal(
          (
            await runtime.app.request("/products", {
              headers: { Authorization: "Bearer admin" },
            })
          ).status,
          200,
        );
        const origin =
          scope === "public"
            ? "http://localhost:5173"
            : "http://localhost:5174";
        const preflight = await runtime.app.request(protectedPath, {
          method: "OPTIONS",
          headers: {
            Origin: origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers":
              "authorization,content-type,idempotency-key",
          },
        });
        assert.equal(preflight.status, 204);
        assert.equal(
          preflight.headers.get("Access-Control-Allow-Origin"),
          origin,
        );
        const denied = await runtime.app.request("/health", {
          headers: { Origin: "https://example.com" },
        });
        assert.equal(denied.headers.get("Access-Control-Allow-Origin"), null);
      } finally {
        await runtime.close();
        await runtime.close();
      }
    }
    assert.ok(lines.some((line) => line.includes("API request")));
    assert.ok(!lines.join("").includes("private-owner"));
  });
});
test("response pipeline blocks invalid success/error payloads, hides thrown details and never recurses", async () => {
  const lines: string[] = [];
  const logger = createLogger({ sink: (line) => lines.push(line) });
  const cases = [
    {
      body: {
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
        secret: "private-marker",
      },
      status: 200,
    },
    { body: { error: { message: "private-marker" } }, status: 400 },
    { body: "private-marker", status: 200 },
    { throws: true },
  ];
  for (const fixture of cases) {
    const app = createContractApp("public", auth, {
      logger,
      beforeRoutes(app) {
        app.get("/products", (_c) => {
          if (fixture.throws) throw new Error("password=private-marker");
          return new Response(
            typeof fixture.body === "string"
              ? fixture.body
              : JSON.stringify(fixture.body),
            {
              status: fixture.status ?? 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        });
      },
    });
    const result = await jsonResponse(await app.request("/products"));
    assert.equal(result.status, 500);
    assert.equal(errorSchema.safeParse(result.body).success, true);
    assert.equal(result.body.error.requestId, result.requestId);
    assert.equal(JSON.stringify(result.body).includes("private-marker"), false);
  }
  assert.equal(
    lines.filter((line) => line.includes("API response validation failed"))
      .length,
    3,
  );
  assert.equal(
    lines.filter((line) => line.includes("API handler failed")).length,
    1,
  );
  assert.ok(!lines.join("").includes("private-marker"));
  const valid = createContractApp("public", auth, {
    logger,
    beforeRoutes(app) {
      app.get("/products", (c) =>
        c.json({ items: [], page: 1, pageSize: 20, total: 0 }),
      );
    },
  });
  assert.equal((await valid.request("/products")).status, 200);
});
