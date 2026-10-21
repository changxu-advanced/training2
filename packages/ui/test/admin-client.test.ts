import { readFileSync } from "node:fs";
import { QueryClient } from "@tanstack/vue-query";
import { buildSchema, parse, validate } from "graphql";
import { expect, it, vi } from "vitest";
import { adminDocuments, createAdminClient } from "../src/admin-client.ts";
import { apiMessage } from "../src/helpers.ts";

it("validates administrator documents, normalizes bigint, preserves restock keys and isolates late account responses", async () => {
  const schema = buildSchema(
    readFileSync(
      new URL("../../../schemas/graphql/admin.graphql", import.meta.url),
      "utf8",
    ),
  );
  for (const doc of Object.values(adminDocuments))
    expect(validate(schema, parse(doc))).toEqual([]);
  const row = {
    id: "00000000-0000-4000-8000-000000000001",
    code: "GQL",
    name: "商品",
    description: "",
    priceJpy: "1280",
    stock: 7,
  };
  let owner = "admin-a";
  const unauthorized = vi.fn(async (_owner: string) => {});
  let reply: unknown = { data: { allProducts: { items: [row], total: 21 } } };
  let status = 200;
  const requests: {
    document: string;
    variables: Record<string, unknown>;
    authorization: string | null;
    signal: AbortSignal | null | undefined;
  }[] = [];
  let delayed: (() => Promise<Response>) | undefined;
  const http: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    requests.push({
      document: body.query,
      variables: body.variables,
      authorization: new Headers(init?.headers).get("Authorization"),
      signal: init?.signal,
    });
    if (delayed) return delayed();
    return Response.json(reply, { status });
  };
  const client = createAdminClient({
    endpoint: "http://localhost:5173/admin-api/graphql",
    owner: () => owner,
    accessToken: async () => "token-" + owner,
    unauthorized,
    fetch: http,
  });
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  try {
    const load = () =>
      queries.fetchQuery({
        queryKey: ["products", "graphql", owner, 2],
        queryFn: ({ signal }) =>
          client.listProducts({ query: { page: 2, pageSize: 20 }, signal }),
      });
    expect((await load()).items[0].priceJpy).toBe(1280);
    await load();
    expect(requests).toHaveLength(1);
    expect(requests[0].variables).toEqual({ first: 20, offset: 20 });
    expect(requests[0].authorization).toBe("Bearer token-admin-a");
    expect(requests[0].signal).toBeInstanceOf(AbortSignal);
    reply = { data: { product: row } };
    const key = "00000000-0000-4000-8000-000000000002";
    const addition = {
      path: { id: row.id },
      headers: { "idempotency-key": key },
      body: { quantity: 2 },
    };
    await client.restockProduct(addition);
    await client.restockProduct(addition);
    expect(requests.slice(-2).map((r) => r.variables.key)).toEqual([key, key]);
    reply = { data: { product: { ...row, priceJpy: "9007199254740993" } } };
    await expect(
      client.getProduct({ path: { id: row.id } }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    reply = { data: { product: null } };
    await expect(
      client.getProduct({ path: { id: row.id } }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    reply = {
      errors: [
        {
          message: "PRIVATE_SQL_MARKER",
          extensions: { code: "DUPLICATE_PRODUCT" },
        },
      ],
    };
    const error = await client
      .registerProduct({
        body: {
          code: row.code,
          name: row.name,
          description: row.description,
          stock: row.stock,
          priceJpy: 1280,
        },
      })
      .catch((e) => e);
    expect(apiMessage(error)).toContain("既に登録");
    expect(String(error)).not.toContain("PRIVATE_SQL_MARKER");
    status = 401;
    reply = {
      errors: [{ message: "expired", extensions: { code: "UNAUTHENTICATED" } }],
    };
    await expect(
      client.getProduct({ path: { id: row.id } }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(unauthorized).toHaveBeenCalledExactlyOnceWith("admin-a");
    let release: (value: Response) => void = () => {};
    delayed = () =>
      new Promise((resolve) => {
        release = resolve;
      });
    const pending = client.getProduct({ path: { id: row.id } }).catch((e) => e);
    await vi.waitFor(() => expect(requests).toHaveLength(8));
    owner = "admin-b";
    release(Response.json(reply, { status: 401 }));
    expect(await pending).toMatchObject({ code: "SESSION_CHANGED" });
    expect(unauthorized).toHaveBeenCalledTimes(1);
  } finally {
    queries.clear();
  }
});
