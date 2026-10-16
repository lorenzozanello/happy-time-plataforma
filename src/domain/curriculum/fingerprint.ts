/**
 * Huella de texto curricular: secuencias de N palabras consecutivas de la malla.
 * Detecta copia literal (total o parcial) de contenido institucional en texto generado o en código.
 */
import type { Unit } from "./schema";

export const WINDOW = 8;

/** Palabras normalizadas (minúsculas, solo letras y dígitos). */
export function words(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

export function curriculumWindows(units: readonly Unit[], n = WINDOW): Set<string> {
  const set = new Set<string>();
  for (const u of units) {
    const w = words(u.text);
    for (let i = 0; i + n <= w.length; i++) set.add(w.slice(i, i + n).join(" "));
  }
  return set;
}

/** Primera secuencia de la malla contenida en `text`, o null. */
export function findCopiedSequence(
  text: string,
  windows: ReadonlySet<string>,
  n = WINDOW,
): string | null {
  const w = words(text);
  for (let i = 0; i + n <= w.length; i++) {
    const seq = w.slice(i, i + n).join(" ");
    if (windows.has(seq)) return seq;
  }
  return null;
}
