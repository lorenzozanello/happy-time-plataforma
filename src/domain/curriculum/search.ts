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
