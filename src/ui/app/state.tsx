import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { CurriculumRepository } from "../../domain/curriculum/repository";
import type { Catalog, SearchBundle } from "../../domain/curriculum/views";
import type { Navigation } from "./routes";
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
  | { type: "reset" }
  | { type: "hydrate"; state?: AppState };

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
    case "hydrate":
      return a.state ?? state;
  }
}

/** Estado raíz: datos de la docente + si ya se leyó el almacenamiento del navegador. */
interface Root {
  app: AppState;
  hydrated: boolean;
}
function rootReducer(r: Root, a: Action): Root {
  if (a.type === "hydrate") return { app: reducer(r.app, a), hydrated: true };
  return { ...r, app: reducer(r.app, a) };
}

const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

interface AppApi {
  state: AppState;
  /** true cuando ya se leyó el almacenamiento del navegador (tras el montaje). */
  hydrated: boolean;
  dispatch: (a: Action) => void;
  catalog: Catalog;
  /** Repositorio completo: solo en el prototipo (Happy simulada). En producción no viaja al cliente. */
  repo?: CurriculumRepository;
  /** Paquete de búsqueda, cargado bajo demanda (archivo estático en producción). */
  loadSearch: () => Promise<SearchBundle>;
  services: Services;
  route: Route;
  visit: number;
  navigate: (r: Route) => void;
  replace: (r: Route) => void;
  back: () => void;
  canGoBack: boolean;
  /** La navegación usa URLs reales (enlaces <a>) o es interna (prototipo). */
  urls: boolean;
  /** Happy disponible en este despliegue (en F3 la app de producción aún no la incluye). */
  happyEnabled: boolean;
  online: boolean;
  isFavorite: (t: FavoriteTarget) => boolean;
}

const Ctx = createContext<AppApi | null>(null);

export function AppProvider({
  catalog,
  repo,
  loadSearch,
  services,
  navigation,
  storageKey = "ht.prototipo.v1",
  happyEnabled = true,
  children,
}: {
  catalog: Catalog;
  repo?: CurriculumRepository;
  loadSearch: () => Promise<SearchBundle>;
  services: Services;
  navigation: Navigation;
  /** Clave del almacenamiento del navegador (el prototipo y la app no comparten datos). */
  storageKey?: string;
  happyEnabled?: boolean;
  children: ReactNode;
}) {
  const [root, dispatch] = useReducer(rootReducer, { app: EMPTY, hydrated: false });
  const { app: state, hydrated } = root;
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );

  // El almacenamiento se lee después de montar: el HTML del servidor y el primer render coinciden.
  useEffect(() => {
    let stored: AppState | undefined;
    try {
      const raw = services.storage.get(storageKey);
      if (raw) stored = { ...EMPTY, ...(JSON.parse(raw) as Partial<AppState>) };
    } catch {
      /* almacenamiento ilegible: se empieza vacío */
    }
    dispatch({ type: "hydrate", ...(stored ? { state: stored } : {}) });
  }, [services.storage, storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      services.storage.set(storageKey, JSON.stringify(state));
    } catch {
      /* el almacenamiento puede no estar disponible: se sigue en memoria */
    }
  }, [state, hydrated, services.storage, storageKey]);

  const lastFicha = useRef<string | null>(null);
  useEffect(() => {
    const r = navigation.route;
    if (r.name === "ficha" && r.code !== lastFicha.current && hydrated) {
      lastFicha.current = r.code;
      dispatch({ type: "work", patch: { lastExperience: r.code } });
    }
  }, [navigation.route, hydrated]);

  const favSet = useMemo(
    () => new Set(state.favorites.map((f) => favoriteKey(f.target))),
    [state.favorites],
  );

  const api: AppApi = {
    state,
    hydrated,
    dispatch,
    catalog,
    ...(repo ? { repo } : {}),
    loadSearch,
    services,
    route: navigation.route,
    visit: navigation.visit,
    navigate: navigation.navigate,
    replace: navigation.replace,
    back: navigation.back,
    canGoBack: navigation.canGoBack,
    urls: navigation.urls,
    happyEnabled,
    online,
    isFavorite: (t) => favSet.has(favoriteKey(t)),
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

/** Repositorio completo; solo existe donde Happy está disponible (prototipo). */
export function useRepo(): CurriculumRepository {
  const { repo } = useApp();
  if (!repo) throw new Error("Esta pantalla requiere el repositorio curricular completo");
  return repo;
}

export function useApp(): AppApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp fuera de AppProvider");
  return v;
}

/** Marca de tiempo (fuera del render: se usa en manejadores de eventos). */
export const now = () => Date.now();

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
