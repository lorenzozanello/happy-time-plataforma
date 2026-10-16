/**
 * e2e de la app de producción (F3) contra `next start`: URLs compartibles, fichas estáticas,
 * búsqueda bajo demanda, fidelidad, accesibilidad, seguridad y rendimiento.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  expectAccessible,
  expectFichaLiterals,
  expectNoHorizontalScroll,
  expectTouchTargets,
  release,
  unit,
} from "./support";

const codes = [...new Set(release.units.flatMap((u) => (u.code ? [u.code] : [])))];
const slug = (code: string) => code.toLowerCase().replace(".", "-");
const tab = (page: Page, name: string) => page.locator(".tabbar").getByRole("link", { name });

test.describe("F3-02 · URLs compartibles", () => {
  test("de Inicio a la ficha con enlaces reales y Volver del navegador", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "¿Qué preparamos hoy?" })).toBeVisible();
    await tab(page, "Malla").click();
    await expect(page).toHaveURL(/\/malla$/);
    await expect(page.getByRole("heading", { level: 1, name: "Malla curricular" })).toBeFocused();

    await page.getByRole("button", { name: /Transición/ }).click();
    await page.getByRole("radio", { name: /^Periodo III:/ }).click();
    await expect(page).toHaveURL(/\/malla\?nivel=transicion&periodo=3$/);
    const open = page.getByRole("link", { name: "Abrir ficha" });
    await expect(open).toHaveAttribute("href", "/malla/t-3");
    await open.click();
    await expect(page).toHaveURL(/\/malla\/t-3$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(unit("T.3#titulo").text);

    await page.goBack();
    await expect(page).toHaveURL(/\/malla\?nivel=transicion&periodo=3$/);
    await expect(page.locator(".exp-card--hero")).toContainText(unit("T.3#titulo").text);
  });

  test("abrir un enlace compartido de la malla respeta nivel y periodo", async ({ page }) => {
    await page.goto("/malla?nivel=step-2&periodo=3");
    await expect(page.locator(".exp-card--hero")).toContainText(unit("S2.3#titulo").text);
    await expect(page.getByRole("radio", { name: /^Periodo III:/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("niveles, progresión y principios tienen su URL", async ({ page }) => {
    await page.goto("/niveles/step-2");
    await expect(page.locator('[data-unit-id="L:step-2#perfil_entrada"]')).toContainText(
      unit("L:step-2#perfil_entrada").text.slice(0, 40),
    );
    await page.goto("/progresion");
    await expect(page.locator(".progression__step")).toHaveCount(5);
    await page.goto("/principios");
    await expect(page.locator(".principles__item")).toHaveCount(7);
    await expect(page.locator('[data-unit-id="OBS-1"]')).toContainText(unit("OBS-1").text);
  });

  test("una ficha inexistente responde 404 con salida a la malla", async ({ page }) => {
    for (const path of ["/malla/zz-9", "/malla/S2-1", "/niveles/primaria", "/no-existe"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(404);
      await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
      await expect(page.locator(".tabbar [aria-current]")).toHaveCount(0);
    }
    await page.getByRole("link", { name: "Ir a la malla" }).click();
    await expect(page).toHaveURL(/\/malla$/);
  });
});

test.describe("Revisión adversarial F3 · navegación", () => {
  test("«Volver» en un enlace abierto directamente lleva a la malla, no fuera de la app", async ({
    page,
  }) => {
    await page.goto("/malla/s2-1");
    await page.locator(".ficha__next").click();
    await expect(page).toHaveURL(/\/malla\/s2-2$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/malla\/s2-1$/);
    await page.getByRole("button", { name: "Volver" }).click();
    await expect(page).toHaveURL(/\/malla\?nivel=step-2&periodo=1$/);
    await expect(page.locator(".exp-card--hero")).toContainText(unit("S2.1#titulo").text);
  });

  test("«Volver» tras navegar dentro de la app usa el historial", async ({ page }) => {
    await page.goto("/buscar?q=rimas");
    await page.locator(".result").first().click();
    await expect(page.locator(".ficha")).toBeVisible();
    await page.getByRole("button", { name: "Volver" }).click();
    await expect(page).toHaveURL(/\/buscar\?q=rimas$/);
    await expect(page.getByLabel("Buscar en la malla")).toHaveValue("rimas");
  });

  test("la pantalla de la malla sigue a la URL (pestaña, atrás y adelante)", async ({ page }) => {
    await page.goto("/malla?nivel=transicion&periodo=3");
    await expect(page.locator(".exp-card--hero")).toContainText(unit("T.3#titulo").text);
    await tab(page, "Malla").click();
    await expect(page).toHaveURL(/\/malla$/);
    await expect(page.locator(".exp-card--hero")).toContainText(unit("S1.1#titulo").text);
    await page.getByRole("button", { name: /Step 2/ }).click();
    await expect(page).toHaveURL(/\/malla\?nivel=step-2&periodo=1$/);
    await expect(page.getByRole("button", { name: /Step 2/ })).toBeFocused();
    await page.goBack();
    await expect(page).toHaveURL(/\/malla\?nivel=transicion&periodo=3$/);
    await expect(page.locator(".exp-card--hero")).toContainText(unit("T.3#titulo").text);
    await page.goForward();
    await expect(page).toHaveURL(/\/malla\?nivel=step-2&periodo=1$/);
    await expect(page.locator(".exp-card--hero")).toContainText(unit("S2.1#titulo").text);
  });

  test("la búsqueda sigue a la URL y escribir no la reinicia", async ({ page }) => {
    await page.goto("/buscar?q=rimas");
    await expect(page.getByLabel("Buscar en la malla")).toHaveValue("rimas");
    await page.locator(".topbar").getByRole("link", { name: "Abrir búsqueda" }).click();
    await expect(page).toHaveURL(/\/buscar$/);
    await expect(page.getByLabel("Buscar en la malla")).toHaveValue("");
    await page.getByLabel("Buscar en la malla").pressSequentially("vinculo seguro", { delay: 5 });
    await expect(page.getByLabel("Buscar en la malla")).toHaveValue("vinculo seguro");
    await expect(page).toHaveURL(/\/buscar\?q=vinculo\+seguro$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/buscar\?q=rimas$/);
    await expect(page.getByLabel("Buscar en la malla")).toHaveValue("rimas");
  });

  test("URL y datos guardados inválidos no tumban la app", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/malla?periodo=2.5&nivel=primaria");
    await expect(page.locator(".exp-card--hero")).toBeVisible();
    await page.evaluate(() => {
      localStorage.setItem(
        "ht.app.v1",
        JSON.stringify({
          work: { levelIds: ["primaria", "kinder"], periodIndex: 9, lastExperience: "ZZ.9" },
          favorites: null,
          recentSearches: [3],
        }),
      );
    });
    for (const path of ["/", "/malla", "/guardados", "/perfil"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
    await page.goto("/malla");
    await expect(page.locator(".exp-card--hero")).toContainText(unit("K.1#titulo").text);
    expect(errors).toEqual([]);
  });

  test("una ficha inexistente no borra «Continuar donde quedaste»", async ({ page }) => {
    await page.goto("/malla/s2-1");
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("ht.app.v1") ?? ""))
      .toContain('"lastExperience":"S2.1"');
    await page.goto("/malla/zz-9");
    await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
    await page.goto("/");
    await expect(page.getByRole("region", { name: "Continuar donde quedaste" })).toContainText(
      unit("S2.1#titulo").text,
    );
  });
});

test.describe("F3-03 · Fichas estáticas", () => {
  test.use({ javaScriptEnabled: false });
  test("sin JavaScript, la ficha ya trae sus literales en el HTML", async ({ page }) => {
    await page.goto("/malla/s2-1");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(unit("S2.1#titulo").text);
    await expect(page.locator('[data-unit-id="S2.1#momento_vivir"]')).toContainText(
      unit("S2.1#momento_vivir").text.slice(0, 60),
    );
    const next = page.locator(".ficha__next");
    await expect(next).toHaveAttribute("href", "/malla/s2-2");
  });

  test("sin JavaScript, la malla no muestra una experiencia que no es la pedida", async ({
    page,
  }) => {
    await page.goto("/malla?nivel=kinder&periodo=2");
    await expect(page.getByRole("heading", { level: 1, name: "Malla curricular" })).toBeVisible();
    await expect(page.locator(".exp-card--hero")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Abrir ficha" })).toHaveCount(0);
  });
});

test.describe("F3-04 · Búsqueda bajo demanda", () => {
  test("el índice se descarga solo al buscar y la URL guarda la consulta", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/datos/")) requests.push(r.url());
    });
    await page.goto("/malla/s2-1");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(requests).toEqual([]);

    await page.locator(".topbar").getByRole("link", { name: "Abrir búsqueda" }).click();
    await page.getByLabel("Buscar en la malla").fill("cancion");
    await expect(page.locator("mark").first()).toBeVisible();
    await expect(page).toHaveURL(/\/buscar\?q=cancion$/);
    expect(requests).toEqual([expect.stringMatching(/\/datos\/busqueda-2026-06\.json$/)]);
    const first = page.locator(".result").first();
    await expect(first).toHaveAttribute("href", /^\/(malla|niveles|progresion|principios)/);
    await first.click();
    await expect(page.locator(".ficha")).toBeVisible();
  });

  test("un enlace /buscar?q= abre con los resultados", async ({ page }) => {
    await page.goto("/buscar?q=rimas");
    await expect(page.getByLabel("Buscar en la malla")).toHaveValue("rimas");
    await expect(page.locator(".results")).toContainText("resultados");
    await page.getByLabel("Buscar en la malla").fill("zxqwv");
    await expect(page.getByText("Sin resultados para «zxqwv»")).toBeVisible();
  });

  test("si el índice no carga, lo dice y permite reintentar", async ({ page }) => {
    let fail = true;
    await page.route("**/datos/*.json", async (route) => {
      if (fail) await route.fulfill({ status: 503, body: "" });
      else await route.continue();
    });
    await page.goto("/buscar?q=rimas");
    await expect(page.locator(".error-state")).toContainText("No pudimos cargar la búsqueda");
    fail = false;
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.locator(".results")).toContainText("resultados");
  });
});

test.describe("F3-05 · Fidelidad", () => {
  test("las 20 fichas muestran cada unidad con su literal exacto", async ({ page }, info) => {
    test.skip(info.project.name !== "app-escritorio", "basta con un proyecto");
    test.setTimeout(150_000);
    for (const code of codes) {
      await page.goto(`/malla/${slug(code)}`);
      await expect(page.locator(".ficha .code").first()).toHaveText(code);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(unit(`${code}#titulo`).text);
      await expectFichaLiterals(page, code);
    }
  });

  test("las fichas se recorren con Siguiente sin recargar", async ({ page }) => {
    await page.goto("/malla/s1-1");
    await page.evaluate(() => {
      (window as unknown as { marca: number }).marca = 1;
    });
    await page.locator(".ficha__next").click();
    await expect(page).toHaveURL(/\/malla\/s1-2$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(unit("S1.2#titulo").text);
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    // Navegación del lado del cliente: la página no se recargó.
    expect(await page.evaluate(() => (window as unknown as { marca?: number }).marca)).toBe(1);
  });
});

test.describe("Datos del navegador", () => {
  test("niveles y favoritos persisten al recargar; Happy aún no está", async ({ page }) => {
    await page.goto("/perfil");
    await page.locator(".check-card", { hasText: "Step 2" }).click();
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByRole("status")).toContainText("Guardado");

    await page.goto("/malla/s2-1");
    await expect(
      page.locator(".ficha__actions").getByRole("button", { name: /Pensemos/ }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Guardar en favoritos" }).click();
    await expect(page.getByRole("button", { name: "Quitar de favoritos" })).toBeVisible();

    await page.goto("/");
    await expect(page.locator("main")).toContainText(unit("S2.1#titulo").text);
    await expect(page.locator(".intent")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("region", { name: "Favoritos" })).toContainText(
      unit("S2.1#titulo").text,
    );

    await page.goto("/malla");
    await expect(page.getByRole("button", { name: /Step 2/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await tab(page, "Happy").click();
    await expect(page.getByRole("heading", { name: "Happy llega pronto" })).toBeVisible();
    await tab(page, "Guardados").click();
    await expect(page.locator(".exp-card")).toContainText(unit("S2.1#titulo").text);
  });
});

test.describe("F3-06 · Accesibilidad y móvil", () => {
  for (const scheme of ["light", "dark"] as const) {
    test.describe(`tema ${scheme === "light" ? "claro" : "oscuro"}`, () => {
      test.use({ colorScheme: scheme });
      test("las vistas principales cumplen", async ({ page }) => {
        for (const path of [
          "/",
          "/malla",
          "/malla/s2-1",
          "/buscar?q=rimas",
          "/niveles/kinder",
          "/progresion",
          "/principios",
          "/guardados",
          "/happy",
          "/perfil",
          "/no-existe",
        ]) {
          await page.goto(path);
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          if (path.startsWith("/buscar")) await expect(page.locator(".results")).toBeVisible();
          if (path === "/malla/s2-1")
            for (const s of await page.locator("details.group summary").all()) await s.click();
          await expectNoHorizontalScroll(page);
          await expectTouchTargets(page);
          await expectAccessible(page);
        }
      });
    });
  }
});

test.describe("F3-08 · Seguridad básica", () => {
  test("cabeceras de seguridad y no indexación", async ({ request }) => {
    for (const path of ["/", "/malla/s2-1", "/datos/busqueda-2026-06.json", "/no-existe"]) {
      const res = await request.get(path);
      const h = res.headers();
      expect(h["content-security-policy"], path).toContain("frame-ancestors 'none'");
      expect(h["content-security-policy"], path).toContain("default-src 'self'");
      expect(h["content-security-policy"], path).not.toContain("unsafe-eval");
      expect(h["x-content-type-options"], path).toBe("nosniff");
      expect(h["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
      expect(h["x-robots-tag"], path).toContain("noindex");
      expect(h["x-powered-by"], path).toBeUndefined();
    }
    const html = await (await request.get("/malla/s2-1")).text();
    expect(html).toContain('<meta name="robots" content="noindex, nofollow"');
  });

  test("todo se sirve desde el propio origen (sin tipografías ni scripts de terceros)", async ({
    page,
    baseURL,
  }) => {
    const foreign: string[] = [];
    page.on("request", (r) => {
      if (!r.url().startsWith(baseURL ?? "") && !r.url().startsWith("data:")) foreign.push(r.url());
    });
    await page.goto("/malla/s2-1");
    await page.waitForLoadState("networkidle");
    expect(foreign).toEqual([]);
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].filter((f) => f.status === "loaded").length;
    });
    expect(fonts).toBeGreaterThan(0);
  });
});

test.describe("F3-07 · Rendimiento", () => {
  /**
   * Laboratorio: perfil móvil de Lighthouse aplicado por petición (equivalente DevTools de
   * "Slow 4G": 562,5 ms de latencia, 1,47 Mbps de bajada) y CPU ×4, sin caché. El LCP se lee
   * cuando la página ya está quieta (red inactiva y 1 s sin cambios), no en el evento load.
   */
  async function measureLcp(page: Page, path: string): Promise<number> {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 562.5,
      downloadThroughput: (1.4746 * 1024 * 1024) / 8,
      uploadThroughput: (675 * 1024) / 8,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto(path, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(1000);
    return page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            resolve(entries[entries.length - 1]?.startTime ?? Number.POSITIVE_INFINITY);
          }).observe({ type: "largest-contentful-paint", buffered: true });
        }),
    );
  }

  for (const [path, budget] of [
    ["/malla/s2-1", 2000],
    // La malla depende de la URL y de los datos del navegador: muestra esqueleto hasta conocerlos
    // y su contenido llega con el JavaScript. Guardia de regresión, no objetivo (ver F3-07).
    ["/malla?nivel=step-2&periodo=3", 4000],
  ] as const) {
    test(`LCP de ${path} ≤ ${String(budget / 1000).replace(".", ",")} s`, async ({
      page,
    }, info) => {
      test.skip(info.project.name !== "app-movil-360", "medición en móvil");
      test.setTimeout(90_000);
      const lcp = await measureLcp(page, path);
      console.log(`LCP ${path}: ${String(Math.round(lcp))} ms`);
      info.annotations.push({ type: `LCP ${path} (ms)`, description: String(Math.round(lcp)) });
      expect(lcp).toBeLessThanOrEqual(budget);
    });
  }
});
