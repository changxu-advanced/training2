import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";

async function login(page: Page, user = "buyer@training2.test") {
  await page.getByLabel("邮箱", { exact: true }).fill(user);
  await page.getByLabel("密码", { exact: true }).fill("Training2-local-2026!");
  await page.getByRole("button", { name: "登录买家端" }).click();
}
async function find(page: Page, code: string, navigate = true) {
  if (navigate) await page.goto("http://localhost:5173/products");
  await page.getByLabel("商品代码", { exact: true }).fill(code);
  await page.getByRole("button", { name: "搜索商品" }).click();
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
    "import {createPrismaClient} from './packages/prisma/src/index.ts';const db=createPrismaClient(process.env.DATABASE_URL);try{await db.products.createMany({data:[{code:process.argv[1]+'-A',name:'订单体验商品',price_jpy:500n,stock:5},{code:process.argv[1]+'-B',name:'无库存体验商品',price_jpy:100n,stock:0},{code:process.argv[1]+'-C',name:'高库存体验商品',price_jpy:100n,stock:1500}]});}finally{await db.$disconnect();}",
    code,
  ]);
  const row = await find(page, code + "-A");
  await row.getByRole("button", { name: "选择商品" }).click();
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
  await page.getByRole("link", { name: "← 继续选购" }).click();
  const highStock = await find(page, code + "-C", false);
  await highStock.getByRole("button", { name: "选择商品" }).click();
  await expect(page.getByRole("spinbutton")).toHaveCount(2);
  await page.getByRole("button", { name: "取消商品选择", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "取消商品选择" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "保留选择" }).click();
  await expect(page).toHaveURL(/\/orders\/new$/);
  await expect(page.getByRole("spinbutton").first()).toHaveValue("2");
  await page.getByRole("button", { name: "取消商品选择", exact: true }).click();
  await page.getByRole("dialog").press("Escape");
  await expect(page.getByRole("spinbutton")).toHaveCount(2);
  await page.getByRole("button", { name: "取消商品选择", exact: true }).click();
  await confirm.getByRole("button", { name: "确定取消" }).click();
  await expect(page).toHaveURL(/\/products$/);
  const fresh = await find(page, code + "-C", false);
  await fresh.getByRole("button", { name: "选择商品" }).click();
  await expect(page.getByRole("spinbutton")).toHaveCount(1);
  await expect(page.getByText("订单体验商品", { exact: true })).toHaveCount(0);
  await expect(quantity).toHaveValue("1");
  await quantity.fill("1001");
  await expect(quantity).toHaveValue("1000");
  await page.getByRole("button", { name: "取消商品选择", exact: true }).click();
  await confirm.getByRole("button", { name: "确定取消" }).click();
  const reselected = await find(page, code + "-A", false);
  await reselected.getByRole("button", { name: "选择商品" }).click();
  await expect(quantity).toHaveValue("1");
  await quantity.fill("2");
  await page.getByRole("heading", { name: "创建订单" }).click();
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
  await page.getByRole("button", { name: "创建草稿订单" }).click();
  await expect(page.getByText("连接失败，请检查网络并重试。")).toBeVisible();
  await page.getByRole("button", { name: "创建草稿订单" }).click();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+$/);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  expect(returnedIds[0]).toBe(returnedIds[1]);
  await page.unroute("**/api/orders");
  const orderId = new URL(page.url()).pathname.split("/").pop()!;
  await expect(
    page.getByRole("heading", { name: "草稿", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "合计 ¥1,000" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "确认订单", exact: true }).dblclick();
  await expect(
    page.getByRole("heading", { name: "已确认", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "确认订单", exact: true }),
  ).toBeDisabled();
  const allocated = await find(page, code + "-A");
  await expect(
    allocated.getByRole("cell", { name: "3", exact: true }),
  ).toBeVisible();
  await page.goto("http://localhost:5173/orders/" + orderId);
  await page.getByRole("button", { name: "取消订单", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "已取消", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "取消订单", exact: true }),
  ).toBeDisabled();
  const restored = await find(page, code + "-A");
  await expect(
    restored.getByRole("cell", { name: "5", exact: true }),
  ).toBeVisible();
  await restored.getByRole("button", { name: "选择商品" }).click();
  await page.getByRole("link", { name: "← 继续选购" }).click();
  const shortage = await find(page, code + "-B", false);
  await expect(
    shortage.getByRole("button", { name: "选择商品" }),
  ).toBeDisabled();
  const selectedAgain = await find(page, code + "-A", false);
  await selectedAgain.getByRole("button", { name: "选择商品" }).click();
  await page.getByRole("button", { name: "创建草稿订单" }).click();
  await expect(
    page.getByRole("heading", { name: "草稿", exact: true }),
  ).toBeVisible();
  // Inventory may change after the bounded draft UI; the API must still reject insufficient stock.
  execFileSync(process.execPath, [
    "--input-type=module",
    "-e",
    "import {createPrismaClient} from './packages/prisma/src/index.ts';const db=createPrismaClient(process.env.DATABASE_URL);try{await db.products.update({where:{code:process.argv[1]+'-A'},data:{stock:0}});}finally{await db.$disconnect();}",
    code,
  ]);
  await page.getByRole("button", { name: "确认订单", exact: true }).click();
  await expect(
    page.getByText("库存不足，请返回商品页查看最新库存。"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "草稿", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "取消订单", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "已取消", exact: true }),
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
  await page.getByRole("button", { name: "退出登录" }).click();
  await login(page, "admin@training2.test");
  await page.waitForURL("**/products");
  const observed = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/orders/" + orderId) &&
      request.method() === "GET",
  );
  await page.goto("http://localhost:5173/orders/" + orderId);
  const otherRequest = await observed;
  await expect(page.getByText("未找到内容，或你无权查看。")).toBeVisible();
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
