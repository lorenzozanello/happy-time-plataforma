import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface Unit {
  unitId: string;
  text: string;
  code?: string;
}
export const release = JSON.parse(
  readFileSync(join(process.cwd(), "curriculum", "build", "curriculum.2026-06.json"), "utf8"),
) as { units: Unit[] };
export const unit = (id: string) => {
  const u = release.units.find((x) => x.unitId === id);
  if (!u) throw new Error(`falta ${id}`);
  return u;
};

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

export async function expectTouchTargets(page: Page) {
  const small = await page.evaluate(() => {
    const els = [
      ...document.querySelectorAll<HTMLElement>(
        "main button, main a[href], main input:not([type=checkbox]):not([type=radio]), main summary, main [role=tab], .tabbar button, .tabbar a, .topbar button, .topbar a",
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

export async function expectAccessible(page: Page) {
  // axe evalúa el diseño en la posición actual; desde arriba nada queda bajo el encabezado fijo.
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
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

/** Cada unidad de la ficha abierta muestra su literal exacto (o sus segmentos), con data-unit-id. */
export async function expectFichaLiterals(page: Page, code: string) {
  const closed = page.locator("details.group:not([open]) summary");
  while ((await closed.count()) > 0) await closed.first().click();
  const problems = await page.evaluate(
    ({ units }) =>
      units.flatMap((u) => {
        const el = document.querySelector(`[data-unit-id="${u.unitId}"]`);
        if (!el) return [`${u.unitId}: no está en la ficha`];
        const shown = el.textContent.replace(/\s+/g, " ");
        const pieces = u.segs.length ? u.segs : [u.text];
        return pieces.every((p) => shown.includes(p.replace(/\s+/g, " ")))
          ? []
          : [`${u.unitId}: el literal no coincide`];
      }),
    {
      units: release.units
        .filter((u) => u.code === code && !u.unitId.endsWith("#titulo"))
        .map((u) => {
          const full = u as Unit & {
            segments?: { valueStart: number; valueEnd: number }[];
          };
          return {
            unitId: u.unitId,
            text: u.text,
            segs: (full.segments ?? []).map((s) => u.text.slice(s.valueStart, s.valueEnd)),
          };
        }),
    },
  );
  expect(problems).toEqual([]);
}

/** Código de acceso del piloto que arranca el servidor de e2e (playwright.app.config.ts). */
export const HAPPY_ACCESS_CODE = "piloto-e2e-2026";

/** Deja el código del piloto guardado antes de cargar la app (como una docente que ya lo escribió). */
export async function withHappyAccess(page: Page, code: string = HAPPY_ACCESS_CODE) {
  await page.addInitScript((c: string) => {
    window.localStorage.setItem("ht.app.happy.acceso", c);
  }, code);
}
