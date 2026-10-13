import type { Server } from "node:http";
import { serve } from "@hono/node-server";
import {
  type ContractApp,
  type ContractOptions,
  createContractApp,
} from "@training2/api-contracts";
import type { Authenticator } from "@training2/auth";
import { loadAuthenticator } from "@training2/auth/load";
import { type ApiConfig, parseApiConfig } from "@training2/config";
import { createLogger } from "@training2/logger";
import { createPrismaClient, type PrismaClient } from "@training2/prisma";
import { cors } from "hono/cors";
import { bindOrderRoutes } from "./orders.ts";
import { bindProductRoutes } from "./products.ts";
export type ApiRuntime = {
  app: ContractApp;
  prisma: PrismaClient;
  close: () => Promise<void>;
};
export async function createApi(
  scope: "public" | "private",
  config: ApiConfig,
  authenticator: Authenticator,
  options: Pick<ContractOptions, "logger" | "beforeRoutes"> = {},
): Promise<ApiRuntime> {
  const logger = options.logger ?? createLogger({ level: config.logLevel });
  const prisma = createPrismaClient(config.databaseUrl);
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    await prisma.$disconnect();
    throw new Error("Database startup check failed");
  }
  const app = createContractApp(scope, authenticator, {
    ...options,
    logger,
    bindRoutes: (app) => [
      ...bindProductRoutes(app, scope, prisma),
      ...(scope === "public" ? bindOrderRoutes(app, prisma) : []),
    ],
    configure(app) {
      app.use(
        "*",
        cors({
          origin: config.corsOrigins,
          allowMethods: ["GET", "POST", "OPTIONS"],
          allowHeaders: ["Authorization", "Content-Type", "Idempotency-Key"],
          exposeHeaders: ["X-Request-Id"],
          maxAge: 600,
        }),
      );
      app.use("*", async (c, next) => {
        const start = Date.now();
        await next();
        logger.info("API request", {
          requestId: c.get("requestId"),
          service: `${scope}-api`,
          method: c.req.method,
          status: c.res.status,
          durationMs: Date.now() - start,
        });
      });
    },
  });
  app.get("/health", async (c) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return c.json(
        { status: "ok", service: `${scope}-api`, database: "ok" },
        200,
      );
    } catch {
      logger.error("Database health check failed", {
        requestId: c.get("requestId"),
      });
      return c.json(
        {
          status: "unavailable",
          service: `${scope}-api`,
          database: "unavailable",
        },
        503,
      );
    }
  });
  let closing: Promise<void> | undefined;
  return {
    app,
    prisma,
    close() {
      closing ??= prisma.$disconnect();
      return closing;
    },
  };
}
export async function startApi(
  scope: "public" | "private",
): Promise<ApiRuntime & { server: Server }> {
  const config = parseApiConfig(process.env, scope);
  const logger = createLogger({ level: config.logLevel });
  const runtime = await createApi(scope, config, await loadAuthenticator(), {
    logger,
  });
  const server = serve({
    fetch: runtime.app.fetch,
    hostname: "0.0.0.0",
    port: config.port,
  }) as Server;
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    logger.info("API stopping", { service: `${scope}-api` });
    const timer = setTimeout(() => server.closeAllConnections(), 10000);
    timer.unref();
    server.close(async () => {
      clearTimeout(timer);
      try {
        await runtime.close();
      } catch {
        logger.error("Database shutdown failed");
        process.exitCode = 1;
      }
    });
  };
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, shutdown);
  server.on("error", () => {
    logger.error("API server failed", { service: `${scope}-api` });
    process.exitCode = 1;
    shutdown();
  });
  logger.info("API started", { service: `${scope}-api`, port: config.port });
  return { ...runtime, server };
}
