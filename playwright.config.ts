import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  retries: 0,
  timeout: 60000,
  use: {
    browserName: "chromium",
    viewport: { width: 1280, height: 850 },
    trace: "off",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "pnpm dev:public-api",
      url: "http://localhost:3000/health",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm dev:private-api",
      url: "http://localhost:3001/health",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm dev:public-frontend",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm dev:private-frontend",
      url: "http://localhost:5174",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
