/**
 * Segmentación derivada de campos compuestos (ADR-011).
 * Nunca altera el texto: solo calcula rangos sobre el literal. Si el patrón no se cumple
 * exactamente, devuelve null y la unidad se muestra completa.
 */
import type { Segment } from "./schema";

function trimEndIndex(text: string, start: number, end: number): number {
  let e = end;
  while (e > start && /\s/.test(text.charAt(e - 1))) e--;
  return e;
}

function countOccurrences(text: string, needle: string): number {
  let n = 0;
  let i = text.indexOf(needle);
  while (i !== -1) {
    n++;
    i = text.indexOf(needle, i + needle.length);
  }
  return n;
}

/** "Tema: … Competencia: … Avance: … Evidencia: …" (columnas P–S). */
export const RECTORA_LABELS = ["Tema", "Competencia", "Avance", "Evidencia"] as const;

export function segmentLabeled(text: string, labels: readonly string[]): Segment[] | null {
  const starts: number[] = [];
  for (const [i, label] of labels.entries()) {
    const marker = `${label}: `;
    if (countOccurrences(text, `${label}:`) !== 1) return null;
    const pos = text.indexOf(marker);
    if (pos === -1) return null;
    if (i === 0 && pos !== 0) return null;
    if (i > 0) {
      const prev = starts[i - 1];
      if (prev === undefined || pos <= prev || text.charAt(pos - 1) !== " ") return null;
    }
    starts.push(pos);
  }
  return labels.map((label, i) => {
    const start = starts[i] ?? 0;
    const end = starts[i + 1] ?? text.length;
    const valueStart = start + label.length + 2;
    return {
      key: label.toLowerCase(),
      label,
      start,
      end,
      valueStart,
      valueEnd: trimEndIndex(text, valueStart, end),
    };
  });
}

/** "… Alertas: …" (columna AD): documentación y alertas. */
export function segmentAlertas(text: string): Segment[] | null {
  const marker = "Alertas: ";
  if (countOccurrences(text, "Alertas:") !== 1) return null;
  const pos = text.indexOf(marker);
  if (pos <= 0 || text.charAt(pos - 1) !== " ") return null;
  return [
    {
      key: "documentacion",
      label: "Documentación",
      start: 0,
      end: pos,
      valueStart: 0,
      valueEnd: trimEndIndex(text, 0, pos),
    },
    {
      key: "alertas",
      label: "Alertas",
      start: pos,
      end: text.length,
      valueStart: pos + marker.length,
      valueEnd: trimEndIndex(text, pos + marker.length, text.length),
    },
  ];
}

export const LOGRO_PREFIX = "En esta experiencia se logra cuando";

/**
 * Propósitos esenciales (columna K): tres bloques separados por "\n\n";
 * cada uno "n. <enunciado>\n<En esta experiencia se logra cuando …>".
 */
export function segmentPropositos(text: string): Segment[] | null {
  const blocks: { start: number; end: number }[] = [];
  let cursor = 0;
  for (;;) {
    const sep = text.indexOf("\n\n", cursor);
    if (sep === -1) {
      blocks.push({ start: cursor, end: text.length });
      break;
    }
    blocks.push({ start: cursor, end: sep });
    cursor = sep + 2;
  }
  if (blocks.length !== 3) return null;

  const segments: Segment[] = [];
  for (const [i, b] of blocks.entries()) {
    const n = i + 1;
    const numbering = `${n}. `;
    if (!text.startsWith(numbering, b.start)) return null;
    const body = text.slice(b.start, b.end);
    if (countOccurrences(body, "\n") !== 1) return null;
    const nl = text.indexOf("\n", b.start);
    if (!text.startsWith(LOGRO_PREFIX, nl + 1)) return null;
    const blockEnd = i < 2 ? b.end + 2 : b.end;
    segments.push({
      key: `proposito_${n}`,
      label: `Propósito ${n}`,
      start: b.start,
      end: nl + 1,
      valueStart: b.start + numbering.length,
      valueEnd: nl,
    });
    segments.push({
      key: `logro_${n}`,
      label: "En esta experiencia",
      start: nl + 1,
      end: blockEnd,
      valueStart: nl + 1,
      valueEnd: b.end,
    });
  }
  return segments;
}

/** Prefijos permitidos entre start y valueStart (solo etiquetas o numeración). */
export const ALLOWED_SEGMENT_PREFIXES = new Set([
  "",
  ...RECTORA_LABELS.map((l) => `${l}: `),
  "Alertas: ",
  "1. ",
  "2. ",
  "3. ",
]);
