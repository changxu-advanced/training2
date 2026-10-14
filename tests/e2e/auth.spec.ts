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
  await expect(
    page.getByRole("navigation", { name: "メインナビゲーション" }),
  ).toHaveCount(0);
  await expect(page.locator("header .account")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "商品を見る →", exact: true }),
  ).toBeVisible();
  await login(page, "buyer@training2.test");
  await expect(page).toHaveURL(/\/orders\/new$/);
  await expect(
    page.getByRole("navigation", { name: "メインナビゲーション" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ログアウト", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "注文管理", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("navigation", { name: "メインナビゲーション" }),
  ).toHaveCount(0);
  await expect(page.locator("header .account")).toHaveCount(0);
  await login(page, "buyer@training2.test");
  await expect(page).toHaveURL(/\/products$/);
  await expect(
    page.getByRole("heading", { name: "商品一覧", exact: true }),
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
  await expect(page.locator("header .account")).toHaveCount(0);
  await login(page, "admin@training2.test");
  await expect(page).toHaveURL(/\/products$/);
  await expect(
    page.getByRole("heading", { name: "商品一覧", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "メインナビゲーション" })
    .getByRole("link", { name: "商品登録", exact: true })
    .click();
  await expect(page).toHaveURL(/\/products\/new$/);
  await page.getByRole("button", { name: "商品登録", exact: true }).click();
  await expect(page.getByText(/次の項目をご確認ください/)).toBeVisible();
  await page.getByRole("button", { name: "ログアウト" }).click();
  await page.goto("http://localhost:5173/login");
  await login(page, "buyer@training2.test");
  await page.waitForURL("**/products");
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "注文管理", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "商品登録", exact: true }),
  ).toHaveCount(0);
  const captured = page.waitForRequest(
    (r) =>
      new URL(r.url()).pathname === "/api/products" && r.method() === "GET",
  );
  await page.reload();
  const authorization = (await captured).headers().authorization;
  await page.goto("http://localhost:5173/products/new");
  await expect(page).toHaveURL(/\/products\?denied=admin$/);
  await expect(
    page.getByText("商品登録は管理者のみ利用できます。", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("初期在庫", { exact: true })).toHaveCount(0);
  const denied = await page.request.post(
    "http://localhost:5173/admin-api/products",
    {
      headers: { Authorization: authorization },
      data: { code: "FORBIDDEN", name: "禁止", priceJpy: 1, stock: 1 },
    },
  );
  expect(denied.status()).toBe(403);
  await page.getByRole("button", { name: "ログアウト" }).click();
  await login(page, "admin@training2.test");
  await page.waitForURL("**/products");
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "商品一覧", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "商品登録", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "注文管理", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "商品を選択" })).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "メインナビゲーション" })
    .getByRole("link", { name: "商品登録", exact: true })
    .click();
  await expect(page.getByLabel("初期在庫", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("初期在庫", { exact: true })).toBeVisible();
  let releaseOld = () => {};
  let oldRequested = () => {};
  const gate = new Promise<void>((resolve) => {
    releaseOld = resolve;
  });
  const pending = new Promise<void>((resolve) => {
    oldRequested = resolve;
  });
  await page.route("**/admin-api/products?**", async (route) => {
    oldRequested();
    await gate;
    await route.fulfill({
      status: 401,
      json: {
        error: {
          code: "UNAUTHENTICATED",
          message: "expired",
          requestId: "old-session",
        },
      },
    });
  });
  await page.goto("http://localhost:5173/products");
  await pending;
  await page.getByRole("button", { name: "ログアウト" }).click();
  await login(page, "buyer@training2.test");
  await page.waitForURL("**/products");
  const oldResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/admin-api/products" &&
      response.status() === 401,
  );
  releaseOld();
  await oldResponse;
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "注文管理", exact: true })
    .click();
  await expect(page).toHaveURL(/\/orders\/new$/);
  await expect(
    page.getByText("buyer@training2.test", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ログアウト" }).click();
});
