import type { ReactNode } from "react";
import { useApp } from "./app/state";
import { tabOf, type Route, type TabName } from "./app/types";
import { Icon, IconButton, OfflineBanner } from "./components";
import { HappyAvatar } from "./happy/HappyAvatar";
import { OnboardingScreen, SignInScreen } from "./screens/Access";
import { FichaScreen } from "./screens/Ficha";
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

/** Clave estable por pantalla: remonta el estado local al cambiar de ruta. */
function routeKey(r: Route): string {
  return JSON.stringify(r);
}

function Screen({ route }: { route: Route }) {
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
    case "ficha":
      return <FichaScreen code={route.code} />;
    case "search":
      return <SearchScreen {...(route.q ? { q: route.q } : {})} />;
    case "level":
      return <LevelScreen levelId={route.levelId} />;
    case "progression":
      return <ProgressionScreen />;
    case "principles":
      return <PrinciplesScreen />;
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

export function App() {
  const { state, route, navigate, back, canGoBack, online } = useApp();
  if (!state.session) return <SignInScreen />;
  if (!state.work.onboarded) return <OnboardingScreen />;

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
            <IconButton
              icon="search"
              label="Abrir búsqueda"
              onClick={() => {
                navigate({ name: "search" });
              }}
            />
            <IconButton
              icon="settings"
              label="Tu perfil"
              onClick={() => {
                navigate({ name: "tools" });
              }}
            />
          </div>
        </div>
      </header>

      <nav className="tabbar" aria-label="Principal">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tabbar__item${active === t.id ? " is-on" : ""}`}
            aria-current={active === t.id ? "page" : undefined}
            onClick={() => {
              navigate(t.route);
            }}
          >
            <span className="tabbar__icon">{t.icon}</span>
            <span className="tabbar__label">{t.label}</span>
          </button>
        ))}
      </nav>

      <main id="main" className="main" tabIndex={-1}>
        {!online && <OfflineBanner />}
        <Screen key={routeKey(route)} route={route} />
      </main>
    </div>
  );
}
