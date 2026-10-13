# 后端运行与响应验证

public/private API 通过 @training2/backend 启动，共用 config、Prisma、auth 与 logger。启动前真实查询数据库，失败停止启动；GET /health 每次检查数据库，返回 200 或 503，属于基础设施接口。SIGINT/SIGTERM 停止接收请求，最多等待 10 秒后关闭剩余连接并释放 Prisma；重复关闭不重复释放。

跨域仅允许配置中的前端 origin，OPTIONS 不要求登录；允许 Authorization、Content-Type、Idempotency-Key，公开 X-Request-Id。请求 ID 由服务器生成，响应与错误使用同一 ID。请求日志只记 service、method、status、duration 和 ID，不记 URL 参数、请求体、token 或用户数据。未预期异常仅记固定分类，客户端收到通用 INTERNAL_ERROR。

业务路由在发送前按 Route Definition 的状态码和 JSON 响应 schema 验证，包括输入、认证、权限错误与当前 501。未声明状态、非 JSON、缺少或越界字段都被替换为经独立 errorSchema 检查的 500；日志只包含操作名、状态和请求 ID。兜底直接替换 Response，不重新进入处理链，防止递归。health、OpenAPI 和未匹配的 404 不属于业务响应契约。

DTO 采用明确字段投影：数据库 bigint 日元先检查安全整数范围，再转换为 JSON number；日期转换为 ISO 字符串。产品不公开数据库时间字段；订单不公开 owner_sub、idempotency_key、request_items。投影后再通过对应 schema 检查。禁止直接序列化 Prisma 模型。

后续职责：API handler 处理输入/身份和响应；业务 service 负责所有者、状态、金额以及事务边界；repository 只负责数据库查询，接受 service 的 transaction client。在 Step11 的 service 内完成锁定、状态及库存更新，同一事务成功后返回 DTO。

@training2/test-utils 的 withTestDatabase 为每个集成测试创建独立数据库、应用 SQL 并最终清理；jsonResponse 简化 API 响应断言。本 Step 只新增两个组合测试，覆盖真实数据库连接、权限/CORS、DTO 和不合法响应的安全兜底。未实现业务仍返回 501。
