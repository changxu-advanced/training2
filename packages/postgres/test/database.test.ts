import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { Client } from "pg";
import { createClient } from "../scripts/connection.ts";
import { applyMigrations, migrationsDirectory } from "../scripts/migrate.ts";
import { describeSchema } from "../scripts/schema.ts";
import { withTemporaryDatabase } from "../scripts/temporary-database.ts";

async function product(client: Client, code = "TEST-001") {
  return (
    await client.query(
      "INSERT INTO products(code,name,price_jpy,stock) VALUES($1,$2,$3,$4) RETURNING id",
      [code, "测试商品", 500, 10],
    )
  ).rows[0].id as string;
}
async function order(client: Client, owner = "buyer-1", key = randomUUID()) {
  return (
    await client.query(
      "INSERT INTO orders(owner_sub,idempotency_key,request_items,total_jpy) VALUES($1,$2,$3,$4) RETURNING id",
      [
        owner,
        key,
        JSON.stringify([{ productId: randomUUID(), quantity: 1 }]),
        500,
      ],
    )
  ).rows[0].id as string;
}
async function rejects(
  client: Client,
  sql: string,
  values: unknown[],
  code: string,
) {
  await client.query("SAVEPOINT invalid_write");
  try {
    await assert.rejects(
      () => client.query(sql, values),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === code,
    );
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT invalid_write");
    await client.query("RELEASE SAVEPOINT invalid_write");
  }
}
test("real PostgreSQL database constraints", async (t) => {
  await withTemporaryDatabase(async (client) => {
    await applyMigrations(client);
    async function check(name: string, run: () => Promise<void>) {
      await t.test(name, async () => {
        await client.query("BEGIN");
        try {
          await run();
        } finally {
          await client.query("ROLLBACK");
        }
      });
    }
    await check(
      "AC-D02 rejects duplicate and unnormalized product codes",
      async () => {
        await product(client);
        await rejects(
          client,
          "INSERT INTO products(code,name,price_jpy,stock) VALUES($1,$2,500,1)",
          ["TEST-001", "重复"],
          "23505",
        );
        for (const code of ["lower", "SPACE CODE", "", "A".repeat(33)])
          await rejects(
            client,
            "INSERT INTO products(code,name,price_jpy,stock) VALUES($1,$2,500,1)",
            [code, "商品"],
            "23514",
          );
      },
    );
    await check(
      "AC-D02 rejects negative and excessive stock or prices",
      async () => {
        for (const stock of [-1, 1000001])
          await rejects(
            client,
            "INSERT INTO products(code,name,price_jpy,stock) VALUES('BAD-STOCK','商品',500,$1)",
            [stock],
            "23514",
          );
        for (const price of [-1, 100000001])
          await rejects(
            client,
            "INSERT INTO products(code,name,price_jpy,stock) VALUES('BAD-PRICE','商品',$1,1)",
            [price],
            "23514",
          );
      },
    );
    await check(
      "unicode name lengths and description limits are enforced",
      async () => {
        for (const name of ["", " padded ", "😀".repeat(101)])
          await rejects(
            client,
            "INSERT INTO products(code,name,price_jpy,stock) VALUES('BAD-NAME',$1,500,1)",
            [name],
            "23514",
          );
        await client.query(
          "INSERT INTO products(code,name,price_jpy,stock) VALUES('UNICODE',$1,0,0)",
          ["😀".repeat(100)],
        );
        await rejects(
          client,
          "INSERT INTO products(code,name,description,price_jpy,stock) VALUES('BAD-DESC','商品',$1,500,1)",
          ["a".repeat(2001)],
          "23514",
        );
      },
    );
    await check(
      "order idempotency is unique per owner, not globally",
      async () => {
        const key = randomUUID();
        await order(client, "buyer-1", key);
        await rejects(
          client,
          "INSERT INTO orders(owner_sub,idempotency_key,request_items,total_jpy) VALUES($1,$2,$3,500)",
          ["buyer-1", key, "[{}]"],
          "23505",
        );
        await order(client, "buyer-2", key);
      },
    );
    await check(
      "invalid owner, total, input shape and enum state are rejected",
      async () => {
        const id = await order(client);
        for (const owner of ["", " padded "])
          await rejects(
            client,
            "UPDATE orders SET owner_sub=$1 WHERE id=$2",
            [owner, id],
            "23514",
          );
        for (const total of [-1, 5000000000001])
          await rejects(
            client,
            "UPDATE orders SET total_jpy=$1 WHERE id=$2",
            [total, id],
            "23514",
          );
        for (const items of [
          "{}",
          "[]",
          JSON.stringify(Array.from({ length: 51 }, () => ({}))),
        ])
          await rejects(
            client,
            "UPDATE orders SET request_items=$1 WHERE id=$2",
            [items, id],
            "23514",
          );
        await rejects(
          client,
          "UPDATE orders SET status='invalid' WHERE id=$1",
          [id],
          "22P02",
        );
      },
    );
    await check(
      "status and timestamps remain structurally consistent",
      async () => {
        const id = await order(client);
        await rejects(
          client,
          "UPDATE orders SET status='confirmed' WHERE id=$1",
          [id],
          "23514",
        );
        await rejects(
          client,
          "UPDATE orders SET status='cancelled' WHERE id=$1",
          [id],
          "23514",
        );
        await client.query(
          "UPDATE orders SET status='confirmed',confirmed_at=CURRENT_TIMESTAMP WHERE id=$1",
          [id],
        );
        await rejects(
          client,
          "UPDATE orders SET cancelled_at=CURRENT_TIMESTAMP WHERE id=$1",
          [id],
          "23514",
        );
        await client.query(
          "UPDATE orders SET status='cancelled',cancelled_at=CURRENT_TIMESTAMP WHERE id=$1",
          [id],
        );
      },
    );
    await check(
      "AC-D02 rejects invalid item quantities, snapshot prices and foreign keys",
      async () => {
        const p = await product(client);
        const o = await order(client);
        for (const quantity of [0, -1, 1001])
          await rejects(
            client,
            "INSERT INTO order_items(order_id,product_id,product_code,product_name,unit_price_jpy,quantity) VALUES($1,$2,'TEST-001','商品',500,$3)",
            [o, p, quantity],
            "23514",
          );
        await rejects(
          client,
          "INSERT INTO order_items(order_id,product_id,product_code,product_name,unit_price_jpy,quantity) VALUES($1,$2,'TEST-001','商品',-1,1)",
          [o, p],
          "23514",
        );
        await rejects(
          client,
          "INSERT INTO order_items(order_id,product_id,product_code,product_name,unit_price_jpy,quantity) VALUES($1,$2,'TEST-001','商品',500,1)",
          [o, randomUUID()],
          "23503",
        );
        await rejects(
          client,
          "INSERT INTO order_items(order_id,product_id,product_code,product_name,unit_price_jpy,quantity) VALUES($1,$2,'TEST-001','商品',500,1)",
          [randomUUID(), p],
          "23503",
        );
      },
    );
    await check(
      "one product per order and product deletion restrictions are enforced",
      async () => {
        const p = await product(client);
        const o = await order(client);
        const sql =
          "INSERT INTO order_items(order_id,product_id,product_code,product_name,unit_price_jpy,quantity) VALUES($1,$2,'TEST-001','商品',500,1)";
        await client.query(sql, [o, p]);
        await rejects(client, sql, [o, p], "23505");
        await rejects(client, "DELETE FROM products WHERE id=$1", [p], "23503");
      },
    );
    await check("updated_at is maintained by the database", async () => {
      const p = await product(client);
      await client.query("UPDATE products SET updated_at=$1 WHERE id=$2", [
        "2000-01-01",
        p,
      ]);
      const row = (
        await client.query(
          "SELECT updated_at > $1::timestamptz AS recent FROM products WHERE id=$2",
          ["2020-01-01", p],
        )
      ).rows[0];
      assert.equal(row.recent, true);
    });
    await check(
      "development seed can run twice without overwriting stock",
      async () => {
        const sql = await readFile(
          new URL("../seeds/development.sql", import.meta.url),
          "utf8",
        );
        await client.query(sql);
        await client.query("UPDATE products SET stock=7 WHERE code='DEMO-001'");
        await client.query(sql);
        const row = (
          await client.query("SELECT stock FROM products WHERE code='DEMO-001'")
        ).rows[0];
        assert.equal(row.stock, 7);
      },
    );
  });
});
test("AC-D01 fresh migration is reproducible and repeat/concurrent execution applies once", async () => {
  await withTemporaryDatabase(async (client, url) => {
    const second = createClient(url);
    await second.connect();
    try {
      const results = await Promise.all([
        applyMigrations(client),
        applyMigrations(second),
      ]);
      assert.deepEqual(results.flat().sort(), [
        "0001_initial.sql",
        "0002_catalog_notifications.sql",
        "0003_order_cleanup.sql",
        "0004_product_restock.sql",
      ]);
      assert.equal(
        (
          await client.query(
            "SELECT count(*)::int AS count FROM schema_migrations",
          )
        ).rows[0].count,
        4,
      );
      assert.deepEqual(await applyMigrations(client), []);
      const expected = await describeSchema(client);
      await withTemporaryDatabase(async (other) => {
        await applyMigrations(other);
        assert.deepEqual(await describeSchema(other), expected);
      });
    } finally {
      await second.end();
    }
  });
});
test("migration drift, missing history and failed DDL do not leave partial changes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "training2-migrations-"));
  try {
    const name = "0001_initial.sql";
    const sql = await readFile(join(migrationsDirectory, name), "utf8");
    await writeFile(join(dir, name), sql);
    await withTemporaryDatabase(async (client) => {
      await applyMigrations(client, dir);
      await writeFile(join(dir, name), `${sql}\n-- changed\n`);
      await assert.rejects(
        () => applyMigrations(client, dir),
        /history differs/,
      );
      await rm(join(dir, name));
      await assert.rejects(
        () => applyMigrations(client, dir),
        /history differs/,
      );
    });
    await writeFile(
      join(dir, name),
      "CREATE TABLE partial_table(id integer); SELECT invalid_column FROM nonexistent_table;",
    );
    await withTemporaryDatabase(async (client) => {
      await assert.rejects(() => applyMigrations(client, dir));
      const rows = await client.query(
        "SELECT to_regclass('public.partial_table') AS partial,to_regclass('public.schema_migrations') AS history",
      );
      assert.equal(rows.rows[0].partial, null);
      assert.equal(rows.rows[0].history, null);
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
