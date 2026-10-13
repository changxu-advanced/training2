import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient } from "./connection.ts";

if (!["development", "test", undefined].includes(process.env.NODE_ENV))
  throw new Error("Development seed is disabled outside development/test.");
const client = createClient();
try {
  await client.connect();
  await client.query("BEGIN");
  await client.query(
    await readFile(
      fileURLToPath(new URL("../seeds/development.sql", import.meta.url)),
      "utf8",
    ),
  );
  await client.query("COMMIT");
  console.log("Development seed applied without overwriting existing rows.");
} catch {
  await client.query("ROLLBACK").catch(() => {});
  console.error("Development seed failed.");
  process.exitCode = 1;
} finally {
  await client.end();
}
