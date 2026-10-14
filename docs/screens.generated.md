# 页面契约（自动生成）

源：packages/screen-contracts/src/index.ts；请勿手改。实际路由由 Vue Router 构建并验证；各 E2E 场景实施状态见下表，运行结果见进度记录。

根路由 / 在两端跳转 /products。权限 owner 包含已登录要求，服务器仍验证订单所有者。

## PUB-PRODUCT-CREATE · 商品登録（共通入口・管理者専用）

- 端：public；路由：/products/new；权限：admin
- 输入：code、name、description、priceJpy、stock
- 输入契约：@training2/api-contracts/inputs#productInput
- API：private:registerProduct、private:getProduct、private:restockProduct
- 认证 SDK：无
- 遷移：PUB-LOGIN、PUB-PRODUCTS
- 验收：AC-P01、AC-P03、AC-P08、AC-P09、AC-A03

| 状态 | 页面反馈 |
| --- | --- |
| idle | 管理员登记商品，顾客无入口且直接URL拒绝；restock查询参数选定已有商品，自动填入只读信息，追加数量默认1，范围1～2000；按增量补货且保留同次提交key避免重复 |
| loading | 提交禁止重复 |
| empty | 提示必填 |
| success | 登记后回商品一覧，顾客收到自动更新 |
| error | 401登录，403权限提示，409重复，保留输入 |

## PUB-LOGIN · 共通ログイン

- 端：public；路由：/login；权限：any
- 输入：username、password、returnTo（仅同站受保护路由）
- 输入契约：Amplify signIn
- API：无业务 API
- 认证 SDK：signIn、signOut、fetchAuthSession
- 遷移：PUB-PRODUCTS、PUB-ORDER-CREATE、PUB-ORDER
- 验收：AC-A01、AC-O07、AC-E02

| 状态 | 页面反馈 |
| --- | --- |
| idle | 显示登录表单 |
| loading | 登录按钮禁用 |
| empty | 提示填写账号与密码 |
| success | 安全跳转回来源页，默认商品页 |
| error | 登录失败或会话到期提示，不回显密码 |

## PUB-PRODUCTS · 商品検索と在庫

- 端：public；路由：/products；权限：any
- 输入：code、name、page、pageSize、所选商品与数量、inStock（有库存筛选）
- 输入契约：searchProducts request；数量由 orderInput 验证
- API：searchProducts、getStock、private:listProducts
- 认证 SDK：无
- 遷移：PUB-LOGIN、PUB-ORDER-CREATE、PUB-PRODUCT-CREATE
- 验收：AC-P05、AC-P06、AC-P07、AC-E01、AC-E02

| 状态 | 页面反馈 |
| --- | --- |
| idle | 显示搜索条件；件数左侧筛选按钮未选中显示在庫ありのみ，选中显示在庫ありのみを解除并保持蓝色，两种文案的右边缘均与商品选择按钮对齐，文字变长向左扩展；服务器跨页过滤及计数，切换回第一页，搜索条件保留且库存变化自动更新 |
| loading | 仅首次加载展示占位；后台自动更新保留列表、搜索、分页和滚动 |
| empty | 没有匹配商品，可清空条件 |
| success | 显示代码、名称、说明、JPY价格、自动更新库存和分页；仅商品选择按钮，零库存不可选择 |
| error | 保留条件并支持重试，501提示功能未实现 |

## PUB-ORDER-CREATE · 注文管理・新規作成

- 端：public；路由：/orders/new；权限：authenticated
- 输入：items(productId,quantity)、Idempotency-Key（同一次创建/重试保持 UUID）
- 输入契约：@training2/api-contracts/inputs#orderInput
- API：listOrders、deleteCancelledOrders、createOrder、getStock、confirmOrder、cancelOrder
- 认证 SDK：无
- 遷移：PUB-LOGIN、PUB-PRODUCTS、PUB-ORDER
- 验收：AC-O11、AC-O09、AC-O10、AC-O08、AC-O01、AC-O02、AC-O03、AC-O04、AC-O05、AC-O07、AC-E01、AC-E02

