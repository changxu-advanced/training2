# 页面契约与对应验证

页面规格的正本是 packages/screen-contracts/src/index.ts，包含屏幕 ID、端、路由、权限、输入契约、API、迁移、状态反馈及验收 ID。业务输入引用现有 API/Zod 契约，不在页面规格手写另一套字段限制。生成说明见 screens.generated.md。

容器内运行 pnpm screen:generate 生成文档，pnpm screen:check 验证文档一致性、screen ID/路由唯一性、同端迁移、现有 API operationId、验收 ID 和浏览器业务场景覆盖；CI 自动执行后一命令。修改生成文档不会改变正本。

两端 src/route-manifest.ts 当前是 planned 路由声明，供 Step9 接入 Vue Router；不代表网页存在。声明与契约之间的丢失或变化会失败。实现时须通过同一声明构造 Vue Router，并将 router.getRoutes() 传给 validateActualRoutes，避免只有清单一致、实际路由缺失。届时把路由标记为 implemented，并在 CI 使用 --require-implemented；当前该模式明确拒绝计划清单。

6 组 E2E 是业务场景计划，包含操作与可观察结果，不是 Playwright 测试。实现时记录 status=implemented 和 tests/e2e 内的实际 specFile，测试标题带 [场景ID]；检查器检测路径或标记缺失。--require-e2e 要求全部实际 spec 映射，Step12 启用。标记扫描只能证明对应关系，必须另外执行 Playwright 并通过业务断言。路由存在检查不替代订单、库存、回滚或权限的业务验证；并发仍由实际 DB 测试完成。

Step8 只新增两个检查器组合测试，用破坏性的 fixture 验证缺失映射、错误 API/ID/路由以及 planned 被错误当作 implemented 时能失败。真实浏览器结果在 Step9〜12 单独记录。
