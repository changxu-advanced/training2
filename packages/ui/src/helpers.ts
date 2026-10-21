import type { RouteManifest } from "@training2/screen-contracts";
import axios from "axios";
import { AdminApiError } from "./admin-client.ts";
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
  NOT_IMPLEMENTED: "この機能は準備中です。",
  INVALID_INPUT: "入力内容をご確認ください。",
  DUPLICATE_PRODUCT:
    "商品コードは既に登録されています。別のコードを入力してください。",
  UNAUTHENTICATED:
    "セッションの有効期限が切れました。再度ログインしてください。",
  FORBIDDEN: "管理権限がありません。",
  NOT_FOUND: "見つからないか、閲覧する権限がありません。",
  IDEMPOTENCY_CONFLICT:
    "注文内容が変更されています。注文を作成し直してください。",
  INSUFFICIENT_STOCK:
    "在庫が不足しています。商品一覧で最新の在庫をご確認ください。",
  INVALID_ORDER_STATE: "現在の注文状態ではこの操作はできません。",
  TEMPORARILY_UNAVAILABLE:
    "ただいま混み合っています。時間をおいて再試行してください。",
};
export function apiMessage(error: unknown) {
  if (error instanceof AdminApiError) {
    if (error.code === "NETWORK_ERROR")
      return "接続できません。ネットワークを確認して再試行してください。";
    if (error.code === "TIMEOUT")
      return "通信がタイムアウトしました。同じ受付番号で再試行できます。";
    if (error.code === "IDEMPOTENCY_CONFLICT")
      return "追加内容が変更されています。数量を確認してから再試行してください。";
    return (
      messages[error.code] ??
      "処理を完了できません。時間をおいて再試行してください。"
    );
  }
  if (axios.isAxiosError(error)) {
    if (error.code === "ECONNABORTED")
      return "通信がタイムアウトしました。再試行できます。注文は同じ受付番号で処理されます。";
    if (!error.response)
      return "接続できません。ネットワークを確認して再試行してください。";
    return (
      messages[error.response.data?.error?.code] ??
      "処理を完了できません。時間をおいて再試行してください。"
    );
  }
  return "処理を完了できません。再試行してください。";
}
