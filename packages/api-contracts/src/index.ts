import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  AuthError,
  type Authenticator,
  authenticate,
  type Principal,
  requireAdmin,
} from "@training2/auth";
import { HTTPException } from "hono/http-exception";
import { orderInput, productInput } from "./inputs.ts";

export { orderInput, productInput };
export const errorSchema = z
  .strictObject({
    error: z.strictObject({
      code: z.enum([
        "INVALID_INPUT",
        "UNAUTHENTICATED",
        "FORBIDDEN",
        "NOT_FOUND",
        "DUPLICATE_PRODUCT",
        "IDEMPOTENCY_CONFLICT",
        "INSUFFICIENT_STOCK",
        "INVALID_ORDER_STATE",
        "TEMPORARILY_UNAVAILABLE",
        "INTERNAL_ERROR",
        "NOT_IMPLEMENTED",
        "UNSUPPORTED_MEDIA_TYPE",
      ]),
      message: z.string(),
      requestId: z.string(),
      fields: z.array(z.string()).optional(),
    }),
  })
  .openapi("ApiError");
const id = z.string().uuid();
const amount = z.number().int().min(0).max(100000000);
export const productSchema = z
  .strictObject({
    id,
    code: z.string().regex(/^[A-Z0-9_-]{1,32}$/),
    name: z.string().regex(/^[\s\S]{1,100}$/u),
    description: z.string().regex(/^[\s\S]{0,2000}$/u),
    priceJpy: amount,
    stock: z.number().int().min(0).max(1000000),
  })
  .openapi("Product");
export const orderSchema = z
  .strictObject({
    id,
    status: z.enum(["draft", "confirmed", "cancelled"]),
    items: z
      .array(
        z.strictObject({
          productId: id,
          productCode: z.string(),
          productName: z.string(),
          unitPriceJpy: amount,
          quantity: z.number().int().min(1).max(1000),
        }),
      )
      .min(1)
      .max(50),
    totalJpy: z.number().int().min(0).max(5000000000000),
    createdAt: z.string().datetime({ offset: true }),
    confirmedAt: z.string().datetime({ offset: true }).nullable(),
    cancelledAt: z.string().datetime({ offset: true }).nullable(),
  })
  .openapi("Order");
const params = z.object({
  id: id.openapi({ param: { name: "id", in: "path" } }),
});
const pagination = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
const search = pagination.extend({
  code: z
    .string()
    .optional()
    .describe("Trim and uppercase; blank means absent; exact match"),
  name: z
    .string()
    .optional()
    .describe(
      "Trim; blank means absent; literal case-insensitive substring; combined with code using AND",
    ),
});
const productsPage = z
  .strictObject({
    items: z.array(productSchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    total: z.number().int().min(0),
  })
  .openapi("ProductsPage");
const stockSchema = z
  .strictObject({ productId: id, stock: z.number().int().min(0).max(1000000) })
  .openapi("Stock");
const json = <Schema extends z.ZodType>(
  schema: Schema,
  description: string,
) => ({ description, content: { "application/json": { schema } } });
const failures = <const Codes extends readonly number[]>(codes: Codes) =>
  Object.fromEntries(
    codes.map((code) => [
      code,
      json(
        errorSchema,
        (
          {
            400: "Invalid input",
            401: "Authentication required",
            403: "Admin role required",
            404: "Not found or not owner",
            409: "Business or idempotency conflict",
            415: "Unsupported content type",
            500: "Internal response or service error",
            501: "Operation not implemented",
            503: "Retry exhausted",
          } as Record<number, string>
        )[code],
      ),
    ]),
  ) as Record<Codes[number], ReturnType<typeof json<typeof errorSchema>>>;
const body = <Schema extends z.ZodType>(schema: Schema) => ({
  required: true,
  content: { "application/json": { schema } },
});
const secured = [{ bearerAuth: [] }];
export const publicRoutes = [
  createRoute({
    method: "get",
    path: "/products",
    operationId: "searchProducts",
    summary: "Search products and current stock",
    security: [],
    request: { query: search },
    responses: {
      200: json(productsPage, "Products sorted by code"),
      ...failures([400, 500, 501]),
    },
  }),
  createRoute({
    method: "get",
    path: "/products/{id}/stock",
    operationId: "getStock",
    summary: "Get current stock snapshot",
    security: [],
    request: { params },
    responses: {
      200: json(stockSchema, "Current stock, not reserved"),
      ...failures([400, 404, 500, 501]),
    },
  }),
  createRoute({
    method: "post",
    path: "/orders",
    operationId: "createOrder",
    summary: "Create draft without reserving stock",
    security: secured,
    request: {
      headers: z.object({
        "idempotency-key": z
          .string()
          .uuid()
          .openapi({ param: { name: "idempotency-key", in: "header" } }),
      }),
      body: body(orderInput.openapi("OrderInput")),
    },
    responses: {
      201: json(orderSchema, "New draft"),
      200: json(orderSchema, "Existing order for same owner/key/input"),
      ...failures([400, 401, 404, 409, 415, 500, 501, 503]),
    },
  }),
  createRoute({
    method: "get",
    path: "/orders/{id}",
    operationId: "getOrder",
    summary: "Read own order",
    security: secured,
    request: { params },
    responses: {
      200: json(orderSchema, "Own order"),
      ...failures([400, 401, 404, 500, 501]),
    },
  }),
  createRoute({
    method: "post",
    path: "/orders/{id}/confirm",
    operationId: "confirmOrder",
    summary: "Confirm once with atomic stock allocation",
    security: secured,
    request: { params },
    responses: {
      200: json(orderSchema, "Confirmed or already confirmed"),
      ...failures([400, 401, 404, 409, 500, 501, 503]),
    },
  }),
  createRoute({
    method: "post",
    path: "/orders/{id}/cancel",
    operationId: "cancelOrder",
    summary: "Cancel once; restore stock only when previously confirmed",
    security: secured,
    request: { params },
    responses: {
      200: json(orderSchema, "Cancelled or already cancelled"),
      ...failures([400, 401, 404, 500, 501, 503]),
    },
  }),
] as const;
export const privateRoutes = [
  createRoute({
    method: "post",
    path: "/products",
    operationId: "registerProduct",
    summary: "Admin registers product",
    security: secured,
    request: { body: body(productInput.openapi("ProductInput")) },
    responses: {
      201: json(productSchema, "Registered product"),
      ...failures([400, 401, 403, 409, 415, 500, 501]),
    },
  }),
  createRoute({
    method: "get",
    path: "/products",
    operationId: "listProducts",
    summary: "Admin lists products",
    security: secured,
    request: { query: pagination },
    responses: {
      200: json(productsPage, "Products sorted by code"),
      ...failures([400, 401, 403, 500, 501]),
    },
  }),
] as const;
export function openapiDocument(
  scope: "public" | "private",
): ReturnType<OpenAPIHono["getOpenAPI31Document"]> {
  const app = new OpenAPIHono();
  app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  });
  for (const route of scope === "public" ? publicRoutes : privateRoutes)
    app.openAPIRegistry.registerPath(route);
  return app.getOpenAPI31Document({
    openapi: "3.1.0",
    info: { title: `training2 ${scope} API`, version: "0.1.0" },
  });
}

