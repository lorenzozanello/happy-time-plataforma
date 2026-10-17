/**
 * Huella de texto curricular: secuencias de N palabras consecutivas de la malla.
 * Detecta copia literal (total o parcial) de contenido institucional en texto generado o en código.
 */
import type { Unit } from "./schema";

export const WINDOW = 8;

/**
 * Palabras normalizadas: compatibilidad Unicode, sin caracteres de formato invisibles (ancho cero,
 * guion suave…), sin tildes, minúsculas, solo letras y dígitos. Así una copia con invisibles o sin
 * tildes sigue coincidiendo con la malla (revisión adversarial F5).
 */
const CONFUSABLES: Record<string, string> = {
  а: "a",
  е: "e",
  о: "o",
  р: "p",
  с: "c",
  у: "y",
  х: "x",
  і: "i",
  ј: "j",
  ѕ: "s",
  ԁ: "d",
  ɡ: "g",
  А: "a",
  Е: "e",
  О: "o",
  Р: "p",
  С: "c",
  Х: "x",
  І: "i",
  Т: "t",
  М: "m",
  Н: "h",
  К: "k",
  В: "b",
  α: "a",
  ο: "o",
  ε: "e",
  ι: "i",
  ν: "v",
  ρ: "p",
  τ: "t",
  υ: "u",
  κ: "k",
};

/** Pliega homoglifos cirílicos y griegos frecuentes a su letra latina. */
export function foldConfusables(s: string): string {
  return s.replace(
    /[\u0370-\u03FF\u0400-\u04FF\u0500-\u052F\u0250-\u02AF]/g,
    (c) => CONFUSABLES[c] ?? c,
  );
}

export function words(s: string): string[] {
  return foldConfusables(s.normalize("NFKC"))
    .replace(/[\p{Cf}\u00AD]/gu, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
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

/**
 * Huella corta y determinista de un texto (cyrb53, 53 bits), igual en Node y en el navegador.
 * Sirve para comprobar que un literal guardado en el navegador sigue siendo el de la release
 * (revisión adversarial F5: un hilo alterado o de otra release no puede pintarse como institucional).
 * No es criptográfica: protege contra corrupción, versiones viejas y manipulación casual, no contra
 * un adversario con control del navegador (que igualmente podría alterar la página).
 */
export function textHash(text: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return n.toString(16).padStart(14, "0");
}

/**
 * Huella de una unidad: texto **y procedencia** (encabezado, código, nivel, campo, tipo, celda y
 * segmentos). Así un literal real con código o segmentos manipulados tampoco pasa (revisión F5, N2).
 */
export function unitFingerprint(u: Unit): string {
  return textHash(
    JSON.stringify([
      u.text,
      u.headerLiteral,
      u.code ?? "",
      u.levelId ?? "",
      u.fieldKey,
      u.kind,
      u.source.sheet,
      u.source.cell,
      u.segments ?? [],
    ]),
  );
}

/** Tabla `unitId → huella` de una release (viaja solo a la pantalla de Happy). */
export function unitHashes(units: readonly Unit[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const u of units) out[u.unitId] = unitFingerprint(u);
  return out;
}
