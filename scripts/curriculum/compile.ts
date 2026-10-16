/**
 * Compilador determinista: XLSX certificado → release curricular canónica (Baseline v1 §6).
 * El texto de cada unidad es el valor exacto de su celda. No hay trim, corrección ni normalización.
 */
import {
  EXPERIENCE_FIELDS,
  LEVEL_FIELDS,
  PERIOD_HEADER,
  PERIOD_ROMANS,
  PROGRESSION_DIMENSIONS,
  TITLE_HEADER,
  type LevelId,
} from "../../src/domain/curriculum/fields";
import {
  CurriculumReleaseSchema,
  type CurriculumRelease,
  type Experience,
  type Level,
  type Segment,
  type Unit,
} from "../../src/domain/curriculum/schema";
import {
  RECTORA_LABELS,
  segmentAlertas,
  segmentLabeled,
  segmentPropositos,
} from "../../src/domain/curriculum/segments";
import type { GateResult } from "./gate";
import type { LevelAliases, SourceLock } from "./lock";
import { cellRef, type Sheet, type Workbook } from "./xlsx";

export interface CompileResult {
  release: CurriculumRelease;
  warnings: string[];
}

const CODE_IN_PERIOD = /^Periodo (I|II|III|IV) \(((?:S[123]|K|T)\.[1-4])\)$/;

function must<T>(v: T | undefined | null, msg: string): T {
  if (v === undefined || v === null) throw new Error(`Compilación: ${msg}`);
  return v;
}

