import { expect, type Page, test } from "@playwright/test";

async function login(page: Page, email: string) {
  await page.getByLabel("メールアドレス", { exact: true }).fill(email);
  await page
    .getByLabel("パスワード", { exact: true })
    .fill("Training2-local-2026!");
  await page.getByRole("button", { name: /ログイン|管理者ログイン/ }).click();
}
test("[E2E-AUTH] real Cognito login/logout, protected routes, roles and expired-session feedback", async ({
  page,
}) => {
  await page.goto("http://localhost:5173/orders/new");
  await expect(page).toHaveURL(/\/login/);
  await login(page, "buyer@training2.test");
  await expect(page).toHaveURL(/\/orders\/new$/);
  await expect(
    page.getByRole("heading", { name: "注文", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, "buyer@training2.test");
  await expect(page).toHaveURL(/\/products$/);
  await expect(
    page.getByRole("heading", { name: /商品一覧|すべての商品/ }),
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
  await expect(
    page.getByText(
      "セッションの有効期限が切れました。再度ログインしてください",
    ),
  ).toBeVisible();
  await page.goto("http://localhost:5174/products");
  await expect(page).toHaveURL(/\/login/);
  await login(page, "buyer@training2.test");
  await expect(
    page.getByText("管理権限がありません", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "商品登録", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "ログアウト" }).click();
  await login(page, "admin@training2.test");
  await expect(page).toHaveURL(/\/products$/);
  await expect(
    page.getByRole("heading", { name: /商品一覧|すべての商品/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "商品登録", exact: true }).click();
  await expect(page).toHaveURL(/\/products\/new$/);
  await page.getByRole("button", { name: "商品登録", exact: true }).click();
  await expect(page.getByText(/次の項目をご確認ください/)).toBeVisible();
  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
