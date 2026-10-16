/**
 * Datos de la docente guardados en el navegador. Lo que se lee del almacenamiento no es de fiar:
 * puede venir de una versión anterior, de otra release curricular o estar alterado. Se valida
 * pieza por pieza y se descarta lo inválido, sin tumbar la app (revisión adversarial F3).
 */
import { LEVEL_IDS, type LevelId } from "../../domain/curriculum/fields";
import type { Unit } from "../../domain/curriculum/schema";
import { catalogExperience, type Catalog } from "../../domain/curriculum/views";
import { isMode } from "../../domain/happy/modes";
import type {
  Favorite,
  FavoriteTarget,
  SavedIdea,
  Session,
  Thread,
  ThreadMessage,
  WorkContext,
} from "./types";

export interface AppState {
  session: Session | null;
  work: WorkContext;
  favorites: Favorite[];
  ideas: SavedIdea[];
  recentSearches: string[];
  threads: Thread[];
}

export const EMPTY: AppState = {
  session: null,
  work: { levelIds: [], onboarded: false },
  favorites: [],
  ideas: [],
  recentSearches: [],
  threads: [],
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 2000): v is string => typeof v === "string" && v.length <= max;
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
/** Propiedad opcional: se copia solo si es válida (exactOptionalPropertyTypes). */
const opt = <K extends string, T>(k: K, v: unknown, ok: (x: unknown) => x is T) =>
  (ok(v) ? { [k]: v } : {}) as Partial<Record<K, T>>;

export const isPeriod = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 4;

function session(v: unknown): Session | null {
  if (!isObj(v) || !str(v.email, 320)) return null;
  const role = v.role;
  if (role !== "docente" && role !== "coordinacion" && role !== "admin") return null;
  return { email: v.email, role };
}

function work(v: unknown, catalog: Catalog): WorkContext {
  if (!isObj(v)) return EMPTY.work;
  const known = new Set<string>(catalog.levels.map((l) => l.id));
  const levelIds = [
    ...new Set(
      arr(v.levelIds).filter(
        (x): x is LevelId =>
          typeof x === "string" && (LEVEL_IDS as readonly string[]).includes(x) && known.has(x),
      ),
    ),
  ];
  return {
    levelIds,
    onboarded: v.onboarded === true,
    ...opt("periodIndex", v.periodIndex, isPeriod),
    ...(str(v.lastExperience, 20) && catalogExperience(catalog, v.lastExperience)
      ? { lastExperience: v.lastExperience }
      : {}),
    ...opt("lastThreadId", v.lastThreadId, (x): x is string => str(x, 100)),
    ...opt("principleSeen", v.principleSeen, (x): x is boolean => typeof x === "boolean"),
  };
}

function target(v: unknown): FavoriteTarget | null {
  if (!isObj(v)) return null;
  if (v.type === "experience" && str(v.code, 20)) return { type: "experience", code: v.code };
  if (v.type === "unit" && str(v.unitId, 100)) return { type: "unit", unitId: v.unitId };
  return null;
}

function favorite(v: unknown): Favorite | null {
  if (!isObj(v) || !str(v.id, 100) || !str(v.release, 40) || !num(v.createdAt)) return null;
  const t = target(v.target);
  return t ? { id: v.id, target: t, release: v.release, createdAt: v.createdAt } : null;
}

function idea(v: unknown): SavedIdea | null {
  if (!isObj(v) || !str(v.id, 100) || !str(v.title, 300) || !str(v.text, 5000)) return null;
  if (!str(v.release, 40) || !num(v.createdAt)) return null;
  return {
    id: v.id,
    title: v.title,
    text: v.text,
    sourceUnitIds: arr(v.sourceUnitIds).filter((x): x is string => str(x, 100)),
    release: v.release,
    createdAt: v.createdAt,
    ...opt("experienceCode", v.experienceCode, (x): x is string => str(x, 20)),
    ...opt("threadId", v.threadId, (x): x is string => str(x, 100)),
  };
}

/** Valida una respuesta de Happy guardada. */
export type ResponseCheck = (v: unknown) => boolean;

const strs = (v: unknown, max: number) => Array.isArray(v) && v.every((x) => str(x, max));

/**
 * Forma de una respuesta guardada, sin Zod (para no cargarlo en el navegador): basta para que
 * la interfaz la pinte sin fallar. El contenido ya lo validó el servidor al recibirlo.
 */
export function looksLikeResponse(v: unknown): boolean {
  if (!isObj(v) || !isMode(v.mode) || !Array.isArray(v.blocks) || !Array.isArray(v.nextActions))
    return false;
  const blockOk = (b: unknown): boolean => {
    if (!isObj(b)) return false;
    switch (b.kind) {
      case "malla_ref":
        return (
          str(b.unitId, 80) && str(b.why, 1200) && (b.segment === undefined || str(b.segment, 40))
        );
      case "paths":
        return (
          Array.isArray(b.paths) &&
          b.paths.length <= 3 &&
          b.paths.every((p) => isObj(p) && str(p.title, 160) && str(p.summary, 1200))
        );
      case "steps":
        return str(b.title, 160) && strs(b.items, 1200);
      case "idea":
      case "question":
        return str(b.text, 1200);
      case "notice":
        return (
          str(b.text, 1200) && ["privacy", "out_of_scope", "no_match"].includes(String(b.code))
        );
      default:
        return false;
    }
  };
  const actionOk = (a: unknown) =>
    isObj(a) &&
    str(a.id, 40) &&
    str(a.label, 160) &&
    ["send", "open_experience", "save_idea"].includes(String(a.kind)) &&
    (a.payload === undefined || str(a.payload, 400));
  return v.blocks.length <= 8 && v.blocks.every(blockOk) && v.nextActions.every(actionOk);
}

