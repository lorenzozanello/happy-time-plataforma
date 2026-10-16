/**
 * Huella de texto curricular: secuencias de N palabras consecutivas de la malla.
 * Detecta copia literal (total o parcial) de contenido institucional en texto generado o en código.
 *
 * Todo se compara normalizado (NFKC, sin invisibles, homoglifos plegados, sin tildes, minúsculas):
 * una copia con otra codificación, sin tildes o con caracteres de ancho completo sigue siendo copia
 * (revisión adversarial F5).
 */
import { normalizeForRules } from "../text/normalize";
import type { Unit } from "./schema";

export const WINDOW = 8;
/** Unidades cortas (menos de WINDOW palabras) con al menos estas palabras se buscan enteras. */
export const SHORT_MIN_WORDS = 4;

/** Palabras normalizadas (solo letras y dígitos). */
export function words(s: string): string[] {
  return normalizeForRules(s)
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

/**
 * Textos normalizados de las unidades cortas (p. ej. Observaciones). Los títulos de experiencia
 * quedan fuera: son nombres, y mencionarlos para referirse a la experiencia es legítimo.
 */
export function curriculumShortTexts(units: readonly Unit[], n = WINDOW): string[] {
  return [
    ...new Set(
      units.flatMap((u) => {
        if (u.kind === "experience_title") return [];
        const w = words(u.text);
        return w.length >= SHORT_MIN_WORDS && w.length < n ? [w.join(" ")] : [];
      }),
    ),
  ];
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

/** Primera unidad corta contenida entera en `text`, o null. */
export function findCopiedShort(text: string, shorts: readonly string[]): string | null {
  const padded = ` ${words(text).join(" ")} `;
  return shorts.find((s) => padded.includes(` ${s} `)) ?? null;
}
