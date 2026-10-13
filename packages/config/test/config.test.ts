import { test } from "node:test";
import { expect } from "chai";
import { ConfigurationError, parseApiConfig } from "../src/index.ts";

const base = { DATABASE_URL: "postgresql://postgres:local@db:5432/training2" };
test("public/private ports and origins are parsed independently", () => {
  expect(parseApiConfig(base, "public").port).to.equal(3000);
  expect(parseApiConfig(base, "private").port).to.equal(3001);
  expect(
    parseApiConfig(
      {
        ...base,
        PUBLIC_API_PORT: "4100",
        PUBLIC_API_CORS_ORIGINS: "https://shop.test, https://shop.test",
      },
      "public",
    ).corsOrigins,
  ).to.deep.equal(["https://shop.test"]);
});
test("invalid ports cannot silently become a different number", () => {
  for (const value of ["", "0", "65536", "3e3", "3000x", "3.5", "-1"])
    expect(() =>
      parseApiConfig({ ...base, PUBLIC_API_PORT: value }, "public"),
    ).to.throw(ConfigurationError);
});
test("reject non-postgres URLs and do not disclose input credentials", () => {
  const secret = "private-password-123";
  try {
    parseApiConfig(
      { ...base, DATABASE_URL: `https://user:${secret}@db.test` },
      "public",
    );
    throw new Error("Expected configuration failure");
  } catch (error) {
    expect(error).to.be.instanceOf(ConfigurationError);
    expect(String(error)).not.to.contain(secret);
    expect((error as ConfigurationError).fields).to.include("databaseUrl");
  }
});
test("reject wildcard, non-web and non-origin CORS values", () => {
  for (const value of [
    "*",
    "https://shop.test/path",
    "ftp://shop.test",
    "https://user:password@shop.test",
    "https://shop.test,",
  ])
    expect(() =>
      parseApiConfig({ ...base, PUBLIC_API_CORS_ORIGINS: value }, "public"),
    ).to.throw(ConfigurationError);
});
test("invalid environment and log level fail; unrelated process variables are ignored", () => {
  expect(() =>
    parseApiConfig({ ...base, NODE_ENV: "unknown" }, "public"),
  ).to.throw(ConfigurationError);
  expect(() =>
    parseApiConfig({ ...base, LOG_LEVEL: "all" }, "public"),
  ).to.throw(ConfigurationError);
  expect(
    parseApiConfig({ ...base, UNRELATED_SECRET: "never-return-me" }, "public"),
  ).not.to.have.property("UNRELATED_SECRET");
});

test("malformed URL errors expose field names without raw values", () => {
  const raw = "broken-url-with-secret";
  expect(() =>
    parseApiConfig({ ...base, DATABASE_URL: raw }, "public"),
  ).to.throw(ConfigurationError);
  expect(() =>
    parseApiConfig({ ...base, PUBLIC_API_CORS_ORIGINS: raw }, "public"),
  ).to.throw(ConfigurationError);
});
