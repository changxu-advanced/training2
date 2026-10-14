import type { openapiDocument } from "../../packages/api-contracts/src/index.ts";

type Document = ReturnType<typeof openapiDocument>;
const json = (value: unknown) =>
  `\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n`;
export function renderApiDocs(documents: { scope: string; doc: Document }[]) {
  let result =
    "# API 参考（自动生成）\n\n由 packages/api-contracts 经 tools/codegen 生成，禁止手改。更新：pnpm codegen；验证：pnpm codegen:check。业务实现及生成方式见 [API 指南](./api.md)。下列结构直接来自 OpenAPI，不作为运行结果证明。\n";
  for (const { scope, doc } of documents) {
    result += `\n## ${scope} API\n`;
    for (const [url, item] of Object.entries(doc.paths ?? {})) {
      for (const [method, raw] of Object.entries(item ?? {})) {
        if (!["get", "post", "put", "patch", "delete"].includes(method))
          continue;
        const operation = raw as {
          operationId: string;
          summary?: string;
          description?: string;
          security?: unknown;
          parameters?: unknown;
          requestBody?: unknown;
          responses: unknown;
        };
        result +=
          "\n### " +
          operation.operationId +
          "\n\n`" +
          method.toUpperCase() +
          " " +
          url +
          "`\n";
        result += `\n${operation.summary ?? ""}\n`;
        if (operation.description) result += `\n${operation.description}\n`;
        result += `\n#### 认证\n${json(operation.security ?? doc.security ?? [])}`;
        if (operation.parameters)
          result += `\n#### 参数\n${json(operation.parameters)}`;
        if (operation.requestBody)
          result += `\n#### 请求体\n${json(operation.requestBody)}`;
        result += `\n#### 响应\n${json(operation.responses)}`;
      }
    }
    result += `\n### 共享模型与认证定义\n${json(doc.components ?? {})}`;
  }
  return result;
}
