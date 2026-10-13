# training2 当前进度

更新日期：2026-10-13。

## Step0 规格已准备

状态：レビュー待ち。已建立业务需求、架构说明和带 ID 的验收场景。原文未明确的细节采用 requirements.md 中的默认设计，不增加支付、配送或独立购物车。尚未提交合并，因此按实施计划不标为完了。

## Step1 开发环境已验证

状态：レビュー待ち。已补齐缺失容器文件，启动开发容器、PostgreSQL 和 cognito-local，并用最终配置重建。

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

当前页面只是环境就绪占位页，API 只有 health。没有实现商品、订单、正式认证页面、数据库业务 schema 或业务测试。当前 Amplify 检查在 Node 中运行 SDK；浏览器登录的实际 UI 在后续阶段验证。

## 下一步依赖

本地 Git 仓库为 main，origin 为 git@github.com:changxu-advanced/training2.git。通过 HTTPS 只读检查可访问仓库，没有 refs。容器 GitHub 登录等待本人在浏览器授权；尚未提交或推送。

implementation-plan 明确要求 Step1 后由用户首次推送，Step2 起按独立分支、验证、PR、合并推进。需要完成初次提交推送后，才开始 Step2 的 CI、commit hook、config 和 logger。
