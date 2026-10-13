import { expect, type Page, test } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.getByLabel("邮箱", { exact: true }).fill(email);
  await page.getByLabel("密码", { exact: true }).fill("Training2-local-2026!");
  await page.getByRole("button", { name: /登录买家端|登录管理端/ }).click();
}
test("[E2E-AUTH] real Cognito login/logout, protected routes, roles and expired-session feedback", async ({
  page,
}) => {
  await page.goto("http://localhost:5173/orders/new");
  await expect(page).toHaveURL(/\/login/);
  await login(page, "buyer@training2.test");
  await expect(page).toHaveURL(/\/orders\/new$/);
  await expect(page.getByText("还没有选择商品")).toBeVisible();
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, "buyer@training2.test");
  await expect(page).toHaveURL(/\/products$/);
  await expect(
    page.getByText("此功能即将开放，当前还不能完成操作。"),
  ).toBeVisible();
  await page.route("**/api/orders/**", (route) =>
    route.continue({
      headers: {
        ...route.request().headers(),
        authorization: "Bearer invalid",
      },
    }),
  );
  await page.goto(
    "http://localhost:5173/orders/00000000-0000-4000-8000-000000000000",
  );
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText("登录已失效，请重新登录")).toBeVisible();
  await page.goto("http://localhost:5174/products");
  await expect(page).toHaveURL(/\/login/);
  await login(page, "buyer@training2.test");
  await expect(
    page.getByText("当前账号没有管理权限", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "注册商品", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "退出登录" }).click();
  await login(page, "admin@training2.test");
  await expect(page).toHaveURL(/\/products$/);
  await expect(
    page.getByText("此功能即将开放，当前还不能完成操作。"),
  ).toBeVisible();
  await page.getByRole("link", { name: "注册商品", exact: true }).click();
  await expect(page).toHaveURL(/\/products\/new$/);
  await page.getByRole("button", { name: "注册商品", exact: true }).click();
  await expect(page.getByText(/请检查以下字段/)).toBeVisible();
  await page.getByLabel("商品代码", { exact: true }).fill(" abc-1 ");
  await page.getByLabel("商品名称", { exact: true }).fill("测试商品");
  await page.getByRole("button", { name: "注册商品", exact: true }).click();
  await expect(
    page.getByText("此功能即将开放，当前还不能完成操作。"),
  ).toBeVisible();
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
