import {
  buildFicha,
  buildLevel,
  buildPrinciples,
  buildProgression,
} from "../domain/curriculum/views";
import { useApp, useRepo } from "./app/state";
import type { Route } from "./app/types";
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
import { Shell } from "./Shell";

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
    case "notFound":
      return <NotFoundScreen />;
  }
}

/** Prototipo F2: acceso simulado + armazón + pantallas en memoria. */
export function App() {
  const { route, visit, state, hydrated } = useApp();
  if (!hydrated) return null;
  if (!state.session) return <SignInScreen />;
  if (!state.work.onboarded) return <OnboardingScreen />;
  return (
    <Shell>
      <PrototypeScreen key={`${route.name}#${String(visit)}`} route={route} />
    </Shell>
  );
}
