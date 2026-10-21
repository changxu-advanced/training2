import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("[E2E-PRODUCTS] admin registers a real product, buyer searches literal values and automatically receives stock updates", async ({
  page,
}) => {
  test.setTimeout(90000);
  const graphOperations = new Set<string>();
  page.on("response", (response) => {
    if (
      new URL(response.url()).pathname === "/admin-api/graphql" &&
      response.status() === 200
    ) {
      const body = response.request().postDataJSON();
      const name = String(body.query).match(/(?:query|mutation)\s+(\w+)/)?.[1];
      if (name) graphOperations.add(name);
    }
  });
  await page.route("**/admin-api/products**", (route) => route.abort());
  async function findAdminRow(code: string) {
    const row = page.getByRole("row").filter({ hasText: code });
    for (let i = 0; i < 100; i++) {
      await expect(page.locator(".product-table")).toBeVisible();
      if (await row.count()) return row;
      const next = page.locator(".el-pagination .btn-next");
      if (await next.isDisabled())
        throw new Error(
          "Registered product not found in paginated administrator list",
        );
      const changed = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === "/admin-api/graphql" &&
          r.request().postData()?.includes("AdminProducts") === true,
      );
      await next.click();
      await changed;
      await expect(page.locator(".el-skeleton")).toHaveCount(0);
    }
    throw new Error("Administrator pagination exceeded test bound");
  }
  const code = "E2E-" + randomUUID().slice(0, 8).toUpperCase();
  const name = "サンプル商品 %_ " + code;
  await page.goto("http://localhost:5173/login");
  const logo = page.getByRole("img", {
    name: "アドバンスト・ソフト",
    exact: true,
  });
  await expect(
    page.getByRole("link", { name: /アドバンスト・ソフト/ }),
  ).toHaveCount(0);
  await logo.click();
  await expect(page).toHaveURL(/\/login$/);
  const browse = page.getByRole("link", { name: "商品を見る →", exact: true });
  await expect(browse).toHaveClass(/navigation-button/);
  const beforeHover = await browse.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  await browse.hover();
  await expect
    .poll(() => browse.evaluate((el) => getComputedStyle(el).backgroundColor))
    .not.toBe(beforeHover);
  await browse.focus();
  await expect(browse).toBeFocused();
  await browse.press("Enter");
  await expect(page).toHaveURL(/\/products$/);
  const headerLogin = page
    .locator("header")
    .getByRole("link", { name: /^ログイン\s*↗$/ });
  await expect(headerLogin).toHaveClass(/navigation-button/);
  const loginNormal = await headerLogin.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  await headerLogin.hover();
  await expect
    .poll(() =>
      headerLogin.evaluate((el) => getComputedStyle(el).backgroundColor),
    )
    .not.toBe(loginNormal);
  await headerLogin.click();
  await expect(page).toHaveURL(/\/login$/);
  await page
    .getByLabel("メールアドレス", { exact: true })
    .fill("admin@training2.test");
  await page
    .getByLabel("パスワード", { exact: true })
    .fill("Training2-local-2026!");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForURL("**/products");
  await page.goto("http://localhost:5173/products/new");
  await logo.click();
  await expect(page).toHaveURL(/\/products\/new$/);
  const back = page.getByRole("link", { name: "← 一覧へ戻る", exact: true });
  await expect(back).toHaveClass(/navigation-button/);
  await back.focus();
  await back.press("Enter");
  await expect(page).toHaveURL(/\/products$/);
  await page.getByRole("button", { name: "商品登録", exact: true }).click();
  await expect(page).toHaveURL(/\/products\/new$/);
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
  const registered = await findAdminRow(code);
  const registerButton = page.getByRole("button", {
    name: "商品登録",
    exact: true,
  });
  const addButton = registered.getByRole("button", {
    name: "在庫を追加",
    exact: true,
  });
  await expect(addButton).toBeVisible();
  const registerBox = await registerButton.boundingBox();
  const addBox = await addButton.boundingBox();
  const countBox = await page
    .locator(".product-heading-actions .muted")
    .boundingBox();
  expect(Math.abs(registerBox!.x - addBox!.x)).toBeLessThan(2);
  expect(registerBox!.width).toBe(addBox!.width);
  expect(registerBox!.height).toBe(addBox!.height);
  expect(
    Math.abs(
      registerBox!.y +
        registerBox!.height / 2 -
        countBox!.y -
        countBox!.height / 2,
    ),
  ).toBeLessThan(2);
  expect(registerBox!.x + registerBox!.width).toBeLessThan(countBox!.x);
  const normal = await registerButton.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  await registerButton.hover();
  await expect
    .poll(() =>
      registerButton.evaluate((el) => getComputedStyle(el).backgroundColor),
    )
    .not.toBe(normal);
  await page.getByRole("heading", { name: "商品一覧", exact: true }).hover();
  await registered
    .getByRole("button", { name: "在庫を追加", exact: true })
    .click();
  await expect(page).toHaveURL(/\/products\/new\?restock=/);
  await expect(page.getByLabel("商品コード", { exact: true })).toHaveValue(
    code,
  );
  await expect(page.getByLabel("商品名", { exact: true })).toHaveValue(name);
  await expect(page.getByLabel("商品コード", { exact: true })).toBeDisabled();
  const additional = page.getByLabel("追加数量", { exact: true });
  await expect(additional).toHaveValue("1");
  await page.reload();
  await expect(additional).toHaveValue("1");
  await expect(page.getByLabel("商品説明", { exact: true })).toHaveValue(
    "<b>プレーンテキストの説明</b>",
  );
  await page.getByRole("button", { name: "在庫を追加", exact: true }).click();
  await expect(page).toHaveURL(/\/products$/);
  await findAdminRow(code);
  await expect(
    registered.getByRole("cell", { name: "8", exact: true }),
  ).toBeVisible();
  await page.goto("http://localhost:5173/products/new");
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
  await expect(row.getByRole("button", { name: "在庫を更新" })).toHaveCount(0);
  await expect(row.getByRole("cell", { name: "9", exact: true })).toBeVisible();
  const filter = page.getByRole("button", {
    name: /^在庫ありのみ(?:を解除)?$/,
  });
  async function checkRightEdge() {
    await expect
      .poll(async () => {
        const a = await filter.boundingBox();
        const b = await row
          .getByRole("button", { name: "商品を選択", exact: true })
          .boundingBox();
        return a && b ? Math.abs(a.x + a.width - b.x - b.width) : Infinity;
      })
      .toBeLessThan(2);
  }
  await checkRightEdge();
  await filter.click();
  await expect(filter).toHaveAttribute("aria-pressed", "true");
  await expect(filter).toHaveText("在庫ありのみを解除");
  await checkRightEdge();
  await page.setViewportSize({ width: 1536, height: 850 });
  await checkRightEdge();
  await filter.click();
  await checkRightEdge();
  await filter.click();
  await checkRightEdge();
  await page.setViewportSize({ width: 1280, height: 850 });
  await checkRightEdge();
  function updateStock(value: number) {
    execFileSync(process.execPath, [
      "--input-type=module",
      "-e",
      "import {createPrismaClient} from './packages/prisma/src/index.ts';const db=createPrismaClient(process.env.DATABASE_URL);try{await db.products.update({where:{code:process.argv[1]},data:{stock:Number(process.argv[2])}});}finally{await db.$disconnect();}",
      code,
      String(value),
    ]);
  }
  updateStock(0);
  await expect(row).toHaveCount(0);
  await expect(page.getByText("0 件の商品", { exact: true })).toBeVisible();
  await filter.click();
  await expect(filter).toHaveAttribute("aria-pressed", "false");
  await expect(filter).toHaveText("在庫ありのみ");
  await expect(row.getByText("在庫なし", { exact: true })).toBeVisible();
  await filter.click();
  await expect(filter).toHaveText("在庫ありのみを解除");
  await expect(row).toHaveCount(0);
  updateStock(9);
  await expect(row.getByRole("cell", { name: "9", exact: true })).toBeVisible();
  await filter.click();
  await expect(filter).toHaveText("在庫ありのみ");
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
  expect([...graphOperations]).toEqual(
    expect.arrayContaining([
      "AdminProducts",
      "AdminProduct",
      "RegisterAdminProduct",
      "RestockAdminProduct",
    ]),
  );
  // The same shared client must also serve the standalone administrator origin.
  const privatePage = await page.context().newPage();
  try {
    await privatePage.route("**/admin-api/products**", (route) =>
      route.abort(),
    );
    await privatePage.route("**/api/products**", (route) => route.abort());
    await privatePage.goto("http://localhost:5174/login");
    await privatePage
      .getByLabel("メールアドレス", { exact: true })
      .fill("admin@training2.test");
    await privatePage
      .getByLabel("パスワード", { exact: true })
      .fill("Training2-local-2026!");
    await privatePage
      .getByRole("button", { name: "管理者ログイン", exact: true })
      .click();
    await expect(privatePage.locator(".product-table")).toBeVisible();
    await privatePage
      .getByRole("navigation")
      .getByRole("link", { name: "商品登録", exact: true })
      .click();
    const privateCode = "PRI-" + randomUUID().slice(0, 8).toUpperCase();
    await privatePage
      .getByLabel("商品コード", { exact: true })
      .fill(privateCode);
    await privatePage
      .getByLabel("商品名", { exact: true })
      .fill("GraphQL 管理端商品");
    await privatePage.getByLabel("価格 · JPY", { exact: true }).fill("500");
    await privatePage.getByLabel("初期在庫", { exact: true }).fill("1");
    const created = privatePage.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/admin-api/graphql" &&
        r.request().postData()?.includes("RegisterAdminProduct") === true,
    );
    await privatePage
      .getByRole("button", { name: "商品登録", exact: true })
      .click();
    const payload = await (await created).json();
    expect(payload.errors).toBeUndefined();
    const id = payload.data.product.id;
    await expect(privatePage).toHaveURL(/\/products$/);
    await privatePage.goto("http://localhost:5174/products/new?restock=" + id);
    await expect(
      privatePage.getByLabel("商品コード", { exact: true }),
    ).toHaveValue(privateCode);
    await expect(
      privatePage.getByLabel("追加数量", { exact: true }),
    ).toHaveValue("1");
    const restocked = privatePage.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/admin-api/graphql" &&
        r.request().postData()?.includes("RestockAdminProduct") === true,
    );
    await privatePage
      .getByRole("button", { name: "在庫を追加", exact: true })
      .click();
    expect((await (await restocked).json()).data.product.stock).toBe(2);
    await expect(privatePage).toHaveURL(/\/products$/);
  } finally {
    await privatePage.close();
  }
});
