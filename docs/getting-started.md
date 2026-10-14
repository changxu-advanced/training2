# 启动与日常操作

## 进入开发容器

Windows 需要 Docker Desktop 已启动、VS Code 与 Dev Containers 扩展，以及供启动器使用的 Node。主机只负责启动容器；依赖安装、生成、实现和测试均在容器内进行。

在项目目录的 PowerShell 运行：

```powershell
.\.devcontainer\start.ps1
```

启动器设置 COMPOSE_DISABLE_ENV_FILE=true，打开 VS Code 的容器工作区。容器终端工作目录应为 /workspaces/training2；执行下面命令应输出该路径与成功状态：

```bash
pwd
test -f /.dockerenv
node --version
pnpm --version
```

固定 Node 26.10.0、pnpm 12.9.1。项目禁止读取、修改和提交 .env；Compose、前端、测试与文档工具关闭隐式加载，运行配置来自容器环境。首次创建的 post-create 自动安装、初始化认证与业务数据库、生成 Prisma 并检查 API 文档。已有容器更新代码后可在容器终端重复执行：

```bash
bash .devcontainer/post-create.sh /workspaces/training2
```

迁移与示例商品初始化可重复执行，不清空现有数据。数据库与认证数据保存在数据卷；日常启动不删除数据卷。

## 打开商城与文档

在四个容器终端分别启动，每个命令保持运行：

```bash
pnpm dev:public-api
pnpm dev:private-api
pnpm dev:public-frontend
pnpm dev:private-frontend
```

在 VS Code 的 Ports 面板确认端口转发。主入口 [localhost:5173](http://localhost:5173)、独立管理端 [localhost:5174](http://localhost:5174)；API 健康检查为 [3000/health](http://localhost:3000/health) 和 [3001/health](http://localhost:3001/health)。认证模拟器由 Compose 启动，浏览器地址为 localhost:9230，容器内地址为 cognito-local:9229。

验收可以使用三种方式：5173登录顾客验证购物；5173分别登录顾客与管理员验证统一入口；5174登录管理员验证独立管理端。两端共用相同API业务实现和数据库，5174管理页面与5173管理员页面功能一致。

本地账号为 admin@training2.test、buyer@training2.test、buyer2@training2.test 与 buyer3@training2.test，共用开发密码 Training2-local-2026!，仅适用于模拟器。管理员可登记商品及增量补货；买家可搜索、筛选有库存商品、查看实时库存、管理自己的草稿/已确认/已取消订单及清理已取消记录。草稿不扣库存，确认扣减，取消已确认订单返还一次。详细条件见 [业务规则](./requirements.md)。

第五个容器终端运行：

```bash
pnpm docs:dev
```

转发 5175 后打开 [文档站点](http://localhost:5175)。也可先 pnpm docs:build 再 pnpm docs:preview，产物为 docs/.vitepress/dist；该目录不提交 Git。

## 验证环境和生成产物

首次执行浏览器测试需安装 Chromium 与 Linux 系统库，后者需要容器 root 权限。主机 PowerShell 可只负责将安装动作送入容器：

```powershell
docker exec -u root -w /workspaces/training2 -e PLAYWRIGHT_BROWSERS_PATH=/opt/playwright training2-app-1 pnpm exec playwright install --with-deps chromium
```

随后在普通容器终端验证：

```bash
pnpm check:environment
pnpm db:schema:check
pnpm prisma:check
pnpm docs:check
pnpm check
PLAYWRIGHT_BROWSERS_PATH=/opt/playwright pnpm test:e2e
```

pnpm check 执行格式、类型、单元/集成测试和应用构建；浏览器测试、文档构建和契约一致性单独执行。Playwright 自动启动四个应用服务，本地已有实例会复用，CI 则独立启动，无需先手动启动商城；认证模拟器和 PostgreSQL 必须可连接。完整 CI 还比较 OpenAPI 基线。见 [验证方式](./testing.md) 和 [故障排查](./maintenance.md)。

GitHub 登录和提交在容器内进行。每一步使用 step/NN-* 分支和 PR；当前步骤合并后再开始依赖步骤，实际进度见 [进度记录](./progress.md)。
