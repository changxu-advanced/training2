import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("[E2E-PRODUCTS] admin registers a real product, buyer searches literal values and refreshes stock", async ({
  page,
}) => {
  const code = "E2E-" + randomUUID().slice(0, 8).toUpperCase();
  const name = "サンプル商品 %_ " + code;
  await page.goto("http://localhost:5174/login");
  await page
    .getByLabel("メールアドレス", { exact: true })
    .fill("admin@training2.test");
  await page
    .getByLabel("パスワード", { exact: true })
    .fill("Training2-local-2026!");
  await page.getByRole("button", { name: "管理者ログイン" }).click();
  await page.waitForURL("**/products");
  await page.goto("http://localhost:5174/products/new");
  await page
    .getByLabel("商品コード", { exact: true })
    .fill(" " + code.toLowerCase() + " ");
  await page.getByLabel("商品名", { exact: true }).fill(name);
  await page
    .getByLabel("商品説明", { exact: true })
    .fill("<b>プレーンテキストの説明</b>");
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(
    page.getByRole("img", { name: "アドバンスト・ソフト" }),
  ).toBeVisible();
  const price = page.getByLabel("価格 · JPY", { exact: true });
  const stock = page.getByLabel("初期在庫", { exact: true });
  await price.fill("-2");
  await expect(price).toHaveValue("0");
  await stock.fill("-3");
  await expect(stock).toHaveValue("0");
  await stock.press("ArrowDown");
  await expect(stock).toHaveValue("0");
  await stock.fill("999999999");
  await expect(stock).toHaveValue("2000");
  await stock.press("ArrowUp");
  await expect(stock).toHaveValue("2000");
  await stock.fill("1.5");
  await expect(stock).toHaveValue("1");
  await price.fill("1280");
  await page.getByLabel("初期在庫", { exact: true }).fill("7");
  await page.getByRole("heading", { name: "商品登録" }).click();
  await page.getByRole("button", { name: "商品登録", exact: true }).click();
  await expect(page).toHaveURL(/\/products$/);
  await page.goto("http://localhost:5174/products/new");
  await page.getByLabel("商品コード", { exact: true }).fill(code.toLowerCase());
  await page.getByLabel("商品名", { exact: true }).fill(name);
  await page.getByRole("button", { name: "商品登録", exact: true }).click();
  await expect(
    page.getByText(
      "商品コードは既に登録されています。別のコードを入力してください。",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "ログアウト" }).click();
  await page.goto("http://localhost:5173/products");
  await page.getByLabel("商品コード", { exact: true }).fill(code.toLowerCase());
  await page.getByLabel("商品名", { exact: true }).fill("%_");
  await page.getByRole("button", { name: "商品を検索" }).click();
  const row = page.getByRole("row").filter({ hasText: code });
  await expect(row).toContainText(name);
  await expect(row).toContainText("1,280");
  await expect(row).toContainText("<b>プレーンテキストの説明</b>");
  await expect(page.getByText("1 件の商品", { exact: true })).toBeVisible();
  execFileSync(process.execPath, [
    "--input-type=module",
    "-e",
    "import {createPrismaClient} from './packages/prisma/src/index.ts';const db=createPrismaClient(process.env.DATABASE_URL);try{await db.products.update({where:{code:process.argv[1]},data:{stock:9}});}finally{await db.$disconnect();}",
    code,
  ]);
  await row.getByRole("button", { name: "在庫を更新" }).click();
  await expect(row.getByRole("cell", { name: "9", exact: true })).toBeVisible();
  await page
    .getByLabel("商品名", { exact: true })
    .fill("該当なし-" + randomUUID());
  await page.getByRole("button", { name: "商品を検索" }).click();
  await expect(
    page.getByText("該当する商品はありません。条件を変えてお試しください"),
  ).toBeVisible();
  await page.route("**/api/products**", (route) => route.abort("failed"));
  await page.getByLabel("商品名", { exact: true }).fill("通信失敗テスト");
  await page.getByRole("button", { name: "商品を検索" }).click();
  await expect(
    page.getByText(
      "接続できません。ネットワークを確認して再試行してください。",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "再読み込み" })).toBeVisible();
});
