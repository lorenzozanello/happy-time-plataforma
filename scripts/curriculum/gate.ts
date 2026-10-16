/**
 * Gate estructural de la fuente curricular (criterio F1-02).
 * Si cualquier comprobación falla, la compilación se detiene.
 */
import { createHash } from "node:crypto";
import type { SourceLock } from "./lock";
import {
  cellRef,
  contentRange,
  indexToCol,
  nonEmptyCells,
  type Sheet,
  type Workbook,
} from "./xlsx";

export interface GateCheck {
  id: string;
  description: string;
  expected: unknown;
  actual: unknown;
  pass: boolean;
}

export interface GateResult {
  pass: boolean;
  checks: GateCheck[];
  info: Record<string, unknown>;
}

const CODE_IN_PERIOD = /^Periodo (I|II|III|IV) \(((?:S[123]|K|T)\.[1-4])\)$/;

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function sheetOrThrow(wb: Workbook, name: string): Sheet {
  const s = wb.sheets.get(name);
  if (!s) throw new Error(`Gate: falta la hoja ${name}`);
  return s;
}

export function runGate(bytes: Uint8Array, wb: Workbook, lock: SourceLock): GateResult {
  const checks: GateCheck[] = [];
  const add = (id: string, description: string, expected: unknown, actual: unknown) => {
    checks.push({ id, description, expected, actual, pass: same(expected, actual) });
  };

  add("G01", "SHA-256 de la fuente", lock.sha256, createHash("sha256").update(bytes).digest("hex"));
  add("G02", "Tamaño en bytes", lock.size_bytes, bytes.byteLength);
  add("G03", "Hojas: nombres exactos y orden", lock.sheets, wb.sheetNames);
  if (!same(lock.sheets, wb.sheetNames)) {
    return { pass: false, checks, info: {} };
  }

  const ma = sheetOrThrow(wb, lock.malla.sheet);
  const ob = sheetOrThrow(wb, lock.observaciones.sheet);
  const pr = sheetOrThrow(wb, lock.progresion.sheet);
  const val = (s: Sheet, row: number, col: number) => s.cells.get(cellRef(row, col))?.value ?? "";

  add("G04", "Rango de contenido Malla", lock.malla.content_range, contentRange(ma));
  add(
    "G05",
    "Rango de contenido Observaciones",
    lock.observaciones.content_range,
    contentRange(ob),
  );
  add("G06", "Rango de contenido Progresión", lock.progresion.content_range, contentRange(pr));

  const maNonEmpty = nonEmptyCells(ma);
  add("G07", "Celdas no vacías Malla A1:AG21", lock.malla.nonempty_cells_total, maNonEmpty.length);
  add(
    "G08",
    "Celdas no vacías Malla filas 2–21",
    lock.malla.nonempty_cells_experience_rows,
    maNonEmpty.filter((c) => c.row >= 2).length,
  );

  const headers = Array.from({ length: 33 }, (_, i) => val(ma, 1, i + 1));
  add("G09", "33 encabezados literales de Malla", lock.malla.headers, headers);

  // Bloques de nivel: columnas A–G combinadas en bloques de 4 filas (2–5, 6–9, …, 18–21).
  const block = lock.malla.level_block_rows;
  const expectedMerges: string[] = [];
  for (let b = 0; b < 5; b++) {
    for (let col = 1; col <= 7; col++) {
      const c = indexToCol(col);
      expectedMerges.push(`${c}${2 + b * block}:${c}${1 + (b + 1) * block}`);
    }
  }
  add(
    "G10",
    "35 rangos combinados A–G por nivel",
    [...expectedMerges].sort(),
    [...ma.merges].sort(),
  );

  const followersWithValue: string[] = [];
  for (let b = 0; b < 5; b++) {
    for (let col = 1; col <= 7; col++) {
      for (let r = 3 + b * block; r <= 1 + (b + 1) * block; r++) {
        if (val(ma, r, col) !== "") followersWithValue.push(cellRef(r, col));
      }
    }
  }
  add("G11", "Celdas interiores de rangos combinados vacías", [], followersWithValue);

  const levelLabels = Array.from({ length: 5 }, (_, b) => val(ma, 2 + b * block, 1));
  add("G12", "5 niveles con etiqueta", 5, levelLabels.filter((l) => l !== "").length);

  const periodCol = headers.indexOf("Periodo / código") + 1;
  const codes = Array.from({ length: 20 }, (_, i) => {
    const m = CODE_IN_PERIOD.exec(val(ma, i + 2, periodCol));
    return m?.[2] ?? null;
  });
  add("G13", "20 códigos de periodo en orden", lock.malla.period_codes, codes);
  add("G14", "Códigos únicos", 20, new Set(codes).size);

  const gaps: string[] = [];
  for (let r = 2; r <= 21; r++) {
    for (let col = 8; col <= 33; col++) {
      if (val(ma, r, col) === "") gaps.push(cellRef(r, col));
    }
  }
  add("G15", "Sin vacíos en H–AG (filas 2–21)", [], gaps);

  add("G16", "Encabezado Observaciones", lock.observaciones.header, val(ob, 1, 1));
  const obs = Array.from({ length: 7 }, (_, i) => val(ob, i + 2, 1));
  add(
    "G17",
    "7 observaciones (A2:A8)",
    lock.observaciones.count,
    obs.filter((o) => o !== "").length,
  );

  const prHeaders = Array.from({ length: 7 }, (_, i) => val(pr, 1, i + 1));
  add("G18", "Encabezados de Progresión", lock.progresion.headers, prHeaders);
  const prLabels = Array.from({ length: 5 }, (_, i) => val(pr, i + 2, 1));
  add("G19", "Etiquetas de nivel en Progresión", lock.progresion.row_labels, prLabels);
  let prCount = 0;
  for (let r = 2; r <= 6; r++)
    for (let col = 2; col <= 7; col++) if (val(pr, r, col) !== "") prCount++;
  add("G20", "30 contenidos de progresión (B2:G6)", lock.progresion.count, prCount);

  const nonString = [ma, ob, pr].flatMap((s) =>
    nonEmptyCells(s)
      .filter((c) => c.type !== "s" && c.type !== "inlineStr")
      .map((c) => `${s.name}!${c.ref}:${c.type}`),
  );
  add("G21", "Solo celdas de texto (sin fórmulas ni números)", [], nonString);

  const blankish = [ma, ob, pr].flatMap((s) =>
    nonEmptyCells(s)
      .filter((c) => c.value.trim() === "")
      .map((c) => `${s.name}!${c.ref}`),
  );
  add("G22", "Sin celdas solo con espacios", [], blankish);

  const info = {
    levelLabels,
    xmlRowCount: {
      [ma.name]: ma.xmlRowCount,
      [ob.name]: ob.xmlRowCount,
      [pr.name]: pr.xmlRowCount,
    },
    cellsWithEdgeWhitespace: [ma, ob, pr].flatMap((s) =>
      nonEmptyCells(s)
        .filter((c) => c.value !== c.value.trim())
        .map((c) => `${s.name}!${c.ref}`),
    ),
  };
  return { pass: checks.every((c) => c.pass), checks, info };
}
