# training2 架构说明

training2 由两个 Vue 前端、两个 Hono API、一个 PostgreSQL 和本地认证服务组成。先确定业务规则与契约，再实现接口和页面，最后通过实际数据库和浏览器验证。

## 请求路径和职责

```text
买家浏览器 → public-frontend → public-api  → PostgreSQL
管理员浏览器 → private-frontend → private-api → PostgreSQL
两种浏览器 → Cognito 登录 → access token → API 验证
```

- `apps/public-frontend`：搜索、库存、自己的订单操作。
- `apps/private-frontend`：管理员商品注册和列表。
- `apps/public-api` / `apps/private-api`：接入契约、验证请求和响应、调用服务、认证授权、返回统一错误。
- 服务层：订单所有者、状态、金额和库存业务规则；负责事务边界。
- 数据访问层：Prisma 普通查询与参数化 SQL 行锁；不直接拼接用户输入。

不新增 `packages/api-routes`，不提前建立复杂 Mapper 基础设施。公开 DTO 通过小型显式转换函数生成，不直接序列化数据库行。

## 三种契约

| 契约 | 唯一维护入口 | 生成或检查内容 |
| --- | --- | --- |
| 数据库 | `packages/postgres/migrations` 中的 SQL | PostgreSQL → Prisma introspection → Client；最新结构从迁移结果生成 |
| API | `packages/api-contracts` 中的路由和 Zod schema | OpenAPI、请求和响应验证、API Client |
| 页面 | `packages/screen-contracts` | 页面文档、路由对应、验收 ID 与 E2E 对应 |

Prisma schema 和 Client 不手改，不使用 Prisma migrations 管理 DB。生成使用空临时 DB 应用全部 SQL；不能依赖开发库的手动改动。

业务验证与结构验证分开。Zod 能判断数量是否为正整数；服务层结合实际 DB 判断库存是否足够。响应在发送前统一进行契约验证，验证失败返回受控 500 并记录脱敏日志，避免错误处理递归。

## 初始数据模型

- products：UUID、唯一规范化商品代码、名称、说明、JPY 整数价格、库存、时间戳。
- orders：UUID、owner sub、状态、幂等 key、规范化创建输入、总额、时间戳。
- order_items：订单和商品外键、商品代码和名称及价格快照、数量。同一订单同一商品唯一。
- `(owner_sub, idempotency_key)` 唯一约束防止并发创建重复订单。

库存只保存在 products 一处。金额使用 BIGINT 保存并在 DTO 转换时检查安全整数。应用计算订单金额；DB 提供字段约束和外键，跨行金额一致性由事务与业务测试保证。订单创建和全部明细写入也在一个事务中。

## 并发一致性

确认或取消先锁订单，然后以固定商品 ID 顺序获取商品锁。状态和库存同事务提交或全部回滚。库存非负 CHECK 作为最后保障。

标准实现采用悲观锁。乐观锁在 Step12 作为独立实验比较，不将正式实现无条件分成两套。幂等重试、事务失败重试和普通客户端重复操作分别按需求处理。

## 开发环境和地址

| 服务 | 浏览器或 Windows | 开发容器内部 |
| --- | --- | --- |
| 买家前端 | localhost:5173 | app:5173 |
| 管理前端 | localhost:5174 | app:5174 |
| 买家 API | localhost:3000 | app:3000 |
| 管理 API | localhost:3001 | app:3001 |
| PostgreSQL | localhost:5432 | db:5432 |
| cognito-local | localhost:9230 | cognito-local:9229 |

应用开发服务器监听 0.0.0.0，由 VS Code 转发。JWT issuer 固定为浏览器可见的 `http://localhost:9230/<poolId>`；服务端抓取 JWKS 时使用容器可达地址。两个地址的区别不改变 token 中 issuer 的验证规则。

Step1 已验证 Amplify SDK 的 USER_PASSWORD_AUTH、管理员组和买家登录。针对本地 HTTP issuer，采用 aws-jwt-verify 的 JwtRsaVerifier，显式配置 issuer、预取并缓存本地 JWKS，并检查 client_id、token_use 和 sub。保持签名和到期验证，不把本地认证改为绕过验签。生产 Cognito 使用官方 CognitoJwtVerifier；正式实现及浏览器登录页面在 Step6 和 Step9 完成。当前小型接通检查在 Node 里执行 Amplify SDK，尚不代表浏览器登录页面已经实现。

开发参数由 Compose 显式传入；不读取 `.env`。Compose 命令设置 `COMPOSE_DISABLE_ENV_FILE=true`。容器构建上下文限定为 `infra/docker`，不将整个工作区发送到镜像构建。

当前计划保留 GitHub CLI、AWS CLI 和 Docker in Docker 特性。开发账号和 DB 密码只用于本地；部署时接入真正 Cognito 和 Secret 管理。

## 验证和推进

按 implementation-plan 的 Step0 到 Step14 推进。在 Step1 完成前不将空的递归 test/build 视为验证通过。Step2 后使用分支和 PR；上一步合并后再推进下一步。文档与测试随功能同步更新。
