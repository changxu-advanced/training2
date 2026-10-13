import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Client } from "pg";
import { applyMigrations } from "./migrate.ts";
import { withTemporaryDatabase } from "./temporary-database.ts";
export async function describeSchema(client: Client) {
  const columns = await client.query(
    "SELECT table_name, column_name, ordinal_position, data_type, udt_name, is_nullable, column_default, collation_name FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position",
  );
  const constraints = await client.query(
    "SELECT c.relname AS table_name, con.conname AS name, con.contype AS type, pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname, con.conname",
  );
  const indexes = await client.query(
    "SELECT tablename AS table_name, indexname AS name, indexdef AS definition FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname",
  );
  const enums = await client.query(
    "SELECT t.typname AS name, e.enumlabel AS value FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder",
  );
  const functions = await client.query(
    "SELECT p.proname AS name, pg_get_function_identity_arguments(p.oid) AS arguments, pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace LEFT JOIN pg_depend d ON d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e' WHERE n.nspname='public' AND d.objid IS NULL AND p.prokind IN ('f','p') ORDER BY p.proname, arguments",
  );
  const triggers = await client.query(
    "SELECT c.relname AS table_name,t.tgname AS name,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname",
  );
  return {
    columns: columns.rows,
    constraints: constraints.rows,
    indexes: indexes.rows,
    enums: enums.rows,
    functions: functions.rows,
    triggers: triggers.rows,
  };
}
export async function generateSchema() {
  return withTemporaryDatabase(async (client) => {
    await applyMigrations(client);
    return `${JSON.stringify(await describeSchema(client), null, 2)}\n`;
  });
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const file = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../schemas/current.json",
    );
    const schema = await generateSchema();
    if (process.argv.includes("--check")) {
      if ((await readFile(file, "utf8")) !== schema)
        throw new Error("Schema snapshot differs.");
      console.log(
        "Schema snapshot matches migrations applied to a fresh PostgreSQL database.",
      );
    } else {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, schema);
      console.log(
        "Generated schema snapshot from a fresh PostgreSQL database.",
      );
    }
  } catch {
    console.error(
      "Schema generation/check failed. Run db:schema and review the result.",
    );
    process.exitCode = 1;
  }
}
