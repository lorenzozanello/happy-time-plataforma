import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSearchIndex,
  loadSearchIndex,
  normalizeForSearch,
  processTerm,
} from "../../src/domain/curriculum/search";
import { BUILD_DIR, release } from "../helpers";

describe("F1-10 · índice de búsqueda", () => {
  const index = loadSearchIndex(readFileSync(join(BUILD_DIR, "search-index.2026-06.json"), "utf8"));
  const units = new Map(release().units.map((u) => [u.unitId, u]));

  it("indexa las 572 unidades", () => {
    expect(index.documentCount).toBe(572);
  });

  it("normaliza tildes, mayúsculas y tipografía solo para buscar", () => {
    expect(normalizeForSearch("Exploración – “Caribe”")).toBe('exploracion - "caribe"');
    expect(processTerm("de")).toBeNull();
    expect(processTerm("Rimas")).toBe("rimas");
  });

  it.each(["rimas", "ritmo", "exploracion", "BARRANQUILLA"])("encuentra '%s'", (q) => {
    const hits = index.search(q);
    expect(hits.length).toBeGreaterThan(0);
    const top = units.get(String(hits[0]?.id));
    expect(top).toBeDefined();
    expect(normalizeForSearch(top?.text ?? "")).toContain(normalizeForSearch(q));
  });

  it("devuelve unitId resolubles a texto literal", () => {
    for (const h of index.search("juego simbolico")) expect(units.has(String(h.id))).toBe(true);
  });

  it("es determinista", () => {
    expect(JSON.stringify(buildSearchIndex(release()))).toBe(
      JSON.stringify(buildSearchIndex(release())),
    );
  });
});