export function createContractApp(
  scope: "public" | "private",
  authenticator?: Authenticator,
) {
  const error = (
    code:
      | "INVALID_INPUT"
      | "NOT_IMPLEMENTED"
      | "INTERNAL_ERROR"
      | "UNSUPPORTED_MEDIA_TYPE",
    message: string,
  ) => ({ error: { code, message, requestId: crypto.randomUUID() } });
  const app = new OpenAPIHono<{ Variables: { principal: Principal } }>({
    defaultHook: (result, c) => {
      if (!result.success)
        return c.json(error("INVALID_INPUT", "Invalid request input"), 400);
    },
  });
  app.use("*", async (c, next) => {
    const protectedRequest =
      (scope === "private" && c.req.path === "/products") ||
      c.req.path === "/orders" ||
      c.req.path.startsWith("/orders/");
    if (!protectedRequest) return next();
    try {
      if (!authenticator) throw new AuthError(401);
      const user = await authenticate(
        c.req.header("Authorization"),
        authenticator,
      );
      if (scope === "private") requireAdmin(user);
      c.set("principal", user);
      return next();
    } catch (failure) {
      if (!(failure instanceof AuthError)) throw failure;
      const code = failure.status === 403 ? "FORBIDDEN" : "UNAUTHENTICATED";
      return c.json(
        {
          error: {
            code,
            message: failure.message,
            requestId: crypto.randomUUID(),
          },
        },
        failure.status,
      );
    }
  });
  for (const route of scope === "public" ? publicRoutes : privateRoutes)
    app.openapi(route, (c) =>
      c.json(
        error("NOT_IMPLEMENTED", "This operation is not implemented yet"),
        501,
      ),
    );
  app.get("/openapi.json", (c) => c.json(openapiDocument(scope)));
  app.onError((failure, c) => {
    if (failure instanceof HTTPException && failure.status === 415)
      return c.json(
        error("UNSUPPORTED_MEDIA_TYPE", "JSON content type required"),
        415,
      );
    if (failure instanceof HTTPException && failure.status === 400)
      return c.json(error("INVALID_INPUT", "Invalid JSON request"), 400);
    return c.json(error("INTERNAL_ERROR", "Internal server error"), 500);
  });
  return app;
}
