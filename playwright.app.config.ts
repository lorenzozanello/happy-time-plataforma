import { defineConfig, devices } from "@playwright/test";

/** e2e de la app de producción (F3) contra `next start`. Requiere `npm run app:build` antes. */
const executablePath = process.env.PW_CHROMIUM_PATH;
const PORT = Number(process.env.APP_PORT ?? 3100);
/** Código del piloto usado en e2e (el mismo que leen las pruebas desde support.ts). */
export const ACCESS_CODE = "piloto-e2e-2026";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /(app|happy)\.spec\.ts$/,
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
    // F5: Happy con el modelo falso determinista y el código de acceso del piloto (sin clave real).
    env: {
      ...process.env,
      HAPPY_MODEL: "fake",
      HAPPY_ACCESS_CODE: ACCESS_CODE,
      HAPPY_FAKE_FIRST_MS: "350",
      HAPPY_FAKE_CHUNK_MS: "60",
      HAPPY_LIMIT_PER_HOUR: "200",
      HAPPY_LIMIT_PER_DAY: "500",
    },
    // Siempre un servidor propio: nunca medir contra un `next dev` o un build viejo en el puerto.
    reuseExistingServer: false,
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
