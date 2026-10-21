import {
  type ProductInput,
  productInput,
} from "@training2/api-contracts/inputs";
import {
  ClientError,
  GraphQLClient,
  gql,
  type Variables,
} from "graphql-request";

export const adminDocuments = {
  list: gql`query AdminProducts($first: Int!, $offset: Int!) {
    allProducts(first: $first, offset: $offset, orderBy: CODE_ASC) {
      total: totalCount
      items: nodes { id: rowId code name description priceJpy stock }
    }
  }`,
  detail: gql`query AdminProduct($id: UUID!) {
    product: productByRowId(rowId: $id) { id: rowId code name description priceJpy stock }
  }`,
  register: gql`mutation RegisterAdminProduct($input: RegisterAdminProductInput!) {
    product: registerAdminProduct(input: $input) { id code name description priceJpy stock }
  }`,
  restock: gql`mutation RestockAdminProduct($id: ID!, $key: ID!, $quantity: Int!) {
    product: restockAdminProduct(id: $id, idempotencyKey: $key, quantity: $quantity) { id code name description priceJpy stock }
  }`,
};
export class AdminApiError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "AdminApiError";
  }
}
type Product = ProductInput & { id: string };
type WireProduct = Omit<Product, "priceJpy"> & { priceJpy: string | number };
function product(row: WireProduct | null): Product {
  if (!row) throw new AdminApiError("NOT_FOUND");
  if (
    typeof row.priceJpy === "string" &&
    !/^(0|[1-9][0-9]*)$/.test(row.priceJpy)
  )
    throw new AdminApiError("INVALID_RESPONSE");
  const parsed = productInput.safeParse({
    code: row.code,
    name: row.name,
    description: row.description,
    priceJpy: Number(row.priceJpy),
    stock: row.stock,
  });
  if (
    !parsed.success ||
    typeof row.id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      row.id,
    )
  )
    throw new AdminApiError("INVALID_RESPONSE");
  return { id: row.id, ...parsed.data };
}
export function createAdminClient(options: {
  endpoint: string;
  owner: () => string;
  accessToken: () => Promise<string | undefined>;
  unauthorized: (owner: string) => Promise<void>;
  fetch?: typeof fetch;
}) {
  // No persistent Authorization header: each request captures the current owner.
  const client = new GraphQLClient(options.endpoint, {
    fetch: options.fetch,
  });
  async function request<T>(
    document: string,
    variables: Variables,
    signal?: AbortSignal,
  ) {
    const owner = options.owner();
    if (!owner) throw new AdminApiError("UNAUTHENTICATED");
    const timeout = AbortSignal.timeout(8000);
    try {
      const token = await options.accessToken().catch(() => undefined);
      if (options.owner() !== owner) throw new AdminApiError("SESSION_CHANGED");
      if (!token) throw new AdminApiError("UNAUTHENTICATED");
      const result = await client.request<T>({
        document,
        variables,
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        requestHeaders: { Authorization: `Bearer ${token}` },
      });
      if (options.owner() !== owner) throw new AdminApiError("SESSION_CHANGED");
      return result;
    } catch (error) {
      if (signal?.aborted) throw error;
      if (options.owner() !== owner) throw new AdminApiError("SESSION_CHANGED");
      let failure: AdminApiError;
      if (error instanceof AdminApiError) failure = error;
      else if (timeout.aborted) failure = new AdminApiError("TIMEOUT");
      else if (error instanceof ClientError) {
        const code = error.response.errors?.[0]?.extensions?.code;
        failure = new AdminApiError(
          error.response.status === 401
            ? "UNAUTHENTICATED"
            : error.response.status === 403
              ? "FORBIDDEN"
              : typeof code === "string"
                ? code
                : "INTERNAL_ERROR",
        );
      } else failure = new AdminApiError("NETWORK_ERROR");
      if (failure.code === "UNAUTHENTICATED") await options.unauthorized(owner);
      throw failure;
    }
  }
  return {
    async listProducts({
      query,
      signal,
    }: {
      query: { page: number; pageSize: number };
      signal?: AbortSignal;
    }) {
      const data = await request<{
        allProducts: { items: WireProduct[]; total: number };
      }>(
        adminDocuments.list,
        { first: query.pageSize, offset: (query.page - 1) * query.pageSize },
        signal,
      );
      if (
        !data.allProducts ||
        !Array.isArray(data.allProducts.items) ||
        !Number.isSafeInteger(data.allProducts.total) ||
        data.allProducts.total < 0
      )
        throw new AdminApiError("INVALID_RESPONSE");
      return {
        ...query,
        total: data.allProducts.total,
        items: data.allProducts.items.map(product),
      };
    },
    async getProduct({
      path,
      signal,
    }: {
      path: { id: string };
      signal?: AbortSignal;
    }) {
      const data = await request<{ product: WireProduct | null }>(
        adminDocuments.detail,
        { id: path.id },
        signal,
      );
      return product(data.product);
    },
    async registerProduct({ body }: { body: ProductInput }) {
      const data = await request<{ product: WireProduct | null }>(
        adminDocuments.register,
        { input: body },
      );
      return product(data.product);
    },
    async restockProduct({
      path,
      headers,
      body,
    }: {
      path: { id: string };
      headers: { "idempotency-key": string };
      body: { quantity: number };
    }) {
      const data = await request<{ product: WireProduct | null }>(
        adminDocuments.restock,
        {
          id: path.id,
          key: headers["idempotency-key"],
          quantity: body.quantity,
        },
      );
      return product(data.product);
    },
  };
}