| 状态 | 页面反馈 |
| --- | --- |
| idle | 统一订单入口：没有所选商品时显示本人的订单列表，按状态筛选，未确定可确认/取消，已确定仅取消，已取消无操作；所有操作先确认；顶部状态筛选右侧新建订单进入商品选择；清理本人全部已取消订单需确认，数据库逻辑删除保留幂等记录。有所选商品时显示所选明细，重查库存；数量即时限制为1到min(库存,1000)的整数；零库存禁用；不允许输入价格或所有者 |
| loading | 仅首次查询库存时禁用输入/创建；后台更新保留输入节点，库存不足提示并禁用创建，不自动改变已选数量；提交中禁止重复点击或取消选择，不创建新key |
| empty | 无历史订单显示空白提示及创建新订单按钮；状态筛选无结果另有提示 |
| success | 201或200跳转订单详情；取消选择需确认，确认清空全部选择/数量/key并返回商品页，保留或关闭不清空 |
| error | 保留明细及key，输入/商品不存在/幂等冲突分别提示 |

## PUB-ORDER · 注文詳細・確定・キャンセル

- 端：public；路由：/orders/:id；权限：owner
- 输入：id(UUID)、confirm/cancel 操作
- 输入契约：getOrder/confirmOrder/cancelOrder path
- API：getOrder、confirmOrder、cancelOrder
- 认证 SDK：无
- 遷移：PUB-LOGIN、PUB-PRODUCTS
- 验收：AC-O06、AC-O07、AC-P07、AC-S01、AC-S02、AC-S03、AC-S04、AC-S05、AC-S06、AC-E01、AC-E02

| 状态 | 页面反馈 |
| --- | --- |
| idle | 等待订单加载 |
| loading | 加载中；操作中禁止重复点击 |
| empty | 不存在或非本人统一显示未找到订单 |
| success | 展示draft/confirmed/cancelled、价格快照及金额；草稿显示确认/取消，已确认仅显示柔和红色取消按钮且在右下与金额右侧对齐；取消请求期间及已取消隐藏两个按钮，失败可重试；自动更新草稿库存，不足禁止确认；操作后刷新订单与库存 |
| error | 401转登录；404统一未找到；409显示库存/状态冲突；503可重试 |

## ADM-LOGIN · 管理者ログイン

- 端：private；路由：/login；权限：any
- 输入：username、password、returnTo（仅管理端受保护路由）
- 输入契约：Amplify signIn
- API：无业务 API
- 认证 SDK：signIn、signOut、fetchAuthSession
- 遷移：ADM-PRODUCTS、ADM-PRODUCT-CREATE
- 验收：AC-P03、AC-A01、AC-E02

| 状态 | 页面反馈 |
| --- | --- |
| idle | 显示管理员登录表单 |
| loading | 登录按钮禁用 |
| empty | 提示填写账号与密码 |
| success | 验证admin组后进入管理页 |
| error | 登录失败、会话到期或非管理员提示 |

## ADM-PRODUCTS · 商品一覧（管理）

- 端：private；路由：/products；权限：admin
- 输入：page、pageSize
- 输入契约：listProducts request
- API：listProducts
- 认证 SDK：无
- 遷移：ADM-LOGIN、ADM-PRODUCT-CREATE
- 验收：AC-P01、AC-P03、AC-P06、AC-E01、AC-E02

| 状态 | 页面反馈 |
| --- | --- |
| idle | 显示列表入口 |
| loading | 显示加载状态 |
| empty | 无商品或末页外时提供注册/上一页入口 |
| success | 按代码升序显示产品和分页，自动更新商品和库存；每行库存右侧提供在庫を追加，跳转登记页预填信息；商品登録移至件数左侧同一行，和补货按钮左边缘对齐、大小及描边悬停样式相同；浅蓝表头及条纹行 |
| error | 401转登录；403无管理权限；其他错误可重试 |

## ADM-PRODUCT-CREATE · 商品登録

- 端：private；路由：/products/new；权限：admin
- 输入：code、name、description、priceJpy、stock
- 输入契约：@training2/api-contracts/inputs#productInput
- API：registerProduct、getProduct、restockProduct
- 认证 SDK：无
- 遷移：ADM-LOGIN、ADM-PRODUCTS
- 验收：AC-P09、AC-P08、AC-P01、AC-P02、AC-P03、AC-P04、AC-E01、AC-E02

| 状态 | 页面反馈 |
| --- | --- |
| idle | 已有商品补货复用登记表单，只读信息自动填写，追加数量默认1且限制1～2000；日文登记表单；价格即时限制非负整数，初期库存即时限制0～2000；公司Logo与柔和蓝色 |
| loading | 提交按钮禁用 |
| empty | 必填缺失提示 |
| success | 201后返回管理列表并刷新商品查询 |
| error | 400显示字段问题；409重复代码；401/403权限提示；保留输入 |

