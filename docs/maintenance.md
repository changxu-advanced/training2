# 生成流程与故障排查

## 正本与生成命令

| 正本 | 更新动作 | 产物 |
| --- | --- | --- |
| packages/postgres/migrations/*.sql | pnpm db:migrate；pnpm db:schema | schemas/current.json |
| 同一组 SQL 迁移 | pnpm prisma:generate | packages/prisma/schema.prisma；忽略的 generated Client |
| packages/api-contracts/src | pnpm codegen | schemas/openapi/*.json、packages/api-client/src、docs/api.generated.md |
| packages/screen-contracts/src | pnpm screen:generate | docs/screens.generated.md；路由/E2E 映射由检查器验证 |

不手改生成产物，不用 Prisma schema 代替 SQL 正本。数据库迁移新增连续编号文件，已应用文件的 checksum 不允许变化。API 路由和请求/响应结构源自契约，实际业务处理仍在 backend。页面正本生成说明并核验真实路由和场景，Playwright 测试需要真实执行。

修改相应正本并生成后执行数据库、Prisma、API、页面一致性检查，再运行 pnpm docs:build。pnpm docs:generate 一次更新 API 和页面参考；pnpm docs:check 只比较和构建，不覆盖已提交文档。API 的请求/响应 JSON Schema 在 [生成参考](./api.generated.md) 中可查，页面输入/迁移/反馈在 [页面参考](./screens.generated.md) 中可查。

## 常见问题

| 现象 | 处理 |
| --- | --- |
| 启动器找不到 Docker | 启动 Docker Desktop 并等待引擎就绪，重新运行启动器 |
| VS Code 终端在主机路径 | 重新用启动器打开容器工作区，确认 /workspaces/training2 和 /.dockerenv |
| 数据库缺表或 Client 缺失 | 容器内运行 pnpm db:migrate、pnpm db:seed、pnpm prisma:check |
| 登录失败或浏览器认证配置缺失 | 检查 Compose 模拟器状态，运行 pnpm seed:cognito，使用本地账号；运行配置在忽略的 .devcontainer/runtime/cognito.json |
| 页面打不开 | 确认两个 API 与两个前端均运行，在 VS Code Ports 面板转发 3000/3001/5173/5174 |
| 文档打不开 | 运行 pnpm docs:dev 并转发 5175 |
| Generated artifact differs | 改正本后运行对应生成命令，审阅产物差异，不手改产物 |
| 文档构建报死链接 | 修正文档相对路径或站内链接，保留站内死链接检查 |
| Chromium 或系统库缺失 | 按启动说明在容器 root 下安装，测试时保持相同 PLAYWRIGHT_BROWSERS_PATH |
| API 401 / 403 | 重新登录；管理操作使用 admin；API 只接收 access token |
| 订单 404 / 409 / 503 | 检查所属账号、当前状态与库存；503 是有限重试耗尽，保留请求 ID 排查，不无限重试 |
| OpenAPI 兼容性失败 | 核对删除/收窄结构及旧客户端影响，在 PR 说明迁移并解决差异，不忽略检查 |
| 依赖安装与 lockfile 不符 | 容器内用 pnpm install --frozen-lockfile；有意新增依赖才修改锁文件 |

DB 与认证卷不能作为日常排障被删除。所有诊断继续遵守禁止读取、修改、提交 .env 的规则。生产配置与故障恢复将在 Step14 确定，不把开发账号和 local 认证用于部署。
