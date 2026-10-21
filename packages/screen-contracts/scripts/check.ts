import { readFile, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { openapiDocument } from "@training2/api-contracts";
import { routeManifest as privateManifest } from "../../../apps/private-frontend/src/route-manifest.ts";
import { routeManifest as publicManifest } from "../../../apps/public-frontend/src/route-manifest.ts";
import { graphqlOperations } from "../src/graphql-operations.ts";
import { type Scope, scenarios, screens } from "../src/index.ts";
import { renderScreens } from "../src/render.ts";
import { validateGraph, validateRoutes } from "../src/validate.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const acceptance = new Set(
  [
    ...(await readFile(`${root}docs/acceptance-scenarios.md`, "utf8")).matchAll(
      /\| (AC-[A-Z][0-9]{2}) \|/g,
    ),
  ].map((m) => m[1]),
);
function operations(scope: Scope) {
  return new Set(
    Object.values(openapiDocument(scope).paths ?? {}).flatMap((path) =>
      Object.values(path ?? {})
        .filter((v) => v && typeof v === "object" && "operationId" in v)
        .map((v) => String((v as { operationId: string }).operationId)),
    ),
  );
}
const adminOperations = operations("private");
for (const field of graphqlOperations(
  await readFile(`${root}schemas/graphql/admin.graphql`, "utf8"),
))
  adminOperations.add(field);
validateGraph(screens, scenarios, acceptance, {
  public: operations("public"),
  private: adminOperations,
});
for (const manifest of [publicManifest, privateManifest])
  validateRoutes(
    screens,
    manifest,
    process.argv.includes("--require-implemented"),
  );
for (const scenario of scenarios) {
  if (
    process.argv.includes("--require-e2e") &&
    scenario.status !== "implemented"
  )
    throw new Error(`E2E only planned: ${scenario.id}`);
  if (scenario.status === "implemented") {
    const file = resolve(root, scenario.specFile ?? "");
    if (!file.startsWith(resolve(root, "tests/e2e") + sep))
      throw new Error("E2E spec must be in tests/e2e");
    const source = await readFile(file, "utf8");
    if (!source.includes(`[${scenario.id}]`))
      throw new Error(`Missing scenario marker ${scenario.id}`);
  }
}
const target = `${root}docs/screens.generated.md`;
const rendered = renderScreens(screens, scenarios);
if (process.argv.includes("--write")) await writeFile(target, rendered);
else if ((await readFile(target, "utf8")) !== rendered)
  throw new Error("Screen docs differ; run pnpm screen:generate");
console.log(
  `PASS ${screens.length} screens, route declarations, API/acceptance/E2E mappings and generated docs. Routes: ${[publicManifest, privateManifest].map((m) => `${m.scope}=${m.status}`).join(", ")}; E2E planned=${scenarios.filter((s) => s.status === "planned").length}`,
);
