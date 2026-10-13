---
name: schema-to-types
description: Regenerate and verify training2 Prisma models and Client from SQL migrations. Use for database schema changes and generated Client maintenance.
---

# training2 SQL 到 Prisma

遵守根目录 AGENTS.md，操作必须在 Dev Container 内，不读取、修改或提交 .env。

数据库定义只维护 packages/postgres/migrations；已应用历史不改，添加新 SQL migration。不得使用 Prisma Migrate 或手改模型、Client。

运行 pnpm db:schema，再运行 pnpm prisma:generate，审查生成 schema.prisma 和结构清单。两个命令均从空临时 DB 的迁移结果生成，不依赖开发库状态。

Git 保存 schema.prisma 和 SQL 结构清单，generated Client 不提交。运行 pnpm prisma:check 验证复现并生成 Client，然后执行 pnpm check。新增测试只覆盖本次关键风险，复用已有 DB 约束检查。

操作和发布入口见 packages/prisma/README.md；PR 与合并按 step-workflow 和 implementation-plan 推进。
