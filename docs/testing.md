# 验证方式

全部命令在开发容器内运行；数据库测试使用真实 PostgreSQL 17.6。当前共 40 个单元/集成测试和 4 组 Playwright 流程，覆盖 6 个 E2E 场景 ID；数量描述的是 Step12 基线。后续优先复用组合用例和契约检查，只补必要风险。

| 命令 | 验证内容 |
| --- | --- |
| pnpm check | Biome、各包类型检查、已有单元/集成测试、应用构建 |
| pnpm test:e2e | 真实本地认证、商品、订单所有权/库存和完整管理→买家流程 |
| pnpm db:schema:check | 空库应用 SQL 后的结构清单与已提交产物一致 |
| pnpm prisma:check | 空库迁移、反向生成模型一致性、Client 再生成 |
| pnpm codegen:check | OpenAPI、Axios 类型/Client、API 参考与契约一致 |
| pnpm screen:check | 页面文档、实际 Vue 路由、API 和 E2E 对应完整；不代替浏览器执行 |
| pnpm docs:build | VitePress 静态构建，检查站内死链接；本地服务地址作为外部链接例外 |
| pnpm docs:check | API/页面生成一致性加文档构建 |
| bash tools/scripts/check-openapi-breaking.sh origin/main | 与基线的 API 破坏性差异检查 |

首次浏览器安装和启动步骤见 [启动说明](./getting-started.md)。pnpm test 中的库存竞争、回滚、重试验证使用两条真实数据库连接与可观察的锁等待，详细断言见 [重点验证](./verification.md)。测试在隔离临时库运行，不清空开发业务库。

提交钩子执行 lint 和 typecheck；GitHub Actions 才运行完整流程：固定镜像安装 → 模拟器认证 → 业务库迁移/seed → Prisma/契约/页面检查 → 文档构建 → pnpm check → Chromium/E2E → 数据库结构比较 → OpenAPI 基线比较。CI 失败则不可把当前步骤计为完成。

配置只接收运行环境变量，不读取配置秘密文件。日志不记录完整请求体、token 或密码，脱敏能力与测试边界见 [后端说明](./backend.md)。生成通过只能证明契约产物一致，业务行为仍以实际测试结果为准。
