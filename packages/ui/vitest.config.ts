import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";
export default defineConfig({
  envDir: false,
  plugins: [vue()],
  test: { environment: "node", include: ["test/**/*.test.ts"] },
});
