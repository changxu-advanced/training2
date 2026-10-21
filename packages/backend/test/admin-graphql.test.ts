import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseApiConfig } from "@training2/config";
import { createLogger } from "@training2/logger";
import { jsonResponse, withTestDatabase } from "@training2/test-utils";
import { lexicographicSortSchema, printSchema } from "graphql";
import { createAdminGraphql } from "../src/admin-graphql.ts";
import { createApi } from "../src/index.ts";

test("Training3 GraphQL: generated product reads, admin-only writes, idempotency and shared inventory", async () => {
  await withTestDatabase(async (prisma, url) => {
    const auth = {
      verify: async (token: string) => {
        if (token === "invalid")
          throw new (await import("@training2/auth")).AuthError(401);
        return { sub: token, groups: token === "admin" ? ["admin"] : [] };
      },
    };
    const logger = createLogger({ sink: () => {} });
    const config = { DATABASE_URL: url, NODE_ENV: "test" };
    const admin = await createApi(
      "private",
      parseApiConfig(config, "private"),
      auth,
      { logger },
    );
    const pub = await createApi(
      "public",
      parseApiConfig(config, "public"),
      auth,
      { logger },
    );
    const request = (
      query: string,
      variables: Record<string, unknown> = {},
      user = "admin",
    ) =>
      admin.app.request("/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(user ? { Authorization: `Bearer ${user}` } : {}),
        },
        body: JSON.stringify({ query, variables }),
      });
    const run = async (
      query: string,
      variables: Record<string, unknown> = {},
      user = "admin",
    ) => jsonResponse(await request(query, variables, user));
    const register =
      "mutation Register($input: RegisterAdminProductInput!) {registerAdminProduct(input:$input){id code name description priceJpy stock}}";
    const restock =
      "mutation Restock($id: ID!, $key: ID!, $quantity: Int!){restockAdminProduct(id:$id,idempotencyKey:$key,quantity:$quantity){id stock}}";
    const input = {
      code: " gql-1 ",
      name: " 商品 GraphQL ",
      priceJpy: 500,
      stock: 1,
    };
    try {
      for (const [user, status] of [
        ["", 401],
        ["invalid", 401],
        ["buyer", 403],
      ] as const) {
        const result = await run(register, { input }, user);
        assert.equal(result.status, status);
        assert.ok(result.body.errors[0].extensions.requestId);
        assert.equal(
          (await run("{allProducts(first:1){totalCount}}", {}, user)).status,
          status,
        );
      }
      assert.equal(await prisma.products.count(), 0);
      const schemaApi = await createAdminGraphql(url, prisma);
      try {
        assert.equal(
          `${printSchema(lexicographicSortSchema(schemaApi.schema))}\n`,
          readFileSync(
            new URL("../../../schemas/graphql/admin.graphql", import.meta.url),
            "utf8",
          ),
        );
      } finally {
        await schemaApi.close();
      }
      const made = await run(register, { input });
      assert.equal(made.status, 200);
      assert.equal(made.body.errors, undefined);
      const product = made.body.data.registerAdminProduct;
      assert.equal(product.code, "GQL-1");
      assert.equal(product.name, "商品 GraphQL");
      assert.equal(product.priceJpy, 500);
      assert.equal(
        (await run(register, { input })).body.errors[0].extensions.code,
        "DUPLICATE_PRODUCT",
      );
      for (const change of [
        { stock: -1 },
        { stock: 1.5 },
        { priceJpy: -1 },
        { stock: 1000001 },
      ]) {
        assert.ok(
          (
            await run(register, {
              input: { ...input, code: "INVALID", ...change },
            })
          ).body.errors,
        );
      }
      assert.equal(await prisma.products.count(), 1);
      const list = await run(
        "{allProducts(first:1,orderBy:CODE_ASC){totalCount nodes{rowId code stock priceJpy}}}",
      );
      assert.equal(list.body.errors, undefined);
      assert.equal(list.body.data.allProducts.totalCount, 1);
      assert.equal(list.body.data.allProducts.nodes[0].rowId, product.id);
      assert.equal(Number(list.body.data.allProducts.nodes[0].priceJpy), 500);
      const detail = await run(
        "query($id:UUID!){productByRowId(rowId:$id){rowId code stock}}",
        { id: product.id },
      );
      assert.equal(detail.body.data.productByRowId.stock, 1);
      const roots = await run(
        "{__schema{queryType{fields{name}} mutationType{fields{name}}}}",
      );
      assert.deepEqual(
        roots.body.data.__schema.queryType.fields
          .map((f: { name: string }) => f.name)
          .sort(),
        [
          "query",
          "id",
          "node",
          "allProducts",
          "productByRowId",
          "productByCode",
        ].sort(),
      );
      assert.deepEqual(
        roots.body.data.__schema.mutationType.fields
          .map((f: { name: string }) => f.name)
          .sort(),
        ["registerAdminProduct", "restockAdminProduct"],
      );
      assert.equal((await run("{allOrders(first:1){totalCount}}")).status, 400);
      assert.equal((await run("{allProducts{totalCount}}")).status, 400);
      assert.equal(
        (
          await run("query($n:Int!){allProducts(first:$n){totalCount}}", {
            n: 101,
          })
        ).status,
        400,
      );
      assert.equal(
        (await run("{allProducts(first:1,last:101){totalCount}}")).status,
        400,
      );
      assert.equal(
        (await run("query($n:Int=1){allProducts(first:$n){totalCount}}")).body
          .data.allProducts.totalCount,
        1,
      );
      assert.equal(
        (
          await run("query($n:Int!){allProducts(first:$n){totalCount}}", {
            n: "1",
          })
        ).status,
        400,
      );
      const key = randomUUID();
      const variables = { id: product.id, key, quantity: 2 };
      const repeated = await Promise.all([
        run(restock, variables),
        run(restock, variables),
      ]);
      for (const result of repeated)
        assert.equal(result.body.data.restockAdminProduct.stock, 3);
      assert.equal(await prisma.product_restocks.count(), 1);
      assert.equal(
        (await run(restock, { ...variables, quantity: 3 })).body.errors[0]
          .extensions.code,
        "IDEMPOTENCY_CONFLICT",
      );
      for (const quantity of [0, -1, 1.5, 2001])
        assert.ok(
          (await run(restock, { ...variables, key: randomUUID(), quantity }))
            .body.errors,
        );
      assert.equal(
        (
          await run(restock, {
            ...variables,
            id: randomUUID(),
            key: randomUUID(),
          })
        ).body.errors[0].extensions.code,
        "NOT_FOUND",
      );
      assert.ok(
        (await run(restock, { ...variables, key: "invalid" })).body.errors,
      );
      const headers = {
        Authorization: "Bearer buyer",
        "Content-Type": "application/json",
        "Idempotency-Key": randomUUID(),
      };
      const order = await jsonResponse(
        await pub.app.request("/orders", {
          method: "POST",
          headers,
          body: JSON.stringify({
            items: [{ productId: product.id, quantity: 2 }],
          }),
        }),
      );
      const concurrent = await Promise.all([
        run(restock, { ...variables, key: randomUUID() }),
        pub.app.request(`/orders/${order.body.id}/confirm`, {
          method: "POST",
          headers,
        }),
      ]);
      assert.equal(concurrent[0].body.errors, undefined);
      assert.equal(concurrent[1].status, 200);
      assert.equal(
        (await prisma.products.findUniqueOrThrow({ where: { id: product.id } }))
          .stock,
        3,
      );
      assert.equal(
        (await run("{allProducts(first:1){nodes{stock}}}")).body.data
          .allProducts.nodes[0].stock,
        3,
      );
      assert.equal(
        (await pub.app.request("/graphql", { method: "POST" })).status,
        404,
      );
      assert.equal(
        (
          await admin.app.request("/graphql", {
            headers: { Authorization: "Bearer admin" },
          })
        ).status,
        405,
      );
      assert.equal(
        (
          await admin.app.request("/graphql", {
            method: "POST",
            headers: {
              Authorization: "Bearer admin",
              "Content-Type": "text/plain",
            },
            body: "{}",
          })
        ).status,
        415,
      );
      assert.equal(
        (
          await admin.app.request("/graphql", {
            method: "POST",
            headers: {
              Authorization: "Bearer admin",
              "Content-Type": "application/json",
            },
            body: "[",
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await admin.app.request("/graphql", {
            method: "POST",
            headers: {
              Authorization: "Bearer admin",
              "Content-Type": "application/json",
            },
            body: "[]",
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await admin.app.request("/graphql", {
            method: "POST",
            headers: {
              Authorization: "Bearer admin",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: "x".repeat(66000) }),
          })
        ).status,
        413,
      );
      await prisma.$executeRawUnsafe(
        "CREATE FUNCTION graphql_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'PRIVATE_SQL_FAILURE'; END $$",
      );
      await prisma.$executeRawUnsafe(
        "CREATE TRIGGER graphql_test_failure BEFORE INSERT ON products FOR EACH ROW WHEN (NEW.code = 'FAILED') EXECUTE FUNCTION graphql_test_failure()",
      );
      const failed = await run(register, {
        input: { ...input, code: "FAILED" },
      });
      assert.equal(failed.body.errors[0].extensions.code, "INTERNAL_ERROR");
      assert.ok(!JSON.stringify(failed.body).includes("PRIVATE_SQL_FAILURE"));
    } finally {
      await pub.close();
      await admin.close();
    }
  });
});
