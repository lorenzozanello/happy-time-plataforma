"use client";
/**
 * Frontera cliente de la app: las pantallas compartidas con el prototipo (src/ui) reciben aquí
 * sus datos del servidor o sus parámetros de URL.
 */
import { useSearchParams } from "next/navigation";
import { Fragment, Suspense, type ReactNode } from "react";
import type {
  FichaData,
  LevelData,
  PrinciplesData,
  ProgressionData,
} from "../../src/domain/curriculum/views";
import { hrefToRoute } from "../../src/ui/app/routes";
import { useApp } from "../../src/ui/app/state";
import { FichaScreen } from "../../src/ui/screens/Ficha";
import { HappyScreen } from "../../src/ui/screens/Happy";
import { HomeScreen } from "../../src/ui/screens/Home";
import { MallaScreen } from "../../src/ui/screens/Malla";
import { NotFoundScreen } from "../../src/ui/screens/NotFound";
import { IdentityScreen, ProfileScreen } from "../../src/ui/screens/Profile";
import { LevelScreen, PrinciplesScreen, ProgressionScreen } from "../../src/ui/screens/Reference";
import { SavedScreen } from "../../src/ui/screens/Saved";
import { SearchScreen } from "../../src/ui/screens/Search";

/**
 * Pantallas cuyo estado inicial depende de los datos del navegador (niveles, periodo): se
 * vuelven a montar cuando esos datos ya se leyeron, para no quedarse con los valores vacíos
 * del HTML estático.
 */
function AfterHydration({ children }: { children: ReactNode }) {
  const { hydrated } = useApp();
  return <Fragment key={hydrated ? "datos" : "estatico"}>{children}</Fragment>;
}

function useRouteParams(pathname: string) {
  return hrefToRoute(pathname, new URLSearchParams(useSearchParams().toString()));
}

/* ── Inicio, perfil, identidad, Happy ───────────────────────────────────── */
export const HomePage = () => <HomeScreen />;
export const IdentityPage = () => <IdentityScreen />;
export const HappyPage = () => <HappyScreen />;
export const NotFoundPage = () => <NotFoundScreen />;
export const ProfilePage = () => (
  <AfterHydration>
    <ProfileScreen />
  </AfterHydration>
);

/* ── Malla (con ?nivel=&periodo=) ───────────────────────────────────────── */
function MallaWithParams() {
  const r = useRouteParams("/malla");
  const p = r.name === "malla" ? r : { levelId: undefined, periodIndex: undefined };
  return (
    <AfterHydration>
      <MallaScreen
        {...(p.levelId ? { levelId: p.levelId } : {})}
        {...(p.periodIndex ? { periodIndex: p.periodIndex } : {})}
      />
    </AfterHydration>
  );
}
export const MallaPage = () => (
  <Suspense
    fallback={
      <AfterHydration>
        <MallaScreen />
      </AfterHydration>
    }
  >
    <MallaWithParams />
  </Suspense>
);

/* ── Buscar (con ?q=) ───────────────────────────────────────────────────── */
function SearchWithParams() {
  const r = useRouteParams("/buscar");
  return <SearchScreen {...(r.name === "search" && r.q ? { q: r.q } : {})} />;
}
export const SearchPage = () => (
  <Suspense fallback={<SearchScreen />}>
    <SearchWithParams />
  </Suspense>
);

/* ── Guardados (con ?pestana=) ──────────────────────────────────────────── */
function SavedWithParams() {
  const r = useRouteParams("/guardados");
  return <SavedScreen {...(r.name === "saved" && r.tab ? { tab: r.tab } : {})} />;
}
export const SavedPage = () => (
  <Suspense fallback={<SavedScreen />}>
    <SavedWithParams />
  </Suspense>
);

/* ── Páginas con datos del servidor ─────────────────────────────────────── */
export const FichaPage = ({ data }: { data: FichaData }) => <FichaScreen data={data} />;
export const LevelPage = ({ data }: { data: LevelData }) => <LevelScreen data={data} />;
export const ProgressionPage = ({ data }: { data: ProgressionData }) => (
  <ProgressionScreen data={data} />
);
export const PrinciplesPage = ({ data }: { data: PrinciplesData }) => (
  <PrinciplesScreen data={data} />
);
