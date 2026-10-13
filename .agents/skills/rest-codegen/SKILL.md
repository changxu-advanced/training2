---
name: rest-codegen
description: Update and regenerate training2 API contracts, OpenAPI and Axios Client, checking consistency and compatibility.
---

# training2 REST 生成

遵守 AGENTS.md 与 step-workflow，在容器内操作，不读取或改动 .env。

只维护 packages/api-contracts 中的契约和 tools/codegen 的生成逻辑，不手改 schemas/openapi 和生成 Client。业务规则引用 requirements.md，操作方式见 docs/api.md。

改动后运行 pnpm codegen，再检查 pnpm codegen:check、pnpm check 和基线 OpenAPI 兼容性。测试聚焦本次关键风险，复用已有检查。

破坏性变更须在 PR 解释影响、理由和移行方法，不能自动跳过兼容性失败。契约生成不代表认证、服务或发送前响应验证完成。
