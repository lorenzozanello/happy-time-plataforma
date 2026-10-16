/**
 * e2e de Happy en la app de producción (F5) contra `next start` con el modelo falso determinista.
 * Cubre: acceso del piloto (F5-10), estados del avatar ligados al stream (F5-05), cita por
 * referencia con literales exactos (F5-07), política de privacidad sin red (F5-02), errores y
 * reintento, persistencia del hilo con sus literales, límites (F5-08), accesibilidad (F5-11) y el
 * contrato HTTP (F5-01).
 */
import { expect, test, type Page } from "@playwright/test";
import {
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
  HAPPY_ACCESS_CODE,
  unit,
  withHappyAccess,
} from "./support";

const avatar = (page: Page) => page.locator(".happy__head .happy-avatar");
const composer = (page: Page) => page.getByLabel("Mensaje para Happy");

async function expectState(page: Page, state: string, timeout = 8_000) {
  await expect(avatar(page)).toHaveAttribute("data-state", state, { timeout });
}

test.describe("F5-10 · Acceso del piloto", () => {
  test("sin código pide el código; con un código válido abre Happy", async ({ page }) => {
    await page.goto("/happy");
    await expect(page.getByRole("heading", { name: "Código de acceso" })).toBeVisible();
    await page.getByLabel("Código del piloto").fill("ab");
    await page.getByRole("button", { name: "Abrir Happy" }).click();
    await expect(page.locator("#happy-code-error")).toContainText("Escribe el código completo");
    await page.getByLabel("Código del piloto").fill(HAPPY_ACCESS_CODE);
    await page.getByRole("button", { name: "Abrir Happy" }).click();
    await expect(page.getByRole("heading", { name: "Pensemos juntas." })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Pensemos juntas." })).toBeVisible();
  });

  test("un código guardado pero incorrecto vuelve a pedir el código al enviar; el mensaje queda", async ({
    page,
  }) => {
    await withHappyAccess(page, "codigo-viejo");
    await page.goto("/happy");
    await expect(page.getByRole("heading", { name: "Pensemos juntas." })).toBeVisible();
    await composer(page).fill("¿Dónde viven las rimas?");
    await composer(page).press("Enter");
    await expect(page.getByRole("heading", { name: "Código de acceso" })).toBeVisible();
    await page.getByLabel("Código del piloto").fill(HAPPY_ACCESS_CODE);
    await page.getByRole("button", { name: "Abrir Happy" }).click();
    await expect(page.locator(".bubble--docente")).toContainText("¿Dónde viven las rimas?");
  });
});

test.describe("F5-01 · Contrato HTTP de /api/happy", () => {
  test("estado sin secretos, 401 sin código, 400 con cuerpo inválido, NDJSON con código", async ({
    request,
  }) => {
    const status = await request.get("/api/happy");
    expect(status.ok()).toBe(true);
    const s = (await status.json()) as Record<string, unknown>;
    expect(s).toEqual({ enabled: true, needsCode: true, provider: "fake", release: "2026-06" });
    expect(JSON.stringify(s)).not.toMatch(/key|sk-|secret/i);

    const noCode = await request.post("/api/happy", {
      data: { mode: "explorar", message: "hola" },
    });
    expect(noCode.status()).toBe(401);
    const bad = await request.post("/api/happy", {
      data: { mode: "zzz" },
      headers: { "x-happy-access": HAPPY_ACCESS_CODE },
    });
    expect(bad.status()).toBe(400);
    expect(((await bad.json()) as { message: string }).message).toMatch(/formato esperado/);

    const ok = await request.post("/api/happy", {
      data: { mode: "conectar", message: "rimas", context: { levelId: "step-2" }, history: [] },
      headers: { "x-happy-access": HAPPY_ACCESS_CODE, "x-happy-device": "e2e-contract" },
    });
    expect(ok.status()).toBe(200);
    expect(ok.headers()["content-type"]).toContain("application/x-ndjson");
    expect(ok.headers()["content-security-policy"]).toContain("default-src 'self'");
    const lines = (await ok.text())
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as { type: string });
    expect(lines[0]?.type).toBe("meta");
    expect(lines.at(-1)?.type).toBe("done");
    expect(lines.filter((l) => l.type === "block").length).toBeGreaterThan(0);
  });

  test("el límite por dispositivo responde 429 con un mensaje amable", async ({ request }) => {
    // El servidor de e2e permite 200 por hora; aquí se agota un dispositivo propio con mensajes de privacidad
    // (no llaman al modelo pero sí cuentan como peticiones).
    const headers = { "x-happy-access": HAPPY_ACCESS_CODE, "x-happy-device": "e2e-limite" };
    let last = 200;
    for (let i = 0; i < 205 && last === 200; i++) {
      const r = await request.post("/api/happy", {
        data: { mode: "general", message: "Mateo llora" },
        headers,
      });
      last = r.status();
      if (last === 429) {
        const body = (await r.json()) as { error: string; reason: string; message: string };
        expect(body.error).toBe("limit");
        expect(body.reason).toBe("rate");
        expect(body.message).toMatch(/respiro/);
      }
    }
    expect(last).toBe(429);
  });
});

