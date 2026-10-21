# Training 3：GraphQL 与镜像交付

Training 3 在 Training 2 上继续实施。原 implementation-plan 中 GraphQL 不在范围内的说明仅针对 Training 2；本计划记录用户在 2026-10-20 提出的新要求。

## 分步交付

| 阶段 | 内容 | 本阶段边界 |
| --- | --- | --- |
| 1 | PostGraphile 管理员 GraphQL API | 商品查询、登记、补货；保留 REST 兼容入口，验证实际数据库和权限 |
| 2 | 管理端接入 graphql-request + TanStack Vue Query | 5173 管理员模式和 5174 独立管理端一起迁移；买家界面维持 |
| 3 | 检查其他 Axios 请求的 Vue Query 包装 | 已完成：复用已有请求管理，并把读取取消信号传入 Axios |
| 4 | CI 检查、构建应用镜像并推送 GHCR | typecheck、unit test、build、image build/push；镜像发布权限在实施时配置 |
| 5 | 从 GHCR 拉取并在本地启动验收 | 验证认证、商品操作和订单库存，记录可复现命令 |

阶段 1 已通过 PR #15 合并，当前实施阶段 2。保留日本文案、角色边界、SSE 自动刷新和现有订单锁规则。后续阶段在前一步集成后推进。

## 阶段 1：管理员 GraphQL

采用固定版 PostGraphile 5.1.5 和 GraphQL 16.11.0，以 library/schema 模式在现有 private-api 的 Hono 入口接入 Grafast。它是实际从 PostgreSQL introspection 生成的商品查询，不通过 HTTP 转调 REST。自定义 mutation 调用既有商品业务服务，保留输入规范化、唯一商品代码、事务重试、幂等补货和与订单共享的库存行锁。

接口为 private-api 的 POST /graphql（本地端口 3001）。现有两个前端均已有 /admin-api 代理，因此第二阶段可使用 /admin-api/graphql。public-api 不提供 GraphQL。所有查询、mutation 和 introspection 均需要现有 Cognito access token 且属于 admin 组；顾客 403、未登录或无效 token 401。管理员身份从已验证 token 获取，不从 variables 接收。

PostGraphile 只暴露 products 的读取。订单、明细、补货幂等记录、迁移历史和数据库函数不开放；自动创建、更新、删除 mutation 禁用，避免直接覆盖库存或修改价格。登记和补货以自定义 mutation 显式开放。

### 查询示例

使用 Authorization: Bearer 后跟已登录管理员的 access token，Content-Type: application/json；不要把 token 保存进仓库或文档。

~~~graphql
query Products($first: Int! = 20, $offset: Int! = 0) {
  allProducts(first: $first, offset: $offset, orderBy: CODE_ASC) {
    totalCount
    nodes { rowId code name description priceJpy stock }
  }
}

query Product($id: UUID!) {
  productByRowId(rowId: $id) { rowId code name description priceJpy stock }
}
~~~

PostGraphile Amber preset 中数据库 UUID 主键映射为 rowId；priceJpy 的 PostgreSQL bigint 映射为 BigInt 标量，JSON 表达是字符串，前端第二阶段需按 0..100000000 范围转换成日元数字，不直接沿用 REST DTO 假设。查询节点不存在时返回 null；客户端据此展示不存在提示。

连接查询必须明确 first 或 last，范围 1..100（可通过变量默认值提供），页码通过 offset 转换；保留 totalCount 和 CODE_ASC 稳定顺序。第一阶段的管理列表不需要顾客端的名称部分匹配筛选；顾客 REST 搜索维持既有行为。

### 修改示例

~~~graphql
mutation Register($input: RegisterAdminProductInput!) {
  registerAdminProduct(input: $input) {
    id code name description priceJpy stock
  }
}

mutation Restock($id: ID!, $key: ID!, $quantity: Int!) {
  restockAdminProduct(id: $id, idempotencyKey: $key, quantity: $quantity) {
    id stock
  }
}
~~~

登记 input 为 code、name、description（可省略，默认空串）、priceJpy、stock；沿用后端价格 0..100000000、库存 0..1000000 的整数约束和文本长度约束，界面单次初始库存限制 2000 保留。追加 quantity 为 1..2000，key 是每次操作新建并在重试时复用的 UUID；同一管理员/key/商品/数量只增加一次，不同参数复用 key 返回 IDEMPOTENCY_CONFLICT。总库存上限 1000000 不变。自定义 mutation 返回既有安全 DTO，因此 id 为 UUID、priceJpy 为 Int。

GraphQL 的 mutation 字段按文档顺序执行，但一个文档内多个 mutation 字段不是整体数据库事务；每个登记或补货操作具有自身的事务语义。

### 传输与错误

