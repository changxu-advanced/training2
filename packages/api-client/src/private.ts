// Generated from OpenAPI. Do not edit.
import type {AxiosInstance} from "axios";
import type {operations} from "./private.types.ts";
type Success<O extends {responses: object}> = {[K in Extract<keyof O["responses"],200|201>]: O["responses"][K] extends {content:{"application/json":infer Data}} ? Data : never}[Extract<keyof O["responses"],200|201>];
export function createPrivateClient(http:AxiosInstance){return {
registerProduct:(args:{body:operations["registerProduct"]["requestBody"]["content"]["application/json"]})=>http.request<Success<operations["registerProduct"]>>({method:"post",url:"/products",data:args.body}).then(response=>response.data),
listProducts:(args:{query?:operations["listProducts"]["parameters"]["query"]} = {})=>http.request<Success<operations["listProducts"]>>({method:"get",url:"/products",params:args.query}).then(response=>response.data),
getProduct:(args:{path:NonNullable<operations["getProduct"]["parameters"]["path"]>})=>http.request<Success<operations["getProduct"]>>({method:"get",url:"/products/{id}".replaceAll("{id}",encodeURIComponent(String(args.path.id))),}).then(response=>response.data),
restockProduct:(args:{path:NonNullable<operations["restockProduct"]["parameters"]["path"]>;headers:NonNullable<operations["restockProduct"]["parameters"]["header"]>;body:operations["restockProduct"]["requestBody"]["content"]["application/json"]})=>http.request<Success<operations["restockProduct"]>>({method:"post",url:"/products/{id}/restock".replaceAll("{id}",encodeURIComponent(String(args.path.id))),headers:args.headers,data:args.body}).then(response=>response.data),
};}
