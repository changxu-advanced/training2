import { defineConfig } from "vitepress";

export default defineConfig({
  lang: "zh-CN",
  title: "training2",
  description: "从契约、开发到验证的电商项目学习记录",
  cleanUrls: true,
  // Local service links are external targets, available when dev services run.
  ignoreDeadLinks: [
    /^http:\/\/localhost:(3000|3001|5173|5174|5175|9230)(\/.*)?$/,
  ],
  vite: { envDir: false },
  themeConfig: {
    nav: [
      { text: "开始开发", link: "/getting-started" },
      { text: "当前进度", link: "/progress" },
      { text: "GitHub", link: "https://github.com/changxu-advanced/training2" },
    ],
    sidebar: [
      {
        text: "开始与业务",
        items: [
          { text: "文档首页", link: "/" },
          { text: "启动与日常操作", link: "/getting-started" },
          { text: "业务规则", link: "/requirements" },
          { text: "验收场景", link: "/acceptance-scenarios" },
          { text: "架构", link: "/architecture" },
        ],
      },
      {
        text: "契约与实现",
        items: [
          { text: "数据库与 Prisma", link: "/database" },
          { text: "API 生成流程", link: "/api" },
          { text: "API 参考（生成）", link: "/api.generated" },
          { text: "页面生成流程", link: "/screen-contracts" },
          { text: "页面参考（生成）", link: "/screens.generated" },
          { text: "认证与权限", link: "/auth" },
          { text: "后端", link: "/backend" },
          { text: "Training 3・GraphQL", link: "/training3" },
          { text: "前端", link: "/frontend" },
          { text: "商品", link: "/products" },
          { text: "订单与锁", link: "/orders" },
        ],
      },
      {
        text: "验证与学习记录",
        items: [
          { text: "检查命令", link: "/testing" },
          { text: "并发与故障验证", link: "/verification" },
          { text: "生成与故障排查", link: "/maintenance" },
          { text: "设计判断与学习", link: "/learning" },
          { text: "实施计划", link: "/implementation-plan" },
          { text: "进度与验证记录", link: "/progress" },
        ],
      },
    ],
    search: { provider: "local" },
    outline: { level: [2, 3], label: "本页内容" },
    docFooter: { prev: "上一页", next: "下一页" },
  },
});