只接受单个 JSON POST，禁止 GET 执行 mutation 和数组批处理；请求体至多 64 KiB、query 长度至多 16000、解析 token 至多 2000，展开 fragment 后字段/选择项至多 200、深度至多 10。数据库读取 statement timeout 为 5 秒，商品写入沿用既有事务超时/重试。

错误返回 GraphQL errors 数组，extensions 含 code 和 requestId。业务错误包括 INVALID_INPUT、DUPLICATE_PRODUCT、IDEMPOTENCY_CONFLICT、NOT_FOUND、TEMPORARILY_UNAVAILABLE；未预期异常只返回 INTERNAL_ERROR，不返回 SQL、堆栈或内部异常文本。响应不缓存。认证 401/403；请求错误 400/405/413/415；已执行的 GraphQL 操作可为 HTTP 200 并含 errors，前端不能只检查 HTTP 状态。

### 契约和验证

schemas/graphql/admin.graphql 从空临时数据库应用原 SQL migrations 后，通过同一 PostGraphile preset 生成；不手改 SDL，也不读取 .env。本阶段不修改数据库结构、REST OpenAPI 或现有页面契约。

容器内执行：

~~~sh
pnpm graphql:schema
pnpm graphql:check
pnpm check
~~~

既有 pnpm test/CI 自动包含新增的一项真实 PostgreSQL 组合测试，并比对生成 SDL；覆盖访问权限、自动查询、登记、输入边界、重复代码、并发同 key 补货、补货与订单确认竞争、隐藏数据/自动修改入口、请求边界及异常信息隐藏。临时数据库在测试后释放，不修改演示账号订单。

阶段 1 仅完成后端，前端迁移见下面阶段 2；GHCR 应用镜像属于后续阶段。

参考：[PostGraphile schema-only](https://postgraphile.org/postgraphile/5/usage-schema/)、[schema extension](https://postgraphile.org/postgraphile/5/extend-schema/)、[公开行为控制](https://postgraphile.org/postgraphile/5/behavior/)。

## 阶段 2：管理员前端请求迁移

5173 的管理员模式和 5174 的独立管理端共用 packages/ui/src/admin-client.ts。graphql-request 7.4.0 发送商品列表、详情、登记和补货请求，页面继续用既有 useQuery/useMutation 管理缓存、加载、失败和写入后刷新，不再为管理员商品功能调用 Axios REST。顾客商品浏览和订单仍使用原 REST + Vue Query；SSE 仍是库存变化通知。

GraphQLClient 使用当前 origin 生成完整的 /admin-api/graphql 地址，适用于两个端口及同源反向代理。每个请求单独取得 Amplify access token，不把 token 缓存为客户端固定 header；捕获请求账号，在发送前、响应后及错误处理时验证身份，迟到的响应不能清除新账号会话或填充新账号缓存。401 和 GraphQL UNAUTHENTICATED 返回登录，其他业务错误按 code 显示日文安全提示，不回显服务端原始文本。

查询传入 Vue Query 的 AbortSignal，页面切换/账号退出可取消读取；请求超时 8 秒。写操作不自动重试，补货手动重试沿用同一 UUID key，数量变化才换 key。商品 UUID 通过 GraphQL alias id:rowId 映射到页面，bigint 日元字符串先检查格式及业务范围再转 number。列表、商品详情缓存包含当前账号，避免跨账号复用私有查询。

页面仍复用 products 查询键前缀，因此既有 SSE 失效通知与 mutation 成功刷新继续生效；后台重新取数保持已有表格、滚动和按钮，不加入整页刷新。

Screen Contract 使用 `graphql:<rootField>` 声明管理接口依赖。screen:check 从已保存 SDL 构建 schema 验证字段存在；客户端组合测试还验证四份实际 GraphQL 文档与 SDL 一致。既有 E2E-PRODUCTS 覆盖两个管理员入口的实际读写，阻断旧 REST 管理请求以避免悄悄回退；既有 E2E-AUTH 覆盖 GraphQL 401 和退出后迟到请求。浏览器用例数量不增加。

阶段 2 完成后继续保留后端 REST 兼容入口；阶段 3 已补齐买家 REST 读取的取消信号，镜像发布属于阶段 4/5。

## 阶段 3：REST Axios 与 Vue Query

阶段 3 的审查确认，前端业务请求均从页面的 `useQuery` 或 `useMutation` 发起；登录配置读取、Axios 实例创建、认证拦截器和错误类型判断是启动/传输基础设施，不属于脱离 Vue Query 的业务请求。为使查询生命周期完整，OpenAPI Axios Client 的生成模板现在为每个方法提供可选 `AbortSignal`，商品搜索、库存、订单列表和订单详情读取把 Vue Query 的 signal 传入 Client。页面离开、查询失效或账号切换时，Vue Query 可以中止正在进行的 REST 读取；写操作仍由 mutation 管理且不自动重试。未修改 API 契约、服务端、数据库或缓存键。
