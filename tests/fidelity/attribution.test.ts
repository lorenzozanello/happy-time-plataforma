import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileCurriculum } from "../../scripts/curriculum/compile";
import { LevelAliasesSchema } from "../../scripts/curriculum/lock";
import { ALIASES_PATH } from "../../scripts/curriculum/pipeline";
import { readWorkbook } from "../../scripts/curriculum/xlsx";
import type { CurriculumRelease, Unit } from "../../src/domain/curriculum/schema";
import { artifacts, release, sourceBytes } from "../helpers";
import { cleanupTemps, runVerifier, tamperedWorkspace } from "../verifier-helpers";

cleanupTemps();

const byId = (rel: CurriculumRelease, id: string): Unit => {
  const u = rel.units.find((x) => x.unitId === id);
  if (!u) throw new Error(`falta ${id}`);
  return u;
};

const swap = (a: Unit, b: Unit, keys: (keyof Unit)[]) => {
  for (const k of keys) {
    const tmp = a[k];
    (a as Record<string, unknown>)[k] = b[k];
    (b as Record<string, unknown>)[k] = tmp;
  }
};

describe("F1-05/F1-06 · atribución: cada celda pertenece a la unidad correcta", () => {
  it.each([
    // [unitId, celda esperada, rango] — muestra escrita a mano, una por tipo y nivel.
    ["L:step-1#nivel", "A2", "A2:A5"],
    ["L:kinder#perfil_salida", "G14", "G14:G17"],
    ["L:transicion#equivalencia", "C18", "C18:C21"],
    ["S1.1#titulo", "I2", undefined],
    ["S1.1#juego", "P2", undefined],
    ["S1.1#arte", "S2", undefined],
    ["S3.3#contexto_caribe", "Y12", undefined],
    ["K.2#documentacion_alertas", "AD15", undefined],
    ["T.4#observacion_valoracion", "AG21", undefined],
    ["OBS-1", "A2", undefined],
    ["OBS-7", "A8", undefined],
    ["PROG:step-1#cognitiva", "B2", undefined],
    ["PROG:step-2#corporal", "E3", undefined],
    ["PROG:kinder#estetica", "F5", undefined],
    ["PROG:transicion#etico_moral", "G6", undefined],
  ])("%s está en %s", (id, cell, range) => {
    const u = byId(release(), id);
    expect(u.source.cell).toBe(cell);
    expect(u.source.range).toBe(range);
  });

  it("detecta Juego y Arte intercambiados dentro de la misma experiencia", () => {
    const lock = tamperedWorkspace((rel) => {
      swap(byId(rel, "S1.1#juego"), byId(rel, "S1.1#arte"), [
        "text",
        "source",
        "headerLiteral",
        "segments",
      ]);
    });
    const { code, report } = runVerifier(lock);
    expect(code).toBe(1);
    expect(report.errors.some((e) => e.startsWith("S1.1#juego: source.cell"))).toBe(true);
  });

  it("detecta progresión atribuida al nivel equivocado", () => {
    const lock = tamperedWorkspace((rel) => {
      swap(byId(rel, "PROG:step-1#cognitiva"), byId(rel, "PROG:step-2#cognitiva"), [
        "text",
        "source",
      ]);
    });
    expect(runVerifier(lock).code).toBe(1);
  });

  it("detecta nivel, código o periodo cambiados sin tocar el texto", () => {
    for (const mutate of [
      (rel: CurriculumRelease) => {
        byId(rel, "S1.1#juego").levelId = "kinder";
      },
      (rel: CurriculumRelease) => {
        byId(rel, "S1.1#juego").code = "T.4";
      },
      (rel: CurriculumRelease) => {
        const e = rel.experiences[0];
        if (e) e.periodIndex = 3;
      },
      (rel: CurriculumRelease) => {
        delete byId(rel, "L:step-1#nivel").source.range;
      },
    ]) {
      expect(runVerifier(tamperedWorkspace(mutate)).code).toBe(1);
    }
  });

  it("de punta a punta: un alias de nivel mal configurado se detecta tras recompilar", () => {
    const aliases = LevelAliasesSchema.parse(JSON.parse(readFileSync(ALIASES_PATH, "utf8")));
    const [l1, l2] = aliases.levels;
    if (!l1 || !l2) throw new Error("alias faltantes");
    [l1.progresionLabel, l2.progresionLabel] = [l2.progresionLabel, l1.progresionLabel];
    const { release: bad } = compileCurriculum(
      readWorkbook(sourceBytes()),
      artifacts().gate,
      artifacts().lock,
      aliases,
      { name: "t", version: "0" },
    );
    // El compilador acepta el alias (es configuración válida en forma); el validador no.
    expect(byId(bad, "PROG:step-1#cognitiva").source.cell).toBe("B3");
    const lock = tamperedWorkspace((rel) => {
      Object.assign(rel, bad);
    });
    const { code, report } = runVerifier(lock);
    expect(code).toBe(1);
    expect(report.errors.some((e) => e.startsWith("PROG:step-1#cognitiva"))).toBe(true);
  });
});
