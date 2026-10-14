import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import { routeManifest as privateManifest } from "../../../apps/private-frontend/src/route-manifest.ts";
import { routeManifest as publicManifest } from "../../../apps/public-frontend/src/route-manifest.ts";
import { clearSession, draft, session } from "../src/context.ts";
import { apiMessage, safeReturnTo } from "../src/helpers.ts";
import { createScreenRouter } from "../src/router.ts";

describe("frontend foundation", () => {
  it("constructs actual Vue Router routes for both applications and resolves static before dynamic routes", () => {
    for (const manifest of [publicManifest, privateManifest]) {
      const router = createScreenRouter(manifest);
      for (const route of manifest.routes)
        expect(
          router.resolve(
            route.path.replace(":id", "00000000-0000-4000-8000-000000000000"),
          ).meta.screenId,
        ).toBe(route.screenId);
    }
    const router = createScreenRouter(publicManifest);
    expect(router.resolve("/orders/new").name).toBe("PUB-ORDER-CREATE");
  });
  it("rejects unsafe login redirects and translates errors without exposing response details", () => {
    draft.items = [
      {
        productId: "selected",
        productCode: "A",
        productName: "商品",
        quantity: 1,
      },
    ];
    clearSession(true);
    expect(draft.items).toHaveLength(1);
    session.sub = "buyer";
    clearSession();
    expect(draft.items).toHaveLength(0);
    for (const input of [
      "https://example.com",
      "//example.com",
      "/login",
      "/../evil",
      "/products?url=https://example.com",
      "/unknown",
    ])
      expect(safeReturnTo(input, publicManifest)).toBe("/products");
    expect(safeReturnTo("/orders/new", publicManifest)).toBe("/orders/new");
    expect(safeReturnTo("/products/new", privateManifest)).toBe(
      "/products/new",
    );
    const error = new AxiosError(
      "private-marker",
      "ERR_BAD_RESPONSE",
      undefined,
      undefined,
      {
        data: { error: { code: "INTERNAL_ERROR", message: "private-marker" } },
        status: 500,
        statusText: "",
        headers: {},
        config: { headers: {} as never },
      },
    );
    expect(apiMessage(error)).not.toContain("private-marker");
    expect(apiMessage(new AxiosError("timeout", "ECONNABORTED"))).toContain(
      "タイムアウト",
    );
  });
});
