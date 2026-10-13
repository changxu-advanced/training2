import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { openapiDocument } from "@training2/api-contracts";
import { routeManifest as privateManifest } from "../../../apps/private-frontend/src/route-manifest.ts";
import { routeManifest as publicManifest } from "../../../apps/public-frontend/src/route-manifest.ts";
import { type Scope, scenarios, screens } from "../src/index.ts";
import {
  validateActualRoutes,
  validateGraph,
  validateRoutes,
} from "../src/validate.ts";

const acceptance = new Set(
  [
    ...(
      await readFile(
        new URL("../../../docs/acceptance-scenarios.md", import.meta.url),
        "utf8",
      )
    ).matchAll(/\| (AC-[A-Z][0-9]{2}) \|/g),
  ].map((m) => m[1]),
);
function ids(scope: Scope) {
  return new Set(
    Object.values(openapiDocument(scope).paths ?? {}).flatMap((path) =>
      Object.values(path ?? {})
        .filter((v) => v && typeof v === "object" && "operationId" in v)
        .map((v) => String((v as { operationId: string }).operationId)),
    ),
  );
}
const operations = { public: ids("public"), private: ids("private") };
test("screen graph detects missing E2E/acceptance, duplicate IDs and unknown API/transition", () => {
  validateGraph(screens, scenarios, acceptance, operations);
  assert.throws(
    () => validateGraph(screens, [], acceptance, operations),
    /Missing E2E/,
  );
  assert.throws(
    () =>
      validateGraph(
        [...screens, screens[0]],
        scenarios,
        acceptance,
        operations,
      ),
    /Duplicate/,
  );
  for (const change of [
    { apis: ["unknown-api"] },
    { acceptance: ["AC-UNKNOWN"] },
    { transitions: ["ADM-LOGIN"] },
  ])
    assert.throws(() =>
      validateGraph(
        [{ ...screens[0], ...change }, ...screens.slice(1)],
        scenarios,
        acceptance,
        operations,
      ),
    );
  assert.throws(
    () =>
      validateGraph(
        screens,
        [
          ...scenarios,
          { ...scenarios[0], id: "E2E-UNKNOWN", screens: ["UNKNOWN"] },
        ],
        acceptance,
        operations,
      ),
    /Unknown scenario screen/,
  );
});
test("route guard detects drift and planned routes cannot count as implemented", () => {
  for (const manifest of [publicManifest, privateManifest]) {
    validateRoutes(screens, manifest);
    assert.throws(
      () => validateRoutes(screens, manifest, true),
      /only planned/,
    );
    assert.throws(
      () =>
        validateRoutes(screens, {
          ...manifest,
          routes: manifest.routes.slice(1),
        }),
      /count mismatch/,
    );
    assert.throws(
      () =>
        validateRoutes(screens, {
          ...manifest,
          routes: manifest.routes.map((r, i) =>
            i === 0 ? { ...r, path: "/wrong" } : r,
          ),
        }),
      /Route mismatch/,
    );
    assert.throws(
      () => validateRoutes(screens, { ...manifest, redirects: [] }),
      /home redirect/,
    );
    // Router-shaped fixtures verify the adapter; they do not claim frontend implementation.
    const actual = [
      ...manifest.routes.map((r) => ({
        path: r.path,
        meta: { screenId: r.screenId },
      })),
      ...manifest.redirects.map((r) => ({ path: r.path, redirect: r.to })),
    ];
    validateActualRoutes(screens, manifest.scope, actual);
    assert.throws(
      () =>
        validateActualRoutes(screens, manifest.scope, [
          ...actual,
          { path: "/orphan", meta: { screenId: "UNKNOWN" } },
        ]),
      /count mismatch/,
    );
  }
});
