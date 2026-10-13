import type { RouteManifest, Scenario, Scope, Screen } from "./index.ts";

function unique(values: readonly string[], label: string) {
  if (new Set(values).size !== values.length)
    throw new Error(`Duplicate ${label}`);
}
export function validateGraph(
  screens: readonly Screen[],
  scenarios: readonly Scenario[],
  acceptance: ReadonlySet<string>,
  operations: Record<Scope, ReadonlySet<string>>,
) {
  unique(
    screens.map((s) => s.id),
    "screen ID",
  );
  unique(
    scenarios.map((s) => s.id),
    "scenario ID",
  );
  const ids = new Map(screens.map((s) => [s.id, s]));
  for (const scope of ["public", "private"] as const)
    unique(
      screens.filter((s) => s.scope === scope).map((s) => s.path),
      `${scope} screen route`,
    );
  for (const screen of screens) {
    if (
      !screen.id ||
      !screen.path.startsWith("/") ||
      !screen.inputContract ||
      !screen.name ||
      screen.acceptance.length === 0
    )
      throw new Error(`Incomplete screen ${screen.id}`);
    for (const state of [
      "idle",
      "loading",
      "empty",
      "success",
      "error",
    ] as const)
      if (!screen.states[state])
        throw new Error(`Missing state ${screen.id}:${state}`);
    for (const target of screen.transitions)
      if (ids.get(target)?.scope !== screen.scope)
        throw new Error(`Invalid transition ${screen.id}:${target}`);
    for (const api of screen.apis)
      if (!operations[screen.scope].has(api))
        throw new Error(`Unknown API ${screen.id}:${api}`);
    for (const id of screen.acceptance) {
      if (!acceptance.has(id)) throw new Error(`Unknown acceptance ${id}`);
      if (
        !scenarios.some(
          (s) => s.screens.includes(screen.id) && s.acceptance.includes(id),
        )
      )
        throw new Error(`Missing E2E mapping ${screen.id}:${id}`);
    }
  }
  for (const scenario of scenarios) {
    if (
      !scenario.actions.length ||
      !scenario.expectations.length ||
      !scenario.screens.length ||
      !scenario.acceptance.length ||
      scenario.kind !== "business"
    )
      throw new Error(`Incomplete business scenario ${scenario.id}`);
    if (scenario.status === "implemented" && !scenario.specFile)
      throw new Error(`Implemented scenario needs a spec ${scenario.id}`);
    for (const id of scenario.screens)
      if (!ids.has(id)) throw new Error(`Unknown scenario screen ${id}`);
    for (const id of scenario.acceptance)
      if (!acceptance.has(id)) throw new Error(`Unknown acceptance ${id}`);
  }
}
export function validateRoutes(
  screens: readonly Screen[],
  manifest: RouteManifest,
  requireImplemented = false,
) {
  if (requireImplemented && manifest.status !== "implemented")
    throw new Error(`Routes are only planned: ${manifest.scope}`);
  const expected = screens.filter((s) => s.scope === manifest.scope);
  unique(
    manifest.routes.map((r) => r.screenId),
    "route screen ID",
  );
  unique(
    [
      ...manifest.routes.map((r) => r.path),
      ...manifest.redirects.map((r) => r.path),
    ],
    "route path",
  );
  if (expected.length !== manifest.routes.length)
    throw new Error(`Route count mismatch: ${manifest.scope}`);
  for (const screen of expected)
    if (
      !manifest.routes.some(
        (r) => r.screenId === screen.id && r.path === screen.path,
      )
    )
      throw new Error(`Route mismatch ${screen.id}`);
  if (!manifest.redirects.some((r) => r.path === "/" && r.to === "/products"))
    throw new Error("Missing home redirect");
  for (const redirect of manifest.redirects)
    if (!manifest.routes.some((r) => r.path === redirect.to))
      throw new Error("Unknown redirect target");
}
// Pass router.getRoutes() here after Vue Router is constructed. Flags alone are not evidence.
export function validateActualRoutes(
  screens: readonly Screen[],
  scope: Scope,
  routes: readonly {
    path: string;
    redirect?: unknown;
    meta?: { screenId?: unknown; [key: string]: unknown };
  }[],
) {
  validateRoutes(
    screens,
    {
      scope,
      status: "implemented",
      routes: routes
        .filter((r) => !r.redirect)
        .map((r) => ({
          path: r.path,
          screenId: String(r.meta?.screenId ?? ""),
        })),
      redirects: routes
        .filter((r) => r.redirect)
        .map((r) => ({
          path: r.path,
          to: typeof r.redirect === "string" ? r.redirect : "",
        })),
    },
    true,
  );
}
