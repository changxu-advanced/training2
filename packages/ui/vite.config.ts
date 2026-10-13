import { readFile } from "node:fs/promises";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
export function frontendConfig(scope: "public" | "private") {
  return defineConfig({
    envDir: false,
    plugins: [
      vue(),
      {
        name: "local-auth-config",
        configureServer(server) {
          server.middlewares.use("/auth-config.json", async (_req, res) => {
            try {
              const config = JSON.parse(
                await readFile(
                  new URL(
                    "../../.devcontainer/runtime/cognito.json",
                    import.meta.url,
                  ),
                  "utf8",
                ),
              );
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Cache-Control", "no-store");
              res.end(
                JSON.stringify({
                  userPoolId: config.userPoolId,
                  userPoolClientId: config.userPoolClientId,
                  localEndpoint: `http://localhost:${scope === "public" ? 5173 : 5174}/cognito`,
                }),
              );
            } catch {
              res.statusCode = 503;
              res.end("Authentication configuration unavailable");
            }
          });
        },
      },
    ],
    server: {
      proxy: {
        "/api": {
          target: `http://localhost:${scope === "public" ? 3000 : 3001}`,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
        "/cognito": {
          target: "http://cognito-local:9229",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/cognito/, ""),
        },
      },
    },
  });
}
