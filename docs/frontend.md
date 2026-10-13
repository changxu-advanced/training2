# 前端启动与验证

买家端 http://localhost:5173，管理端 http://localhost:5174。两端共享 packages/ui 的 Vue/Element Plus 布局、表单、状态提示和登录管理；路由由两端 route-manifest 构造，运行时及 Vitest 使用 router.getRoutes() 与 Screen Contract 对照。所有7个页面路由已经实现，未知路径回到商品页。

开发账号：buyer@training2.test、admin@training2.test，密码 Training2-local-2026!，仅为本地模拟器账户。管理端拒绝买家；订单路由要求登录。登录只允许跳回已知同端站内页面，拒绝外部 URL；退出/身份失效清除用户查询缓存及私有草稿。访客选择商品后登录可保留当前选择。

Amplify 管理会话与刷新，Axios 每次受保护请求取得新的 access token，不另存 token。401 返回登录，403、输入、超时及业务错误使用中文安全提示。TanStack Query 负责查询缓存、loading/error 与写入后的刷新，写操作默认不自动重试。商品与订单 API 仍是诚实的 501，页面提示功能即将开放；Step10/11 实现对应业务。不能把可见表单当成商品已写入或订单已创建。

Vite 的本地 /auth-config.json 只返回忽略的 runtime/cognito.json 中的非秘密池/Client ID；/cognito 代理到本地模拟器，/api 代理到对应 API。构建不打包开发配置。部署时须提供非秘密 /auth-config.json（真实 Cognito 不传 localEndpoint）并配置同站 API 反向代理，见 Step14。Vite envDir=false，不读取 .env。

表单转换只在浏览器中把数量/价格输入转换为 number，通过 @training2/api-contracts/inputs 的纯 Zod productInput/orderInput 验证和规范化，不复制金额/长度规则；后端仍执行验证。创建草稿保留 UUID key 供同一次请求重试，输入改变后生成新 key。实际再送/库存行为在 Step11 验证。

固定前端工具：vue-router 5.4.0、Element Plus 2.14.7、TanStack Vue Query 5.104.2、plugin-vue 6.0.10、vue-tsc 3.3.13、Vitest 5.0.4、Playwright 1.64.0。Vue 检查使用 TypeScript 5.9.3 的编译 API；其余包继续项目 TypeScript 7.0.2。Biome 不检查 .vue 的模板绑定，避免错误的 unused 自动修复；由 vue-tsc、Vite 和实际浏览器测试检查 SFC。vue-demi 的已核验安装脚本只选择 Vue3 兼容入口。

容器内 pnpm check 包含2个新增 Vitest 用例；pnpm screen:check 强制实现路由；PLAYWRIGHT_BROWSERS_PATH=/opt/playwright pnpm test:e2e 执行1组真实 Cognito 浏览器流程。首次以容器 root 执行 pnpm exec playwright install --with-deps chromium，设置同一浏览器目录供 node 使用。CI 启动临时模拟器并在容器内安装浏览器，运行真实登录、退出、权限、401 提示、站内跳转和表单验证/501 反馈；没有 mock 成功登录。其余5组商品/订单业务 E2E 仍是 planned。
