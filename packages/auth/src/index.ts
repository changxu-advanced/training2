import { CognitoJwtVerifier, JwtRsaVerifier } from "aws-jwt-verify";
import { type Jwks, SimpleJwksCache } from "aws-jwt-verify/jwk";
export type Principal = { sub: string; groups: readonly string[] };
export class AuthError extends Error {
  readonly status: 401 | 403 | 404;
  constructor(status: 401 | 403 | 404) {
    super(
      status === 401
        ? "Authentication required"
        : status === 403
          ? "Admin role required"
          : "Order not found",
    );
    this.name = "AuthError";
    this.status = status;
  }
}
export type Authenticator = { verify: (token: string) => Promise<Principal> };
export type AuthSettings = {
  mode: "local" | "cognito";
  nodeEnv?: string;
  userPoolId: string;
  clientId: string;
  issuer?: string;
  jwksUri?: string;
};
function principal(
  payload: Record<string, unknown>,
  clientId: string,
): Principal {
  const now = Date.now() / 1000;
  if (
    payload.token_use !== "access" ||
    payload.client_id !== clientId ||
    typeof payload.sub !== "string" ||
    !payload.sub ||
    typeof payload.exp !== "number" ||
    !Number.isFinite(payload.exp) ||
    payload.exp <= now ||
    typeof payload.iat !== "number" ||
    !Number.isFinite(payload.iat) ||
    payload.iat > now + 5 ||
    payload.exp <= payload.iat
  )
    throw new AuthError(401);
  const groups = payload["cognito:groups"] ?? [];
  if (
    !Array.isArray(groups) ||
    groups.some((group) => typeof group !== "string")
  )
    throw new AuthError(401);
  return { sub: payload.sub, groups };
}
export function createAuthenticator(
  settings: AuthSettings,
  initialJwks?: Jwks,
): Authenticator {
  if (!settings.userPoolId || !settings.clientId)
    throw new Error("Cognito pool/client must be configured.");
  if (settings.mode === "cognito") {
    const verifier = CognitoJwtVerifier.create({
      userPoolId: settings.userPoolId,
      clientId: settings.clientId,
      tokenUse: "access",
    });
    return {
      verify: async (token) => {
        try {
          return principal(await verifier.verify(token), settings.clientId);
        } catch {
          throw new AuthError(401);
        }
      },
    };
  }
  if (
    settings.nodeEnv === "production" ||
    !settings.issuer ||
    !settings.jwksUri
  )
    throw new Error(
      "Local auth requires non-production issuer and JWKS configuration.",
    );
  const issuer = new URL(settings.issuer);
  const jwks = new URL(settings.jwksUri);
  for (const url of [issuer, jwks])
    if (
      url.protocol !== "http:" ||
      !["localhost", "127.0.0.1", "cognito-local"].includes(url.hostname) ||
      url.username ||
      url.password
    )
      throw new Error("Local auth endpoints must be explicit local HTTP URLs.");
  if (
    !issuer.pathname.endsWith(`/${settings.userPoolId}`) ||
    jwks.pathname !== `${issuer.pathname}/.well-known/jwks.json`
  )
    throw new Error("Local auth pool paths differ.");
  const cache = new SimpleJwksCache({
    fetcher: {
      fetch: async (uri) => {
        if (uri !== settings.jwksUri)
          throw new Error("Unexpected JWKS endpoint.");
        const response = await fetch(uri, {
          signal: AbortSignal.timeout(5000),
          redirect: "error",
        });
        if (!response.ok) throw new Error("JWKS unavailable.");
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength > 100000) throw new Error("JWKS too large.");
        return bytes;
      },
    },
  });
  const verifier = JwtRsaVerifier.create(
    {
      issuer: settings.issuer,
      jwksUri: settings.jwksUri,
      audience: null,
      customJwtCheck: ({ payload }) => {
        principal(payload, settings.clientId);
      },
    },
    { jwksCache: cache },
  );
  if (initialJwks) verifier.cacheJwks(initialJwks);
  return {
    verify: async (token) => {
      try {
        return principal(await verifier.verify(token), settings.clientId);
      } catch {
        throw new AuthError(401);
      }
    },
  };
}
export async function authenticate(
  header: string | undefined,
  authenticator: Authenticator,
): Promise<Principal> {
  const match = header?.match(/^Bearer +(\S+)$/i);
  if (!match) throw new AuthError(401);
  return authenticator.verify(match[1]);
}
export function requireAdmin(user: Principal) {
  if (!user.groups.includes("admin")) throw new AuthError(403);
}
export function requireOwner(user: Principal, ownerSub: string) {
  if (user.sub !== ownerSub) throw new AuthError(404);
}
