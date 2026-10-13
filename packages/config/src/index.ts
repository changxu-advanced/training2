import { z } from "zod";

const port = z.preprocess(
  (value) =>
    typeof value === "string" && /^[0-9]+$/.test(value) ? Number(value) : value,
  z.int().min(1).max(65535),
);
const databaseUrl = z
  .string()
  .url()
  .pipe(
    z
      .string()
      .refine((value) =>
        ["postgres:", "postgresql:"].includes(new URL(value).protocol),
      ),
  );
const origins = z
  .string()
  .transform((value) => value.split(",").map((item) => item.trim()))
  .pipe(
    z
      .array(
        z
          .string()
          .url()
          .pipe(
            z.string().refine((value) => {
              const url = new URL(value);
              return (
                ["http:", "https:"].includes(url.protocol) &&
                !url.username &&
                !url.password &&
                url.origin === value
              );
            }),
          ),
      )
      .min(1),
  )
  .transform((values) => [...new Set(values)]);
const schema = z.object({
  nodeEnv: z.enum(["development", "test", "production"]).default("development"),
  databaseUrl,
  port,
  corsOrigins: origins,
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});
export class ConfigurationError extends Error {
  readonly fields: readonly string[];
  constructor(fields: string[]) {
    super(`Invalid configuration fields: ${fields.join(", ")}`);
    this.name = "ConfigurationError";
    this.fields = fields;
  }
}
export function parseApiConfig(
  environment: Readonly<Record<string, string | undefined>>,
  scope: "public" | "private",
) {
  const upper = scope.toUpperCase();
  const result = schema.safeParse({
    nodeEnv: environment.NODE_ENV,
    databaseUrl: environment.DATABASE_URL,
    port:
      environment[`${upper}_API_PORT`] ??
      (scope === "public" ? "3000" : "3001"),
    corsOrigins:
      environment[`${upper}_API_CORS_ORIGINS`] ??
      (scope === "public" ? "http://localhost:5173" : "http://localhost:5174"),
    logLevel: environment.LOG_LEVEL,
  });
  if (!result.success)
    throw new ConfigurationError([
      ...new Set(result.error.issues.map((issue) => String(issue.path[0]))),
    ]);
  return result.data;
}
export type ApiConfig = ReturnType<typeof parseApiConfig>;
