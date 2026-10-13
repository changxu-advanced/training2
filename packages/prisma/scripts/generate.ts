import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { redact } from "../../logger/src/index.ts";
import { applyMigrations } from "../../postgres/scripts/migrate.ts";
import { withTemporaryDatabase } from "../../postgres/scripts/temporary-database.ts";

const directory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(directory, `.generation-${randomUUID()}.prisma`);
const header =
  'generator client {\n  provider = "prisma-client"\n  output = "./generated"\n  moduleFormat = "esm"\n  generatedFileExtension = "ts"\n  importFileExtension = "ts"\n}\n\ndatasource db {\n  provider = "postgresql"\n}\n';
function run(args: string[], url: string) {
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "prisma",
      ...args,
      "--config",
      join(directory, "prisma.config.ts"),
    ],
    {
      cwd: directory,
      env: { ...process.env, DATABASE_URL: url, PRISMA_SCHEMA_PATH: file },
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    console.error(
      redact(
        (result.stderr || result.stdout || String(result.error)).slice(-4000),
      ),
    );
    throw new Error("Prisma command failed.");
  }
}
try {
  await writeFile(file, header);
  await withTemporaryDatabase(async (client, url) => {
    await applyMigrations(client);
    run(["db", "pull", "--force"], url);
    const schema = (await readFile(file, "utf8")).replace(/\r\n/g, "\n");
    const target = join(directory, "schema.prisma");
    if (process.argv.includes("--check")) {
      if ((await readFile(target, "utf8")) !== schema)
        throw new Error(
          "Generated Prisma schema differs from SQL migrations. Run prisma:generate.",
        );
    } else {
      await writeFile(target, schema);
    }
    run(["generate"], url);
  });
  console.log(
    "Prisma schema and Client generated from SQL migrations applied to a fresh database.",
  );
} finally {
  await unlink(file);
}
