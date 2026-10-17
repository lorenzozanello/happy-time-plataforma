/**
 * Comprobaciones estructurales sin Zod, para el cliente de la app (que no carga Zod en cada
 * página). Validan lo que llega del servidor o del almacenamiento del navegador antes de usarlo.
 * Son más laxas que `HappyResponseSchema` en límites de longitud; la autoridad sigue siendo el
 * validador del servidor. Cualquier cosa que no pase aquí se descarta sin tumbar la app.
 */
import type { Unit } from "../curriculum/schema";
import { isMode } from "./modes";
import type { HappyMetrics } from "./pipeline";
import { textRuleErrors } from "./rules";
import type { Action, Block, HappyResponse } from "./schema";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 2000): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max;
const optStr = (v: unknown, max = 2000): boolean => v === undefined || str(v, max);
const strArr = (v: unknown, max = 2000, maxItems = 12): v is string[] =>
  Array.isArray(v) && v.length <= maxItems && v.every((x) => str(x, max));

export function isBlockShape(v: unknown): v is Block {
  if (!isObj(v)) return false;
  switch (v.kind) {
    case "malla_ref":
      return str(v.unitId, 80) && str(v.why) && optStr(v.segment, 40);
    case "paths":
      return (
        Array.isArray(v.paths) &&
        v.paths.length >= 1 &&
        v.paths.length <= 3 &&
        v.paths.every((p) => isObj(p) && str(p.title, 160) && str(p.summary))
      );
    case "steps":
      return str(v.title, 160) && strArr(v.items, 2000, 8) && v.items.length >= 1;
    case "idea":
    case "question":
      return str(v.text);
    case "notice":
      return (
        (v.code === "privacy" || v.code === "out_of_scope" || v.code === "no_match") && str(v.text)
      );
    default:
      return false;
  }
}

export function isActionShape(v: unknown): v is Action {
  return (
    isObj(v) &&
    str(v.id, 40) &&
    str(v.label, 160) &&
    (v.kind === "send" || v.kind === "open_experience" || v.kind === "save_idea") &&
    optStr(v.payload, 400)
  );
}

export function isHappyResponseShape(v: unknown): v is HappyResponse {
  return (
    isObj(v) &&
    isMode(v.mode) &&
    Array.isArray(v.blocks) &&
    v.blocks.length >= 1 &&
    v.blocks.length <= 8 &&
    v.blocks.every(isBlockShape) &&
    Array.isArray(v.nextActions) &&
    v.nextActions.length <= 4 &&
    v.nextActions.every(isActionShape)
  );
}

const KINDS = new Set([
  "experience_field",
  "experience_title",
  "level_field",
  "observation",
  "progression",
]);

/** Unidad literal tal como la entrega el servidor (procedencia incluida). */
export function isUnitShape(v: unknown): v is Unit {
  if (!isObj(v)) return false;
  if (!str(v.unitId, 80) || !KINDS.has(String(v.kind)) || !str(v.fieldKey, 60)) return false;
  if (!str(v.headerLiteral, 200) || !str(v.text, 20_000) || v.authority !== "official_curriculum")
    return false;
  if (!str(v.release, 40) || !isObj(v.source)) return false;
  const s = v.source;
  if (!str(s.sheet, 80) || !str(s.cell, 12) || !str(s.header, 200) || !optStr(s.range, 30))
    return false;
  if (!optStr(v.levelId, 20) || !optStr(v.code, 20)) return false;
  if (v.segments !== undefined) {
    if (!Array.isArray(v.segments) || v.segments.length > 12) return false;
    const len = v.text.length;
    const int = (x: unknown): x is number =>
      Number.isInteger(x) && (x as number) >= 0 && (x as number) <= len;
    for (const seg of v.segments) {
      if (!isObj(seg) || !str(seg.key, 40) || !str(seg.label, 80)) return false;
      if (!int(seg.start) || !int(seg.end) || !int(seg.valueStart) || !int(seg.valueEnd))
        return false;
      if (seg.start > seg.valueStart || seg.valueStart > seg.valueEnd || seg.valueEnd > seg.end)
        return false;
    }
  }
  return true;
}

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Métricas de una respuesta tal como viajan al cliente (sin secretos ni texto). */
export function isMetricsShape(v: unknown): v is HappyMetrics {
  if (!isObj(v)) return false;
  if (!str(v.provider, 40) || !str(v.model, 80) || !str(v.promptVersion, 40) || !str(v.release, 40))
    return false;
  if (!num(v.attempts) || !num(v.costUsd) || !num(v.totalMs) || !num(v.retrieved)) return false;
  if (!(v.firstBlockMs === null || num(v.firstBlockMs))) return false;
  if (!strArr(v.dropped, 400, 12) && !(Array.isArray(v.dropped) && v.dropped.length === 0))
    return false;
  if (!strArr(v.cited, 80, 40) && !(Array.isArray(v.cited) && v.cited.length === 0)) return false;
  if (!isObj(v.usage)) return false;
  const u = v.usage;
  return (
    num(u.inputTokens) &&
    num(u.outputTokens) &&
    num(u.cacheReadTokens) &&
    num(u.cacheWrite5mTokens) &&
    num(u.cacheWrite1hTokens) &&
    (v.policy === undefined || v.policy === "privacy")
  );
}

/** Resumen textual de una respuesta para el historial que se envía al modelo (sin literales). */
export function summarizeResponse(r: HappyResponse, max = 600): string {
  const parts: string[] = [];
  for (const b of r.blocks) {
    if (b.kind === "malla_ref") parts.push(`cita ${b.unitId}`);
    else if (b.kind === "paths") parts.push(`caminos: ${b.paths.map((p) => p.title).join(" / ")}`);
    else if (b.kind === "steps") parts.push(`pasos: ${b.title}`);
    else parts.push(`${b.kind}: ${b.text}`);
  }
  const s = parts.join(" · ");
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Texto generado de una respuesta (sin literales). */
export function generatedOf(r: HappyResponse): string[] {
  const out: string[] = [];
  for (const b of r.blocks) {
    if (b.kind === "malla_ref") out.push(b.why);
    else if (b.kind === "paths") out.push(...b.paths.flatMap((p) => [p.title, p.summary]));
    else if (b.kind === "steps") out.push(b.title, ...b.items);
    else out.push(b.text);
  }
  for (const a of r.nextActions) {
    out.push(a.label);
    if (a.payload && a.kind === "send") out.push(a.payload);
  }
  return out;
}

/** Forma válida y texto generado que respeta las reglas (sin autoridad, diagnóstico ni calificación). */
export function isTrustedResponseShape(v: unknown): v is HappyResponse {
  return isHappyResponseShape(v) && generatedOf(v).every((t) => textRuleErrors(t).length === 0);
}
