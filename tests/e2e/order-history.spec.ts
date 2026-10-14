import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("[E2E-ORDER-HISTORY] unified order entry, state actions and confirmation dismissal", async ({
  page,
}) => {
  await page.goto("http://localhost:5173/login");
  await page
    .getByLabel("メールアドレス", { exact: true })
    .fill("buyer2@training2.test");
  await page
    .getByLabel("パスワード", { exact: true })
    .fill("Training2-local-2026!");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await page.waitForURL("**/products");
  await page.route("**/api/orders?**", (route) =>
    route.fulfill({ json: { items: [], page: 1, pageSize: 20, total: 0 } }),
  );
  await page.getByRole("link", { name: "注文管理", exact: true }).click();
  await expect(
    page.getByText("まだ注文はありません。商品を選んで注文を作成しましょう。"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "新しい注文を作成", exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/orders?**");
  const request = page.waitForRequest(
    (r) => new URL(r.url()).pathname === "/api/orders" && r.method() === "GET",
  );
  await page.reload();
  const headers = {
    Authorization: (await request).headers().authorization,
    "Idempotency-Key": randomUUID(),
  };
  const code = "HISTORY-" + randomUUID().slice(0, 8).toUpperCase();
  execFileSync(process.execPath, [
    "--input-type=module",
    "-e",
    "import {createPrismaClient} from './packages/prisma/src/index.ts';const db=createPrismaClient(process.env.DATABASE_URL);try{await db.products.create({data:{code:process.argv[1],name:'注文一覧の検証商品',price_jpy:500n,stock:4}});}finally{await db.$disconnect();}",
    code,
  ]);
  const products = await (
    await page.request.get("http://localhost:5173/api/products?code=" + code)
  ).json();
  const productId = products.items[0].id;
  async function create() {
    const response = await page.request.post(
      "http://localhost:5173/api/orders",
      {
        headers: { ...headers, "Idempotency-Key": randomUUID() },
        data: { items: [{ productId, quantity: 1 }] },
      },
    );
    expect(response.status()).toBe(201);
    return response.json();
  }
  const a = await create();
  const b = await create();
  await page.reload();
  const card = (id: string) => page.locator('[data-order-id="' + id + '"]');
  await expect(card(a.id).getByText("未確定", { exact: true })).toBeVisible();
  let submitted = 0;
  page.on("request", (r) => {
    if (
      r.method() === "POST" &&
      /\/(confirm|cancel)$/.test(new URL(r.url()).pathname)
    )
      submitted++;
  });
  await card(a.id)
    .getByRole("button", { name: "注文を確定", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "注文確定の確認" })
    .getByRole("button", { name: "戻る", exact: true })
    .click();
  expect(submitted).toBe(0);
  await expect(card(a.id).getByText("未確定", { exact: true })).toBeVisible();
  await card(a.id)
    .getByRole("button", { name: "注文を確定", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "注文確定の確認" })
    .getByRole("button", { name: "注文を確定", exact: true })
    .click();
  await expect(card(a.id).getByText("確定済み", { exact: true })).toBeVisible();
  await expect(
    card(a.id).getByRole("button", { name: "注文を確定", exact: true }),
  ).toHaveCount(0);
  await card(a.id)
    .getByRole("button", { name: "注文をキャンセル", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "注文キャンセルの確認" })
    .getByRole("button", { name: "戻る", exact: true })
    .click();
  expect(submitted).toBe(1);
  await expect(card(a.id).getByText("確定済み", { exact: true })).toBeVisible();
  await card(a.id)
    .getByRole("button", { name: "注文をキャンセル", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "注文キャンセルの確認" })
    .getByRole("button", { name: "注文をキャンセル", exact: true })
    .click();
  await expect(
    card(a.id).getByText("キャンセル済み", { exact: true }),
  ).toBeVisible();
  await expect(card(a.id).getByRole("button")).toHaveCount(0);
  await page
    .getByRole("radiogroup", { name: "注文状態" })
    .getByText("未確定", { exact: true })
    .click();
  await expect(card(b.id)).toBeVisible();
  await expect(card(a.id)).toHaveCount(0);
  await page
    .getByRole("radiogroup", { name: "注文状態" })
    .getByText("キャンセル済み", { exact: true })
    .click();
  await expect(card(a.id)).toBeVisible();
  await expect(card(b.id)).toHaveCount(0);
  await page
    .getByRole("button", { name: "新しい注文を作成", exact: true })
    .click();
  await expect(page).toHaveURL(/\/products$/);
  await page.getByLabel("商品コード", { exact: true }).fill(code);
  await page.getByRole("button", { name: "商品を検索" }).click();
  await page
    .getByRole("row")
    .filter({ hasText: code })
    .getByRole("button", { name: "商品を選択" })
    .click();
  await page.getByRole("button", { name: "注文を作成", exact: true }).click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+$/);
  const newId = new URL(page.url()).pathname.split("/").pop()!;
  await page
    .getByRole("link", { name: "← 注文一覧へ戻る", exact: true })
    .click();
  await expect(card(newId).getByText("未確定", { exact: true })).toBeVisible();
});
