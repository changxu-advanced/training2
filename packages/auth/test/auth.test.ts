import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { test } from "node:test";
import {
  AuthError,
  authenticate,
  createAuthenticator,
  requireAdmin,
  requireOwner,
} from "../src/index.ts";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const settings = {
  mode: "local" as const,
  nodeEnv: "test",
  userPoolId: "local_test",
  clientId: "client",
  issuer: "http://localhost:9230/local_test",
  jwksUri: "http://localhost:9230/local_test/.well-known/jwks.json",
};
const exportedKey = publicKey.export({ format: "jwk" });
assert.ok(exportedKey.n && exportedKey.e);
const auth = createAuthenticator(settings, {
  keys: [
    {
      n: exportedKey.n,
      e: exportedKey.e,
      kty: "RSA",
      kid: "fixture",
      alg: "RS256",
      use: "sig",
    },
  ],
});
export function token(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", kid: "fixture" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: settings.issuer,
      sub: "buyer",
      client_id: "client",
      token_use: "access",
      iat: now - 1,
      exp: now + 3600,
      ...overrides,
    }),
  ).toString("base64url");
  const input = `${header}.${payload}`;
  return `${input}.${sign("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url")}`;
}
test("real RSA verification rejects invalid credentials and unsafe local production configuration", async () => {
  assert.deepEqual(await authenticate(`Bearer ${token()}`, auth), {
    sub: "buyer",
    groups: [],
  });
  for (const claims of [
    { exp: 1 },
    { exp: undefined },
    { iss: `${settings.issuer}/wrong` },
    { client_id: "wrong" },
    { token_use: "id" },
    { "cognito:groups": "admin" },
    { sub: "" },
    { iat: Date.now() / 1000 + 100 },
  ])
    await assert.rejects(() => auth.verify(token(claims)), { status: 401 });
  const parts = token().split(".");
  parts[2] = (parts[2][0] === "a" ? "b" : "a") + parts[2].slice(1);
  await assert.rejects(() => auth.verify(parts.join(".")), { status: 401 });
  await assert.rejects(() => authenticate(undefined, auth), { status: 401 });
  assert.throws(() =>
    createAuthenticator({ ...settings, nodeEnv: "production" }),
  );
  assert.throws(() =>
    createAuthenticator({ ...settings, jwksUri: "http://example.com/keys" }),
  );
});
test("admin and owner checks grant only their intended identities", async () => {
  const buyer = await auth.verify(token());
  const admin = await auth.verify(
    token({ sub: "admin", "cognito:groups": ["admin"] }),
  );
  assert.throws(
    () => requireAdmin(buyer),
    (error) => error instanceof AuthError && error.status === 403,
  );
  requireAdmin(admin);
  requireOwner(buyer, "buyer");
  for (const user of [buyer, admin])
    assert.throws(() => requireOwner(user, "other"), { status: 404 });
});
