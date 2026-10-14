import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    stableInput: Element | null;
    stableRow: Element | null;
  }
}

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

test("[E2E-FLOW] two customers receive inventory updates without replacing the selected input", async ({
  browser,
}) => {
  const code = "LIVE-" + randomUUID().slice(0, 8).toUpperCase();
  execFileSync(process.execPath, [
    "--input-type=module",
    "-e",
    "import {createPrismaClient} from './packages/prisma/src/index.ts';const db=createPrismaClient(process.env.DATABASE_URL);try{await db.products.create({data:{code:process.argv[1],name:'同時注文の検証商品',price_jpy:500n,stock:1}});}finally{await db.$disconnect();}",
    code,
  ]);
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  const [a, b, observer] = await Promise.all(contexts.map((c) => c.newPage()));
  try {
    for (const [page, user] of [
      [a, "buyer@training2.test"],
      [b, "buyer2@training2.test"],
    ] as const) {
      await page.goto("http://localhost:5173/login");
      await page.getByLabel("メールアドレス", { exact: true }).fill(user);
      await page
        .getByLabel("パスワード", { exact: true })
        .fill("Training2-local-2026!");
      await page.getByRole("button", { name: "ログイン", exact: true }).click();
      await page.waitForURL("**/products");
      await page.getByLabel("商品コード", { exact: true }).fill(code);
      await page.getByRole("button", { name: "商品を検索" }).click();
      await page
        .getByRole("row")
        .filter({ hasText: code })
        .getByRole("button", { name: "商品を選択" })
        .click();
      await expect(page.getByRole("spinbutton")).toBeEnabled();
    }
    const setStock = (stock: number) =>
      execFileSync(process.execPath, [
        "--input-type=module",
        "-e",
        "import {createPrismaClient} from './packages/prisma/src/index.ts';const db=createPrismaClient(process.env.DATABASE_URL);try{await db.products.update({where:{code:process.argv[1]},data:{stock:Number(process.argv[2])}});}finally{await db.$disconnect();}",
        code,
        String(stock),
      ]);
    setStock(2);
    await expect(b.getByRole("spinbutton")).toHaveAttribute(
      "aria-valuemax",
      "2",
    );
    await b.getByRole("spinbutton").fill("2");
    setStock(1);
    await expect(
      b.getByText("在庫が不足しています。数量を変更してください。", {
        exact: true,
      }),
    ).toBeVisible();
    await b.getByRole("heading", { name: "注文作成", exact: true }).click();
    await expect(b.getByRole("spinbutton")).toHaveValue("2");
    await expect(
      b.getByRole("button", { name: "注文を作成", exact: true }),
    ).toBeDisabled();
    await b.getByRole("spinbutton").fill("1");
    await observer.goto("http://localhost:5173/products");
    await observer.getByLabel("商品コード", { exact: true }).fill(code);
    await observer.getByRole("button", { name: "商品を検索" }).click();
    const row = observer.getByRole("row").filter({ hasText: code });
    await expect(row).toBeVisible();
    // Detect any removal of the existing row/input during pushed background updates.
    await b.evaluate(() => {
      const node = document.querySelector('input[type="number"]')!;
      window.stableInput = node;
    });
    await observer.evaluate(() => {
      window.stableRow = document.querySelector(".el-table__body tr");
    });
    await a.getByRole("button", { name: "注文を作成", exact: true }).click();
    await expect(
      a.getByRole("button", { name: "注文を確定", exact: true }),
    ).toBeEnabled();
    await a.getByRole("button", { name: "注文を確定", exact: true }).click();
    await expect(
      a.getByRole("heading", { name: "確定済み", exact: true }),
    ).toBeVisible();
    const orderUrl = a.url();
    await expect(
      b.getByText("在庫がありません。商品一覧で選び直してください。", {
        exact: true,
      }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      b.getByRole("button", { name: "注文を作成", exact: true }),
    ).toBeDisabled();
    await expect(b.getByRole("spinbutton")).toBeDisabled();
    await expect(
      row.getByRole("button", { name: "商品を選択" }),
    ).toBeDisabled();
    await expect(row.getByText("在庫なし", { exact: true })).toBeVisible();
    expect(
      await b.evaluate(
        () =>
          window.stableInput === document.querySelector('input[type="number"]'),
      ),
    ).toBe(true);
    expect(
      await observer.evaluate(
        () => window.stableRow === document.querySelector(".el-table__body tr"),
      ),
    ).toBe(true);
    await a
      .getByRole("button", { name: "注文をキャンセル", exact: true })
      .click();
    await expect(
      a.getByRole("heading", { name: "キャンセル済み", exact: true }),
    ).toBeVisible();
    await expect(
      b.getByRole("button", { name: "注文を作成", exact: true }),
    ).toBeEnabled({ timeout: 5000 });
    await expect(row.getByRole("button", { name: "商品を選択" })).toBeEnabled();
    // Network reconnect catches up instead of relying on delivery of missed events.
    await contexts[2].setOffline(true);
    await b.getByRole("button", { name: "注文を作成", exact: true }).click();
    await expect(
      b.getByRole("button", { name: "注文を確定", exact: true }),
    ).toBeEnabled();
    await b.getByRole("button", { name: "注文を確定", exact: true }).click();
    await expect(
      b.getByRole("heading", { name: "確定済み", exact: true }),
    ).toBeVisible();
    await contexts[2].setOffline(false);
    await observer.bringToFront();
    await expect(row.getByText("在庫なし", { exact: true })).toBeVisible({
      timeout: 10000,
    });
    // Restored fixture remains usable for manual testing.
    await b
      .getByRole("button", { name: "注文をキャンセル", exact: true })
      .click();
    await expect(
      b.getByRole("heading", { name: "キャンセル済み", exact: true }),
    ).toBeVisible();
    expect(orderUrl).toContain("/orders/");
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
