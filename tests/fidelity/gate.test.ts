import { describe, expect, it } from "vitest";
import { runGate } from "../../scripts/curriculum/gate";
import { compileCurriculum } from "../../scripts/curriculum/compile";
import { cellRef, readWorkbook } from "../../scripts/curriculum/xlsx";
import { artifacts, sourceBytes } from "../helpers";
import { readFileSync } from "node:fs";
import { LevelAliasesSchema } from "../../scripts/curriculum/lock";
import { ALIASES_PATH } from "../../scripts/curriculum/pipeline";

describe("F1-01/F1-02 · gate de la fuente certificada", () => {
  it("pasa todas las comprobaciones sobre el Excel versionado", () => {
    const { gate } = artifacts();
    const failed = gate.checks.filter((c) => !c.pass);
    expect(failed).toEqual([]);
    expect(gate.checks.length).toBeGreaterThanOrEqual(22);
  });

  it("detecta un solo byte alterado (huella)", () => {
    const bytes = sourceBytes().slice();
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 0xff;
    const { lock } = artifacts();
    const gate = runGate(bytes, readWorkbook(sourceBytes()), lock);
    expect(gate.checks.find((c) => c.id === "G01")?.pass).toBe(false);
    expect(gate.pass).toBe(false);
  });

  it("detecta un texto curricular vaciado (hueco en H–AG)", () => {
    const wb = readWorkbook(sourceBytes());
    wb.sheets.get("Malla ajustada")?.cells.delete(cellRef(7, 20));
    const gate = runGate(sourceBytes(), wb, artifacts().lock);
    expect(gate.checks.find((c) => c.id === "G15")?.pass).toBe(false);
  });
});

describe("F1-03 · enlace por encabezado literal", () => {
  const aliases = LevelAliasesSchema.parse(JSON.parse(readFileSync(ALIASES_PATH, "utf8")));

  it("el gate falla si se renombra un encabezado", () => {
    const wb = readWorkbook(sourceBytes());
    const cell = wb.sheets.get("Malla ajustada")?.cells.get("P1");
    if (!cell) throw new Error("falta P1");
    cell.value = "Juego";
    const gate = runGate(sourceBytes(), wb, artifacts().lock);
    expect(gate.checks.find((c) => c.id === "G09")?.pass).toBe(false);
  });

  it("aunque se forzara el gate, el compilador se niega a enlazar encabezados desconocidos", () => {
    const wb = readWorkbook(sourceBytes());
    const cells = wb.sheets.get("Malla ajustada")?.cells;
    const p1 = cells?.get("P1");
    if (!p1) throw new Error("falta P1");
    p1.value = "Juego";
    const forced = { pass: true, checks: [], info: {} };
    expect(() =>
      compileCurriculum(wb, forced, artifacts().lock, aliases, { name: "t", version: "0" }),
    ).toThrow(/encabezado/);
  });

  it("si dos columnas se intercambian, los textos siguen su encabezado, no su letra", () => {
    const wb = readWorkbook(sourceBytes());
    const ma = wb.sheets.get("Malla ajustada");
    if (!ma) throw new Error("falta Malla");
    // Intercambia columnas Y (Contexto Caribe) y Z (GIRE) completas, encabezado incluido.
    for (let r = 1; r <= 21; r++) {
      const y = ma.cells.get(cellRef(r, 25));
      const z = ma.cells.get(cellRef(r, 26));
      if (!y || !z) throw new Error("celda faltante");
      [y.value, z.value] = [z.value, y.value];
    }
    const forced = { pass: true, checks: [], info: {} };
    const { release } = compileCurriculum(wb, forced, artifacts().lock, aliases, {
      name: "t",
      version: "0",
    });
    const original = artifacts().compiled.release;
    const pick = (rel: typeof release, id: string) => rel.units.find((u) => u.unitId === id);
    expect(pick(release, "S1.1#gire")?.text).toBe(pick(original, "S1.1#gire")?.text);
    expect(pick(release, "S1.1#gire")?.source.cell).toBe("Y2");
  });
});
