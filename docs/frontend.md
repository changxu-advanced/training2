# 前端启动与验证

统一登录入口 http://localhost:5173：顾客显示商品浏览/注文管理，管理员显示商品一覧/商品登録。http://localhost:5174 是独立管理入口。两端共享 packages/ui 的 Vue/Element Plus 布局、表单、状态提示和登录管理；路由由两端 route-manifest 构造，运行时及 Vitest 使用 router.getRoutes() 与 Screen Contract 对照。所有8个页面路由已经实现，未知路径回到商品页。

开发账号：buyer@training2.test、admin@training2.test，密码 Training2-local-2026!，仅为本地模拟器账户。管理端拒绝买家；订单路由要求登录。登录只允许跳回已知同端站内页面，拒绝外部 URL；退出/身份失效清除用户查询缓存及私有草稿。访客选择商品后登录可保留当前选择。

Amplify 管理会话与刷新；顾客 REST 使用 Axios，管理员商品功能使用 graphql-request，两种客户端都在每次受保护请求时取得 access token，不另存 token。401 返回登录，403、输入、超时及业务错误使用日文安全提示。TanStack Query 负责查询缓存、loading/error 与写入后的刷新，写操作默认不自动重试。商品与订单 API 已分别在 Step10/11 实现，可注册、搜索、创建草稿、确认与取消。写入与订单状态以服务器成功响应为准。

Vite 的本地 /auth-config.json 只返回忽略的 runtime/cognito.json 中的非秘密池/Client ID；/cognito 代理到本地模拟器，/api 代理到对应 API。构建不打包开发配置。部署时须提供非秘密 /auth-config.json（真实 Cognito 不传 localEndpoint）并配置同站 API 反向代理，见 Step14。Vite envDir=false，不读取 .env。

表单转换只在浏览器中把数量/价格输入转换为 number，通过 @training2/api-contracts/inputs 的纯 Zod productInput/orderInput 验证和规范化，不复制金额/长度规则；后端仍执行验证。创建草稿保留 UUID key 供同一次请求重试，输入改变后生成新 key。实际再送/库存行为已在 Step11 验证。

固定前端工具：vue-router 5.4.0、Element Plus 2.14.7、TanStack Vue Query 5.104.2、plugin-vue 6.0.10、vue-tsc 3.3.13、Vitest 5.0.4、Playwright 1.64.0。Vue 检查使用 TypeScript 5.9.3 的编译 API；其余包继续项目 TypeScript 7.0.2。Biome 不检查 .vue 的模板绑定，避免错误的 unused 自动修复；由 vue-tsc、Vite 和实际浏览器测试检查 SFC。vue-demi 的已核验安装脚本只选择 Vue3 兼容入口。

容器内 pnpm check 包含前端路由/错误处理与 GraphQL 客户端关键风险验证；pnpm screen:check 强制实现路由；PLAYWRIGHT_BROWSERS_PATH=/opt/playwright pnpm test:e2e 执行1组真实 Cognito 浏览器流程。首次以容器 root 执行 pnpm exec playwright install --with-deps chromium，设置同一浏览器目录供 node 使用。CI 启动临时模拟器并在容器内安装浏览器，运行真实登录、退出、权限、401 提示、站内跳转和表单验证/501 反馈；没有 mock 成功登录。商品浏览器场景已在 Step10 实现；3组订单场景已由 Step11 的一个组合浏览器测试覆盖；完整 E2E-FLOW 已在 Step12 实施。

统一入口的管理Client使用/admin-api代理到private API，复用相同令牌/401处理，不复制或另存令牌。顾客访问/products/new重定向商品页并提示无权限，不挂载登记表单；绕过页面调用管理商品API仍403。管理员订单路由返回商品一覧；顾客和管理员切换时清理查询及选择。页面契约apiBindings显式声明private API依赖并验证。

Training 3 阶段 2 将两个管理员入口的四项商品请求迁移到 GraphQL + 既有 Vue Query；阶段 3 又把买家 REST 读取的 AbortSignal 贯通到生成 Axios Client。实现、请求取消/账号隔离、SDL 检查及验收边界见 [Training 3](./training3.md)。
