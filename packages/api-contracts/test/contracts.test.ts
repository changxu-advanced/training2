import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import axios from "axios";
import { createPublicClient } from "../../api-client/src/public.ts";
import {
  createContractApp,
  errorSchema,
  openapiDocument,
  productInput,
  productSchema,
} from "../src/index.ts";

test("contract input/response validation, honest stubs and generated Axios transport", async () => {
  const app = createContractApp("public", {
    verify: async () => ({ sub: "buyer", groups: [] }),
  });
  assert.equal((await app.request("/products?unexpected=1")).status, 400);
  assert.equal(
    (await app.request("/orders/00000000-0000-4000-8000-000000000000")).status,
    401,
  );
  const privateApp = createContractApp("private", {
    verify: async (token) => ({
      sub: token,
      groups: token === "admin" ? ["admin"] : [],
    }),
  });
  assert.equal((await privateApp.request("/products")).status, 401);
  assert.equal(
    (
      await privateApp.request("/products", {
        headers: { Authorization: "Bearer buyer" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await privateApp.request("/products", {
        headers: { Authorization: "Bearer admin" },
      })
    ).status,
    501,
  );
  const bad = await app.request("/orders", {
    method: "POST",
    headers: {
      Authorization: "Bearer fixture",
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify({ items: [{ productId: randomUUID(), quantity: 0 }] }),
  });
  assert.equal(bad.status, 400);
  assert.equal(errorSchema.safeParse(await bad.json()).success, true);
  const valid = await app.request("/orders", {
    method: "POST",
    headers: {
      Authorization: "Bearer fixture",
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify({ items: [{ productId: randomUUID(), quantity: 1 }] }),
  });
  assert.equal(valid.status, 501);
  const normalized = productInput.parse({
    code: " abc-1 ",
    name: " 😀 ",
    priceJpy: 500,
    stock: 1,
  });
  assert.equal(normalized.code, "ABC-1");
  assert.equal(
    productSchema.safeParse({
      id: randomUUID(),
      code: "ABC",
      name: "商品",
      description: "",
      priceJpy: 1,
      stock: -1,
    }).success,
    false,
  );
  let url = "";
  let header = "";
  const transport = axios.create({
    adapter: async (config) => {
      url = config.url ?? "";
      header = String(config.headers.get("Idempotency-Key") ?? "");
      return {
        data: { stub: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    },
  });
  const client = createPublicClient(transport);
  const id = randomUUID();
  await client.confirmOrder({ path: { id } });
  assert.equal(url, `/orders/${id}/confirm`);
  const key = randomUUID();
  await client.createOrder({
    headers: { "idempotency-key": key },
    body: { items: [{ productId: id, quantity: 1 }] },
  });
  assert.equal(header, key);
});
test("breaking checker rejects removal of a published endpoint", async () => {
  const directory = await mkdtemp(join(tmpdir(), "training2-openapi-"));
  try {
    const base = openapiDocument("public");
    const changed = structuredClone(base);
    delete changed.paths?.["/products"];
    await writeFile(join(directory, "base.json"), JSON.stringify(base));
    await writeFile(join(directory, "changed.json"), JSON.stringify(changed));
    const result = spawnSync(
      "oasdiff",
      [
        "breaking",
        join(directory, "base.json"),
        join(directory, "changed.json"),
        "--fail-on",
        "ERR",
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 1, result.stdout + result.stderr);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
