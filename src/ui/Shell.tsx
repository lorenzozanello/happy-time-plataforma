import { useEffect, useRef, type ReactNode } from "react";
import { useApp } from "./app/state";
import { tabOf, type Route, type TabName } from "./app/types";
import { Icon, IconButton, OfflineBanner, RouteLink } from "./components";
import { HappyAvatar } from "./happy/HappyAvatar";

const TABS: { id: TabName; label: string; route: Route; icon: ReactNode }[] = [
  { id: "home", label: "Inicio", route: { name: "home" }, icon: <Icon name="home" /> },
  { id: "malla", label: "Malla", route: { name: "malla" }, icon: <Icon name="malla" /> },
  { id: "happy", label: "Happy", route: { name: "happy" }, icon: <HappyAvatar size={24} /> },
  { id: "saved", label: "Guardados", route: { name: "saved" }, icon: <Icon name="saved" /> },
];

/** Identidad de una ruta raíz (pestañas). */
const routeKey = (r: Route) => JSON.stringify(r);

/**
 * Armazón común (barra superior, pestañas, foco tras navegar). Lo usan el prototipo y la app de
 * producción; no conoce las pantallas, solo las recibe.
 */
export function Shell({ children }: { children: ReactNode }) {
  const { route, visit, back, canGoBack, online } = useApp();
  const lastVisit = useRef(visit);

  // Tras navegar, el foco va al título de la nueva pantalla (lectores de pantalla y teclado).
  // Se compara con la visita anterior: en StrictMode el efecto corre dos veces al montar.
  useEffect(() => {
    if (lastVisit.current === visit) return;
    lastVisit.current = visit;
    const h1 = document.querySelector<HTMLElement>("main h1");
    if (h1) {
      h1.tabIndex = -1;
      h1.focus({ preventScroll: true });
    }
  }, [visit]);

  const active = tabOf(route);
  const isRoot = TABS.some((t) => routeKey(t.route) === routeKey(route));

  return (
    <div className="shell">
      <a className="skip" href="#main">
        Saltar al contenido
      </a>
      <header className="topbar">
        <div className="topbar__inner">
          {canGoBack && !isRoot ? (
            <IconButton icon="back" label="Volver" onClick={back} />
          ) : (
            <span className="brand">
              <span className="brand__name">Happy Time</span>
              <span className="brand__sub">Malla curricular</span>
            </span>
          )}
          <div className="topbar__actions">
            <RouteLink to={{ name: "search" }} className="icon-btn" label="Abrir búsqueda">
              <Icon name="search" />
            </RouteLink>
            <RouteLink to={{ name: "tools" }} className="icon-btn" label="Tu perfil">
              <Icon name="settings" />
            </RouteLink>
          </div>
        </div>
      </header>

      <nav className="tabbar" aria-label="Principal">
        {TABS.map((t) => (
          <RouteLink
            key={t.id}
            to={t.route}
            className={`tabbar__item${active === t.id ? " is-on" : ""}`}
            // "page" en la raíz de la pestaña; "true" en una pantalla dentro de esa sección.
            {...(active === t.id ? { current: isRoot ? "page" : "true" } : {})}
          >
            <span className="tabbar__icon">{t.icon}</span>
            <span className="tabbar__label">{t.label}</span>
          </RouteLink>
        ))}
      </nav>

      <main id="main" className="main" tabIndex={-1}>
        {!online && <OfflineBanner />}
        {children}
      </main>
    </div>
  );
}
