# PostgreSQL 数据库契约

SQL migrations 是唯一维护入口。应用和 Prisma 后续均使用迁移产生的 PostgreSQL 定义，不手工修改开发库设计。

## 操作

在 Dev Container 中从根目录运行：

- pnpm db:migrate：按 0001 起的连续编号应用新增 SQL，保存 SHA256 历史。
- pnpm db:seed：加入本地示例商品，不重置已有库存；生产 NODE_ENV 下禁止执行。
- pnpm db:schema：创建专用临时 DB，应用迁移，生成 schemas/current.json，最后删除这个临时 DB。
- pnpm db:schema:check：同样从空库生成，并比较已提交的结构清单。
- pnpm --filter @training2/postgres test：实际 DB 约束、并发迁移、回滚和重建测试。

迁移脚本在一个事务中锁定迁移流程，检查已应用文件与历史的校验和，再执行所有新增 SQL。修改、删除或在历史前插入已应用迁移都会失败。修正结构需要添加新的连续编号 SQL，不改旧 SQL；迁移文件不能包含事务控制或 CREATE INDEX CONCURRENTLY。当前工具仅支持可在事务内执行的迁移。

测试与清单生成需要本地或 CI 数据库角色具备 CREATE DATABASE 权限。它们只删除自己生成的 training2_test_ 加随机 UUID 数据库，不清空开发库。生产 schema 迁移无需 CREATE DATABASE 权限；测试和清单生成不应对生产地址运行。

## 生成物与补助 SQL

Git 保存 migrations、开发 seed 和 schemas/current.json。schemas/current.json 从空数据库的系统目录查询生成，包含列、约束、索引、枚举、应用函数和触发器；不含数据和运行时间。不得手改清单。

需要的函数、触发器、扩展和索引均定义在迁移里，不在 tables/functions 等目录重复维护 SQL。seed 只包含示例数据。Prisma schema 和 Client 在 Step4 引入。
