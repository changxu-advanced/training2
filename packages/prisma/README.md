# Prisma 生成流程

Prisma 7.10.0、Client 和 PostgreSQL adapter 版本一致并固定。SQL migrations 是数据库唯一维护入口，不能通过 Prisma Migrate 管理结构或手改 schema.prisma 的业务模型。

## 生成与使用

在容器内运行 pnpm prisma:generate：创建临时空 DB、应用全部 SQL migrations、写入仅含 generator/datasource 配置的临时文件、执行 prisma db pull，再执行 prisma generate。完成后删除临时 DB 和临时配置文件。不会依赖开发 DB 的手动改动。

Git 保存生成的 schema.prisma，用于审查；generated/ Client 在生成时创建并由 Git 忽略。pnpm prisma:check 从空库重建 schema，比较保存的版本，并生成 Client。新环境在安装后先执行这个命令，再进行类型检查、测试和构建；Dev Container 初始化和 CI 已接入。

API 后续从 @training2/prisma 使用 createPrismaClient(connectionString)，并在关闭时调用 $disconnect。src/index.ts 提供 PostgreSQL driver adapter，构建输出包含生成 Client。连接地址由调用方提供，不在包内创建 dotenv 读取机制。

Prisma config 仅使用进程提供的 DATABASE_URL，未导入 dotenv/config。schema.prisma 中没有连接密码。SQL CHECK、表达式索引和触发器可能不能完整映射为 Prisma 模型；它们仍由迁移和 Step3 的实际 DB 测试保证。

## 验证

只新增一个真实数据库集成测试，覆盖生成 Client 的写入、读取和事务回滚。模型复现通过 prisma:check 校验，其他数据库边界复用已有 Step3 测试。
