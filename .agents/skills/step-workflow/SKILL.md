---
name: step-workflow
description: Execute and verify a training2 roadmap step, maintaining its branch, PR and progress records. Use for training2 implementation work, not general coding advice.
---

# training2 Step 开发流程

先读项目根目录 AGENTS.md、docs/implementation-plan.md 和 docs/progress.md。业务规则引用 docs/requirements.md，验收引用 docs/acceptance-scenarios.md，不在此复制规格。

实现、依赖安装、生成和验证都在 Dev Container 内执行。不得读取、修改或提交 .env；启动 Compose 时关闭隐式 .env 加载。宿主机只准备容器启动所必需配置。

从已合并上一步的 main 开始，使用 step/NN-xxx 分支。实现当前 Step 的成果物和完成条件；问题写入 ISSUES.md，并更新进度。

运行 pnpm check 和当前 Step 需要的实际连接、业务或并发验证。无测试包不能算测试成功；不要用生成契约的形式检查代替业务验证。

验证后提交、推送分支并创建 PR，描述实际变化、验证结果及未解决事项。沿用用户已经提供的提交推送授权；没有授权时先完成可审查的工作，再确认外部操作。若当前环境支持 PR 附件工具，创建后附加到本聊天。

PR 创建不等于合并授权。未获用户合并授权或上一步尚未合并时，不启动依赖它的下一 Step。只有成果物、验证和集成都成立才标为完了。
