import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import openapiTS, { astToString } from "openapi-typescript";
import { openapiDocument } from "../../packages/api-contracts/src/index.ts";

const check = process.argv.includes("--check");
async function save(file: string, value: string) {
  if (check) {
    if ((await readFile(file, "utf8")) !== value)
      throw new Error(`Generated artifact differs: ${file}`);
  } else {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, value);
  }
}
for (const scope of ["public", "private"] as const) {
  const doc = openapiDocument(scope);
  await save(
    `schemas/openapi/${scope}.json`,
    `${JSON.stringify(doc, null, 2)}\n`,
  );
  const types = astToString(await openapiTS(doc));
  await save(`packages/api-client/src/${scope}.types.ts`, types);
  let code = `// Generated from OpenAPI. Do not edit.\nimport type {AxiosInstance} from "axios";\nimport type {operations} from "./${scope}.types.ts";\ntype Success<O extends {responses: object}> = {[K in Extract<keyof O["responses"],200|201>]: O["responses"][K] extends {content:{"application/json":infer Data}} ? Data : never}[Extract<keyof O["responses"],200|201>];\nexport function create${scope === "public" ? "Public" : "Private"}Client(http:AxiosInstance){return {\n`;
  for (const [url, item] of Object.entries(doc.paths ?? {})) {
    for (const [method, operation] of Object.entries(item ?? {})) {
      if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
      const op = operation as {
        operationId: string;
        parameters?: { in: string; required?: boolean }[];
        requestBody?: unknown;
      };
      // EventSource owns streaming transport, never buffer SSE with Axios.
      if (op.operationId === "catalogEvents") continue;
      const id = op.operationId;
      const params = op.parameters ?? [];
      const fields: string[] = [];
      const config: string[] = [];
      let required = false;
      let route = JSON.stringify(url);
      if (params.some((p) => p.in === "path")) {
        fields.push(
          `path:NonNullable<operations["${id}"]["parameters"]["path"]>`,
        );
        required = true;
        for (const match of url.matchAll(/\{([^}]+)\}/g)) {
          route += `.replaceAll(${JSON.stringify(match[0])},encodeURIComponent(String(args.path.${match[1]})))`;
        }
      }
      if (params.some((p) => p.in === "query")) {
        fields.push(`query?:operations["${id}"]["parameters"]["query"]`);
        config.push("params:args.query");
      }
      if (params.some((p) => p.in === "header")) {
        fields.push(
          `headers:NonNullable<operations["${id}"]["parameters"]["header"]>`,
        );
        config.push("headers:args.headers");
        required = true;
      }
      if (op.requestBody) {
        fields.push(
          `body:operations["${id}"]["requestBody"]["content"]["application/json"]`,
        );
        config.push("data:args.body");
        required = true;
      }
      code += `${id}:(args:{${fields.join(";")}}${required ? "" : " = {}"})=>http.request<Success<operations["${id}"]>>({method:${JSON.stringify(method)},url:${route},${config.join(",")}}).then(response=>response.data),\n`;
    }
  }
  code += "};}\n";
  await save(`packages/api-client/src/${scope}.ts`, code);
}
console.log(
  check
    ? "OpenAPI and Axios Client match their contracts."
    : "Generated OpenAPI and typed Axios Client.",
);
