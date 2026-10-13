import { test } from "node:test";
import { expect } from "chai";
import { createLogger, redact } from "../src/index.ts";

test("redact nested secret fields without mutating source", () => {
  const input = {
    headers: {
      Authorization: "top-secret",
      Cookie: "session-secret",
      "x-api-key": "key-secret",
    },
    nested: [{ password: "password-secret", access_token: "access-secret" }],
    requestId: "request-123",
  };
  const result = redact(input);
  const output = JSON.stringify(result);
  for (const secret of [
    "top-secret",
    "session-secret",
    "key-secret",
    "password-secret",
    "access-secret",
  ])
    expect(output).not.to.contain(secret);
  expect(output).to.contain("request-123");
  expect(input.headers.Authorization).to.equal("top-secret");
});
test("redact embedded connection credentials, bearer and JWT strings", () => {
  const value = redact(
    "postgresql://user:db-secret@db/app Bearer auth-secret token=token-secret eyJabc.eyJdef.signature",
  );
  const text = String(value);
  for (const secret of [
    "db-secret",
    "auth-secret",
    "token-secret",
    "eyJabc.eyJdef.signature",
  ])
    expect(text).not.to.contain(secret);
  expect(text).to.contain("[REDACTED]");
});
test("sanitize Error and handle cyclic objects and bigint safely", () => {
  const cyclic: Record<string, unknown> = {
    error: new Error('password="multi word secret"'),
    count: 12n,
  };
  cyclic.self = cyclic;
  expect(() => JSON.stringify(redact(cyclic))).not.to.throw();
  const text = JSON.stringify(redact(cyclic));
  expect(text).not.to.contain("multi word secret");
  expect(text).to.contain("[Circular]");
  expect(text).not.to.contain("stack");
});
test("filter levels and emit a single JSON record with protected metadata", () => {
  const lines: string[] = [];
  const logger = createLogger({
    level: "warn",
    sink: (line) => lines.push(line),
    clock: () => new Date("2026-10-13T00:00:00Z"),
  });
  logger.info("skip");
  logger.error("request failed Bearer abc123", {
    requestId: "req-1",
    level: "fake",
    password: "secret123",
  });
  expect(lines).to.have.length(1);
  const event = JSON.parse(lines[0]);
  expect(event.level).to.equal("error");
  expect(event.context.requestId).to.equal("req-1");
  expect(lines[0]).not.to.contain("abc123").and.not.to.contain("secret123");
  expect(event.time).to.equal("2026-10-13T00:00:00.000Z");
});
