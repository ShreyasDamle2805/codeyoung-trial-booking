import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3011",
    channel: process.env.CI
      ? undefined
      : process.env.PLAYWRIGHT_CHANNEL || "msedge",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node backend/src/server.js",
    port: 3011,
    env: {
      PORT: "3011",
      DB_PATH: ":memory:",
      MAIL_MODE: "preview",
      APP_ORIGIN: "http://127.0.0.1:3011",
    },
    reuseExistingServer: false,
  },
});
