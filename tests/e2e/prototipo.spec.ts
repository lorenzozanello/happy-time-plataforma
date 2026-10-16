import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface Unit {
  unitId: string;
  text: string;
  code?: string;
}
const release = JSON.parse(
  readFileSync(join(process.cwd(), "curriculum", "build", "curriculum.2026-06.json"), "utf8"),
) as { units: Unit[] };
const unit = (id: string) => {
  const u = release.units.find((x) => x.unitId === id);
  if (!u) throw new Error(`falta ${id}`);
  return u;
};

const URL = "?rapido";

async function signIn(page: Page, levels: string[] = ["Step 2"]) {
  await page.goto(URL);
  await page.getByLabel("Tu correo institucional").fill("docente@happytime.edu.co");
  await page.getByRole("button", { name: "Enviarme un código" }).click();
  await page.getByLabel(/Código que enviamos/).fill("123456");
  await page.getByRole("button", { name: "Entrar" }).click();
  for (const l of levels) await page.locator(".check-card", { hasText: l }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("heading", { name: "¿Qué preparamos hoy?" })).toBeVisible();
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function expectTouchTargets(page: Page) {
  const small = await page.evaluate(() => {
    const els = [
      ...document.querySelectorAll<HTMLElement>(
        "main button, main a[href], main input:not([type=checkbox]):not([type=radio]), main summary, main [role=tab], .tabbar button, .topbar button",
      ),
    ];
    return els
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (r.width === 0 || style.visibility === "hidden") return false;
        return r.height < 44 || r.width < 44;
      })
      .map(
        (el) =>
          `${el.tagName} "${(el.getAttribute("aria-label") ?? el.textContent).trim().slice(0, 30)}"`,
      );
  });
  expect(small).toEqual([]);
}

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id}: ${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join(" | ")}`,
    );
  expect(serious).toEqual([]);
}

test.describe("Recorrido 1 · primer ingreso", () => {
  test("valida correo y código, y lleva a elegir niveles", async ({ page }) => {
    await page.goto(URL);
    await page.getByRole("button", { name: "Enviarme un código" }).click();
    await expect(page.getByRole("alert")).toContainText("correo válido");
    await page.getByLabel("Tu correo institucional").fill("docente@happytime.edu.co");
    await page.getByRole("button", { name: "Enviarme un código" }).click();
    await page.getByLabel(/Código que enviamos/).fill("000000");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert")).toContainText("no es válido o ya venció");
    await page.getByLabel(/Código que enviamos/).fill("123456");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("heading", { name: "¿Con qué niveles trabajas?" })).toBeVisible();
    await expectAccessible(page);
    await page.locator(".check-card", { hasText: "Kínder" }).click();
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.locator("main")).toContainText(unit("K.1#titulo").text);
    await expectNoHorizontalScroll(page);
    await expectTouchTargets(page);
    await expectAccessible(page);
  });
});

test.describe("Recorrido 2 · consulta rápida", () => {
  test("de Inicio a la ficha, con procedencia y favorito", async ({ page }) => {
    await signIn(page);
    await page.locator("main").getByText(unit("S2.1#titulo").text).first().click();
    await expect(
      page.getByRole("heading", { level: 1, name: unit("S2.1#titulo").text }),
    ).toBeVisible();
    await expect(page.locator('[data-unit-id="S2.1#alcance"]')).toContainText(
      unit("S2.1#alcance").text,
    );
    await page
      .locator('[data-unit-id="S2.1#alcance"]')
      .getByRole("button", { name: "Fuente" })
      .click();
    await expect(page.locator('[data-unit-id="S2.1#alcance"]')).toContainText(
      "Malla ajustada · celda J6 · release 2026-06",
    );
    await page.getByRole("button", { name: "Guardar en favoritos" }).click();
    await expect(page.getByRole("button", { name: "Quitar de favoritos" })).toBeVisible();
    for (const s of await page.locator("details.group summary").all()) await s.click();
    await expect(page.locator('[data-unit-id="S2.1#documentacion_alertas"] .alerts')).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectTouchTargets(page);
    await expectAccessible(page);
    await page.locator(".tabbar").getByRole("button", { name: "Guardados" }).click();
    await expect(page.locator("main")).toContainText(unit("S2.1#titulo").text);
  });

  test("el reloj de periodos cambia la experiencia y responde al teclado", async ({ page }) => {
    await signIn(page);
    await page.locator(".tabbar").getByRole("button", { name: "Malla" }).click();
    await page.getByRole("radio", { name: /^Periodo III:/ }).click();
    await expect(page.locator(".exp-card--hero")).toContainText(unit("S2.3#titulo").text);
    await page.getByRole("radio", { name: /^Periodo III:/ }).press("ArrowRight");
    await expect(page.getByRole("radio", { name: /^Periodo IV:/ })).toBeFocused();
    await expect(page.locator(".exp-card--hero")).toContainText(unit("S2.4#titulo").text);
    await page.getByRole("tab", { name: /Transición/ }).click();
    await expect(page.locator(".exp-card--hero")).toContainText(unit("T.4#titulo").text);
    await expectNoHorizontalScroll(page);
    await expectTouchTargets(page);
    await expectAccessible(page);
  });
});

test.describe("Recorrido 3 · búsqueda", () => {
  test("busca sin tildes, resalta y abre la ficha", async ({ page }) => {
    await signIn(page);
    await page.locator(".topbar").getByRole("button", { name: "Abrir búsqueda" }).click();
    await page.getByLabel("Buscar en la malla").fill("cancion");
    await expect(page.locator("mark").first()).toBeVisible();
    await expect(page.locator(".results")).toContainText("resultados");
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
    await page.locator(".result").first().click();
    await expect(page.locator(".ficha")).toBeVisible();
  });

  test("sin resultados muestra cómo seguir", async ({ page }) => {
    await signIn(page);
    await page.locator(".topbar").getByRole("button", { name: "Abrir búsqueda" }).click();
    await page.getByLabel("Buscar en la malla").fill("zxqwv");
    await expect(page.getByText("Sin resultados para «zxqwv»")).toBeVisible();
  });
});

test.describe("Recorrido 4 · Happy contextual", () => {
  test("cita la malla literalmente, separa lo generado y guarda ideas", async ({ page }) => {
    await signIn(page);
    await page.locator("main").getByText(unit("S2.1#titulo").text).first().click();
    await page.locator(".ficha__actions").getByRole("button", { name: "Pensemos juntas" }).click();
    await expect(page.getByRole("list", { name: "Contexto activo" })).toContainText("S2.1");
    await page.getByRole("radio", { name: /Necesito ideas/ }).click();
    await page.getByRole("button", { name: "Pedir ideas para S2.1" }).click();
    const ref = page.locator('.block--malla[data-unit-id="S2.1#momento_vivir"]');
    await expect(ref).toContainText("Desde nuestra malla…");
    await expect(ref.locator(".block__literal")).toHaveText(unit("S2.1#momento_vivir").text);
    await expect(page.locator(".block--generated").first()).toContainText(
      "Como idea complementaria…",
    );
    await expect(page.locator(".path")).toHaveCount(3);
    await expect(page.locator(".happy__head .happy-avatar")).toHaveAttribute(
      "data-state",
      /resultado|neutral/,
    );
    await expectNoHorizontalScroll(page);
    await expectTouchTargets(page);
    await expectAccessible(page);
    await page.locator(".path").first().getByRole("button", { name: "Guardar idea" }).click();
    await page.getByRole("button", { name: "Me sirvió", exact: true }).click();
    await expect(page.getByRole("button", { name: "Me sirvió", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.locator(".tabbar").getByRole("button", { name: "Guardados" }).click();
    await page.getByRole("tab", { name: /Ideas/ }).click();
    await expect(page.locator(".idea")).toHaveCount(1);
    await expect(page.locator(".idea")).toContainText("S2.1");
  });

  test("el avatar pasa por Escucha y Piensa con eventos reales", async ({ page }) => {
    await signIn(page);
    await page.locator(".tabbar").getByRole("button", { name: "Happy" }).click();
    const avatar = page.locator(".happy__head .happy-avatar");
    await expect(avatar).toHaveAttribute("data-state", "neutral");
    await page.getByLabel("Mensaje para Happy").fill("rimas");
    await expect(avatar).toHaveAttribute("data-state", "escucha");
    await page.getByLabel("Mensaje para Happy").press("Enter");
    await expect(page.locator(".bubble--docente")).toHaveText("rimas");
    await expect(avatar).toHaveAttribute("data-state", /piensa|idea|resultado/);
    await expect(page.locator(".block--malla").first()).toBeVisible();
  });

  test("ante datos sensibles pide reformular y no los trata", async ({ page }) => {
    await signIn(page);
    await page.locator(".tabbar").getByRole("button", { name: "Happy" }).click();
    await page.getByLabel("Mensaje para Happy").fill("Mi alumna Sofía tiene TDAH, ¿qué hago?");
    await page.getByLabel("Mensaje para Happy").press("Enter");
    await expect(page.locator(".notice--privacy")).toContainText("sin nombres, diagnósticos");
    await expect(page.locator(".block--malla")).toHaveCount(0);
  });

  test("si Happy falla, muestra el error y permite reintentar", async ({ page }) => {
    await signIn(page);
    await page.locator(".topbar").getByRole("button", { name: "Tu perfil" }).click();
    await page.getByLabel("La próxima respuesta de Happy falla").check();
    await page.locator(".tabbar").getByRole("button", { name: "Happy" }).click();
    await page.getByLabel("Mensaje para Happy").fill("rimas");
    await page.getByLabel("Mensaje para Happy").press("Enter");
    await expect(page.getByRole("alert")).toContainText("Happy no pudo responder");
    await expectAccessible(page);
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.locator(".block--malla").first()).toBeVisible();
    await expect(page.locator(".bubble--docente")).toHaveCount(1);
  });
});

test.describe("Recorrido 5 · retomar", () => {
  test("Inicio ofrece continuar donde quedó y retomar la conversación", async ({ page }) => {
    await signIn(page);
    await page.locator(".tabbar").getByRole("button", { name: "Malla" }).click();
    await page.getByRole("radio", { name: /^Periodo II:/ }).click();
    await page.getByRole("button", { name: "Abrir ficha" }).click();
    await page.locator(".tabbar").getByRole("button", { name: "Inicio" }).click();
    await expect(page.getByRole("heading", { name: "Continuar donde quedaste" })).toBeVisible();
    await expect(page.locator(".exp-card--link").first()).toContainText(unit("S2.2#titulo").text);
    await page.locator(".tabbar").getByRole("button", { name: "Happy" }).click();
    await page.getByLabel("Mensaje para Happy").fill("patio");
    await page.getByLabel("Mensaje para Happy").press("Enter");
    await expect(page.locator(".block--malla").first()).toBeVisible();
    await page.locator(".tabbar").getByRole("button", { name: "Inicio" }).click();
    await page.locator(".tabbar").getByRole("button", { name: "Happy" }).click();
    await page.locator(".thread-item", { hasText: "patio" }).click();
    await expect(page.locator(".bubble--docente")).toHaveText("patio");
  });
});

test.describe("Estados y referencia", () => {
  test("vacíos en Guardados", async ({ page }) => {
    await signIn(page);
    await page.locator(".tabbar").getByRole("button", { name: "Guardados" }).click();
    await expect(page.getByText("Aún no tienes favoritos")).toBeVisible();
    await page.getByRole("tab", { name: "Ideas" }).click();
    await expect(page.getByText("Aún no tienes ideas guardadas")).toBeVisible();
    await page.getByRole("tab", { name: "Planeaciones" }).click();
    await expect(page.getByText("Las planeaciones llegan en la siguiente versión")).toBeVisible();
    await expectAccessible(page);
  });

  test("sin conexión: aviso visible y Happy en espera", async ({ page, context }) => {
    await signIn(page);
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.getByText(/Sin conexión\. La malla sigue disponible/)).toBeVisible();
    await page.locator(".tabbar").getByRole("button", { name: "Happy" }).click();
    await expect(page.getByLabel("Mensaje para Happy")).toBeDisabled();
    await context.setOffline(false);
  });

  test("perfil de nivel, progresión, principios e identidad", async ({ page }) => {
    await signIn(page);
    await page.locator(".tabbar").getByRole("button", { name: "Malla" }).click();
    await page.getByRole("button", { name: "Perfil de Step 2" }).click();
    await expect(page.locator("main")).toContainText(unit("L:step-2#perfil_entrada").text);
    await expectAccessible(page);
    await page.getByRole("button", { name: "Volver" }).click();
    await page.getByRole("button", { name: "Progresión por dimensión" }).click();
    await page.getByRole("tab", { name: "Corporal" }).click();
    await expect(page.locator(".progression")).toContainText(unit("PROG:kinder#corporal").text);
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
    await page.getByRole("button", { name: "Volver" }).click();
    await page.getByRole("button", { name: "Principios de la malla" }).click();
    for (let i = 1; i <= 7; i++)
      await expect(page.locator("main")).toContainText(unit(`OBS-${i}`).text);
    await page.locator(".topbar").getByRole("button", { name: "Tu perfil" }).click();
    await page.getByRole("button", { name: /Identidad de Happy/ }).click();
    await expect(page.locator(".identity__grid .happy-avatar")).toHaveCount(25);
    await expectNoHorizontalScroll(page);
    await expectAccessible(page);
  });
});

test.describe("Tema oscuro", () => {
  test.use({ colorScheme: "dark" });
  test("las vistas principales son accesibles en oscuro", async ({ page }) => {
    await signIn(page);
    await expectAccessible(page);
    await page.locator(".tabbar").getByRole("button", { name: "Malla" }).click();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Abrir ficha" }).click();
    for (const s of await page.locator("details.group summary").all()) await s.click();
    await expectAccessible(page);
    await page.locator(".ficha__actions").getByRole("button", { name: "Pensemos juntas" }).click();
    await page.getByRole("radio", { name: /Necesito ideas/ }).click();
    await page.getByRole("button", { name: /Pedir ideas para/ }).click();
    await expect(page.locator(".block--malla").first()).toBeVisible();
    await expectAccessible(page);
  });
});
