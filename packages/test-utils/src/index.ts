import { createPrismaClient, type PrismaClient } from "@training2/prisma";
import { applyMigrations } from "../../postgres/scripts/migrate.ts";
import { withTemporaryDatabase } from "../../postgres/scripts/temporary-database.ts";
export async function withTestDatabase<T>(
  run: (prisma: PrismaClient, url: string) => Promise<T>,
): Promise<T> {
  return withTemporaryDatabase(async (client, url) => {
    await applyMigrations(client);
    const prisma = createPrismaClient(url);
    try {
      return await run(prisma, url);
    } finally {
      await prisma.$disconnect();
    }
  });
}
export async function jsonResponse(response: Response) {
  return {
    status: response.status,
    body: await response.json(),
    requestId: response.headers.get("X-Request-Id"),
  };
}
