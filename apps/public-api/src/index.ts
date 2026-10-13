import { serve } from "@hono/node-server";
import { createContractApp } from "@training2/api-contracts";

const app = createContractApp("public");
app.get("/health", (c) =>
  c.json({ status: "ok", service: "public-api", stage: "foundation" }),
);
const server = serve({
  fetch: app.fetch,
  hostname: "0.0.0.0",
  port: Number(process.env.PUBLIC_API_PORT ?? 3000),
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => server.close());
