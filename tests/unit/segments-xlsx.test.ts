import { describe, expect, it } from "vitest";
import {
  RECTORA_LABELS,
  segmentAlertas,
  segmentLabeled,
  segmentPropositos,
} from "../../src/domain/curriculum/segments";
import {
  colToIndex,
  decodeOoxmlEscapes,
  indexToCol,
  parseRef,
} from "../../scripts/curriculum/xlsx";

describe("segmentación (casos sintéticos)", () => {
  it("segmenta Tema/Competencia/Avance/Evidencia y respeta el literal", () => {
    const t = "Tema: a b. Competencia: c. Avance: d. Evidencia: e.";
    const s = segmentLabeled(t, RECTORA_LABELS);
    expect(s?.map((x) => t.slice(x.valueStart, x.valueEnd))).toEqual(["a b.", "c.", "d.", "e."]);
  });

  it("rechaza etiquetas faltantes, repetidas o fuera de orden", () => {
    expect(segmentLabeled("Tema: a. Avance: d. Evidencia: e.", RECTORA_LABELS)).toBeNull();
    expect(
      segmentLabeled("Tema: a. Tema: x. Competencia: c. Avance: d. Evidencia: e.", RECTORA_LABELS),
    ).toBeNull();
    expect(
      segmentLabeled("Competencia: c. Tema: a. Avance: d. Evidencia: e.", RECTORA_LABELS),
    ).toBeNull();
    expect(
      segmentLabeled("Intro. Tema: a. Competencia: c. Avance: d. Evidencia: e.", RECTORA_LABELS),
    ).toBeNull();
  });

  it("separa documentación y alertas solo con un único 'Alertas:'", () => {
    const t = "Registro. Alertas: algo; activar diálogo.";
    expect(segmentAlertas(t)?.map((x) => t.slice(x.valueStart, x.valueEnd))).toEqual([
      "Registro.",
      "algo; activar diálogo.",
    ]);
    expect(segmentAlertas("Alertas: x")).toBeNull();
    expect(segmentAlertas("a. Alertas: x. Alertas: y")).toBeNull();
  });

  it("segmenta 3 propósitos con su logro", () => {
    const t = [
      "1. A.\nEn esta experiencia se logra cuando x.",
      "2. B.\nEn esta experiencia se logra cuando y.",
      "3. C.\nEn esta experiencia se logra cuando z.",
    ].join("\n\n");
    const s = segmentPropositos(t);
    expect(s).toHaveLength(6);
    expect(s?.map((x) => t.slice(x.start, x.end)).join("")).toBe(t);
    expect(
      s?.filter((x) => x.key.startsWith("proposito")).map((x) => t.slice(x.valueStart, x.valueEnd)),
    ).toEqual(["A.", "B.", "C."]);
    expect(segmentPropositos("1. A.\nEn esta experiencia se logra cuando x.")).toBeNull();
  });
});

describe("lector XLSX (utilidades)", () => {
  it("convierte columnas en ambos sentidos", () => {
    for (const n of [1, 26, 27, 33, 52, 702]) expect(colToIndex(indexToCol(n))).toBe(n);
    expect(indexToCol(33)).toBe("AG");
    expect(parseRef("AG21")).toEqual({ col: 33, row: 21 });
  });

  it("decodifica escapes OOXML", () => {
    expect(decodeOoxmlEscapes("a_x000D_b")).toBe("a\rb");
    expect(decodeOoxmlEscapes("sin escapes")).toBe("sin escapes");
  });
});
