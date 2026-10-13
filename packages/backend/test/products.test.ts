import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { parseApiConfig } from "@training2/config";
import { createLogger } from "@training2/logger";
import { jsonResponse, withTestDatabase } from "@training2/test-utils";
import { createApi } from "../src/index.ts";

test("AC-P01..P06: real product registration, literal search, paging, stock and write restrictions", async () => {
  await withTestDatabase(async (prisma, url) => {
    const auth = {
      verify: async (token: string) => ({
        sub: token,
        groups: token === "admin" ? ["admin"] : [],
      }),
    };
    const config = { DATABASE_URL: url, NODE_ENV: "test" };
    const logger = createLogger({ sink: () => {} });
    const pub = await createApi(
      "public",
      parseApiConfig(config, "public"),
      auth,
      { logger },
    );
    const admin = await createApi(
      "private",
      parseApiConfig(config, "private"),
      auth,
      { logger },
    );
    const post = (body: unknown, user = "admin") =>
      admin.app.request("/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(user ? { Authorization: "Bearer " + user } : {}),
        },
        body: JSON.stringify(body),
      });
    try {
      const input = {
        code: " abc-1 ",
        name: " 😀好物 %_\\ demo ",
        description: "<b>pure text</b>",
        priceJpy: 1280,
        stock: 7,
      };
      const created = await jsonResponse(await post(input));
      assert.equal(created.status, 201);
      assert.equal(created.body.code, "ABC-1");
      assert.equal(created.body.name, "😀好物 %_\\ demo");
      assert.equal(created.body.stock, 7);
      assert.equal(created.body.priceJpy, 1280);
      assert.equal((await post({ ...input, code: "abc-1" })).status, 409);
      for (const [user, status] of [
        ["", 401],
        ["buyer", 403],
      ] as const) {
        assert.equal(
          (await post({ ...input, code: "BLOCKED" }, user)).status,
          status,
        );
        assert.equal(
          (
            await admin.app.request("/products", {
              headers: user ? { Authorization: "Bearer " + user } : {},
            })
          ).status,
          status,
        );
      }
      for (const invalid of [
        { ...input, code: "BAD", priceJpy: -1 },
        { ...input, code: "BAD", priceJpy: 100000001 },
        { ...input, code: "BAD", stock: 1000001 },
        { ...input, code: "BAD", name: "😀".repeat(101) },
        { ...input, code: "BAD", stock: 1.5 },
        { ...input, code: "BAD", priceJpy: "1" },
        { ...input, code: "BAD", owner: "evil" },
        { ...input, code: "BAD", name: " ".repeat(3) },
      ])
        assert.equal((await post(invalid)).status, 400);
      assert.equal(await prisma.products.count(), 1);
      await prisma.products.create({
        data: { code: "AAA", name: "demo control", price_jpy: 100n, stock: 1 },
      });
      const search = async (query: string) =>
        jsonResponse(await pub.app.request("/products?" + query));
      assert.deepEqual(
        (await search("")).body.items.map((p: { code: string }) => p.code),
        ["AAA", "ABC-1"],
      );
      for (const name of ["%", "_", "\\", "DEMO"]) {
        const result = await search(
          "code=abc-1&name=" + encodeURIComponent(name),
        );
        assert.equal(result.status, 200);
        assert.equal(result.body.total, 1);
        assert.equal(result.body.items[0].id, created.body.id);
      }
      assert.equal(
        (await search("name=" + encodeURIComponent("%"))).body.total,
        1,
      );
      assert.equal(
        (await search("code=AAA&name=" + encodeURIComponent("%"))).body.total,
        0,
      );
      assert.equal((await search("code=+++&name=+++")).body.total, 2);
      assert.equal(
        (await search("page=2&pageSize=1")).body.items[0].code,
        "ABC-1",
      );
      assert.deepEqual((await search("page=999")).body.items, []);
      assert.deepEqual(
        (await search("page=9007199254740991&pageSize=100")).body.items,
        [],
      );
      assert.equal((await search("page=0")).status, 400);
      const listed = await jsonResponse(
        await admin.app.request("/products", {
          headers: { Authorization: "Bearer admin" },
        }),
      );
      assert.equal(listed.body.total, 2);
      const stock = await jsonResponse(
        await pub.app.request("/products/" + created.body.id + "/stock"),
      );
      assert.deepEqual(stock.body, { productId: created.body.id, stock: 7 });
      assert.equal(
        (await pub.app.request("/products/" + randomUUID() + "/stock")).status,
        404,
      );
      assert.equal(
        (await pub.app.request("/products/not-a-uuid/stock")).status,
        400,
      );
      assert.equal(
        (await post({ ...input, code: "UNICODE", name: "😀".repeat(100) }))
          .status,
        201,
      );
    } finally {
      await pub.close();
      await admin.close();
    }
  });
});
