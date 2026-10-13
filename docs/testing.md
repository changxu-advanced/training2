# training2 验证方式

Step2 使用 pnpm check 统一执行 lint、类型检查、当前实际存在的测试和构建。GitHub Actions 在 infra/docker/Dockerfile 构建的固定 Node/pnpm 容器里执行相同命令，提交钩子执行 lint 和类型检查，CI 才是完整检查的依据。

当前 Node Test Runner 和 Chai 覆盖 config、logger 的基础行为，Node Test Runner 另覆盖实际 PostgreSQL 约束及迁移。其他应用和共享包仍为骨架，不将它们的无测试状态计为测试通过。业务验收仍以 acceptance-scenarios.md 为依据。

前端 Vitest 在 Step9 引入实际组件与查询测试，Playwright 随 Step10/11 的页面业务加入；Step12 覆盖实际 PostgreSQL 并发和主要 E2E。Step3 已在 CI 增加 PostgreSQL 17.6 服务、迁移和 seed、实际 DB 测试以及空库结构清单比较；不使用 DB mock 宣称库存一致性。

配置包只校验调用方提供的环境变量，不读取任何文件。日志只记录必要的结构化上下文；不要记录完整请求体、token 或密码。脱敏支持嵌套敏感键、Bearer、JWT、连接串凭据和常见密钥赋值；不能从任意自然语言中推断所有秘密。
