import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXPERIENCE_FIELDS, LEVEL_FIELDS } from "../../src/domain/curriculum/fields";
import { ALLOWED_SEGMENT_PREFIXES } from "../../src/domain/curriculum/segments";
import { runPipeline } from "../../scripts/curriculum/pipeline";
import { artifacts, BUILD_DIR, committedRelease, release } from "../helpers";

describe("F1-04 · 572 unidades con procedencia", () => {
  it("cuenta exacta por tipo", () => {
    expect(release().counts).toEqual({
      units: 572,
      experienceFields: 480,
      experienceTitles: 20,
      levelFields: 35,
      observations: 7,
      progression: 30,
    });
    expect(release().units).toHaveLength(572);
  });

  it("cada unidad declara hoja, celda, encabezado, autoridad y release", () => {
    for (const u of release().units) {
      expect(u.authority).toBe("official_curriculum");
      expect(u.release).toBe("2026-06");
      expect(u.source.sheet.length).toBeGreaterThan(0);
      expect(u.source.cell).toMatch(/^[A-Z]{1,2}\d{1,2}$/);
      expect(u.headerLiteral).toBe(u.source.header);
      expect(u.text.length).toBeGreaterThan(0);
    }
  });

  it("los campos de nivel apuntan al rango combinado completo", () => {
    const lf = release().units.filter((u) => u.kind === "level_field");
    expect(lf).toHaveLength(35);
    for (const u of lf) expect(u.source.range).toMatch(/^([A-G])(\d+):\1(\d+)$/);
    const nivelS1 = lf.find((u) => u.unitId === "L:step-1#nivel");
    expect(nivelS1?.source.range).toBe("A2:A5");
  });

  it("cada experiencia tiene sus 24 campos y su título", () => {
    const ids = new Set(release().units.map((u) => u.unitId));
    for (const e of release().experiences) {
      expect(Object.keys(e.fieldUnitIds)).toHaveLength(24);
      for (const f of EXPERIENCE_FIELDS) expect(ids.has(`${e.code}#${f.key}`)).toBe(true);
      expect(ids.has(e.titleUnitId)).toBe(true);
    }
  });
});

describe("F1-06 · niveles canónicos", () => {
  it("5 niveles en orden con IDs canónicos y literales de la fuente", () => {
    const lv = release().levels;
    expect(lv.map((l) => l.id)).toEqual(["step-1", "step-2", "step-3", "kinder", "transicion"]);
    expect(lv.map((l) => l.labelLiteral)).toEqual([
      "Step 1",
      "Step 2",
      "Step 3",
      "Kínder",
      "Transición",
    ]);
    expect(lv.find((l) => l.id === "kinder")?.progresionLabelLiteral).toBe("Jardín/Kínder");
    for (const l of lv) expect(Object.keys(l.fieldUnitIds)).toHaveLength(LEVEL_FIELDS.length);
  });

  it("cada código pertenece al nivel de su bloque y los periodos van 1–4", () => {
    for (const l of release().levels) {
      expect(l.periodCodes).toEqual([1, 2, 3, 4].map((n) => `${l.codePrefix}.${n}`));
    }
    for (const e of release().experiences) {
      expect(e.code.endsWith(`.${e.periodIndex}`)).toBe(true);
    }
  });

  it("la progresión cubre 5 niveles × 6 dimensiones", () => {
    const p = release().progression;
    expect(new Set(p.map((x) => x.levelId)).size).toBe(5);
    expect(new Set(p.map((x) => x.dimensionKey)).size).toBe(6);
  });
});

describe("F1-07 · segmentación derivada", () => {
  const segmented = [
    "juego",
    "exploracion_medio",
    "literatura",
    "arte",
    "propositos",
    "documentacion_alertas",
  ];

  it("los campos compuestos están segmentados en 20/20 experiencias", () => {
    for (const key of segmented) {
      const us = release().units.filter((u) => u.fieldKey === key);
      expect(us).toHaveLength(20);
      for (const u of us) expect(u.segments, u.unitId).toBeDefined();
    }
  });

  it("ningún otro campo se segmenta", () => {
    for (const u of release().units) {
      if (!segmented.includes(u.fieldKey)) expect(u.segments).toBeUndefined();
    }
  });

  it("segmentos contiguos que reconstruyen el literal exacto", () => {
    for (const u of release().units) {
      if (!u.segments) continue;
      expect(u.segments.map((s) => u.text.slice(s.start, s.end)).join("")).toBe(u.text);
      let pos = 0;
      for (const s of u.segments) {
        expect(s.start).toBe(pos);
        expect(s.start <= s.valueStart && s.valueStart <= s.valueEnd && s.valueEnd <= s.end).toBe(
          true,
        );
        expect(ALLOWED_SEGMENT_PREFIXES.has(u.text.slice(s.start, s.valueStart))).toBe(true);
        expect(u.text.slice(s.valueEnd, s.end).trim()).toBe("");
        expect(s.valueEnd).toBeGreaterThan(s.valueStart);
        pos = s.end;
      }
      expect(pos).toBe(u.text.length);
    }
  });

  it("los 3 propósitos esenciales se derivan como compartidos (idénticos en las 20 filas)", () => {
    const p = release().purposes;
    expect(p.map((x) => x.n)).toEqual([1, 2, 3]);
    for (const x of p) expect(x.occurrences).toHaveLength(20);
  });

  it("compila sin avisos", () => {
    expect(artifacts().compiled.warnings).toEqual([]);
  });
});

describe("F1-08 · determinismo", () => {
  it("dos compilaciones producen exactamente los mismos bytes", () => {
    const a = runPipeline().files;
    const b = runPipeline().files;
    expect(a).toEqual(b);
  });

  it("los artefactos versionados coinciden con la recompilación", () => {
    for (const [name, content] of Object.entries(artifacts().files)) {
      expect(readFileSync(join(BUILD_DIR, name), "utf8"), name).toBe(content);
    }
    expect(committedRelease()).toEqual(release());
  });
});
