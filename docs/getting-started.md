# training2 开始开发

开发容器已于 2026-10-13 首次启动。代码保存在 Windows 的 training2 文件夹，开发命令必须在容器终端运行。

## 在 VS Code 中操作

打开的容器窗口左下角应出现容器连接标记。选择 Terminal → New Terminal，在终端运行 pwd，应为 /workspaces/training2，运行 test -f /.dockerenv 应成功。不要在 Windows 终端安装项目依赖。

容器提供 Node 26.10.0、pnpm 12.9.1、PostgreSQL 客户端、GitHub CLI、AWS CLI、Docker 和 Codex CLI 0.162.1。

## 首次使用 Codex CLI

在容器终端运行 codex login --device-auth，按照提示在浏览器完成自己的账号登录。登录是个人账号操作，不自动复制 Windows 登录凭据。然后在项目目录运行 codex。设备登录方式见 [OpenAI 官方认证说明](https://learn.chatgpt.com/docs/auth)。当前桌面聊天也可以通过容器执行开发命令；窗口连接并不会把桌面聊天的运行环境自动切换成 Linux。

## 常用命令

在容器内运行：

- pnpm check:environment：检查 Node、pnpm、DB 和 Codex。
- pnpm typecheck：检查应用和共享包的类型。
- pnpm build：构建骨架。
- pnpm lint：检查代码格式和基本规范。
- pnpm seed:cognito：初始化本地账号并验证认证连接。
- pnpm dev:public-frontend：买家页面，5173。
- pnpm dev:private-frontend：管理页面，5174。
- pnpm dev:public-api：买家 API，3000。
- pnpm dev:private-api：管理 API，3001。

分别在四个容器终端启动应用。通过 VS Code Ports 面板访问前端。此阶段页面只显示开发骨架，API 只有 /health，没有商城业务接口。pnpm test 当前执行 config/logger 和 PostgreSQL 的实际测试；商品、订单 API 和浏览器业务测试尚未实现，不将无测试包计为已验证。

## 配置和数据

Docker Desktop 已运行时，可在 Windows PowerShell 的项目目录执行 `.\.devcontainer\start.ps1`，启动容器并打开对应的 VS Code 窗口。此启动器使用 Windows 上现有的 Node 仅执行容器启动工具，项目依赖仍安装在容器内。

Compose 显式提供本地配置。运行任何 Compose 或 Dev Container 启动命令前，在 Windows PowerShell 设置 $env:COMPOSE_DISABLE_ENV_FILE='true'，避免 .env 自动读取；详细行为见 [Docker 官方文档](https://docs.docker.com/compose/how-tos/environment-variables/envvars/)。启动器已设置该变量。两个前端的 Vite 配置通过 envDir: false 关闭 .env 自动加载。不要读取、改动或提交 .env。

认证模拟服务的容器端口为 9229，Windows 和浏览器使用 `http://localhost:9230`。9229 在首次启动时与本机监听端口冲突，因此选用 9230。issuer 同样采用 9230，服务端访问 JWKS 使用容器服务地址。DB 通过 5432 发布，API 和前端通过 VS Code 转发，避免对同一端口重复转发。

数据库和认证模拟服务使用命名卷，容器重启后保留数据。删除卷会删除数据，不作为日常启动步骤。首次构建需要访问镜像仓库、npm、Debian、GitHub 和 AWS 下载服务。

## 下一阶段

阅读 requirements.md 的默认业务规则和 acceptance-scenarios.md。Step0/1 已验证并首次推送。Step2 已合并。Step3 已建立 SQL 数据库契约并扩展实际 DB 检查；完成对应 PR 后，Step4 从 SQL 迁移结果生成 Prisma。
