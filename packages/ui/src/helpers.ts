import type { RouteManifest } from "@training2/screen-contracts";
import axios from "axios";
export function safeReturnTo(value: unknown, manifest: RouteManifest) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("?") ||
    value.includes("#")
  )
    return "/products";
  return manifest.routes.some(
    (r) =>
      r.path !== "/login" &&
      (r.path === value ||
        (r.path === "/orders/:id" &&
          /^\/orders\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            value,
          ))),
  )
    ? value
    : "/products";
}
const messages: Record<string, string> = {
  NOT_IMPLEMENTED: "此功能即将开放，当前还不能完成操作。",
  INVALID_INPUT: "请检查输入内容。",
  DUPLICATE_PRODUCT: "商品代码已存在，请换一个代码。",
  UNAUTHENTICATED: "登录已失效，请重新登录。",
  FORBIDDEN: "当前账号没有管理权限。",
  NOT_FOUND: "未找到内容，或你无权查看。",
  IDEMPOTENCY_CONFLICT: "这次提交的内容已改变，请重新创建订单。",
  INSUFFICIENT_STOCK: "库存不足，请返回商品页查看最新库存。",
  INVALID_ORDER_STATE: "订单当前状态不允许此操作。",
  TEMPORARILY_UNAVAILABLE: "服务暂时繁忙，请稍后重试。",
};
export function apiMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    if (error.code === "ECONNABORTED")
      return "请求超时，可重试；创建订单会沿用同一个提交编号。";
    if (!error.response) return "连接失败，请检查网络并重试。";
    return (
      messages[error.response.data?.error?.code] ??
      "服务暂时无法完成请求，请稍后重试。"
    );
  }
  return "操作未完成，请重试。";
}
