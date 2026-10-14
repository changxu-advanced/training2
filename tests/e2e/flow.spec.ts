import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("[E2E-FLOW] real administrator registration through buyer order confirmation and cancellation", async ({
  page,
}) => {
  const code = "FLOW-" + randomUUID().slice(0, 8).toUpperCase();
  await page.goto("http://localhost:5174/login");
  await page
    .getByLabel("メールアドレス", { exact: true })
    .fill("admin@training2.test");
  await page
    .getByLabel("パスワード", { exact: true })
    .fill("Training2-local-2026!");
  await page.getByRole("button", { name: "管理者ログイン" }).click();
  await page.waitForURL("**/products");
  await page.getByRole("link", { name: "商品登録", exact: true }).click();
  await page.getByLabel("商品コード", { exact: true }).fill(code.toLowerCase());
  await page
    .getByLabel("商品名", { exact: true })
    .fill("購入フローテスト商品 " + code);
  await page.getByLabel("価格 · JPY", { exact: true }).fill("750");
  await page.getByLabel("初期在庫", { exact: true }).fill("3");
  await page.getByRole("heading", { name: "商品登録" }).click();
  await page.getByRole("button", { name: "商品登録", exact: true }).click();
  await expect(page).toHaveURL(/\/products$/);
  await page.getByRole("button", { name: "ログアウト" }).click();
  await page.goto("http://localhost:5173/login");
  await page
    .getByLabel("メールアドレス", { exact: true })
    .fill("buyer@training2.test");
  await page
    .getByLabel("パスワード", { exact: true })
    .fill("Training2-local-2026!");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForURL("**/products");
  async function find() {
    await page.goto("http://localhost:5173/products");
    await page.getByLabel("商品コード", { exact: true }).fill(code);
    await page.getByRole("button", { name: "商品を検索" }).click();
    const row = page.getByRole("row").filter({ hasText: code });
    await expect(row).toBeVisible();
    return row;
  }
  const row = await find();
  await expect(row.getByRole("cell", { name: "3", exact: true })).toBeVisible();
  await row.getByRole("button", { name: "商品を選択" }).click();
  await page.getByRole("spinbutton").fill("2");
  await page.getByRole("heading", { name: "注文作成" }).click();
  await page.getByRole("button", { name: "注文を作成" }).click();
  await expect(
    page.getByRole("heading", { name: "下書き", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "合計 ¥1,500" }),
  ).toBeVisible();
  const orderUrl = page.url();
  const beforeConfirm = await find();
  await expect(
    beforeConfirm.getByRole("cell", { name: "3", exact: true }),
  ).toBeVisible();
  await page.goto(orderUrl);
  await page.getByRole("button", { name: "注文を確定", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "確定済み", exact: true }),
  ).toBeVisible();
  const bought = await find();
  await expect(
    bought.getByRole("cell", { name: "1", exact: true }),
  ).toBeVisible();
  await page.goto(orderUrl);
  await page
    .getByRole("button", { name: "注文をキャンセル", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "キャンセル済み", exact: true }),
  ).toBeVisible();
  const restored = await find();
  await expect(
    restored.getByRole("cell", { name: "3", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
