import { useEffect, useRef, type ReactNode } from "react";
import {
  buildFicha,
  buildLevel,
  buildPrinciples,
  buildProgression,
} from "../domain/curriculum/views";
import { useApp, useRepo } from "./app/state";
import { tabOf, type Route, type TabName } from "./app/types";
import { Icon, IconButton, OfflineBanner, RouteLink } from "./components";
import { HappyAvatar } from "./happy/HappyAvatar";
import { OnboardingScreen, SignInScreen } from "./screens/Access";
import { FichaNotFound, FichaScreen } from "./screens/Ficha";
import { NotFoundScreen } from "./screens/NotFound";
import { HappyScreen } from "./screens/Happy";
import { HomeScreen } from "./screens/Home";
import { MallaScreen } from "./screens/Malla";
import { IdentityScreen, ProfileScreen } from "./screens/Profile";
import { LevelScreen, PrinciplesScreen, ProgressionScreen } from "./screens/Reference";
import { SavedScreen } from "./screens/Saved";
import { SearchScreen } from "./screens/Search";

const TABS: { id: TabName; label: string; route: Route; icon: ReactNode }[] = [
  { id: "home", label: "Inicio", route: { name: "home" }, icon: <Icon name="home" /> },
  { id: "malla", label: "Malla", route: { name: "malla" }, icon: <Icon name="malla" /> },
  { id: "happy", label: "Happy", route: { name: "happy" }, icon: <HappyAvatar size={24} /> },
  { id: "saved", label: "Guardados", route: { name: "saved" }, icon: <Icon name="saved" /> },
];

/** Identidad de una ruta raíz (pestañas). */
function routeKey(r: Route): string {
  return JSON.stringify(r);
}

/** Pantallas del prototipo: los modelos de vista se construyen en memoria desde el repositorio. */
function PrototypeScreen({ route }: { route: Route }) {
  const repo = useRepo();
  switch (route.name) {
    case "home":
      return <HomeScreen />;
    case "malla":
      return (
        <MallaScreen
          {...(route.levelId ? { levelId: route.levelId } : {})}
          {...(route.periodIndex ? { periodIndex: route.periodIndex } : {})}
        />
      );
    case "ficha": {
      const data = buildFicha(repo, route.code);
      return data ? <FichaScreen data={data} /> : <FichaNotFound />;
    }
    case "search":
      return <SearchScreen {...(route.q ? { q: route.q } : {})} />;
    case "level": {
      const data = buildLevel(repo, route.levelId);
      return data ? <LevelScreen data={data} /> : <NotFoundScreen />;
    }
    case "progression":
      return <ProgressionScreen data={buildProgression(repo)} />;
    case "principles":
      return <PrinciplesScreen data={buildPrinciples(repo)} />;
    case "happy":
      return (
        <HappyScreen
          {...(route.threadId ? { threadId: route.threadId } : {})}
          {...(route.mode ? { mode: route.mode } : {})}
          {...(route.context ? { context: route.context } : {})}
        />
      );
    case "saved":
      return <SavedScreen {...(route.tab ? { tab: route.tab } : {})} />;
    case "identity":
      return <IdentityScreen />;
    case "tools":
      return <ProfileScreen />;
  }
}

/**
 * Armazón común (barra superior, pestañas, foco tras navegar). Lo usan el prototipo y la app.
 * `requireSession`: el prototipo simula el acceso; producción no tiene acceso hasta F4.
 */
export function Shell({
  children,
  requireSession = false,
}: {
  children: ReactNode;
  requireSession?: boolean;
}) {
  const { state, route, visit, back, canGoBack, online, hydrated } = useApp();
  const firstVisit = useRef(true);

  // Tras navegar, el foco va al título de la nueva pantalla (lectores de pantalla y teclado).
  useEffect(() => {
    if (firstVisit.current) {
      firstVisit.current = false;
      return;
    }
    const h1 = document.querySelector<HTMLElement>("main h1");
    if (h1) {
      h1.tabIndex = -1;
      h1.focus({ preventScroll: true });
    }
  }, [visit]);

  if (requireSession) {
    if (!hydrated) return null;
    if (!state.session) return <SignInScreen />;
    if (!state.work.onboarded) return <OnboardingScreen />;
  }

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
            current={active === t.id}
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

/** Prototipo F2: armazón + pantallas en memoria, con acceso simulado. */
export function App() {
  const { route, visit } = useApp();
  return (
    <Shell requireSession>
      <PrototypeScreen key={`${route.name}#${String(visit)}`} route={route} />
    </Shell>
  );
}
