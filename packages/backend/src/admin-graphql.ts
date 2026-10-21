import { ApiFailure, type ContractApp } from "@training2/api-contracts";
import { productInput, restockInput } from "@training2/api-contracts/inputs";
import {
  AuthError,
  type Authenticator,
  authenticate,
  type Principal,
  requireAdmin,
} from "@training2/auth";
import type { createLogger } from "@training2/logger";
import type { PrismaClient } from "@training2/prisma";
import {
  type DocumentNode,
  GraphQLError,
  getArgumentValues,
  getOperationAST,
  getVariableValues,
  parse,
  type SelectionSetNode,
  TypeInfo,
  validate,
  visit,
  visitWithTypeInfo,
} from "graphql";
import { bodyLimit } from "hono/body-limit";
import { Pool } from "pg";
import { postgraphile } from "postgraphile";
import { makePgService } from "postgraphile/adaptors/pg";
import { grafast } from "postgraphile/grafast";
import { PostGraphileAmberPreset } from "postgraphile/presets/amber";
import { extendSchema, pgSmartTags } from "postgraphile/utils";
import { registerProduct, restockProduct } from "./products.ts";

type Context = { principal: Principal };
const invalid = () =>
  new GraphQLError("Invalid request input", {
    extensions: { code: "INVALID_INPUT" },
  });
