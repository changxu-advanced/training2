import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Client } from "pg";
import { createClient } from "./connection.ts";
export const migrationsDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../migrations",
);
export async function applyMigrations(
  client: Client,
  directory = migrationsDirectory,
) {
  const names = (await readdir(directory))
    .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name))
    .sort();
  const migrations = await Promise.all(
    names.map(async (name, index) => {
      if (Number(name.slice(0, 4)) !== index + 1)
        throw new Error("Migrations must be numbered consecutively from 0001.");
      const sql = (await readFile(join(directory, name), "utf8")).replace(
        /\r\n/g,
        "\n",
      );
      return {
        name,
        sql,
        checksum: createHash("sha256").update(sql).digest("hex"),
      };
    }),
  );
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock(782031, 3)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS public.schema_migrations (name text PRIMARY KEY, checksum char(64) NOT NULL, applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    );
    const history = await client.query<{ name: string; checksum: string }>(
      "SELECT name, checksum FROM public.schema_migrations ORDER BY name",
    );
    for (const [index, row] of history.rows.entries()) {
      const file = migrations[index];
      if (!file || file.name !== row.name || file.checksum !== row.checksum)
        throw new Error(
          "Applied migration history differs from the repository. Add a new migration; do not edit or remove history.",
        );
    }
    const applied: string[] = [];
    for (const file of migrations.slice(history.rowCount ?? 0)) {
      await client.query(file.sql);
      await client.query(
        "INSERT INTO public.schema_migrations(name,checksum) VALUES ($1,$2)",
        [file.name, file.checksum],
      );
      applied.push(file.name);
    }
    await client.query("COMMIT");
    return applied;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const client = createClient();
  try {
    await client.connect();
    const result = await applyMigrations(client);
    console.log(`Migrations applied: ${result.length}`);
  } catch {
    console.error(
      "Migration failed. Check migration history and database availability.",
    );
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
