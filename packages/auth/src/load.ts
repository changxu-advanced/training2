import { readFile } from "node:fs/promises";
import { type Authenticator, createAuthenticator } from "./index.ts";
export async function loadAuthenticator(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<Authenticator> {
  const mode =
    environment.AUTH_MODE ??
    (environment.NODE_ENV === "production" ? "cognito" : "local");
  if (mode === "cognito")
    return createAuthenticator({
      mode,
      nodeEnv: environment.NODE_ENV,
      userPoolId: environment.COGNITO_USER_POOL_ID ?? "",
      clientId: environment.COGNITO_CLIENT_ID ?? "",
    });
  if (mode !== "local") throw new Error("Invalid AUTH_MODE.");
  const config = JSON.parse(
    await readFile(
      new URL("../../../.devcontainer/runtime/cognito.json", import.meta.url),
      "utf8",
    ),
  );
  return createAuthenticator({
    mode,
    nodeEnv: environment.NODE_ENV,
    userPoolId: config.userPoolId,
    clientId: config.userPoolClientId,
    issuer: config.issuer,
    jwksUri: `${config.containerEndpoint}/${config.userPoolId}/.well-known/jwks.json`,
  });
}
