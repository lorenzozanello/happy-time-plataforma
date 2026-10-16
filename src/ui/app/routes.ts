/**
 * Rutas de la interfaz y su forma de URL (F3). El prototipo navega en memoria; la app de
 * producción usa estas mismas rutas como URLs compartibles.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { LEVEL_IDS, type LevelId } from "../../domain/curriculum/fields";
import { isMode } from "../../domain/happy/modes";
import {
  catalogExperience,
  codeToSlug,
  slugToCode,
  type Catalog,
} from "../../domain/curriculum/views";
import type { Route } from "./types";

export interface Navigation {
  route: Route;
  /** Cambia en cada navegación (no al reemplazar): remonta la pantalla y mueve el foco. */
  visit: number;
  navigate: (r: Route) => void;
  replace: (r: Route) => void;
  back: () => void;
  canGoBack: boolean;
  urls: boolean;
}

const SAVED_TABS = ["favoritos", "ideas", "planeaciones"] as const;

export function routeToHref(r: Route): string {
  const q = (params: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params))
      if (v !== undefined && v !== "") sp.set(k, String(v));
    const s = sp.toString();
    return s ? `?${s}` : "";
  };
  switch (r.name) {
    case "home":
      return "/";
    case "malla":
      return `/malla${q({ nivel: r.levelId, periodo: r.periodIndex })}`;
    case "ficha":
      return `/malla/${codeToSlug(r.code)}`;
    case "search":
      return `/buscar${q({ q: r.q })}`;
    case "level":
      return `/niveles/${r.levelId}`;
    case "progression":
      return "/progresion";
    case "principles":
      return "/principios";
    case "happy":
      return `/happy${q({ hilo: r.threadId, modo: r.mode, experiencia: r.context?.experienceCode })}`;
    case "saved":
      return `/guardados${q({ pestana: r.tab })}`;
    case "identity":
      return "/identidad";
    case "tools":
      return "/perfil";
    case "notFound":
      return "/";
  }
}

/**
 * Pantalla "padre" de una ruta: adónde lleva «Volver» cuando no hay historial dentro de la app
 * (enlace abierto en una pestaña nueva). Nunca saca a la docente de la app.
 */
export function parentRoute(r: Route, catalog: Catalog): Route {
  switch (r.name) {
    case "ficha": {
      const e = catalogExperience(catalog, r.code);
      return e
        ? { name: "malla", levelId: e.levelId, periodIndex: e.periodIndex }
        : { name: "malla" };
    }
    case "level":
    case "progression":
    case "principles":
      return { name: "malla" };
    case "identity":
      return { name: "tools" };
    case "malla":
      return { name: "malla" };
    case "happy":
      return { name: "happy" };
    case "saved":
      return { name: "saved" };
    case "home":
    case "search":
    case "tools":
    case "notFound":
      return { name: "home" };
  }
}

const isLevel = (v: string | null): v is LevelId =>
  v !== null && (LEVEL_IDS as readonly string[]).includes(v);

export function hrefToRoute(pathname: string, params: URLSearchParams): Route {
  const parts = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  const [a, b] = parts;
  const p = params.get("periodo") ?? "";
  const period = /^[1-4]$/.test(p) ? Number(p) : undefined;
  switch (a) {
    case undefined:
      return { name: "home" };
    case "malla":
      if (b) return { name: "ficha", code: slugToCode(b) };
      return {
        name: "malla",
        ...(isLevel(params.get("nivel")) ? { levelId: params.get("nivel") as LevelId } : {}),
        ...(period ? { periodIndex: period } : {}),
      };
    case "buscar":
      return { name: "search", ...(params.get("q") ? { q: params.get("q") ?? "" } : {}) };
    case "niveles":
      return isLevel(b ?? null) ? { name: "level", levelId: b as LevelId } : { name: "notFound" };
    case "progresion":
      return { name: "progression" };
    case "principios":
      return { name: "principles" };
    case "happy": {
      const mode = params.get("modo");
      const exp = params.get("experiencia");
      return {
        name: "happy",
        ...(params.get("hilo") ? { threadId: params.get("hilo") ?? "" } : {}),
        ...(isMode(mode) ? { mode } : {}),
        ...(exp ? { context: { experienceCode: exp } } : {}),
      };
    }
    case "guardados": {
      const tab = params.get("pestana");
      return {
        name: "saved",
        ...((SAVED_TABS as readonly string[]).includes(tab ?? "")
          ? { tab: tab as (typeof SAVED_TABS)[number] }
          : {}),
      };
    }
    case "identidad":
      return { name: "identity" };
    case "perfil":
      return { name: "tools" };
    default:
      return { name: "notFound" };
  }
}

/** Navegación en memoria (prototipo de un solo archivo, sin URLs). */
export function useStackNavigation(initial: Route = { name: "home" }): Navigation {
  const [stack, setStack] = useState<{ route: Route; visit: number }[]>([
    { route: initial, visit: 0 },
  ]);
  const visits = useRef(0);
  const navigate = useCallback((r: Route) => {
    visits.current += 1;
    const visit = visits.current;
    setStack((s) => [...s.slice(-30), { route: r, visit }]);
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
  const top = stack.at(-1) ?? { route: initial, visit: 0 };
  return useMemo(
    () => ({
      route: top.route,
      visit: top.visit,
      navigate,
      replace,
      back,
      canGoBack: stack.length > 1,
      urls: false,
    }),
    [top.route, top.visit, navigate, replace, back, stack.length],
  );
}
