"use client";
/**
 * Navegación de la app con URLs reales (Next.js App Router). Mismo contrato `Navigation` que la
 * pila en memoria del prototipo, así las pantallas no saben dónde corren.
 *
 * La ruta global se deriva solo del pathname: leer los parámetros de búsqueda aquí obligaría a
 * renderizar todo en el cliente. Las páginas que usan parámetros (malla, buscar, guardados) los
 * leen ellas mismas dentro de un <Suspense>.
 */
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { hrefToRoute, routeToHref, type Navigation } from "../../src/ui/app/routes";

export function useNextNavigation(): Navigation {
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

  return useMemo(
    () => ({
      route: hrefToRoute(pathname, new URLSearchParams()),
      visit,
      navigate: (r) => {
        router.push(routeToHref(r));
      },
      // Reemplazar solo actualiza la URL (filtros, consulta): sin pedir la página de nuevo.
      replace: (r) => {
        window.history.replaceState(null, "", routeToHref(r));
      },
      back: () => {
        router.back();
      },
      canGoBack: visit > 0,
      urls: true,
    }),
    [pathname, visit, router],
  );
}
