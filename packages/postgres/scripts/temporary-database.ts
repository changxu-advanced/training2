import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { createClient, databaseUrl } from "./connection.ts";
export async function withTemporaryDatabase<T>(
  run: (client: Client, url: string) => Promise<T>,
): Promise<T> {
  const name = `training2_test_${randomUUID().replaceAll("-", "")}`;
  const base = new URL(databaseUrl());
  const adminUrl = new URL(base);
  adminUrl.pathname = "/postgres";
  const admin = createClient(adminUrl.toString());
  const url = new URL(base);
  url.pathname = `/${name}`;
  const client = createClient(url.toString());
  let created = false;
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    await client.connect();
    return await run(client, url.toString());
  } finally {
    await client.end().catch(() => {});
    if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
  }
}
