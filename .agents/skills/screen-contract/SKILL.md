---
name: screen-contract
description: Update training2 screen contracts, generated page docs and route/E2E mappings when changing frontend screens or their acceptance coverage.
---

# training2 页面契约

遵守 AGENTS.md 和 step-workflow；实现、生成、验证在 Dev Container 内执行，不读取、修改或提交 .env。

只维护 packages/screen-contracts 的正本，业务限制引用 API inputs 和 docs/requirements.md，验收引用 docs/acceptance-scenarios.md。不手改 docs/screens.generated.md。

运行 pnpm screen:generate、pnpm screen:check 和当前 Step 的必要验证。更新前端时让实际 Vue Router 使用 route-manifest，并把 router.getRoutes() 传给 validateActualRoutes。仅清单一致不能证明页面存在；planned 不能标为实现完成。

浏览器业务场景实现后记录实际 tests/e2e specFile 与 [场景ID] 标记，再运行 Playwright 验证行为。对应检查不能代替业务断言；并发库存仍按计划用实际 DB 连接检验。--require-implemented 在 Step9 接入，--require-e2e 在完整业务 E2E 就绪后启用。详见 docs/screen-contracts.md。
