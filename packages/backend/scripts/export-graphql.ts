import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { withTestDatabase } from "@training2/test-utils";
import { lexicographicSortSchema, printSchema } from "graphql";
import { createAdminGraphql } from "../src/admin-graphql.ts";

const file = new URL("../../../schemas/graphql/admin.graphql", import.meta.url);
await withTestDatabase(async (prisma, url) => {
  const api = await createAdminGraphql(url, prisma);
  try {
    const content = `${printSchema(lexicographicSortSchema(api.schema))}\n`;
    if (process.argv.includes("--check")) {
      if (readFileSync(file, "utf8") !== content)
        throw new Error("GraphQL schema differs; run pnpm graphql:schema");
    } else {
      mkdirSync(new URL(".", file), { recursive: true });
      writeFileSync(file, content);
    }
    console.log(
      "Administrator GraphQL schema " +
        (process.argv.includes("--check") ? "verified" : "generated"),
    );
  } finally {
    await api.close();
  }
});
