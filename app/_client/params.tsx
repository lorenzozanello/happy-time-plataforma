"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { Fragment, useState, type ReactNode } from "react";
import { hrefToRoute } from "../../src/ui/app/routes";
import type { Route } from "../../src/ui/app/types";
import { wasReplaced } from "./navigation";

/**
 * Ruta completa (con parámetros) de la página actual. La pantalla se vuelve a montar cuando los
 * parámetros cambian por una navegación (atrás/adelante, pestaña, enlace), y no cuando los cambia
 * ella misma con `replace` (así no pierde el foco ni lo que se está escribiendo).
 * Debe usarse dentro de <Suspense>.
 */
export function WithRoute({ children }: { children: (route: Route) => ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const href = search ? `${pathname}?${search}` : pathname;
  const [seen, setSeen] = useState({ href, key: 0 });
  let key = seen.key;
  if (seen.href !== href) {
    key = wasReplaced(href) ? seen.key : seen.key + 1;
    setSeen({ href, key });
  }
  return (
    <Fragment key={key}>{children(hrefToRoute(pathname, new URLSearchParams(search)))}</Fragment>
  );
}
