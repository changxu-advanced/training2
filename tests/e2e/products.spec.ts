import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("[E2E-PRODUCTS] admin registers a real product, buyer searches literal values and refreshes stock", async ({
  page,
}) => {
  const code = "E2E-" + randomUUID().slice(0, 8).toUpperCase();
  const name = "体验好物 %_ " + code;
  await page.goto("http://localhost:5174/login");
  await page.getByLabel("邮箱", { exact: true }).fill("admin@training2.test");
  await page.getByLabel("密码", { exact: true }).fill("Training2-local-2026!");
  await page.getByRole("button", { name: "登录管理端" }).click();
  await page.waitForURL("**/products");
  await page.goto("http://localhost:5174/products/new");
  await page
    .getByLabel("商品代码", { exact: true })
    .fill(" " + code.toLowerCase() + " ");
  await page.getByLabel("商品名称", { exact: true }).fill(name);
  await page.getByLabel("商品说明", { exact: true }).fill("<b>纯文本说明</b>");
  await page.getByLabel("价格 · JPY", { exact: true }).fill("1280");
  await page.getByLabel("初始库存", { exact: true }).fill("7");
  await page.getByRole("heading", { name: "注册商品" }).click();
  await page.getByRole("button", { name: "注册商品", exact: true }).click();
  await expect(page).toHaveURL(/\/products$/);
  await page.goto("http://localhost:5174/products/new");
  await page.getByLabel("商品代码", { exact: true }).fill(code.toLowerCase());
  await page.getByLabel("商品名称", { exact: true }).fill(name);
  await page.getByRole("button", { name: "注册商品", exact: true }).click();
  await expect(page.getByText("商品代码已存在，请换一个代码。")).toBeVisible();
  await page.getByRole("button", { name: "退出登录" }).click();
  await page.goto("http://localhost:5173/products");
  await page.getByLabel("商品代码", { exact: true }).fill(code.toLowerCase());
  await page.getByLabel("商品名称", { exact: true }).fill("%_");
  await page.getByRole("button", { name: "搜索商品" }).click();
  const row = page.getByRole("row").filter({ hasText: code });
  await expect(row).toContainText(name);
  await expect(row).toContainText("1,280");
  await expect(row).toContainText("<b>纯文本说明</b>");
  await expect(page.getByText("1 件商品", { exact: true })).toBeVisible();
  execFileSync(process.execPath, [
    "--input-type=module",
    "-e",
    "import {createPrismaClient} from './packages/prisma/src/index.ts';const db=createPrismaClient(process.env.DATABASE_URL);try{await db.products.update({where:{code:process.argv[1]},data:{stock:9}});}finally{await db.$disconnect();}",
    code,
  ]);
  await row.getByRole("button", { name: "刷新库存" }).click();
  await expect(row.getByRole("cell", { name: "9", exact: true })).toBeVisible();
  await page
    .getByLabel("商品名称", { exact: true })
    .fill("不存在-" + randomUUID());
  await page.getByRole("button", { name: "搜索商品" }).click();
  await expect(page.getByText("没有匹配的商品，试试其他条件")).toBeVisible();
  await page.route("**/api/products**", (route) => route.abort("failed"));
  await page.getByLabel("商品名称", { exact: true }).fill("触发失败");
  await page.getByRole("button", { name: "搜索商品" }).click();
  await expect(page.getByText("连接失败，请检查网络并重试。")).toBeVisible();
  await expect(page.getByRole("button", { name: "重新加载" })).toBeVisible();
});
