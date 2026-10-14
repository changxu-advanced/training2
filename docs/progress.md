# training2 当前进度

更新日期：2026-10-13。

## Step0 规格已准备

状态：完了。已建立业务需求、架构说明和带 ID 的验收场景。原文未明确的细节采用 requirements.md 中的默认设计，不增加支付、配送或独立购物车。经用户授权后提交 2c4dd88 已首次推送至 main。

## Step1 开发环境已验证

状态：完了。已补齐缺失容器文件，启动开发容器、PostgreSQL 和 cognito-local，并用最终配置重建。

| 检查 | 结果 |
| --- | --- |
| Docker Desktop 和 Compose | 28.1.1 和 2.35.1；引擎可访问 |
| VS Code 和 Dev Containers | 已安装；已打开容器工作区；容器中 VS Code server 已启动 |
| Node / pnpm | 26.10.0 / 12.9.1，与计划一致 |
| PostgreSQL | 17.6，实际连接 training2 成功，数据库容器健康 |
| 开发 CLI | Codex 0.162.1、GitHub CLI 2.102.0、AWS CLI 2.37.13、Docker 29.9.0，已固定 |
| 安装 | 容器内 frozen lockfile 安装成功，重建后可重复 |
| 类型检查 | 四个应用和七个共享包骨架通过 |
| 构建 | 两个 Vue/Vite 前端、两个 Hono API 和共享包通过 |
| 格式和 lint | 最终检查通过 |
| 应用启动 | 3000/3001 的 health 与 5173/5174 页面入口均返回 200 |
| 认证连接 | Amplify SDK 登录管理员和买家；JWT RSA、issuer、client、token_use、sub、组验证通过 |
| 认证异常 | 篡改签名、错误 issuer/client/token 用途以及模拟到期后的原签名 token 均拒绝 |
| 认证重建 | 账号和池通过数据卷保留；初始化脚本重复运行通过 |
| .env 限制 | Compose 启动关闭隐式读取；Vite envDir=false；构建排除；Git 忽略 |

当前页面只是环境就绪占位页，API 只有 health。Step1 时没有实现商品、订单、正式认证页面或数据库业务 schema；数据库进展见下面 Step3。当前 Amplify 检查在 Node 中运行 SDK；浏览器登录的实际 UI 在后续阶段验证。

## Step2 检查基盘

Step0/1 首次推送已完成。仓库为 changxu-advanced/training2，容器内 GitHub 已由本人完成登录；Git 使用 HTTPS 凭据连接同一仓库。Step2 分支为 step/02-ci-foundation。

