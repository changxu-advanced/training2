import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";

async function login(page: Page, user = "buyer@training2.test") {
  await page.getByLabel("メールアドレス", { exact: true }).fill(user);
  await page
    .getByLabel("パスワード", { exact: true })
    .fill("Training2-local-2026!");
  await page.getByRole("button", { name: "ログイン" }).click();
}
async function find(page: Page, code: string, navigate = true) {
  if (navigate) await page.goto("http://localhost:5173/products");
  await page.getByLabel("商品コード", { exact: true }).fill(code);
  await page.getByRole("button", { name: "商品を検索" }).click();
  const row = page.getByRole("row").filter({ hasText: code });
  await expect(row).toBeVisible();
  return row;
}
test("[E2E-ORDER-CREATE] [E2E-ORDER-OWNER] [E2E-ORDER-STOCK] real order retry, lifecycle, stock rollback and other-owner denial", async ({
  page,
}) => {
  const code = "ORD-" + randomUUID().slice(0, 8).toUpperCase();
  execFileSync(process.execPath, [
    "--input-type=module",
    "-e",
    "import {createPrismaClient} from './packages/prisma/src/index.ts';const db=createPrismaClient(process.env.DATABASE_URL);try{await db.products.createMany({data:[{code:process.argv[1]+'-A',name:'注文テスト商品',price_jpy:500n,stock:5},{code:process.argv[1]+'-B',name:'在庫なしテスト商品',price_jpy:100n,stock:0},{code:process.argv[1]+'-C',name:'在庫多数テスト商品',price_jpy:100n,stock:1500}]});}finally{await db.$disconnect();}",
    code,
  ]);
  const row = await find(page, code + "-A");
  await row.getByRole("button", { name: "商品を選択" }).click();
  await expect(page).toHaveURL(/\/login/);
  await login(page);
  await expect(page).toHaveURL(/\/orders\/new$/);
  const quantity = page.getByRole("spinbutton");
  await expect(quantity).toBeEnabled();
  await expect(quantity).toHaveAttribute("aria-valuemin", "1");
  await expect(quantity).toHaveAttribute("aria-valuemax", "5");
  await quantity.fill("-33");
  await expect(quantity).toHaveValue("1");
  await quantity.press("ArrowDown");
  await expect(quantity).toHaveValue("1");
  await quantity.fill("999");
  await expect(quantity).toHaveValue("5");
  await quantity.press("ArrowUp");
  await expect(quantity).toHaveValue("5");
  await quantity.fill("1.5");
  await expect(quantity).toHaveValue("1");
  await quantity.fill("2");
  await page.getByRole("link", { name: "← 買い物を続ける" }).click();
  const highStock = await find(page, code + "-C", false);
  await highStock.getByRole("button", { name: "商品を選択" }).click();
  await expect(page.getByRole("spinbutton")).toHaveCount(2);
  await page
    .getByRole("button", { name: "商品選択を取り消す", exact: true })
    .click();
  const confirm = page.getByRole("dialog", { name: "商品選択を取り消す" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "選択を続ける" }).click();
  await expect(page).toHaveURL(/\/orders\/new$/);
  await expect(page.getByRole("spinbutton").first()).toHaveValue("2");
  await page
    .getByRole("button", { name: "商品選択を取り消す", exact: true })
    .click();
  await page.getByRole("dialog").press("Escape");
  await expect(page.getByRole("spinbutton")).toHaveCount(2);
  await page
    .getByRole("button", { name: "商品選択を取り消す", exact: true })
    .click();
  await confirm.getByRole("button", { name: "取り消す" }).click();
  await expect(page).toHaveURL(/\/products$/);
  const fresh = await find(page, code + "-C", false);
  await fresh.getByRole("button", { name: "商品を選択" }).click();
  await expect(page.getByRole("spinbutton")).toHaveCount(1);
  await expect(page.getByText("注文テスト商品", { exact: true })).toHaveCount(
    0,
  );
  await expect(quantity).toHaveValue("1");
  await quantity.fill("1001");
  await expect(quantity).toHaveValue("1000");
  await page
    .getByRole("button", { name: "商品選択を取り消す", exact: true })
    .click();
  await confirm.getByRole("button", { name: "取り消す" }).click();
  const reselected = await find(page, code + "-A", false);
  await reselected.getByRole("button", { name: "商品を選択" }).click();
  await expect(quantity).toHaveValue("1");
  await quantity.fill("2");
  await page.getByRole("heading", { name: "注文作成" }).click();
  const keys: string[] = [];
  const returnedIds: string[] = [];
  let dropped = false;
  await page.route("**/api/orders", async (route) => {
    keys.push(route.request().headers()["idempotency-key"]);
    const response = await route.fetch();
    const data = await response.json();
    returnedIds.push(data.id);
    if (!dropped) {
      dropped = true;
      await route.abort("failed");
    } else await route.fulfill({ response });
  });
  await page.getByRole("button", { name: "注文を作成" }).click();
  await expect(
    page.getByText(
      "接続できません。ネットワークを確認して再試行してください。",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "注文を作成" }).click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+$/);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  expect(returnedIds[0]).toBe(returnedIds[1]);
  await page.unroute("**/api/orders");
  const orderId = new URL(page.url()).pathname.split("/").pop()!;
  await expect(
    page.getByRole("heading", { name: "下書き", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "合計 ¥1,000" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "注文を確定", exact: true })
    .dblclick();
  await expect(
    page.getByRole("heading", { name: "確定済み", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "注文を確定", exact: true }),
  ).toHaveCount(0);
  const allocated = await find(page, code + "-A");
  await expect(
    allocated.getByRole("cell", { name: "3", exact: true }),
  ).toBeVisible();
  await page.goto("http://localhost:5173/orders/" + orderId);
  let releaseCancel: () => void = () => {};
  const cancelGate = new Promise<void>((resolve) => {
    releaseCancel = resolve;
  });
  await page.route("**/api/orders/" + orderId + "/cancel", async (route) => {
    await cancelGate;
    await route.continue();
  });
  await page
    .getByRole("button", { name: "注文をキャンセル", exact: true })
    .click();
  try {
    await expect(page.getByRole("status")).toHaveText(
      "注文をキャンセルしています…",
    );
    await expect(
      page.getByRole("button", { name: "注文をキャンセル", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "注文を確定", exact: true }),
    ).toHaveCount(0);
  } finally {
    releaseCancel();
  }
  await expect(
    page.getByRole("heading", { name: "キャンセル済み", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "注文をキャンセル", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "注文を確定", exact: true }),
  ).toHaveCount(0);
  await page.unroute("**/api/orders/" + orderId + "/cancel");
  const restored = await find(page, code + "-A");
  await expect(
    restored.getByRole("cell", { name: "5", exact: true }),
  ).toBeVisible();
  await restored.getByRole("button", { name: "商品を選択" }).click();
  await page.getByRole("link", { name: "← 買い物を続ける" }).click();
  const shortage = await find(page, code + "-B", false);
  await expect(
    shortage.getByRole("button", { name: "商品を選択" }),
  ).toBeDisabled();
  const selectedAgain = await find(page, code + "-A", false);
  await selectedAgain.getByRole("button", { name: "商品を選択" }).click();
  await page.getByRole("button", { name: "注文を作成" }).click();
  await expect(
    page.getByRole("heading", { name: "下書き", exact: true }),
  ).toBeVisible();
  // Inventory may change after the bounded draft UI; the API must still reject insufficient stock.
  execFileSync(process.execPath, [
    "--input-type=module",
    "-e",
    "import {createPrismaClient} from './packages/prisma/src/index.ts';const db=createPrismaClient(process.env.DATABASE_URL);try{await db.products.update({where:{code:process.argv[1]+'-A'},data:{stock:0}});}finally{await db.$disconnect();}",
    code,
  ]);
  await expect(
    page.getByRole("button", { name: "注文を確定", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText(
      "在庫が不足しています。商品一覧で最新の在庫をご確認ください。",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "下書き", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "注文をキャンセル", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "キャンセル済み", exact: true }),
  ).toBeVisible();
  execFileSync(process.execPath, [
    "--input-type=module",
    "-e",
    "import {createPrismaClient} from './packages/prisma/src/index.ts';const db=createPrismaClient(process.env.DATABASE_URL);try{await db.products.update({where:{code:process.argv[1]+'-A'},data:{stock:5}});}finally{await db.$disconnect();}",
    code,
  ]);
  const unchanged = await find(page, code + "-A");
  await expect(
    unchanged.getByRole("cell", { name: "5", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ログアウト" }).click();
  await login(page, "admin@training2.test");
  await page.waitForURL("**/products");
  const observed = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/orders/" + orderId) &&
      request.method() === "GET",
  );
  await page.goto("http://localhost:5173/orders/" + orderId);
  const otherRequest = await observed;
  await expect(
    page.getByText("見つからないか、閲覧する権限がありません。"),
  ).toBeVisible();
  const authorization = otherRequest.headers().authorization;
  expect(authorization).toBeTruthy();
  for (const action of ["confirm", "cancel"]) {
    const response = await page.request.post(
      "http://localhost:5173/api/orders/" + orderId + "/" + action,
      { headers: { Authorization: authorization } },
    );
    expect(response.status()).toBe(404);
  }
});
