import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CurriculumRepository } from "../../domain/curriculum/repository";
import type { SearchIndex } from "../../domain/curriculum/search";
import type {
  Favorite,
  FavoriteTarget,
  Route,
  SavedIdea,
  Services,
  Session,
  Thread,
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

const EMPTY: AppState = {
  session: null,
  work: { levelIds: [], onboarded: false },
  favorites: [],
  ideas: [],
  recentSearches: [],
  threads: [],
};

type Action =
  | { type: "signIn"; session: Session }
  | { type: "signOut" }
  | { type: "work"; patch: Partial<WorkContext> }
  | { type: "toggleFavorite"; target: FavoriteTarget; release: string }
  | { type: "saveIdea"; idea: SavedIdea }
  | { type: "removeIdea"; id: string }
  | { type: "search"; q: string }
  | { type: "upsertThread"; thread: Thread }
  | { type: "reset" };

export const favoriteKey = (t: FavoriteTarget) =>
  t.type === "experience" ? `experience:${t.code}` : `unit:${t.unitId}`;

function reducer(state: AppState, a: Action): AppState {
  switch (a.type) {
    case "signIn":
      return { ...state, session: a.session };
    case "signOut":
      // En el prototipo los datos viven en este navegador: cerrar sesión los borra (equipos compartidos).
      return EMPTY;
    case "work":
      return { ...state, work: { ...state.work, ...a.patch } };
    case "toggleFavorite": {
      const key = favoriteKey(a.target);
      const exists = state.favorites.some((f) => favoriteKey(f.target) === key);
      return {
        ...state,
        favorites: exists
          ? state.favorites.filter((f) => favoriteKey(f.target) !== key)
          : [
              { id: key, target: a.target, release: a.release, createdAt: Date.now() },
              ...state.favorites,
            ],
      };
    }
    case "saveIdea":
      return { ...state, ideas: [a.idea, ...state.ideas.filter((i) => i.id !== a.idea.id)] };
    case "removeIdea":
      return { ...state, ideas: state.ideas.filter((i) => i.id !== a.id) };
    case "search": {
      const q = a.q.trim();
      if (!q) return state;
      return {
        ...state,
        recentSearches: [q, ...state.recentSearches.filter((x) => x !== q)].slice(0, 6),
      };
    }
    case "upsertThread":
      return {
        ...state,
        threads: [a.thread, ...state.threads.filter((t) => t.id !== a.thread.id)].slice(0, 30),
      };
    case "reset":
      return EMPTY;
  }
}

const STORAGE_KEY = "ht.prototipo.v1";

interface AppApi {
  state: AppState;
  dispatch: (a: Action) => void;
  repo: CurriculumRepository;
  search: SearchIndex;
  services: Services;
  route: Route;
  /** Identificador de la visita actual: cambia al navegar, se conserva al reemplazar. */
  visit: number;
  navigate: (r: Route) => void;
  /** Actualiza la ruta actual sin crear una entrada nueva (Volver conserva el estado). */
  replace: (r: Route) => void;
  back: () => void;
  canGoBack: boolean;
  online: boolean;
  isFavorite: (t: FavoriteTarget) => boolean;
}

const Ctx = createContext<AppApi | null>(null);

export function AppProvider({
  repo,
  search,
  services,
  initialRoute = { name: "home" },
  children,
}: {
  repo: CurriculumRepository;
  search: SearchIndex;
  services: Services;
  initialRoute?: Route;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, EMPTY, () => {
    try {
      const raw = services.storage.get(STORAGE_KEY);
      return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<AppState>) } : EMPTY;
    } catch {
      return EMPTY;
    }
  });
  const [stack, setStack] = useState<{ route: Route; visit: number }[]>([
    { route: initialRoute, visit: 0 },
  ]);
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    try {
      services.storage.set(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* el almacenamiento puede no estar disponible: el prototipo sigue en memoria */
    }
  }, [state, services.storage]);

  useEffect(() => {
    const on = () => {
      setOnline(true);
    };
    const off = () => {
      setOnline(false);
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const top = stack[stack.length - 1] ?? { route: initialRoute, visit: 0 };

  const visits = useRef(0);
  const navigate = useCallback((r: Route) => {
    visits.current += 1;
    const visit = visits.current;
    setStack((s) => [...s.slice(-30), { route: r, visit }]);
    if (r.name === "ficha") dispatch({ type: "work", patch: { lastExperience: r.code } });
    window.scrollTo({ top: 0 });
  }, []);
  const replace = useCallback((r: Route) => {
    setStack((s) => {
      const last = s.at(-1);
      return last ? [...s.slice(0, -1), { route: r, visit: last.visit }] : [{ route: r, visit: 0 }];
    });
  }, []);
  const back = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  const favSet = useMemo(
    () => new Set(state.favorites.map((f) => favoriteKey(f.target))),
    [state.favorites],
  );

  const api: AppApi = {
    state,
    dispatch,
    repo,
    search,
    services,
    route: top.route,
    visit: top.visit,
    navigate,
    replace,
    back,
    canGoBack: stack.length > 1,
    online,
    isFavorite: (t) => favSet.has(favoriteKey(t)),
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useApp(): AppApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp fuera de AppProvider");
  return v;
}

/** Marca de tiempo (fuera del render: se usa en manejadores de eventos). */
export const now = () => Date.now();

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