Step2 已实现 CI、Husky 提交钩子、config 和 logger、Node Test Runner/Chai 测试、测试推进说明，以及 step-workflow 技能。容器内 pnpm check 通过；10 个实际测试通过；人为引入类型和格式错误均被检查拒绝；技能校验通过。PR：[Step2 检查基盘](https://github.com/changxu-advanced/training2/pull/1)。GitHub CI 的当前结果以该 PR checks 为准。状态为完了；2026-10-13 用户授权合并 PR #1，main 合并提交 21357f0。


## Step3 数据库契约

状态：完了。商品、订单、明细、约束、索引、状态枚举和更新时间触发器已由 0001_initial.sql 定义。迁移 runner 保存 SHA256 历史、检查连续编号并用事务和 advisory lock 处理重复或并发执行。

开发库已通过迁移初始化，示例商品已写入。13 个实际 PostgreSQL 测试通过，与 Step2 合计 23 个测试。最新结构从临时空库生成并提交 schemas/current.json；检查命令验证可重复。CI 已加入同版本 PostgreSQL，当前结果以 [PR #2](https://github.com/changxu-advanced/training2/pull/2) checks 为准。详见 database.md。


## Step4 Prisma 生成

Step3 PR #2 已于 2026-10-13 经用户授权合并。Step4 使用 Prisma 7.10，从临时空 PostgreSQL 应用 SQL 后生成 schema 和 Client；Schema 提交 Git，Client 构建时生成。只新增一项 Client 读写/事务回滚集成测试。本地模型复现及 pnpm check 已通过，共 24 个测试。schema-to-types 技能校验通过。状态为完了，用户已授权合并。[PR #3](https://github.com/changxu-advanced/training2/pull/3) 的最新 checks 为 GitHub CI 结果依据，合并后再进入 Step5。


## Step5 API 契约与生成

状态：完了。用户授权合并 Step5 PR #4，main 合并提交 71bc4ce。8 个业务操作及其正常/异常响应、认证要求已定义。OpenAPI 与类型化 Axios Client 可重建，纯 Zod 表单入口与服务代码分离；当前业务未实现返回 501。只新增两个关键测试，与已有检查合计 26 个。兼容性用固定版 oasdiff 在 CI 对基线比较；首次无基线时允许初始化，测试已验证 endpoint 删除会失败。PR 最新 checks 是 CI 结果依据。详见 api.md。


## Step6 认证与权限

状态：完了。用户授权合并 Step6 PR #5，main 合并提交 8309de3。两个 API 已接入 access token 验证和管理员限制；共享库提供订单所有者限制，Step11 再与真实订单结合。开发模拟器初始化及 Amplify 实际登录接入正式验证库；生产禁用 local 模式。新增两个 RSA/权限组合测试，合计 28 个测试。容器内 pnpm check、codegen:check 和 Amplify 实际登录/JWKS 验证通过；GitHub CI 以 PR 最新 checks 为依据。详见 auth.md。


## Step7 后端共通处理

状态：完了。用户授权合并 Step7 PR #6，main 合并提交 cbc2643。两个 API 使用共通运行模块接入 config、Prisma、认证、CORS、日志、DB 健康检查和退出清理。所有业务响应按契约在发送前验证；不合法响应改为经独立检查的 500，不返回或记录原始内容，不递归。DTO 显式投影 bigint 日元与 ISO 日期，提供测试库工具。只新增两个集成测试，总计 30 个；容器内 pnpm check、codegen:check，以及两个 HTTP 服务实际启动/DB 健康/正常退出均通过。开发 API 已更新至此实现。CI 以 PR 最新 checks 为依据。详见 backend.md。


## Step8 页面契约

状态：完了。用户授权合并 Step8 PR #7，main 合并提交 e2d4006。定义 7 个页面、两端计划路由（含首页跳转）及 6 组浏览器业务场景，记录权限、输入/API、迁移和加载/空/成功/失败反馈。页面文档由正本生成；CI 检查路由、API、验收/E2E 对应与生成差异。路由和浏览器业务测试仍明确为 planned，Step9〜12 再与实际 Vue Router/Playwright 接入，不能算作当前业务通过。仅新增两个检查器组合测试，总计 32 个；容器内 pnpm screen:check、pnpm check 和 screen-contract 技能校验通过。CI 以 PR 最新 checks 为依据。详见 screen-contracts.md 和 screens.generated.md。


## Step9 前端框架与登录

状态：完了。用户授权合并 Step9 PR #8，main 合并提交 3e571fd。两个 Vue 前端使用共享布局、Element Plus、TanStack Query、生成 Axios Client 和 Amplify；实际7个路由与契约验证，登录/退出、权限与安全回跳、表单校验、错误反馈已接入。商品/订单业务尚未实现时展示明确提示，不显示假成功。新增2个 Vitest 组合用例及1组真实浏览器认证流程；pnpm check（34个单元/集成测试）、screen:check、Playwright均通过，已目视检查买家登录和管理商品表单。CI新增模拟器/浏览器执行，最新结果以PR checks为准。实际商品/订单 E2E 仍有5组 planned。详见 frontend.md。


## Step10 商品功能

状态：完了。用户授权合并 Step10 PR #9，main 合并提交 5063e1d。商品注册、管理列表、公开字面搜索、分页和库存查询已接入真实数据库，前端显示商品说明/价格/库存及刷新。注册201、重复409、权限401/403与输入400已验证；库存更新通过查询缓存安全反映到页面。新增1个组合DB/API测试及1个真实商品浏览器场景，累计35个单元/集成测试和2组浏览器流程。pnpm check、针对最终改动的检查、screen/codegen一致性及Playwright通过；CI以PR最新checks为依据。订单业务与4组订单/完整流程E2E仍待Step11〜12。详见 products.md。


## Step11 订单与库存事务

状态：完了。用户授权合并 Step11 PR #10，main 合并提交 07099ec。四个订单操作已实现所有者限制、价格快照、owner/key幂等、排序行锁、库存/状态原子更新和有限事务重试。页面接入创建/确认/取消与缓存刷新。新增2个实际数据库测试及1组真实浏览器流程，累计37个单元/集成测试和3组浏览器流程；数据库实际重叠锁等待下成功1/不足1/库存0，响应丢失后的创建重试及状态库存5→3→5通过。容器内 pnpm check、screen/codegen检查和Playwright均通过；CI以PR最新checks为依据。剩余 E2E-FLOW 和强化并发/故障注入在Step12，不以基本竞争代替重点验收。详见 orders.md。


## Step12 重点验证

状态：レビュー待ち。新增3组真实DB组合测试覆盖重复确认/取消、确认取消竞争、多商品逆序锁、同key竞争、半途写入回滚/释放锁和SQL序列化错误重试上限；另有仅测试用途的乐观CAS版本冲突/重读比较，生产仍为悲观锁。新增1组完整管理员注册→买家取消的浏览器流程，6个场景ID全部实施，CI强制对应无缺漏。累计40个单元/集成测试和4组浏览器流程；容器内pnpm check、Playwright、空库SQL/Prisma再生成、结构/API/屏幕一致性检查均通过。CI以PR最新checks为准；详见 verification.md。


## 订单选择交互修正

状态：レビュー待ち。独立于尚待合并的 Step13，从 main 修正创建页数量即时限制（1到min(最新库存,1000)）、零库存选择、取消确认与选择缓存清理；继续选购保留选择，API草稿/确认库存规则保持原设计。

容器内 pnpm check（既有40个单元/集成测试）通过，最终UI类型/前端构建与screen生成一致性通过；4组浏览器流程通过，在既有订单场景增加即时负数/小数/超库存及1000上限、边界按钮、保留/关闭/确认取消、SPA重新选择无旧商品断言，未增加测试数量。服务端库存变化仍实际验证。已目视检查更新页面；CI以此修复PR checks为准。

订单详情交互追加：已确认隐藏确认按钮，取消按钮使用柔和红色并右对齐于金额下方；取消请求中及已取消隐藏全部操作，失败恢复可重试。复用原订单生命周期浏览器场景验证已确认/已取消按钮消失，并用延迟真实取消请求验证请求中立即隐藏两按钮及处理中提示。容器pnpm check和4组既有浏览器流程通过，最终追加断言的订单场景也通过；已目视确认柔和红色与金额右对齐。更新原修复PR #13，CI以最新提交checks为准。


## 日文界面与公司品牌调整

2026-10-14，状态：レビュー待ち。商品登记价格非负、初始库存0～2000即时限制；两端七个页面、错误/确认反馈与Element Plus组件日文化，原样引入公司SVG，配色改为深蓝/浅灰蓝。复用现有测试验证交互与业务流程，不新增重复测试。

容器内 pnpm check（40个既有单元/集成测试）、最终两端构建、页面生成一致性及4组浏览器流程通过；原商品流程增加非负价格、库存0～2000、整数/边界按钮、日文lang与Logo断言，未增加测试数量。已目视检查桌面和390px窄屏，组件残留英文辅助标签补为日文。商品登记库存2000是页面暂定范围，API/DB契约保持兼容。Docker重建后GitHub登录需恢复，PR/CI以实际推送后记录为准。

## 自动库存与多人确认验证（2026-10-14）

先运行既有8组后端真实DB验收及不同买家成功确认优先用例，再实现提交后库存通知、两端SSE、后台缓存更新及柔和蓝色列表。库存不足禁用选择/创建/确认；选中数量不被静默改变。两个新增关键DB组合测试及一个双买家浏览器组合场景；数量控件保持原DOM节点。

本地验收记录：42个单元/集成测试，5组浏览器流程；包括最后一件竞争、幂等确认取消、草稿创建顺序不影响确认优先、回滚不通知、跨连接推送、双买家售罄/恢复、断线补查和DOM保留。正式实现、依赖及检查均在容器内，未读取/修改/提交.env。用户已授权推送及合并；集成状态以PR #13 mergedAt为准。

## 统一订单入口与本人订单管理（2026-10-14）

状态：レビュー待ち。导航统一「注文」，沿用/orders/new；未选择商品时显示本人订单列表/状态筛选、无历史空白提示及底部新建按钮，有所选商品时显示创建表单。新增GET /orders按JWT sub限定查询、分页及最新优先，返回当前库存是否允许确认。列表/详情共用确认和取消弹框，关闭不发请求；已确认仅取消，已取消无操作，库存不足禁止确认。

复用原订单后端组合测试增加本人列表、状态、分页、401/拒绝指定owner验证；新增一个统一入口浏览器组合场景。42个单元/集成测试及6组浏览器流程覆盖本次改动；原有通知测试等待独立连接回调，消除调度竞态。API/屏幕生成及兼容性检查通过，正式操作均在容器内，无.env读写。集成状态以本次PR为准。
