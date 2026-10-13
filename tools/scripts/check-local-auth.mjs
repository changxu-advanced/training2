import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import {
  AdminAddUserToGroupCommand,
  AdminConfirmSignUpCommand,
  AdminGetUserCommand,
  CognitoIdentityProviderClient,
  CreateGroupCommand,
  CreateUserPoolClientCommand,
  CreateUserPoolCommand,
  ListUserPoolClientsCommand,
  ListUserPoolsCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { Amplify } from "aws-amplify";
import { fetchAuthSession, signIn, signOut } from "aws-amplify/auth";
import { JwtRsaVerifier } from "aws-jwt-verify";
import { createAuthenticator } from "../../packages/auth/src/index.ts";

const endpoint = process.env.COGNITO_LOCAL_ENDPOINT;
assert.equal(
  endpoint,
  "http://cognito-local:9229",
  "This script is for the local container emulator only.",
);
const client = new CognitoIdentityProviderClient({
  endpoint,
  region: "us-east-1",
  credentials: { accessKeyId: "local", secretAccessKey: "local" },
});
const pools = await client.send(new ListUserPoolsCommand({ MaxResults: 60 }));
let pool = pools.UserPools?.find((p) => p.Name === "training2");
if (!pool)
  pool = (
    await client.send(new CreateUserPoolCommand({ PoolName: "training2" }))
  ).UserPool;
assert.ok(pool?.Id);
const clients = await client.send(
  new ListUserPoolClientsCommand({ UserPoolId: pool.Id, MaxResults: 60 }),
);
let app = clients.UserPoolClients?.find(
  (c) => c.ClientName === "training2-app",
);
if (!app)
  app = (
    await client.send(
      new CreateUserPoolClientCommand({
        UserPoolId: pool.Id,
        ClientName: "training2-app",
        GenerateSecret: false,
        ExplicitAuthFlows: [
          "ALLOW_USER_PASSWORD_AUTH",
          "ALLOW_USER_SRP_AUTH",
          "ALLOW_REFRESH_TOKEN_AUTH",
        ],
      }),
    )
  ).UserPoolClient;
assert.ok(app?.ClientId);
const password = "Training2-local-2026!";
for (const username of ["admin@training2.test", "buyer@training2.test"]) {
  try {
    await client.send(
      new SignUpCommand({
        ClientId: app.ClientId,
        Username: username,
        Password: password,
        UserAttributes: [{ Name: "email", Value: username }],
      }),
    );
  } catch (e) {
    if (e.name !== "UsernameExistsException") throw e;
  }
  const user = await client.send(
    new AdminGetUserCommand({ UserPoolId: pool.Id, Username: username }),
  );
  if (user.UserStatus !== "CONFIRMED") {
    await client.send(
      new AdminConfirmSignUpCommand({
        UserPoolId: pool.Id,
        Username: username,
      }),
    );
  }
}
try {
  await client.send(
    new CreateGroupCommand({ UserPoolId: pool.Id, GroupName: "admin" }),
  );
} catch (e) {
  if (e.name !== "GroupExistsException") throw e;
}
await client.send(
  new AdminAddUserToGroupCommand({
    UserPoolId: pool.Id,
    GroupName: "admin",
    Username: "admin@training2.test",
  }),
);
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: pool.Id,
      userPoolClientId: app.ClientId,
      userPoolEndpoint: endpoint,
    },
  },
});
const issuer = `http://localhost:9230/${pool.Id}`;
const response = await fetch(`${endpoint}/${pool.Id}/.well-known/jwks.json`);
assert.ok(response.ok);
const jwks = await response.json();
function verifier(
  expectedIssuer = issuer,
  expectedClient = app.ClientId,
  expectedUse = "access",
) {
  const v = JwtRsaVerifier.create({
    issuer: expectedIssuer,
    audience: null,
    customJwtCheck: ({ payload }) => {
      assert.equal(payload.client_id, expectedClient);
      assert.equal(payload.token_use, expectedUse);
      assert.ok(payload.sub);
    },
  });
  v.cacheJwks(jwks);
  return v;
}
const verification = verifier();
const auth = createAuthenticator({
  mode: "local",
  nodeEnv: "development",
  userPoolId: pool.Id,
  clientId: app.ClientId,
  issuer,
  jwksUri: `${endpoint}/${pool.Id}/.well-known/jwks.json`,
});
for (const username of ["admin@training2.test", "buyer@training2.test"]) {
  await signOut();
  const result = await signIn({
    username,
    password,
    options: { authFlowType: "USER_PASSWORD_AUTH" },
  });
  assert.ok(result.isSignedIn, "Amplify must complete login");
  const session = await fetchAuthSession();
  const token = session.tokens?.accessToken?.toString();
  assert.ok(token);
  const payload = await verification.verify(token);
  assert.equal((await auth.verify(token)).sub, payload.sub);
  const registeredUser = await client.send(
    new AdminGetUserCommand({ UserPoolId: pool.Id, Username: username }),
  );
  assert.equal(
    payload.sub,
    registeredUser.UserAttributes.find((attribute) => attribute.Name === "sub")
      .Value,
  );
  if (username.startsWith("admin"))
    assert.ok(payload["cognito:groups"]?.includes("admin"));
  else assert.ok(!payload["cognito:groups"]?.includes("admin"));
  const originalNow = Date.now;
  try {
    Date.now = () => (Number(payload.exp) + 1) * 1000;
    await assert.rejects(() => verification.verify(token));
  } finally {
    Date.now = originalNow;
  }
  const parts = token.split(".");
  parts[2] = (parts[2][0] === "a" ? "b" : "a") + parts[2].slice(1);
  await assert.rejects(() => verification.verify(parts.join(".")));
  await assert.rejects(() => verifier(`${issuer}/wrong`).verify(token));
  await assert.rejects(() => verifier(issuer, "wrong-client").verify(token));
  await assert.rejects(() =>
    verifier(issuer, app.ClientId, "id").verify(token),
  );
  console.log(
    "PASS Amplify login, RSA signature, issuer/client/token-use and negative checks for " +
      username,
  );
}
await signOut();
await mkdir(".devcontainer/runtime", { recursive: true });
await writeFile(
  ".devcontainer/runtime/cognito.json",
  `${JSON.stringify(
    {
      userPoolId: pool.Id,
      userPoolClientId: app.ClientId,
      issuer,
      containerEndpoint: endpoint,
      browserEndpoint: "http://localhost:9230",
    },
    null,
    2,
  )}\n`,
);
console.log(
  "PASS local auth initialization. No tokens or passwords were logged.",
);