## 浏览器业务场景

以下映射不代表测试已运行；路由存在检查不能替代业务 E2E。

### E2E-ORDER-HISTORY

- 状态：implemented；阶段：Step11；实际 spec：tests/e2e/order-history.spec.ts
- 页面：PUB-ORDER-CREATE、PUB-ORDER
- 验收：AC-O09、AC-O10、AC-O11
- 操作：统一入口空白/历史、状态过滤、本人订单权限；确认框返回不提交；确认/取消后刷新状态按钮及库存
- 预期：他人订单不展示；未确定/确定/取消操作正确；顶部创建新订单；取消清理不发送DELETE，确认后仅删除本人全部已取消订单

### E2E-AUTH

- 状态：implemented；阶段：Step9；实际 spec：tests/e2e/auth.spec.ts
- 页面：PUB-LOGIN、PUB-PRODUCT-CREATE、ADM-LOGIN、ADM-PRODUCTS、ADM-PRODUCT-CREATE、PUB-ORDER-CREATE、PUB-ORDER
- 验收：AC-A01、AC-P03、AC-P01、AC-P08、AC-A03、AC-O07、AC-E02
- 操作：登录/退出与过期会话处理；未登录跳转，买家不能进入管理页，API仍返回401/403
- 预期：returnTo仅允许同站路由；不展示受保护数据；错误状态清晰

### E2E-PRODUCTS

- 状态：implemented；阶段：Step10；实际 spec：tests/e2e/products.spec.ts
- 页面：ADM-PRODUCT-CREATE、PUB-PRODUCT-CREATE、ADM-PRODUCTS、PUB-PRODUCTS
- 验收：AC-P09、AC-P08、AC-P01、AC-P02、AC-P03、AC-P04、AC-P05、AC-P06、AC-E01、AC-E02
- 操作：管理员注册后在两端查找商品；验证重复代码、非法输入、搜索组合及空分页
- 预期：代码规范化、商品只写入一次；价格和库存正确；搜索字面匹配；错误不丢输入

### E2E-ORDER-CREATE

- 状态：implemented；阶段：Step11；实际 spec：tests/e2e/orders.spec.ts
- 页面：PUB-PRODUCTS、PUB-ORDER-CREATE、PUB-ORDER
- 验收：AC-O08、AC-O01、AC-O02、AC-O03、AC-O04、AC-O05、AC-O07、AC-E01、AC-E02
- 操作：选多商品创建草稿；数量即时限制；确认取消选择后清空缓存并重新选择；超时重试/双击；同key同输入和不同输入；异常商品与数量
- 预期：同一次提交保留key，重试只生成一单；价格快照由服务器决定；创建不扣库存；数量边界禁用；取消确认/保留、重新选择无旧缓存

### E2E-ORDER-OWNER

- 状态：implemented；阶段：Step11；实际 spec：tests/e2e/orders.spec.ts
- 页面：PUB-LOGIN、PUB-ORDER
- 验收：AC-O06、AC-O07
- 操作：切换买家及管理员账号访问其他人的订单；尝试查看、确认、取消
- 预期：统一404，不泄露订单；库存与状态不变

### E2E-ORDER-STOCK

- 状态：implemented；阶段：Step11；实际 spec：tests/e2e/orders.spec.ts
- 页面：PUB-PRODUCTS、PUB-ORDER
- 验收：AC-P07、AC-S01、AC-S02、AC-S03、AC-S04、AC-S05、AC-S06、AC-E01、AC-E02
- 操作：足量确认、重复确认、取消和重复取消；多商品部分不足；查看快照后库存改变；确认已取消订单
- 预期：库存轨迹符合验收规格，失败全回滚；操作前弹确认框，返回不发请求；操作后刷新状态及库存，重复提交不重复扣减/返还

### E2E-FLOW

- 状态：implemented；阶段：Step12；实际 spec：tests/e2e/flow.spec.ts
- 页面：PUB-LOGIN、PUB-PRODUCTS、PUB-ORDER-CREATE、PUB-ORDER、ADM-LOGIN、ADM-PRODUCTS、ADM-PRODUCT-CREATE
- 验收：AC-E01、AC-E02
- 操作：管理员登录注册→买家登录搜索→创建→确认→取消；观察加载、空数据、失败、重试和重复点击；双买家确认后售罄/取消恢复、断线重连补查及输入/列表DOM保留
- 预期：完整浏览器流程完成；每一步订单与库存展示正确

