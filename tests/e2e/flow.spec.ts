import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("[E2E-FLOW] real administrator registration through buyer order confirmation and cancellation", async ({
  page,
}) => {
  const code = "FLOW-" + randomUUID().slice(0, 8).toUpperCase();
  await page.goto("http://localhost:5174/login");
  await page.getByLabel("邮箱", { exact: true }).fill("admin@training2.test");
  await page.getByLabel("密码", { exact: true }).fill("Training2-local-2026!");
  await page.getByRole("button", { name: "登录管理端" }).click();
  await page.waitForURL("**/products");
  await page.getByRole("link", { name: "注册商品", exact: true }).click();
  await page.getByLabel("商品代码", { exact: true }).fill(code.toLowerCase());
  await page
    .getByLabel("商品名称", { exact: true })
    .fill("主要流程商品 " + code);
  await page.getByLabel("价格 · JPY", { exact: true }).fill("750");
  await page.getByLabel("初始库存", { exact: true }).fill("3");
  await page.getByRole("heading", { name: "注册商品" }).click();
  await page.getByRole("button", { name: "注册商品", exact: true }).click();
  await expect(page).toHaveURL(/\/products$/);
  await page.getByRole("button", { name: "退出登录" }).click();
  await page.goto("http://localhost:5173/login");
  await page.getByLabel("邮箱", { exact: true }).fill("buyer@training2.test");
  await page.getByLabel("密码", { exact: true }).fill("Training2-local-2026!");
  await page.getByRole("button", { name: "登录买家端" }).click();
  await page.waitForURL("**/products");
  async function find() {
    await page.goto("http://localhost:5173/products");
    await page.getByLabel("商品代码", { exact: true }).fill(code);
    await page.getByRole("button", { name: "搜索商品" }).click();
    const row = page.getByRole("row").filter({ hasText: code });
    await expect(row).toBeVisible();
    return row;
  }
  const row = await find();
  await expect(row.getByRole("cell", { name: "3", exact: true })).toBeVisible();
  await row.getByRole("button", { name: "选择商品" }).click();
  await page.getByRole("spinbutton").fill("2");
  await page.getByRole("heading", { name: "创建订单" }).click();
  await page.getByRole("button", { name: "创建草稿订单" }).click();
  await expect(
    page.getByRole("heading", { name: "草稿", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "合计 ¥1,500" }),
  ).toBeVisible();
  const orderUrl = page.url();
  const beforeConfirm = await find();
  await expect(
    beforeConfirm.getByRole("cell", { name: "3", exact: true }),
  ).toBeVisible();
  await page.goto(orderUrl);
  await page.getByRole("button", { name: "确认订单", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "已确认", exact: true }),
  ).toBeVisible();
  const bought = await find();
  await expect(
    bought.getByRole("cell", { name: "1", exact: true }),
  ).toBeVisible();
  await page.goto(orderUrl);
  await page.getByRole("button", { name: "取消订单", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "已取消", exact: true }),
  ).toBeVisible();
  const restored = await find();
  await expect(
    restored.getByRole("cell", { name: "3", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
