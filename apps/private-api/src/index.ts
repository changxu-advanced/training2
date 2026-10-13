import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();
app.get("/health", (c) =>
  c.json({ status: "ok", service: "private-api", stage: "foundation" }),
);
const server = serve({
  fetch: app.fetch,
  hostname: "0.0.0.0",
  port: Number(process.env.PRIVATE_API_PORT ?? 3001),
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => server.close());
