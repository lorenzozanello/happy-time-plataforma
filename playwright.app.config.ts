import { defineConfig, devices } from "@playwright/test";

/**
 * e2e de la app de producción contra `next start`. Requiere `npm run app:build` antes.
 * Dos servidores del mismo build: uno con Happy apagada (configuración por defecto) y otro con
 * Happy encendida con el composer de guion (modo prueba, sin proveedor de IA).
 */
const executablePath = process.env.PW_CHROMIUM_PATH;
const PORT = Number(process.env.APP_PORT ?? 3100);
const HAPPY_PORT = PORT + 1;
const mobile = { ...devices["Pixel 5"], viewport: { width: 360, height: 760 } };
const desktop = { viewport: { width: 1280, height: 860 } };

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  webServer: [
    {
      command: `npx next start -p ${String(PORT)} -H 127.0.0.1`,
      url: `http://127.0.0.1:${String(PORT)}/`,
      // Siempre un servidor propio: nunca medir contra un `next dev` o un build viejo.
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx next start -p ${String(HAPPY_PORT)} -H 127.0.0.1`,
      url: `http://127.0.0.1:${String(HAPPY_PORT)}/`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        HAPPY_ENABLED: "1",
        HAPPY_TEST_MODE: "1",
        HAPPY_COMPOSER: "guion",
        // Todas las pruebas comparten IP: el límite por IP se prueba en las unitarias.
        HAPPY_IP_LIMIT: "1000",
      },
    },
  ],
  projects: [
    {
      name: "app-movil-360",
      testMatch: /app\.spec\.ts$/,
      use: { ...mobile, baseURL: `http://127.0.0.1:${String(PORT)}` },
    },
    {
      name: "app-escritorio",
      testMatch: /app\.spec\.ts$/,
      use: { ...desktop, baseURL: `http://127.0.0.1:${String(PORT)}` },
    },
    {
      name: "happy-movil-360",
      testMatch: /app-happy\.spec\.ts$/,
      use: { ...mobile, baseURL: `http://127.0.0.1:${String(HAPPY_PORT)}` },
    },
    {
      name: "happy-escritorio",
      testMatch: /app-happy\.spec\.ts$/,
      use: { ...desktop, baseURL: `http://127.0.0.1:${String(HAPPY_PORT)}` },
    },
  ],
});
