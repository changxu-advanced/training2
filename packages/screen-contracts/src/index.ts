export type Scope = "public" | "private";
export type Screen = {
  id: string;
  scope: Scope;
  name: string;
  path: string;
  access: "any" | "authenticated" | "owner" | "admin";
  inputs: readonly string[];
  inputContract: string;
  apis: readonly string[];
  authActions: readonly string[];
  transitions: readonly string[];
  states: Record<"idle" | "loading" | "empty" | "success" | "error", string>;
  acceptance: readonly string[];
};
export type Scenario = {
  id: string;
  screens: readonly string[];
  acceptance: readonly string[];
  step: number;
  kind: "business";
  status: "planned" | "implemented";
  specFile?: string;
  actions: readonly string[];
  expectations: readonly string[];
};
export type RouteManifest = {
  scope: Scope;
  status: "planned" | "implemented";
  routes: readonly { screenId: string; path: string }[];
  redirects: readonly { path: string; to: string }[];
};
export const screens: readonly Screen[] = [
  {
    id: "PUB-LOGIN",
    scope: "public",
    name: "买家登录",
    path: "/login",
    access: "any",
    inputs: ["username", "password", "returnTo（仅同站受保护路由）"],
    inputContract: "Amplify signIn",
    apis: [],
    authActions: ["signIn", "signOut", "fetchAuthSession"],
    transitions: ["PUB-PRODUCTS", "PUB-ORDER-CREATE", "PUB-ORDER"],
    states: {
      idle: "显示登录表单",
      loading: "登录按钮禁用",
      empty: "提示填写账号与密码",
      success: "安全跳转回来源页，默认商品页",
      error: "登录失败或会话到期提示，不回显密码",
    },
    acceptance: ["AC-A01", "AC-O07", "AC-E02"],
  },
  {
    id: "PUB-PRODUCTS",
    scope: "public",
    name: "商品搜索与库存",
    path: "/products",
    access: "any",
    inputs: ["code", "name", "page", "pageSize", "所选商品与数量"],
    inputContract: "searchProducts request；数量由 orderInput 验证",
    apis: ["searchProducts", "getStock"],
    authActions: [],
    transitions: ["PUB-LOGIN", "PUB-ORDER-CREATE"],
    states: {
      idle: "显示搜索条件",
      loading: "显示列表加载状态",
      empty: "没有匹配商品，可清空条件",
      success: "显示代码、名称、说明、JPY价格、库存快照和分页",
      error: "保留条件并支持重试，501提示功能未实现",
    },
    acceptance: ["AC-P05", "AC-P06", "AC-P07", "AC-E01", "AC-E02"],
  },
  {
    id: "PUB-ORDER-CREATE",
    scope: "public",
    name: "创建订单",
    path: "/orders/new",
    access: "authenticated",
    inputs: [
      "items(productId,quantity)",
      "Idempotency-Key（同一次创建/重试保持 UUID）",
    ],
    inputContract: "@training2/api-contracts/inputs#orderInput",
    apis: ["createOrder"],
    authActions: [],
    transitions: ["PUB-LOGIN", "PUB-PRODUCTS", "PUB-ORDER"],
    states: {
      idle: "显示所选明细；不允许输入价格或所有者",
      loading: "禁止重复点击，不创建新key",
      empty: "无明细时引导返回商品页",
      success: "201或200跳转订单详情；显示服务器快照与金额",
      error: "保留明细及key，输入/商品不存在/幂等冲突分别提示",
    },
    acceptance: [
      "AC-O01",
      "AC-O02",
      "AC-O03",
      "AC-O04",
      "AC-O05",
      "AC-O07",
      "AC-E01",
      "AC-E02",
    ],
  },
  {
    id: "PUB-ORDER",
    scope: "public",
    name: "订单详情、确认与取消",
    path: "/orders/:id",
    access: "owner",
    inputs: ["id(UUID)", "confirm/cancel 操作"],
    inputContract: "getOrder/confirmOrder/cancelOrder path",
    apis: ["getOrder", "confirmOrder", "cancelOrder"],
    authActions: [],
    transitions: ["PUB-LOGIN", "PUB-PRODUCTS"],
    states: {
      idle: "等待订单加载",
      loading: "加载中；操作中禁止重复点击",
      empty: "不存在或非本人统一显示未找到订单",
      success:
        "展示draft/confirmed/cancelled、价格快照及金额；操作后刷新订单与库存",
      error: "401转登录；404统一未找到；409显示库存/状态冲突；503可重试",
    },
    acceptance: [
      "AC-O06",
      "AC-O07",
      "AC-P07",
      "AC-S01",
      "AC-S02",
      "AC-S03",
      "AC-S04",
      "AC-S05",
      "AC-S06",
      "AC-E01",
      "AC-E02",
    ],
  },
  {
    id: "ADM-LOGIN",
    scope: "private",
    name: "管理员登录",
    path: "/login",
    access: "any",
    inputs: ["username", "password", "returnTo（仅管理端受保护路由）"],
    inputContract: "Amplify signIn",
    apis: [],
    authActions: ["signIn", "signOut", "fetchAuthSession"],
    transitions: ["ADM-PRODUCTS", "ADM-PRODUCT-CREATE"],
    states: {
      idle: "显示管理员登录表单",
      loading: "登录按钮禁用",
      empty: "提示填写账号与密码",
      success: "验证admin组后进入管理页",
      error: "登录失败、会话到期或非管理员提示",
    },
    acceptance: ["AC-P03", "AC-A01", "AC-E02"],
  },
  {
    id: "ADM-PRODUCTS",
    scope: "private",
    name: "管理商品列表",
    path: "/products",
    access: "admin",
    inputs: ["page", "pageSize"],
    inputContract: "listProducts request",
    apis: ["listProducts"],
    authActions: [],
    transitions: ["ADM-LOGIN", "ADM-PRODUCT-CREATE"],
    states: {
      idle: "显示列表入口",
      loading: "显示加载状态",
      empty: "无商品或末页外时提供注册/上一页入口",
      success: "按代码升序显示产品和分页",
      error: "401转登录；403无管理权限；其他错误可重试",
    },
    acceptance: ["AC-P01", "AC-P03", "AC-P06", "AC-E01", "AC-E02"],
  },
  {
    id: "ADM-PRODUCT-CREATE",
    scope: "private",
    name: "注册商品",
    path: "/products/new",
    access: "admin",
    inputs: ["code", "name", "description", "priceJpy", "stock"],
    inputContract: "@training2/api-contracts/inputs#productInput",
    apis: ["registerProduct"],
    authActions: [],
    transitions: ["ADM-LOGIN", "ADM-PRODUCTS"],
    states: {
      idle: "显示商品表单，价格单位JPY",
      loading: "提交按钮禁用",
      empty: "必填缺失提示",
      success: "201后返回管理列表并刷新商品查询",
      error: "400显示字段问题；409重复代码；401/403权限提示；保留输入",
    },
    acceptance: ["AC-P01", "AC-P02", "AC-P03", "AC-P04", "AC-E01", "AC-E02"],
  },
];
export const scenarios: readonly Scenario[] = [
  {
    id: "E2E-AUTH",
    screens: [
      "PUB-LOGIN",
      "ADM-LOGIN",
      "ADM-PRODUCTS",
      "ADM-PRODUCT-CREATE",
      "PUB-ORDER-CREATE",
      "PUB-ORDER",
    ],
    acceptance: ["AC-A01", "AC-P03", "AC-O07", "AC-E02"],
    step: 9,
    kind: "business",
    status: "implemented",
    specFile: "tests/e2e/auth.spec.ts",
    actions: [
      "登录/退出与过期会话处理",
      "未登录跳转，买家不能进入管理页，API仍返回401/403",
    ],
    expectations: ["returnTo仅允许同站路由", "不展示受保护数据；错误状态清晰"],
  },
  {
    id: "E2E-PRODUCTS",
    screens: ["ADM-PRODUCT-CREATE", "ADM-PRODUCTS", "PUB-PRODUCTS"],
    acceptance: [
      "AC-P01",
      "AC-P02",
      "AC-P03",
      "AC-P04",
      "AC-P05",
      "AC-P06",
      "AC-E01",
      "AC-E02",
    ],
    step: 10,
    kind: "business",
    status: "planned",
    actions: [
      "管理员注册后在两端查找商品",
      "验证重复代码、非法输入、搜索组合及空分页",
    ],
    expectations: [
      "代码规范化、商品只写入一次",
      "价格和库存正确；搜索字面匹配；错误不丢输入",
    ],
  },
  {
    id: "E2E-ORDER-CREATE",
    screens: ["PUB-PRODUCTS", "PUB-ORDER-CREATE", "PUB-ORDER"],
    acceptance: [
      "AC-O01",
      "AC-O02",
      "AC-O03",
      "AC-O04",
      "AC-O05",
      "AC-O07",
      "AC-E01",
      "AC-E02",
    ],
    step: 11,
    kind: "business",
    status: "planned",
    actions: [
      "选多商品创建草稿",
      "超时重试/双击；同key同输入和不同输入；异常商品与数量",
    ],
    expectations: [
      "同一次提交保留key，重试只生成一单",
      "价格快照由服务器决定；创建不扣库存",
    ],
  },
  {
    id: "E2E-ORDER-OWNER",
    screens: ["PUB-LOGIN", "PUB-ORDER"],
    acceptance: ["AC-O06", "AC-O07"],
    step: 11,
    kind: "business",
    status: "planned",
    actions: ["切换买家及管理员账号访问其他人的订单", "尝试查看、确认、取消"],
    expectations: ["统一404，不泄露订单", "库存与状态不变"],
  },
  {
    id: "E2E-ORDER-STOCK",
    screens: ["PUB-PRODUCTS", "PUB-ORDER"],
    acceptance: [
      "AC-P07",
      "AC-S01",
      "AC-S02",
      "AC-S03",
      "AC-S04",
      "AC-S05",
      "AC-S06",
      "AC-E01",
      "AC-E02",
    ],
    step: 11,
    kind: "business",
    status: "planned",
    actions: [
      "足量确认、重复确认、取消和重复取消",
      "多商品部分不足；查看快照后库存改变；确认已取消订单",
    ],
    expectations: [
      "库存轨迹符合验收规格，失败全回滚",
      "操作后刷新状态及库存，重复提交不重复扣减/返还",
    ],
  },
  {
    id: "E2E-FLOW",
    screens: [
      "PUB-LOGIN",
      "PUB-PRODUCTS",
      "PUB-ORDER-CREATE",
      "PUB-ORDER",
      "ADM-LOGIN",
      "ADM-PRODUCTS",
      "ADM-PRODUCT-CREATE",
    ],
    acceptance: ["AC-E01", "AC-E02"],
    step: 12,
    kind: "business",
    status: "planned",
    actions: [
      "管理员登录注册→买家登录搜索→创建→确认→取消",
      "观察加载、空数据、失败、重试和重复点击",
    ],
    expectations: ["完整浏览器流程完成", "每一步订单与库存展示正确"],
  },
];
