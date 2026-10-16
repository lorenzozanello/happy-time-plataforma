import { describe, expect, it } from "vitest";
import { createRepository } from "../../src/domain/curriculum/repository";
import { searchUnits, loadSearchIndex, buildSearchIndex } from "../../src/domain/curriculum/search";
import {
  buildCatalog,
  buildFicha,
  buildLevel,
  buildPrinciples,
  buildProgression,
  buildSearchBundle,
  codeToSlug,
  slugToCode,
  unitExperienceCode,
} from "../../src/domain/curriculum/views";
import { hrefToRoute, routeToHref } from "../../src/ui/app/routes";
import type { Route } from "../../src/ui/app/types";
import { release } from "../helpers";

const repo = createRepository(release());
const catalog = buildCatalog(repo);

describe("F3 · modelos de vista", () => {
  it("el catálogo trae los 5 niveles y las 20 experiencias con sus unidades literales", () => {
    expect(catalog.levels).toHaveLength(5);
    expect(catalog.experiences).toHaveLength(20);
    for (const e of catalog.experiences) {
      expect(e.title).toEqual(repo.unit(e.title.unitId));
      expect(e.alcance).toEqual(repo.experienceField(e.code, "alcance"));
    }
    expect(catalog.unitCount).toBe(release().units.length);
  });

  it("cada ficha lleva sus 24 campos literales y nada más de la malla", () => {
    for (const e of catalog.experiences) {
      const f = buildFicha(repo, e.code);
      if (!f) throw new Error(e.code);
      const exp = repo.experience(e.code);
      expect(Object.keys(f.fields).sort()).toEqual(Object.keys(exp.fieldUnitIds).sort());
      for (const [k, u] of Object.entries(f.fields))
        expect(u).toEqual(repo.unit(exp.fieldUnitIds[k as keyof typeof exp.fieldUnitIds]));
      expect(f.prev?.code).toBe(repo.neighbors(e.code).prev?.code);
      expect(f.next?.code).toBe(repo.neighbors(e.code).next?.code);
    }
    expect(buildFicha(repo, "Z9.9")).toBeUndefined();
  });

  it("nivel, progresión y principios usan las unidades del repositorio", () => {
    const l = buildLevel(repo, "kinder");
    expect(l?.experiences).toHaveLength(4);
    expect(l?.progression).toEqual(repo.progressionOf("kinder"));
    expect(buildLevel(repo, "primaria")).toBeUndefined();
    expect(buildProgression(repo).cells).toHaveLength(release().progression.length);
    expect(buildPrinciples(repo).units).toEqual(repo.observations);
  });

  it("el paquete de búsqueda serializado da los mismos resultados que el índice del dominio", () => {
    const bundle = JSON.parse(JSON.stringify(buildSearchBundle(repo))) as ReturnType<
      typeof buildSearchBundle
    >;
    expect(bundle.units).toHaveLength(release().units.length);
    const fromBundle = loadSearchIndex(bundle.index);
    const direct = buildSearchIndex(release());
    for (const q of ["rimas", "cancion", "vínculo seguro", "patio", "zxqwv"]) {
      const a = searchUnits(fromBundle, q, () => true).map((h) => h.unitId);
      const b = searchUnits(direct, q, () => true).map((h) => h.unitId);
      expect(a, q).toEqual(b);
    }
  });

  it("slugs de URL y código de experiencia de una unidad", () => {
    for (const e of catalog.experiences) expect(slugToCode(codeToSlug(e.code))).toBe(e.code);
    expect(codeToSlug("S2.1")).toBe("s2-1");
    expect(unitExperienceCode(catalog, "S2.1#juego")).toBe("S2.1");
    expect(unitExperienceCode(catalog, "OBS-1")).toBeUndefined();
    expect(unitExperienceCode(catalog, "L:step-1#perfil_entrada")).toBeUndefined();
  });
});

describe("F3-02 · rutas ↔ URLs", () => {
  const routes: Route[] = [
    { name: "home" },
    { name: "malla" },
    { name: "malla", levelId: "transicion", periodIndex: 3 },
    { name: "ficha", code: "S2.1" },
    { name: "ficha", code: "T.4" },
    { name: "search" },
    { name: "search", q: "vínculo seguro & juego" },
    { name: "level", levelId: "step-3" },
    { name: "progression" },
    { name: "principles" },
    { name: "happy", mode: "explorar", threadId: "abc" },
    { name: "saved", tab: "ideas" },
    { name: "identity" },
    { name: "tools" },
  ];

  it("ida y vuelta sin pérdida", () => {
    for (const r of routes) {
      const href = routeToHref(r);
      const url = new URL(href, "https://x.test");
      expect(hrefToRoute(url.pathname, url.searchParams), href).toEqual(r);
    }
  });

  it("parámetros inválidos se ignoran en lugar de romper", () => {
    const p = (s: string) => new URLSearchParams(s);
    expect(hrefToRoute("/malla", p("nivel=primaria&periodo=9"))).toEqual({ name: "malla" });
    expect(hrefToRoute("/guardados", p("pestana=otra"))).toEqual({ name: "saved" });
    expect(hrefToRoute("/happy", p("modo=borrar"))).toEqual({ name: "happy" });
    expect(hrefToRoute("/niveles/primaria", p(""))).toEqual({ name: "home" });
  });
});
