import { createApp, h } from "vue";
import "./style.css";

createApp({
  render: () =>
    h("main", [
      h("p", { class: "label" }, "TRAINING2 · STEP1"),
      h("h1", "买家端开发环境已启动"),
      h("p", "Vue 页面骨架已就绪。商品和订单功能会按实施计划逐步加入。"),
    ]),
}).mount("#app");
