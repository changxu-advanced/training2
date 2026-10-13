import { defineConfig, env } from "prisma/config";
export default defineConfig({
  schema: process.env.PRISMA_SCHEMA_PATH ?? "schema.prisma",
  datasource: { url: env("DATABASE_URL") },
});