export function compileCurriculum(
  wb: Workbook,
  gate: GateResult,
  lock: SourceLock,
  aliases: LevelAliases,
  compiler: { name: string; version: string },
): CompileResult {
  if (!gate.pass) {
    const failed = gate.checks.filter((c) => !c.pass).map((c) => `${c.id} ${c.description}`);
    throw new Error(`Compilación detenida: el gate falló (${failed.join("; ")})`);
  }
  const warnings: string[] = [];
  const release = lock.release;
  const ma = must(wb.sheets.get(lock.malla.sheet), "falta Malla");
  const ob = must(wb.sheets.get(lock.observaciones.sheet), "falta Observaciones");
  const pr = must(wb.sheets.get(lock.progresion.sheet), "falta Progresión");
  const val = (s: Sheet, row: number, col: number) => s.cells.get(cellRef(row, col))?.value ?? "";

  // Enlace por encabezado literal (H-13): cada encabezado esperado debe aparecer exactamente una vez.
  const headers = Array.from({ length: 33 }, (_, i) => val(ma, 1, i + 1));
  const colOf = (header: string): number => {
    const idx = headers.indexOf(header);
    if (idx === -1 || headers.lastIndexOf(header) !== idx) {
      throw new Error(`Compilación: encabezado "${header}" ausente o duplicado en ${ma.name}`);
    }
    return idx + 1;
  };
  const boundHeaders = [
    ...LEVEL_FIELDS.map((f) => f.header),
    PERIOD_HEADER,
    TITLE_HEADER,
    ...EXPERIENCE_FIELDS.map((f) => f.header),
  ];
  const unbound = headers.filter((h) => !boundHeaders.includes(h));
  if (unbound.length > 0 || boundHeaders.length !== 33) {
    throw new Error(`Compilación: encabezados sin enlazar: ${unbound.join(", ")}`);
  }

  const levelByMallaLabel = new Map(aliases.levels.map((l) => [l.mallaLabel, l]));
  const levelByProgLabel = new Map(aliases.levels.map((l) => [l.progresionLabel, l]));
  const levelByPrefix = new Map(aliases.levels.map((l) => [l.codePrefix, l]));

  const units: Unit[] = [];
  const unit = (u: Omit<Unit, "authority" | "release">): Unit => {
    const full: Unit = { ...u, authority: "official_curriculum", release };
    units.push(full);
    return full;
  };

  // ── Niveles (A–G combinadas por bloques) ─────────────────────────────────────
  const block = lock.malla.level_block_rows;
  const levels: Level[] = [];
  for (let b = 0; b < 5; b++) {
    const top = 2 + b * block;
    const bottom = top + block - 1;
    const label = val(ma, top, colOf("Nivel"));
    const alias = must(levelByMallaLabel.get(label), `nivel "${label}" sin alias en levels.json`);
    const fieldUnitIds = {} as Record<(typeof LEVEL_FIELDS)[number]["key"], string>;
    for (const f of LEVEL_FIELDS) {
      const col = colOf(f.header);
      const u = unit({
        unitId: `L:${alias.id}#${f.key}`,
        kind: "level_field",
        fieldKey: f.key,
        headerLiteral: f.header,
        text: val(ma, top, col),
        source: {
          sheet: ma.name,
          cell: cellRef(top, col),
          range: `${cellRef(top, col)}:${cellRef(bottom, col)}`,
          header: f.header,
        },
        levelId: alias.id,
      });
      fieldUnitIds[f.key] = u.unitId;
    }
    levels.push({
      id: alias.id,
      codePrefix: alias.codePrefix,
      labelLiteral: label,
      progresionLabelLiteral: alias.progresionLabel,
      aliases: alias.aliases,
      fieldUnitIds,
      periodCodes: [],
    });
  }

  // ── Experiencias (filas 2–21) ─────────────────────────────────────────────────
  const experiences: Experience[] = [];
  const periodCol = colOf(PERIOD_HEADER);
  const titleCol = colOf(TITLE_HEADER);
  for (let row = 2; row <= 21; row++) {
    const periodLiteral = val(ma, row, periodCol);
    const m = must(
      CODE_IN_PERIOD.exec(periodLiteral),
      `periodo ilegible en ${cellRef(row, periodCol)}`,
    );
    const roman = must(m[1], "romano");
    const code = must(m[2], "código");
    const periodIndex = PERIOD_ROMANS.indexOf(roman as (typeof PERIOD_ROMANS)[number]) + 1;
    if (Number(code.split(".")[1]) !== periodIndex) {
      throw new Error(`Compilación: ${code} no coincide con Periodo ${roman}`);
    }
    const blockIndex = Math.floor((row - 2) / block);
    const level = must(levels[blockIndex], "nivel de la fila");
    const byPrefix = must(levelByPrefix.get(code.split(".")[0] ?? ""), `prefijo de ${code}`);
    if (byPrefix.id !== level.id) {
      throw new Error(
        `Compilación: ${code} está en el bloque de ${level.id}, no de ${byPrefix.id}`,
      );
    }
    level.periodCodes.push(code);

    const title = unit({
      unitId: `${code}#titulo`,
      kind: "experience_title",
      fieldKey: "titulo",
      headerLiteral: TITLE_HEADER,
      text: val(ma, row, titleCol),
      source: { sheet: ma.name, cell: cellRef(row, titleCol), header: TITLE_HEADER },
      levelId: level.id,
      code,
    });

    const fieldUnitIds = {} as Record<(typeof EXPERIENCE_FIELDS)[number]["key"], string>;
    for (const f of EXPERIENCE_FIELDS) {
      const col = colOf(f.header);
      const text = val(ma, row, col);
      let segments: Segment[] | null = null;
      if (f.group === "actividades_rectoras") segments = segmentLabeled(text, RECTORA_LABELS);
      else if (f.key === "propositos") segments = segmentPropositos(text);
      else if (f.key === "documentacion_alertas") segments = segmentAlertas(text);
      const expectsSegments =
        f.group === "actividades_rectoras" ||
        f.key === "propositos" ||
        f.key === "documentacion_alertas";
      if (expectsSegments && segments === null) {
        warnings.push(
          `${code}#${f.key}: patrón de segmentación no reconocido; se muestra completo`,
        );
      }
      const u = unit({
        unitId: `${code}#${f.key}`,
        kind: "experience_field",
        fieldKey: f.key,
        headerLiteral: f.header,
        text,
        source: { sheet: ma.name, cell: cellRef(row, col), header: f.header },
        levelId: level.id,
        code,
        ...(segments ? { segments } : {}),
      });
      fieldUnitIds[f.key] = u.unitId;
    }
    experiences.push({
      code,
      levelId: level.id,
      periodIndex,
      periodLiteral,
      periodSource: { sheet: ma.name, cell: cellRef(row, periodCol), header: PERIOD_HEADER },
      titleUnitId: title.unitId,
      fieldUnitIds,
    });
  }

  // ── Observaciones (A2:A8) ─────────────────────────────────────────────────────
  const observationUnitIds: string[] = [];
  for (let i = 1; i <= lock.observaciones.count; i++) {
    const u = unit({
      unitId: `OBS-${i}`,
      kind: "observation",
      fieldKey: "observacion",
      headerLiteral: lock.observaciones.header,
      text: val(ob, i + 1, 1),
      source: { sheet: ob.name, cell: cellRef(i + 1, 1), header: lock.observaciones.header },
    });
    observationUnitIds.push(u.unitId);
  }

  // ── Progresión (matriz nivel × dimensión, B2:G6) ─────────────────────────────
  const prHeaders = Array.from({ length: 7 }, (_, i) => val(pr, 1, i + 1));
  const dimensions = PROGRESSION_DIMENSIONS.map((d) => {
    const idx = prHeaders.indexOf(d.header);
    if (idx < 1) throw new Error(`Compilación: dimensión "${d.header}" ausente en Progresión`);
    return { key: d.key, headerLiteral: d.header, col: idx + 1 };
  });
  const progression: CurriculumRelease["progression"] = [];
  for (let row = 2; row <= 6; row++) {
    const label = val(pr, row, 1);
    const alias = must(levelByProgLabel.get(label), `nivel de progresión "${label}" sin alias`);
    for (const d of dimensions) {
      const u = unit({
        unitId: `PROG:${alias.id}#${d.key}`,
        kind: "progression",
        fieldKey: d.key,
        headerLiteral: d.headerLiteral,
        text: val(pr, row, d.col),
        source: { sheet: pr.name, cell: cellRef(row, d.col), header: d.headerLiteral },
        levelId: alias.id,
      });
      progression.push({ levelId: alias.id, dimensionKey: d.key, unitId: u.unitId });
    }
  }
  const progLevels = new Set(progression.map((p) => p.levelId));
  if (progLevels.size !== 5) throw new Error("Compilación: la progresión no cubre los 5 niveles");

  // ── Propósitos compartidos (derivado, H-15) ──────────────────────────────────
  const purposes: CurriculumRelease["purposes"] = [];
  for (let n = 1; n <= 3; n++) {
    const found = units
      .filter((u) => u.fieldKey === "propositos")
      .map((u) => {
        const seg = u.segments?.find((s) => s.key === `proposito_${n}`);
        return seg
          ? { text: u.text.slice(seg.valueStart, seg.valueEnd), cell: u.source.cell }
          : null;
      });
    const present = found.filter((f): f is { text: string; cell: string } => f !== null);
    const texts = new Set(present.map((f) => f.text));
    const first = present[0];
    if (present.length === found.length && texts.size === 1 && first) {
      purposes.push({
        n,
        text: first.text,
        derived: true,
        occurrences: present.map((f) => f.cell),
      });
    } else {
      warnings.push(
        `Propósito ${n}: el enunciado no es idéntico en las 20 experiencias; no se deriva`,
      );
    }
  }

  const count = (k: Unit["kind"]) => units.filter((u) => u.kind === k).length;
  const draft: CurriculumRelease = {
    schemaVersion: 1,
    release,
    source: {
      file: lock.file,
      certifiedName: lock.certified_name,
      sha256: lock.sha256,
      sizeBytes: lock.size_bytes,
      sheets: lock.sheets,
    },
    compiler,
    counts: {
      units: units.length,
      experienceFields: count("experience_field"),
      experienceTitles: count("experience_title"),
      levelFields: count("level_field"),
      observations: count("observation"),
      progression: count("progression"),
    },
    levels,
    experiences,
    observationUnitIds,
    dimensions: dimensions.map(({ key, headerLiteral }) => ({ key, headerLiteral })),
    progression,
    purposes,
    units,
  };
  const ids = new Set(units.map((u) => u.unitId));
  if (ids.size !== units.length) throw new Error("Compilación: unitId duplicado");
  return { release: CurriculumReleaseSchema.parse(draft), warnings };
}

export function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export type { LevelId };
