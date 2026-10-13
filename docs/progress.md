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

Step3 PR #2 已于 2026-10-13 经用户授权合并。Step4 使用 Prisma 7.10，从临时空 PostgreSQL 应用 SQL 后生成 schema 和 Client；Schema 提交 Git，Client 构建时生成。只新增一项 Client 读写/事务回滚集成测试。本地模型复现及 pnpm check 已通过，共 24 个测试。schema-to-types 技能校验通过。状态为レビュー待ち。[PR #3](https://github.com/changxu-advanced/training2/pull/3) 的最新 checks 为 GitHub CI 结果依据，合并后再进入 Step5。