async function business<T>(run: () => Promise<T>) {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ApiFailure)
      throw new GraphQLError(error.message, {
        extensions: { code: error.code },
      });
    throw error;
  }
}
function uuid(value: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw invalid();
  return value;
}
// Expand fragments when counting, so a small document cannot hide exponential work.
function bounded(document: DocumentNode, operationName?: string) {
  const operation = getOperationAST(document, operationName);
  if (!operation || operation.operation === "subscription") throw invalid();
  const fragments = new Map(
    document.definitions.flatMap((d) =>
      d.kind === "FragmentDefinition"
        ? [[d.name.value, d.selectionSet] as const]
        : [],
    ),
  );
  const used = new Set<string>();
  let fields = 0;
  function walk(set: SelectionSetNode, depth: number) {
    if (depth > 10) throw invalid();
    for (const item of set.selections) {
      if (++fields > 200) throw invalid();
      if (item.kind === "FragmentSpread") {
        used.add(item.name.value);
        const fragment = fragments.get(item.name.value);
        if (fragment) walk(fragment, depth + 1);
      } else if (item.selectionSet) walk(item.selectionSet, depth + 1);
    }
  }
  walk(operation.selectionSet, 0);
  return {
    ...document,
    definitions: [
      operation,
      ...document.definitions.filter(
        (d) => d.kind === "FragmentDefinition" && used.has(d.name.value),
      ),
    ],
  };
}
export async function createAdminGraphql(
  databaseUrl: string,
  prisma: PrismaClient,
) {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 4,
    statement_timeout: 5000,
  });
  pool.on("error", () => {});
  const mutations = extendSchema(() => ({
    typeDefs: `
      type AdminProduct { id: ID!, code: String!, name: String!, description: String!, priceJpy: Int!, stock: Int! }
      input RegisterAdminProductInput { code: String!, name: String!, description: String, priceJpy: Int!, stock: Int! }
      extend type Mutation {
        registerAdminProduct(input: RegisterAdminProductInput!): AdminProduct
        restockAdminProduct(id: ID!, idempotencyKey: ID!, quantity: Int!): AdminProduct
      }
    `,
    resolvers: {
      Mutation: {
        registerAdminProduct(_source: unknown, args: { input: unknown }) {
          const input = productInput.safeParse(args.input);
          if (!input.success) throw invalid();
          return business(() => registerProduct(prisma, input.data));
        },
        restockAdminProduct(
          _source: unknown,
          args: { id: string; idempotencyKey: string; quantity: number },
          context: Context,
        ) {
          const input = restockInput.safeParse({ quantity: args.quantity });
          if (!input.success) throw invalid();
          return business(() =>
            restockProduct(
              prisma,
              context.principal.sub,
              uuid(args.id),
              uuid(args.idempotencyKey),
              input.data.quantity,
            ),
          );
        },
      },
    },
  }));
  const pgl = postgraphile({
    extends: [PostGraphileAmberPreset],
    pgServices: [makePgService({ pool, schemas: ["public"] })],
    plugins: [
      // Only products are part of this administrator API. Hide orders, owners,
      // idempotency records, migration history and all functions by default.
      pgSmartTags([
        {
          kind: "class",
          match: (entity) => entity.relname !== "products",
          tags: { behavior: "-*" },
        },
      ]),
      mutations,
    ],
    schema: { defaultBehavior: "-insert -update -delete -execute -node" },
    grafast: { explain: false },
  });
  try {
    const { schema, resolvedPreset } = await pgl.getSchemaResult();
    return {
      schema,
      async execute(
        query: string,
        variables: Record<string, unknown> | undefined,
        operationName: string | undefined,
        principal: Principal,
      ) {
        let document: DocumentNode;
        try {
          document = parse(query, { maxTokens: 2000 });
        } catch {
          return { errors: [invalid()] };
        }
        const errors = validate(schema, document);
        if (errors.length) return { errors: errors.map(() => invalid()) };
        try {
          const selected = bounded(document, operationName);
          const operation = getOperationAST(document, operationName);
          if (!operation) throw invalid();
          const coerced = getVariableValues(
            schema,
            operation.variableDefinitions ?? [],
            variables ?? {},
          );
          if (coerced.errors) return { errors: [invalid()] };
          const info = new TypeInfo(schema);
          visit(
            selected,
            visitWithTypeInfo(info, {
              Field(node) {
                const field = info.getFieldDef();
                if (!field?.args.some((arg) => arg.name === "first")) return;
                const args = getArgumentValues(field, node, coerced.coerced);
                // Generated connections must always have an explicit bounded page.
                const limits = [args.first, args.last].filter(
                  (value) => value != null,
                );
                if (
                  !limits.length ||
                  limits.some(
                    (limit) =>
                      typeof limit !== "number" ||
                      !Number.isInteger(limit) ||
                      limit < 1 ||
                      limit > 100,
                  )
                )
                  throw invalid();
              },
            }),
          );
        } catch {
          return { errors: [invalid()] };
        }
        return grafast({
          schema,
          resolvedPreset,
          source: query,
          variableValues: variables,
          operationName,
          contextValue: { principal },
          requestContext: {},
        });
      },
      async close() {
        await pgl.release();
        await pool.end();
      },
    };
  } catch {
    await pgl.release();
    await pool.end();
    throw new Error("Administrator GraphQL startup failed");
  }
}
export function bindAdminGraphql(
  app: ContractApp,
  api: Awaited<ReturnType<typeof createAdminGraphql>>,
  authenticator: Authenticator,
  logger: ReturnType<typeof createLogger>,
) {
  const failure = (code: string, message: string, requestId: string) => ({
    errors: [{ message, extensions: { code, requestId } }],
  });
  app.use(
    "/graphql",
    bodyLimit({
      maxSize: 65536,
      onError: (c) =>
        c.json(
          failure("INVALID_INPUT", "Request too large", c.get("requestId")),
          413,
        ),
    }),
  );
  app.all("/graphql", async (c) => {
    c.header("Cache-Control", "no-store");
    const requestId = c.get("requestId");
    let principal: Principal;
    try {
      principal = await authenticate(
        c.req.header("Authorization"),
        authenticator,
      );
      requireAdmin(principal);
    } catch (error) {
      if (!(error instanceof AuthError)) throw error;
      return c.json(
        failure(
          error.status === 403 ? "FORBIDDEN" : "UNAUTHENTICATED",
          error.message,
          requestId,
        ),
        error.status,
      );
    }
    if (c.req.method !== "POST") {
      c.header("Allow", "POST");
      return c.json(failure("INVALID_INPUT", "Use POST", requestId), 405);
    }
    if (
      c.req.header("Content-Type")?.split(";")[0].trim().toLowerCase() !==
      "application/json"
    )
      return c.json(
        failure(
          "UNSUPPORTED_MEDIA_TYPE",
          "JSON content type required",
          requestId,
        ),
        415,
      );
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        failure("INVALID_INPUT", "Invalid JSON request", requestId),
        400,
      );
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      return c.json(
        failure("INVALID_INPUT", "One operation required", requestId),
        400,
      );
    const { query, variables, operationName } = body as Record<string, unknown>;
    if (
      typeof query !== "string" ||
      query.length > 16000 ||
      (operationName != null && typeof operationName !== "string") ||
      (variables != null &&
        (typeof variables !== "object" || Array.isArray(variables)))
    )
      return c.json(
        failure("INVALID_INPUT", "Invalid GraphQL request", requestId),
        400,
      );
    try {
      const result = await api.execute(
        query,
        (variables ?? undefined) as Record<string, unknown> | undefined,
        (operationName ?? undefined) as string | undefined,
        principal,
      );
      if (Symbol.asyncIterator in result)
        return c.json(
          failure("INVALID_INPUT", "Streaming is not supported", requestId),
          400,
        );
      const errors = result.errors?.map((error) => {
        const code =
          typeof error.extensions.code === "string"
            ? error.extensions.code
            : "INTERNAL_ERROR";
        const known = [
          "INVALID_INPUT",
          "DUPLICATE_PRODUCT",
          "IDEMPOTENCY_CONFLICT",
          "NOT_FOUND",
          "TEMPORARILY_UNAVAILABLE",
        ].includes(code);
        if (!known) logger.error("GraphQL execution failed", { requestId });
        return {
          message: known ? error.message : "Internal server error",
          path: error.path,
          extensions: { code: known ? code : "INTERNAL_ERROR", requestId },
        };
      });
      return c.json(
        {
          ...(result.data !== undefined ? { data: result.data } : {}),
          ...(errors?.length ? { errors } : {}),
        },
        result.data === undefined && errors?.length ? 400 : 200,
      );
    } catch {
      logger.error("GraphQL execution failed", { requestId });
      return c.json(
        failure("INTERNAL_ERROR", "Internal server error", requestId),
        500,
      );
    }
  });
}