const UNIT_KINDS = [
  "experience_field",
  "experience_title",
  "level_field",
  "observation",
  "progression",
] as const;

/**
 * Reconstruye una unidad citada guardada con solo campos válidos (sin confiar en el objeto).
 * Una unidad malformada se descarta: la cita no se pinta, pero la vista no falla.
 * Que sea de la release vigente lo decide la interfaz (las de otra release se marcan).
 */
function safeUnit(v: unknown): Unit | null {
  if (!isObj(v) || !str(v.unitId, 100) || !str(v.text, 20_000) || v.text === "") return null;
  if (!str(v.headerLiteral, 500) || !str(v.fieldKey, 60) || !str(v.release, 40)) return null;
  if (!UNIT_KINDS.includes(v.kind as (typeof UNIT_KINDS)[number])) return null;
  const src = v.source;
  if (!isObj(src) || !str(src.sheet, 100) || !str(src.header, 500)) return null;
  if (typeof src.cell !== "string" || !/^[A-Z]{1,3}\d{1,4}$/.test(src.cell)) return null;
  const range =
    typeof src.range === "string" && /^[A-Z]{1,3}\d{1,4}:[A-Z]{1,3}\d{1,4}$/.test(src.range)
      ? src.range
      : undefined;
  const len = v.text.length;
  const idx = (x: unknown): x is number =>
    Number.isInteger(x) && (x as number) >= 0 && (x as number) <= len;
  const segments = Array.isArray(v.segments)
    ? v.segments.flatMap((g) =>
        isObj(g) &&
        str(g.key, 40) &&
        str(g.label, 200) &&
        idx(g.start) &&
        idx(g.end) &&
        idx(g.valueStart) &&
        idx(g.valueEnd) &&
        g.valueStart <= g.valueEnd
          ? [
              {
                key: g.key,
                label: g.label,
                start: g.start,
                end: g.end,
                valueStart: g.valueStart,
                valueEnd: g.valueEnd,
              },
            ]
          : [],
      )
    : undefined;
  return {
    unitId: v.unitId,
    kind: v.kind as Unit["kind"],
    fieldKey: v.fieldKey,
    headerLiteral: v.headerLiteral,
    text: v.text,
    source: { sheet: src.sheet, cell: src.cell, header: src.header, ...(range ? { range } : {}) },
    authority: "official_curriculum",
    release: v.release,
    ...(typeof v.levelId === "string" && (LEVEL_IDS as readonly string[]).includes(v.levelId)
      ? { levelId: v.levelId as LevelId }
      : {}),
    ...(str(v.code, 20) ? { code: v.code } : {}),
    ...(segments?.length ? { segments } : {}),
  };
}

function message(v: unknown, isResponse: ResponseCheck): ThreadMessage | null {
  if (!isObj(v) || !str(v.id, 100) || !num(v.createdAt)) return null;
  if (v.role !== "docente" && v.role !== "happy") return null;
  if (v.response !== undefined && !isResponse(v.response)) return null;
  return {
    id: v.id,
    role: v.role,
    createdAt: v.createdAt,
    ...opt("text", v.text, (x): x is string => str(x, 5000)),
    ...opt("mode", v.mode, isMode),
    ...opt("replyTo", v.replyTo, (x): x is string => str(x, 100)),
    ...(v.response !== undefined ? { response: v.response as ThreadMessage["response"] } : {}),
    ...(Array.isArray(v.units)
      ? {
          units: v.units.slice(0, 20).flatMap((u) => {
            const ok = safeUnit(u);
            return ok ? [ok] : [];
          }),
        }
      : {}),
    ...opt("error", v.error, (x): x is string => str(x, 1000)),
    ...(v.feedback === "up" || v.feedback === "down" ? { feedback: v.feedback } : {}),
  } as ThreadMessage;
}

function thread(v: unknown, isResponse: ResponseCheck, catalog: Catalog): Thread | null {
  if (!isObj(v) || !str(v.id, 100) || !str(v.title, 300) || !num(v.updatedAt)) return null;
  if (!isMode(v.mode)) return null;
  const c = isObj(v.context) ? v.context : {};
  const levelId =
    typeof c.levelId === "string" && catalog.levels.some((l) => l.id === c.levelId)
      ? (c.levelId as LevelId)
      : undefined;
  return {
    id: v.id,
    mode: v.mode,
    title: v.title,
    updatedAt: v.updatedAt,
    context: {
      ...(levelId ? { levelId } : {}),
      ...opt("periodIndex", c.periodIndex, isPeriod),
      ...(str(c.experienceCode, 20) && catalogExperience(catalog, c.experienceCode)
        ? { experienceCode: c.experienceCode }
        : {}),
    },
    messages: arr(v.messages).flatMap((m) => {
      const ok = message(m, isResponse);
      return ok ? [ok] : [];
    }),
  };
}

export function sanitizeStored(
  raw: unknown,
  catalog: Catalog,
  isResponse: ResponseCheck = looksLikeResponse,
): AppState {
  if (!isObj(raw)) return EMPTY;
  const keep = <T>(items: unknown, fn: (v: unknown) => T | null): T[] =>
    arr(items).flatMap((x) => {
      const v = fn(x);
      return v ? [v] : [];
    });
  return {
    session: session(raw.session),
    work: work(raw.work, catalog),
    favorites: keep(raw.favorites, favorite).slice(0, 200),
    ideas: keep(raw.ideas, idea).slice(0, 200),
    recentSearches: arr(raw.recentSearches)
      .filter((x): x is string => str(x, 120) && x.trim() !== "")
      .slice(0, 8),
    threads: keep(raw.threads, (t) => thread(t, isResponse, catalog)).slice(0, 30),
  };
}
