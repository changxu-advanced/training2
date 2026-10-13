import { Client } from "pg";
export function databaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL must be provided explicitly.");
  return value;
}
export function createClient(url = databaseUrl()) {
  return new Client({ connectionString: url, connectionTimeoutMillis: 5000 });
}
