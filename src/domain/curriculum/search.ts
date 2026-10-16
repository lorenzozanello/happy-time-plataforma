/**
 * Búsqueda léxica determinista sobre las unidades curriculares (ADR-006).
 * La normalización solo se aplica al índice y a la consulta, nunca al texto mostrado.
 */
import MiniSearch, { type Options } from "minisearch";
import type { CurriculumRelease, Unit } from "./schema";

const STOPWORDS = new Set([
  "a",
  "al",
  "con",
  "como",
  "de",
  "del",
  "el",
  "en",
  "es",
  "la",
  "las",
  "lo",
  "los",
  "mi",
  "mis",
  "o",
  "para",
  "por",
  "que",
  "se",
  "su",
  "sus",
  "un",
  "una",
  "y",
]);

/** Minúsculas, sin tildes, con rayas y comillas tipográficas plegadas. */
export function normalizeForSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[‐-―]/g, "-")
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'");
}

export function tokenize(s: string): string[] {
  return s.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 0);
}

export function processTerm(term: string): string | null {
  const t = normalizeForSearch(term);
  return t.length < 2 || STOPWORDS.has(t) ? null : t;
}

export interface SearchDoc {
  id: string;
  text: string;
  header: string;
  title: string;
}

export const SEARCH_OPTIONS: Options<SearchDoc> = {
  fields: ["text", "header", "title"],
  storeFields: [],
  tokenize,
  processTerm,
};

export function toSearchDocs(release: CurriculumRelease): SearchDoc[] {
  const titles = new Map<string, string>();
  for (const u of release.units) {
    if (u.kind === "experience_title" && u.code) titles.set(u.code, u.text);
  }
  return release.units.map((u: Unit) => ({
    id: u.unitId,
    text: u.text,
    header: u.headerLiteral,
    title: u.code ? (titles.get(u.code) ?? "") : "",
  }));
}

export function buildSearchIndex(release: CurriculumRelease): MiniSearch<SearchDoc> {
  const ms = new MiniSearch<SearchDoc>(SEARCH_OPTIONS);
  ms.addAll(toSearchDocs(release));
  return ms;
}

export function loadSearchIndex(json: string): MiniSearch<SearchDoc> {
  return MiniSearch.loadJSON<SearchDoc>(json, SEARCH_OPTIONS);
}

export type SearchIndex = MiniSearch<SearchDoc>;

export interface SearchHit {
  unitId: string;
  score: number;
  terms: string[];
}

/** Búsqueda con prefijos y tolerancia leve a errores; filtra por unidades permitidas. */
export function searchUnits(
  index: SearchIndex,
  query: string,
  allow?: (unitId: string) => boolean,
): SearchHit[] {
  if (!query.trim()) return [];
  return index
    .search(query, {
      prefix: (t) => t.length >= 3,
      fuzzy: (t) => (t.length >= 6 ? 0.15 : false),
      combineWith: "AND",
      boost: { title: 2, header: 1.2 },
    })
    .filter((r) => (allow ? allow(String(r.id)) : true))
    .map((r) => ({ unitId: String(r.id), score: r.score, terms: r.terms }));
}

/**
 * Rangos [inicio, fin) del texto ORIGINAL donde aparecen los términos normalizados.
 * Se normaliza carácter a carácter para conservar la correspondencia de posiciones.
 */
export function highlightRanges(text: string, terms: string[]): [number, number][] {
  // Recorrido por puntos de código: los índices se acumulan en unidades UTF-16 (ch.length).
  const chars = Array.from(text);
  const norm: string[] = [];
  const pos: number[] = [];
  let offset = 0;
  for (const ch of chars) {
    const n = normalizeForSearch(ch);
    for (const c of n) {
      norm.push(c);
      pos.push(offset);
    }
    offset += ch.length;
  }
  const hay = norm.join("");
  const ranges: [number, number][] = [];
  for (const t of terms.map(normalizeForSearch).filter((x) => x.length >= 2)) {
    let i = hay.indexOf(t);
    while (i !== -1) {
      const start = pos[i] ?? 0;
      const lastIdx = i + t.length - 1;
      const lastStart = pos[lastIdx] ?? start;
      const lastChar = text.slice(lastStart).codePointAt(0) ?? 0;
      ranges.push([start, lastStart + (lastChar > 0xffff ? 2 : 1)]);
      i = hay.indexOf(t, i + t.length);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged.at(-1);
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}

/** Fragmento corto alrededor de la primera coincidencia, con sus rangos relativos. */
export function snippet(
  text: string,
  terms: string[],
  radius = 90,
): { text: string; ranges: [number, number][]; cutStart: boolean; cutEnd: boolean } {
  const all = highlightRanges(text, terms);
  const first = all[0];
  if (!first) {
    const cut = text.length > radius * 2;
    return {
      text: cut ? text.slice(0, radius * 2) : text,
      ranges: [],
      cutStart: false,
      cutEnd: cut,
    };
  }
  let start = Math.max(0, first[0] - radius);
  let end = Math.min(text.length, first[1] + radius);
  if (start > 0) {
    const sp = text.indexOf(" ", start);
    if (sp !== -1 && sp < first[0]) start = sp + 1;
  }
  if (end < text.length) {
    const sp = text.lastIndexOf(" ", end);
    if (sp > first[1]) end = sp;
  }
  const ranges = all
    .filter(([a, b]) => a >= start && b <= end)
    .map(([a, b]) => [a - start, b - start] as [number, number]);
  return { text: text.slice(start, end), ranges, cutStart: start > 0, cutEnd: end < text.length };
}
