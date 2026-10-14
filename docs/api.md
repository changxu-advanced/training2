# training2 API 契约

packages/api-contracts 定义路由、输入和响应。生成 public/private OpenAPI 3.1 文档到 schemas/openapi，再用工具包的 openapi-typescript 生成类型和 Axios 方法。Git 保存这些产物，pnpm codegen:check 验证重建一致。业务逻辑由 backend 实现。

完整路由、认证声明、参数、请求/响应与共享模型见 [API 参考（自动生成）](./api.generated.md)，不在此维护第二份接口清单。全部 8 个业务操作已在 Step10/11 实现；错误统一为 error.code/message/requestId。契约保留的占位错误结构不代表当前业务仍未实现。

订单创建必须提供 idempotency-key UUID 头；HTTP 头不区分大小写。Axios 的认证由调用方实例的 interceptor 提供，客户端不自行读取 token 或配置文件。API 认证在 Step6 接入，统一发送前响应验证在 Step7，商品和订单业务在 Step10/11。

## 输入和表示

JSON 商品价格和数量为整数，JPY 合计最大 5 万亿；时间为 ISO 字符串或明确的 null，不发送 bigint、内部 owner_sub 或幂等比较原文。商品代码去空白转大写，名称去首尾空白；Unicode 文本通过带 u 标记的正则计数。OpenAPI 描述规范化输入。搜索空白条件由业务处理视为未提供，代码完全匹配、名称字面子串，组合 AND。

结构约束保持可生成，重复商品、所有权、库存和状态等真实数据条件交给服务。订单快照和金额规则仍按 requirements.md，不在契约生成器里实现业务。

## Client 和表单方式

调用 @training2/api-client/public 的 createPublicClient 或 private 的 createPrivateClient，传入 Axios 实例。方法、参数和成功响应类型从 OpenAPI 生成。

选择直接共享 @training2/api-contracts/inputs 的纯 Zod 表单 Schema，再使用生成 Client；浏览器入口不导入 Hono 路由、DB 或服务启动代码。这样不增加第二套表单规则。客户端已校验输入后不重复同一校验，服务端仍必须校验。页面特有转换由共享 UI 处理。暂不引入 Orval；当前生成器满足 8 个 JSON 操作的 path/query/header/body，不承诺支持任意外部 OpenAPI。

应用仍使用 TypeScript 7。生成工具单独固定 TypeScript 5.9.3，以满足 openapi-typescript 的编译 API 依赖。

## 生成和兼容性

- pnpm codegen：更新 OpenAPI、类型、Axios Client 和 API 参考文档。
- pnpm codegen:check：比较重建结果，不覆写产物。
- bash tools/scripts/check-openapi-breaking.sh origin/main：用 oasdiff 1.33.0 比较基线，破坏性结果使命令失败。

CI 对 PR base SHA 或主分支上一提交进行比较，首版无基线时仅跳过差异比较，生成与测试仍运行。破坏性变更需要在 PR 说明影响、理由和迁移方式，再通过显式兼容性设计解决，不自动忽略检查。

只新增两项测试：输入/响应结构、501 占位和生成 Client 的传输组合验证，以及删除已有 endpoint 必须触发兼容性失败。

## Catalog streaming

GET /catalog/events is a public text/event-stream endpoint on both API services. Events: catalog / changed and heartbeat / ok; no order IDs or buyer information. EventSource owns transport (not the JSON Axios client). Reconnect refetches authoritative JSON snapshots; a 30-second fallback covers missed events. Database statement triggers use LISTEN/NOTIFY so both processes see committed writes only. Apply migration 0002 before starting the updated API. Listener failure closes streams, reconnects and returns 503 until ready. Existing JSON response validation and order transactions remain unchanged.

## Own order listing

GET /orders requires the current buyer access token. Inputs: page/pageSize and optional status (draft/confirmed/cancelled). Owner comes only from verified sub; unknown owner parameters are rejected. Newest createdAt first with id tie-breaker, stable pagination snapshot; each item contains the existing order DTO plus canConfirm computed against current stock. This is an availability hint, never a reservation; confirmation still validates locked stock transactionally.
