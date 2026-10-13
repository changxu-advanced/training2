import type { Scenario, Screen } from "./index.ts";
export function renderScreens(
  screens: readonly Screen[],
  scenarios: readonly Scenario[],
) {
  const lines = [
    "# 页面契约（自动生成）",
    "",
    "源：packages/screen-contracts/src/index.ts；请勿手改。实际路由由 Vue Router 构建并验证；各 E2E 场景实施状态见下表，运行结果见进度记录。",
    "",
    "根路由 / 在两端跳转 /products。权限 owner 包含已登录要求，服务器仍验证订单所有者。",
    "",
  ];
  for (const screen of screens) {
    lines.push(
      `## ${screen.id} · ${screen.name}`,
      "",
      `- 端：${screen.scope}；路由：${screen.path}；权限：${screen.access}`,
      `- 输入：${screen.inputs.join("、")}`,
      `- 输入契约：${screen.inputContract}`,
      `- API：${screen.apis.join("、") || "无业务 API"}`,
      `- 认证 SDK：${screen.authActions.join("、") || "无"}`,
      `- 遷移：${screen.transitions.join("、")}`,
      `- 验收：${screen.acceptance.join("、")}`,
      "",
      "| 状态 | 页面反馈 |",
      "| --- | --- |",
    );
    for (const [state, message] of Object.entries(screen.states))
      lines.push(`| ${state} | ${message} |`);
    lines.push("");
  }
  lines.push(
    "## 浏览器业务场景",
    "",
    "以下映射不代表测试已运行；路由存在检查不能替代业务 E2E。",
    "",
  );
  for (const scenario of scenarios)
    lines.push(
      `### ${scenario.id}`,
      "",
      `- 状态：${scenario.status}；阶段：Step${scenario.step}；实际 spec：${scenario.specFile ?? "尚未实现"}`,
      `- 页面：${scenario.screens.join("、")}`,
      `- 验收：${scenario.acceptance.join("、")}`,
      `- 操作：${scenario.actions.join("；")}`,
      `- 预期：${scenario.expectations.join("；")}`,
      "",
    );
  return `${lines.join("\n")}\n`;
}
