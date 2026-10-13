# Step12 重点验证

容器内 pnpm check 共40个单元/集成测试通过；pnpm test:e2e 的4组实际浏览器流程通过。此次只新增3个数据库组合测试和1个完整浏览器流程，复用先前的商品/订单/认证与DB约束检查。

## 并发与故障证据

| 验收 | 实际检查 | 结果 |
| --- | --- | --- |
| C01 库存1两单确认 | orders.test.ts：两个API分别拥有独立Prisma连接，第三连接锁库存；观察2个事务同时等待后释放 | 成功1、不足1、库存0；成功者不固定 |
| C02 双确认、C03 双取消 | concurrency.test.ts：锁订单行后启动两条独立连接，观察真实重叠等待 | 扣减一次、返还一次 |
| C04 确认/取消竞争 | 同上，两种操作等待同一订单锁 | 最终cancelled、库存恢复；确认可200或409 |
| C05 多商品逆序竞争 | 两单以相反输入顺序创建，再同时争用排序后的首个商品锁 | 成功1、不足1；两项库存0，无部分引当 |
| C06 写入中途失败/锁释放 | rollback.test.ts：第二项商品UPDATE的DB trigger抛错；非事务sequence记录已执行两次写入阶段 | 两项库存及draft全回滚；另一连接随后能确认；错误/日志不泄漏夹具内部信息 |
| C07 同key并发创建 | advisory gate确保两条连接同时等待；分别验证同输入和不同输入 | 同输入201/200同订单；不同输入201/409；唯一一单 |
| C08 重试上限 | DB trigger抛真实SQLSTATE40001；非事务sequence观测次数 | 一次失败后第2次成功且只扣一次；持续失败严格3次后503，库存/状态不变 |

测试数据库每组独立创建/销毁。竞争使用真实PostgreSQL连接和 pg_stat_activity 锁等待，不以Promise.all本身或固定sleep代替并发证据。故障trigger与sequence只存在临时测试库，不改变正式migration或生产代码。强制序列化故障不等于完整死锁图实验，但覆盖明确回滚时的实际错误分类和有限重试。

## 乐观锁比较

experiments/optimistic-stock.ts 仅用于比较，正式API不导入它。两条独立连接读取相同 xmin 版本，再执行版本条件UPDATE：一个成功，一个检测conflict；失败者重读版本后进行一次受限重试，最终库存0。再分配时返回不足。

悲观方式在订单/商品行上等待并读取最新状态，适合此项目的多商品事务；乐观方式减少预先锁等待，但需要检测冲突并重读/重做整个事务。此实验只比较单商品CAS，不替代订单原子性。xmin 是PostgreSQL内部版本，存在冻结/回绕及可移植性限制，不作为长期公开版本；若正式采用乐观方案，应另行设计SQL版本列和完整订单事务。当前不增加双模式生产分支。

## 契约与再生成

全部8个业务操作在真实API测试中执行：商品的register/list/search/stock与订单的create/get/confirm/cancel。响应都经过共同的契约校验；既有backend测试故意产生坏响应，验证受控500、秘匿日志和无递归。未知/未授权/业务错误沿用同一errorSchema。

pnpm prisma:check 和 db:schema:check 从新的空PostgreSQL应用SQL，重现Prisma Schema/Client及DB结构；旧的DB约束测试直接写入非法库存/数量/代码/FK并确认拒绝。pnpm codegen:check 保证OpenAPI/Client一致，CI继续对基线做兼容性检查。

pnpm screen:check 同时要求 --require-implemented 和 --require-e2e；运行时和Vitest仍用实际router.getRoutes()对照7个页面。6个场景ID由4个真实spec覆盖，三个订单ID合并在同一个浏览器测试。对应检查与实际Playwright执行是两道检查。

## 业务验收对应

| 验收组 | 自动化证据 |
| --- | --- |
| P01〜P06 | backend/test/products.test.ts、tests/e2e/products.spec.ts |
| P07 最新库存与快照 | orders.test.ts 的真实竞争/不足判断、products.spec.ts 的刷新、orders.spec.ts 的库存反馈 |
| O01〜O07、S01〜S06 | backend/test/orders.test.ts、tests/e2e/orders.spec.ts |
| C01〜C08 | orders.test.ts、concurrency.test.ts、rollback.test.ts |
| D01/D02 | prisma/postgres测试和CI空库生成检查 |
| A01/A02 | auth/test/auth.test.ts、backend/test/backend.test.ts、auth.spec.ts |
| E01 完整主要流程 | tests/e2e/flow.spec.ts：管理员注册→买家登录搜索→草稿→确认→取消；库存3→1→3 |
| E02 状态/失败/重试 | auth/products/orders三个浏览器流程中的权限、空结果、连接失败、响应丢失重试和重复点击 |
| G01 | screen/codegen/schema检查及既有不兼容API测试 |

以上为本次实际覆盖的关键风险，不声称穷尽所有故障或压力组合。配备与运用验证仍属于Step14。
