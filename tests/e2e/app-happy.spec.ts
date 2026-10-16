/**
 * e2e de Happy en la app (F5-07) contra `next start` con Happy encendida y el composer de guion
 * (modo prueba, sin proveedor de IA). Verifica el camino completo: interfaz → /api/happy →
 * política → recuperación → composer → validación → streaming → literales resueltos en servidor.
 */
import { expect, test, type Page } from "@playwright/test";
import { expectAccessible, expectNoHorizontalScroll, unit } from "./support";

const avatar = (page: Page) => page.locator(".happy__head .happy-avatar");

async function askIdeasForS21(page: Page) {
  await page.goto("/malla/s2-1");
  await page.locator(".ficha__actions").getByRole("link", { name: "Pensemos juntas" }).click();
  await expect(page.getByRole("list", { name: "Contexto activo" })).toContainText("S2.1");
  await page.getByRole("radio", { name: /Necesito ideas/ }).click();
  await page.getByRole("button", { name: "Pedir ideas para S2.1" }).click();
}

test.describe("F5-07 · Happy en la app", () => {
  test("cita la malla con el literal del servidor, separa lo generado y guarda ideas", async ({
    page,
  }) => {
    const posts: string[] = [];
    page.on("request", (r) => {
      if (r.url().endsWith("/api/happy") && r.method() === "POST") posts.push(r.postData() ?? "");
    });
    await askIdeasForS21(page);
    const ref = page.locator('.block--malla[data-unit-id="S2.1#momento_vivir"]');
    await expect(ref).toContainText("Desde nuestra malla…");
    await expect(ref.locator(".block__literal")).toHaveText(unit("S2.1#momento_vivir").text);
    await expect(page.locator(".block--generated").first()).toContainText(
      "Como idea complementaria…",
    );
    await expect(page.locator(".path")).toHaveCount(3);
    await expect(avatar(page)).toHaveAttribute("data-state", /resultado|neutral/);
    await expect(page.locator(".proto-note")).toHaveCount(0);
    expect(posts).toHaveLength(1);
    expect(JSON.parse(posts[0] ?? "{}")).toMatchObject({
      mode: "explorar",
      context: { experienceCode: "S2.1" },
    });

    await page.locator(".path").first().getByRole("button", { name: "Guardar idea" }).click();
    await page.getByRole("button", { name: "Me sirvió", exact: true }).click();
    await page.locator(".tabbar").getByRole("link", { name: "Guardados" }).click();
    await page.getByRole("tab", { name: /Ideas/ }).click();
    await expect(page.locator(".idea")).toHaveCount(1);
    await expect(page.locator(".idea")).toContainText("S2.1");
  });

  test("la conversación se retoma al recargar, con sus literales", async ({ page }) => {
    await askIdeasForS21(page);
    await expect(page.locator(".path")).toHaveCount(3);
    await expect(page).toHaveURL(/\/happy\?hilo=/);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("ht.app.v1") ?? ""))
      .toContain("S2.1#momento_vivir");
    await page.reload();
    await expect(
      page.locator('.block--malla[data-unit-id="S2.1#momento_vivir"] .block__literal'),
    ).toHaveText(unit("S2.1#momento_vivir").text);
    await expect(page.locator(".bubble--docente")).toHaveText("Dame ideas para S2.1");
  });

  test("el avatar pasa por Escucha, Piensa e Idea con eventos reales", async ({ page }) => {
    await page.goto("/happy");
    await expect(avatar(page)).toHaveAttribute("data-state", "neutral");
    await page.getByLabel("Mensaje para Happy").fill("¿En qué experiencia se trabajan las rimas?");
    await expect(avatar(page)).toHaveAttribute("data-state", "escucha");
    await page.getByLabel("Mensaje para Happy").press("Enter");
    await expect(avatar(page)).toHaveAttribute("data-state", /piensa|idea/);
    await expect(page.locator(".block--malla").first()).toBeVisible();
    await expect(avatar(page)).toHaveAttribute("data-state", /resultado|neutral/);
  });

  test("datos identificables: aviso sin enviar nada al servidor", async ({ page }) => {
    const posts: string[] = [];
    page.on("request", (r) => {
      if (r.url().endsWith("/api/happy") && r.method() === "POST") posts.push(r.url());
    });
    await page.goto("/happy");
    await page.getByLabel("Mensaje para Happy").fill("Mi alumna Sofía tiene TDAH, ¿qué hago?");
    await page.getByLabel("Mensaje para Happy").press("Enter");
    await expect(page.locator(".notice--privacy")).toContainText("sin nombres");
    expect(posts).toEqual([]);
    const stored = await page.evaluate(() => JSON.stringify(window.localStorage));
    expect(stored).not.toContain("Sofía");
  });

  test("el servidor también aplica la política y rechaza otros orígenes", async ({
    request,
    baseURL,
  }) => {
    const body = { message: "Mi alumna Sofía tiene TDAH", context: {} };
    const ok = await request.post("/api/happy", { data: body, headers: { origin: baseURL ?? "" } });
    expect(ok.status()).toBe(200);
    const events = (await ok.text())
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as { type: string; block?: { kind: string; code?: string } });
    expect(events.filter((e) => e.type === "block").map((e) => e.block?.code)).toEqual(["privacy"]);
    const foreign = await request.post("/api/happy", {
      data: body,
      headers: { origin: "https://otro.example" },
    });
    expect(foreign.status()).toBe(403);
    const status = await request.get("/api/happy");
    expect(await status.json()).toEqual({ disponible: true });
  });

  test("los bloques que rompen las reglas nunca llegan a la docente", async ({ page }) => {
    await page.goto("/happy?modo=explorar&experiencia=S2.1");
    await page.getByLabel("Mensaje para Happy").fill("[[reglas]] ideas para el patio");
    await page.getByLabel("Mensaje para Happy").press("Enter");
    await expect(page.locator(".path")).toHaveCount(3);
    const text = await page.locator(".conversation").innerText();
    expect(text).not.toMatch(/Según la malla|TDAH|4\/5|NO-EXISTE/);
  });

  test("si Happy no logra una respuesta válida, lo dice y permite reintentar", async ({ page }) => {
    await page.goto("/happy");
    await page.getByLabel("Mensaje para Happy").fill("[[vacio]] algo");
    await page.getByLabel("Mensaje para Happy").press("Enter");
    await expect(page.locator(".error-state")).toContainText(
      "Happy no logró una respuesta que cumpla sus reglas",
    );
    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`la conversación es accesible (${scheme === "light" ? "claro" : "oscuro"})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await askIdeasForS21(page);
      await expect(page.locator(".path")).toHaveCount(3);
      await expectNoHorizontalScroll(page);
      await expectAccessible(page);
    });
  }
});
