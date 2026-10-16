import { defineConfig, devices } from "@playwright/test";

const executablePath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /prototipo\.spec\.ts$/,
  timeout: 30_000,
  fullyParallel: true,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `file://${process.cwd()}/dist/prototype/index.html`,
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [
    { name: "movil-360", use: { ...devices["Pixel 5"], viewport: { width: 360, height: 760 } } },
    { name: "escritorio", use: { viewport: { width: 1280, height: 860 } } },
  ],
});
