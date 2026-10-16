"use client";
/**
 * Navegación de la app con URLs reales (Next.js App Router). Mismo contrato `Navigation` que la
 * pila en memoria del prototipo, así las pantallas no saben dónde corren.
 *
 * - La ruta global se deriva solo del pathname: leer los parámetros aquí obligaría a renderizar
 *   todo en el cliente. Las páginas con parámetros (malla, buscar, guardados) los leen ellas
 *   mismas dentro de un <Suspense> (ver `params.tsx`).
 * - «Reemplazar» (filtros, consulta) solo actualiza la URL, sin pedir la página. Se recuerdan esas
 *   URLs para distinguir un cambio propio de una navegación (atrás/adelante, otro enlace).
 * - «Volver» usa el historial solo si la entrada anterior es de la app; si no, va a la pantalla
 *   padre (revisión adversarial F3: antes podía sacar a la docente de la app).
 */
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Catalog } from "../../src/domain/curriculum/views";
import { hrefToRoute, parentRoute, routeToHref, type Navigation } from "../../src/ui/app/routes";

const replaced = new Set<string>();

/** ¿Esta URL la puso la propia pantalla con `replace` (no es una navegación nueva)? */
export const wasReplaced = (href: string) => replaced.has(href);

/** Navigation API (Chromium, Safari 26+, Firefox 147+): ¿hay una entrada anterior de la app? */
function historyHasAppEntryBefore(): boolean {
  const nav = (window as { navigation?: { canGoBack?: boolean } }).navigation;
  return nav?.canGoBack === true;
}

export function useNextNavigation(catalog: Catalog): Navigation {
  const router = useRouter();
  const pathname = usePathname();
  const [track, setTrack] = useState({ pathname, visit: 0 });
  // Cada cambio de pathname es una visita nueva (el armazón mueve el foco al título).
  let current = track;
  if (track.pathname !== pathname) {
    current = { pathname, visit: track.visit + 1 };
    setTrack(current);
  }
  const visit = current.visit;

  useEffect(() => {
    const onPop = () => {
      replaced.clear();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  return useMemo(() => {
    const route = hrefToRoute(pathname, new URLSearchParams());
    return {
      route,
      visit,
      navigate: (r) => {
        replaced.clear();
        router.push(routeToHref(r));
      },
      replace: (r) => {
        const href = routeToHref(r);
        replaced.add(href);
        window.history.replaceState(null, "", href);
      },
      back: () => {
        replaced.clear();
        if (historyHasAppEntryBefore()) router.back();
        else router.push(routeToHref(parentRoute(route, catalog)));
      },
      // Con URLs siempre hay adónde volver: el historial de la app o la pantalla padre.
      canGoBack: true,
      urls: true,
    };
  }, [pathname, visit, router, catalog]);
}
