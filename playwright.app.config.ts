import { defineConfig, devices } from "@playwright/test";

/** e2e de la app de producción (F3) contra `next start`. Requiere `npm run app:build` antes. */
const executablePath = process.env.PW_CHROMIUM_PATH;
const PORT = Number(process.env.APP_PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /app\.spec\.ts$/,
  timeout: 30_000,
  fullyParallel: true,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${String(PORT)}`,
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  webServer: {
    command: `npx next start -p ${String(PORT)} -H 127.0.0.1`,
    url: `http://127.0.0.1:${String(PORT)}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: "app-movil-360",
      use: { ...devices["Pixel 5"], viewport: { width: 360, height: 760 } },
    },
    { name: "app-escritorio", use: { viewport: { width: 1280, height: 860 } } },
  ],
});
