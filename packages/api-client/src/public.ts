// Generated from OpenAPI. Do not edit.
import type {AxiosInstance} from "axios";
import type {operations} from "./public.types.ts";
type Success<O extends {responses: object}> = {[K in Extract<keyof O["responses"],200|201>]: O["responses"][K] extends {content:{"application/json":infer Data}} ? Data : never}[Extract<keyof O["responses"],200|201>];
export function createPublicClient(http:AxiosInstance){return {
searchProducts:(args:{signal?:AbortSignal;query?:operations["searchProducts"]["parameters"]["query"]} = {})=>http.request<Success<operations["searchProducts"]>>({method:"get",url:"/products",signal:args.signal,params:args.query}).then(response=>response.data),
getStock:(args:{signal?:AbortSignal;path:NonNullable<operations["getStock"]["parameters"]["path"]>})=>http.request<Success<operations["getStock"]>>({method:"get",url:"/products/{id}/stock".replaceAll("{id}",encodeURIComponent(String(args.path.id))),signal:args.signal}).then(response=>response.data),
createOrder:(args:{signal?:AbortSignal;headers:NonNullable<operations["createOrder"]["parameters"]["header"]>;body:operations["createOrder"]["requestBody"]["content"]["application/json"]})=>http.request<Success<operations["createOrder"]>>({method:"post",url:"/orders",signal:args.signal,headers:args.headers,data:args.body}).then(response=>response.data),
listOrders:(args:{signal?:AbortSignal;query?:operations["listOrders"]["parameters"]["query"]} = {})=>http.request<Success<operations["listOrders"]>>({method:"get",url:"/orders",signal:args.signal,params:args.query}).then(response=>response.data),
getOrder:(args:{signal?:AbortSignal;path:NonNullable<operations["getOrder"]["parameters"]["path"]>})=>http.request<Success<operations["getOrder"]>>({method:"get",url:"/orders/{id}".replaceAll("{id}",encodeURIComponent(String(args.path.id))),signal:args.signal}).then(response=>response.data),
confirmOrder:(args:{signal?:AbortSignal;path:NonNullable<operations["confirmOrder"]["parameters"]["path"]>})=>http.request<Success<operations["confirmOrder"]>>({method:"post",url:"/orders/{id}/confirm".replaceAll("{id}",encodeURIComponent(String(args.path.id))),signal:args.signal}).then(response=>response.data),
cancelOrder:(args:{signal?:AbortSignal;path:NonNullable<operations["cancelOrder"]["parameters"]["path"]>})=>http.request<Success<operations["cancelOrder"]>>({method:"post",url:"/orders/{id}/cancel".replaceAll("{id}",encodeURIComponent(String(args.path.id))),signal:args.signal}).then(response=>response.data),
deleteCancelledOrders:(args:{signal?:AbortSignal} = {})=>http.request<Success<operations["deleteCancelledOrders"]>>({method:"delete",url:"/orders/cancelled",signal:args.signal}).then(response=>response.data),
};}
