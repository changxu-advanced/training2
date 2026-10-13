# 认证与权限

API 只接收 Bearer access token。@training2/auth 使用 aws-jwt-verify 验证 RSA 签名、issuer、到期时间、签发时间、token_use、client_id 与 sub；不信任前端声明的角色。订单操作须登录，private 商品操作须包含 admin 组。其他用户和管理员都不能借角色绕过 requireOwner；不属于本人的订单返回 404。实际订单读取及所有者检查在 Step11 接入数据库。

开发容器执行 pnpm seed:cognito 初始化管理员、买家、User Pool 和 Client，重复执行安全。脚本用 Amplify 实际登录，并经正式 auth 库从模拟器取得 JWKS 验证签名。非秘密连接配置写入被忽略的 .devcontainer/runtime/cognito.json。post-create 自动执行初始化。测试用户为 admin@training2.test 和 buyer@training2.test，开发密码 Training2-local-2026!；仅限本地模拟器。

本地默认 AUTH_MODE=local，模拟器地址 http://cognito-local:9229，浏览器地址 http://localhost:9230。issuer 与 JWKS 路径须匹配池，端点仅接受显式本地 HTTP 地址，生产模式拒绝 local。NODE_ENV=production 默认使用真实 Cognito，配置 COGNITO_USER_POOL_ID、COGNITO_CLIENT_ID；aws-jwt-verify 按真实池推导 AWS issuer 与 HTTPS JWKS。配置通过运行环境注入，不读取 .env。

浏览器从 @training2/auth/browser 导入 configureBrowserAuth、signIn、signOut、fetchAuthSession；本地传入池 ID、Client ID、localEndpoint，部署时省略 localEndpoint。取得 accessToken 后通过 Axios Authorization 发送；刷新由 Amplify 管理，禁止记录或另存 token。登录 UI 在 Step9 完成。

两个新增组合测试使用实际 RSA 签名 token 覆盖篡改、到期、issuer/client/用途、权限及生产配置边界；现有契约测试同时检查 API 的 401/403 和管理员放行。业务尚未实现的已授权请求仍返回 501。