test.describe("F5-05/07 · Conversación con el modelo falso", () => {
  test.beforeEach(async ({ page }) => {
    await withHappyAccess(page);
  });

  test("desde la ficha: contexto, estados del avatar ligados al stream y literales exactos", async ({
    page,
  }) => {
    await page.goto("/malla/s2-3");
    await page.getByRole("link", { name: "Pensemos juntas" }).click();
    await expect(page).toHaveURL(/\/happy\?experiencia=S2\.3$/);
    await expect(page.getByRole("list", { name: "Contexto activo" })).toContainText(
      unit("S2.3#titulo").text,
    );
    await expectState(page, "neutral");

    await page.getByRole("radio", { name: /Necesito ideas/ }).click();
    const ask = page.getByRole("button", { name: "Pedir ideas para S2.3" });
    await expect(ask).toBeVisible();
    await ask.click();

    // Piensa: desde el envío hasta el primer bloque (el modelo falso tarda 350 ms en empezar).
    await expectState(page, "piensa", 1_500);
    await expect(page.locator(".response--pending .skeleton").first()).toBeVisible();
    // Idea: llegan bloques parciales.
    await expectState(page, "idea");
    await expect(page.locator(".response--pending .block--malla").first()).toBeVisible();
    // Resultado: respuesta final validada.
    await expectState(page, "resultado");
    await expect(page.locator(".response--pending")).toHaveCount(0);

    const response = page.locator(".response").last();
    for (const id of ["S2.3#momento_vivir", "S2.3#contexto_caribe"]) {
      const block = response.locator(`[data-unit-id="${id}"]`);
      await expect(block.locator(".block__literal")).toHaveText(unit(id).text);
      await expect(block).toContainText("Desde nuestra malla…");
      await expect(block.locator(".tag-generated")).toHaveText("Generado");
    }
    // Fragmento: el tema de Juego, exactamente el valor del segmento.
    const juego = unit("S2.3#juego") as {
      text: string;
      segments?: { key: string; valueStart: number; valueEnd: number }[];
    };
    const tema = juego.segments?.find((s) => s.key === "tema");
    if (!tema) throw new Error("S2.3#juego sin segmento tema");
    await expect(response.locator('[data-unit-id="S2.3#juego"] .block__literal')).toHaveText(
      juego.text.slice(tema.valueStart, tema.valueEnd),
    );
    await expect(response.locator('[data-unit-id="S2.3#juego"]')).toContainText("Tema (fragmento)");
    await expect(response.locator(".block--generated")).toContainText("Como idea complementaria…");
    await expect(response.locator(".path")).toHaveCount(3);
    await expect(response.getByTestId("metrics")).toContainText("sin costo");

    // La URL guarda el hilo; «Ver la ficha» lleva a la experiencia citada.
    await expect(page).toHaveURL(/\/happy\?hilo=/);
    await response.getByRole("button", { name: "Ver la ficha" }).click();
    await expect(page).toHaveURL(/\/malla\/s2-3$/);
    await page.goBack();
    await expect(
      page.locator(".response").last().locator('[data-unit-id="S2.3#momento_vivir"]'),
    ).toBeVisible();
  });

  test("el hilo y sus literales persisten tras recargar (sin la malla en el navegador)", async ({
    page,
  }) => {
    await page.goto("/happy?experiencia=K.2&modo=conectar");
    await composer(page).fill("¿Dónde viven los sonidos y las rimas?");
    await composer(page).press("Enter");
    await expectState(page, "resultado");
    const url = page.url();
    expect(url).toMatch(/hilo=/);
    const cited = await page
      .locator(".response [data-unit-id]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-unit-id") ?? ""));
    expect(cited.length).toBeGreaterThan(0);
    await page.goto(url);
    for (const id of cited) {
      await expect(page.locator(`.response [data-unit-id="${id}"] .block__literal`)).toHaveText(
        unit(id).text,
      );
    }
  });

  test("privacidad: un nombre produce el aviso sin llamar a /api/happy", async ({ page }) => {
    let calls = 0;
    page.on("request", (r) => {
      if (r.url().includes("/api/happy") && r.method() === "POST") calls++;
    });
    await page.goto("/happy?experiencia=S1.2");
    await composer(page).fill("Valentina no quiere comer y llora, ¿qué hago?");
    await composer(page).press("Enter");
    await expect(page.locator(".notice--privacy")).toContainText("sin nombres");
    await expect(page.locator(".bubble--docente")).toContainText("[nombre] no quiere comer");
    expect(calls).toBe(0);
    const stored = await page.evaluate(() => window.localStorage.getItem("ht.app.v1") ?? "");
    expect(stored).not.toContain("Valentina");
  });

  test("fallo del modelo: error con reintento ligado al mensaje", async ({ page }) => {
    await page.goto("/happy?experiencia=S3.1");
    await composer(page).fill("Ideas [[fake:fail]]");
    await composer(page).press("Enter");
    await expect(page.locator(".error-state, [role=alert]").first()).toContainText(
      "no pudo responder",
    );
    await expect(page.getByRole("button", { name: /Reintentar/ })).toBeVisible();
    await expectState(page, "neutral");
    await page.getByRole("button", { name: /Reintentar/ }).click();
    await expectState(page, "piensa", 1_500);
    await expect(page.getByRole("button", { name: /Reintentar/ })).toBeVisible({ timeout: 8_000 });
    await expect(page.locator(".bubble--docente")).toHaveCount(1);
  });

  test("respuesta inválida del modelo: se descartan bloques y la respuesta sigue siendo fiel", async ({
    page,
  }) => {
    await page.goto("/happy?experiencia=T.2&modo=explorar");
    await composer(page).fill("Ideas [[fake:invalid]] [[fake:authority]]");
    await composer(page).press("Enter");
    await expectState(page, "resultado");
    const response = page.locator(".response").last();
    await expect(response.locator('[data-unit-id="T.2#momento_vivir"] .block__literal')).toHaveText(
      unit("T.2#momento_vivir").text,
    );
    await expect(response.locator("text=X.9#nada")).toHaveCount(0);
    await expect(response.locator("text=La malla dice")).toHaveCount(0);
    await expect(response.locator(".path")).toHaveCount(2);
  });

  test("respuesta vacía: reinicio y segundo intento sin dejar bloques fantasma", async ({
    page,
  }) => {
    await page.goto("/happy?experiencia=S2.1&modo=explorar");
    await composer(page).fill("Ideas [[fake:empty]]");
    await composer(page).press("Enter");
    await expectState(page, "resultado");
    await expect(
      page.locator(".response").last().locator('[data-unit-id="S2.1#momento_vivir"]'),
    ).toBeVisible();
    await expect(page.locator(".response--pending")).toHaveCount(0);
  });

  test("sin conexión, el compositor se desactiva y la malla sigue legible", async ({
    page,
    context,
  }) => {
    await page.goto("/happy?experiencia=S2.2");
    await expect(composer(page)).toBeEnabled();
    await context.setOffline(true);
    await expect(composer(page)).toBeDisabled();
    await expect(composer(page)).toHaveAttribute("placeholder", /Sin conexión/);
    await context.setOffline(false);
    await expect(composer(page)).toBeEnabled();
  });
});

test.describe("F5-11 · Accesibilidad y móvil de Happy", () => {
  for (const scheme of ["light", "dark"] as const) {
    test.describe(`tema ${scheme === "light" ? "claro" : "oscuro"}`, () => {
      test.use({ colorScheme: scheme });
      test("código de acceso, apertura y conversación cumplen", async ({ page }) => {
        await page.goto("/happy");
        await expect(page.getByRole("heading", { name: "Código de acceso" })).toBeVisible();
        await expectNoHorizontalScroll(page);
        await expectTouchTargets(page);
        await expectAccessible(page);

        await page.getByLabel("Código del piloto").fill(HAPPY_ACCESS_CODE);
        await page.getByRole("button", { name: "Abrir Happy" }).click();
        await expect(page.getByRole("heading", { name: "Pensemos juntas." })).toBeVisible();
        await expectNoHorizontalScroll(page);
        await expectTouchTargets(page);
        await expectAccessible(page);

        await page.goto("/happy?experiencia=S2.3&modo=explorar");
        await page.getByRole("button", { name: "Pedir ideas para S2.3" }).click();
        await expectState(page, "resultado");
        await expectNoHorizontalScroll(page);
        await expectTouchTargets(page);
        await expectAccessible(page);
      });
    });
  }
});
