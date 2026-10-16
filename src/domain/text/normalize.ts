/** Normalización compartida por las reglas de salida, la huella curricular y la privacidad. */

/**
 * Normaliza para comparar reglas: compatibilidad Unicode, sin caracteres invisibles, homoglifos
 * cirílicos/griegos comunes plegados, sin tildes, minúsculas y espacios simples.
 */
export function normalizeForRules(s: string): string {
  const confusables: Record<string, string> = {
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
  };
  return s
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u2060\uFEFF\u00AD]/g, "")
    .replace(/[\u0370-\u03FF\u0400-\u04FF]/g, (c) => confusables[c] ?? c)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}
