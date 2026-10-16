/**
 * Datos de la docente guardados en el navegador. Lo que se lee del almacenamiento no es de fiar:
 * puede venir de una versión anterior, de otra release curricular o estar alterado. Se valida
 * pieza por pieza y se descarta lo inválido, sin tumbar la app (revisión adversarial F3).
 */
import { LEVEL_IDS, type LevelId } from "../../domain/curriculum/fields";
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

/** Valida una respuesta de Happy guardada; sin validador (app sin Happy) se descartan los hilos. */
export type ResponseCheck = (v: unknown) => boolean;

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
  isResponse?: ResponseCheck,
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
    threads: isResponse
      ? keep(raw.threads, (t) => thread(t, isResponse, catalog)).slice(0, 30)
      : [],
  };
}
