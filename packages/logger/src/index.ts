export type LogLevel = "debug" | "info" | "warn" | "error";
const priorities = { debug: 10, info: 20, warn: 30, error: 40 };
const sensitive =
  /password|passwd|secret|token|authorization|cookie|credential|apikey|databaseurl|connectionstring|privatekey/i;
function cleanText(text: string) {
  return text
    .replace(/\bBearer\s+[^\s,"']+/gi, "Bearer [REDACTED]")
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[REDACTED]",
    )
    .replace(/(postgres(?:ql)?|https?):\/\/[^@\s]+@/gi, "$1://[REDACTED]@")
    .replace(
      /([?&](?:access_token|refresh_token|token|password|secret|api_key)=)[^&#\s]*/gi,
      "$1[REDACTED]",
    )
    .replace(
      /\b(password|secret|api[_-]?key|token)\s*[=:]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      "$1=[REDACTED]",
    );
}
export function redact(value: unknown): unknown {
  const seen = new WeakSet<object>();
  function visit(item: unknown, depth: number): unknown {
    if (typeof item === "string") return cleanText(item);
    if (item === null || typeof item === "number" || typeof item === "boolean")
      return item;
    if (typeof item === "bigint") return item.toString();
    if (typeof item !== "object") return "[Unsupported]";
    if (depth >= 8) return "[Truncated]";
    if (seen.has(item)) return "[Circular]";
    seen.add(item);
    let result: unknown;
    if (item instanceof Error)
      result = { name: cleanText(item.name), message: cleanText(item.message) };
    else if (Array.isArray(item))
      result = item.map((entry) => visit(entry, depth + 1));
    else
      result = Object.fromEntries(
        Object.entries(item).map(([key, entry]) => [
          key,
          sensitive.test(key.replace(/[-_\s]/g, ""))
            ? "[REDACTED]"
            : visit(entry, depth + 1),
        ]),
      );
    seen.delete(item);
    return result;
  }
  return visit(value, 0);
}
export function createLogger(
  options: {
    level?: LogLevel;
    sink?: (line: string) => void;
    clock?: () => Date;
  } = {},
) {
  const threshold = options.level ?? "info";
  const sink = options.sink ?? ((line: string) => console.log(line));
  const clock = options.clock ?? (() => new Date());
  const write = (
    level: LogLevel,
    message: string,
    context: Readonly<Record<string, unknown>> = {},
  ) => {
    if (priorities[level] < priorities[threshold]) return;
    sink(
      JSON.stringify({
        time: clock().toISOString(),
        level,
        message: cleanText(message),
        context: redact(context),
      }),
    );
  };
  return {
    debug: (message: string, context?: Readonly<Record<string, unknown>>) =>
      write("debug", message, context),
    info: (message: string, context?: Readonly<Record<string, unknown>>) =>
      write("info", message, context),
    warn: (message: string, context?: Readonly<Record<string, unknown>>) =>
      write("warn", message, context),
    error: (message: string, context?: Readonly<Record<string, unknown>>) =>
      write("error", message, context),
  };
}
