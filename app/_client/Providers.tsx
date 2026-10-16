"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Catalog, SearchBundle } from "../../src/domain/curriculum/views";
import { Shell } from "../../src/ui/Shell";
import { AppProvider } from "../../src/ui/app/state";
import { useNextNavigation } from "./navigation";
import { createAppServices } from "./services";

/** Clave propia: la app y el prototipo no comparten datos del navegador. */
const STORAGE_KEY = "ht.app.v1";

export function Providers({
  catalog,
  searchUrl,
  children,
}: {
  catalog: Catalog;
  searchUrl: string;
  children: ReactNode;
}) {
  const navigation = useNextNavigation(catalog);
  const services = useMemo(() => createAppServices(), []);
  // Happy depende de la configuración del servidor en tiempo de ejecución (no del build).
  const [happy, setHappy] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/happy", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ disponible?: boolean }>) : null))
      .then((s) => {
        if (alive) setHappy(s?.disponible === true);
      })
      .catch(() => {
        if (alive) setHappy(false); // sin respuesta: Happy queda como «llega pronto»
      });
    return () => {
      alive = false;
    };
  }, []);
  const loadSearch = useMemo(() => {
    let pending: Promise<SearchBundle> | undefined;
    return () => {
      pending ??= fetch(searchUrl)
        .then(async (r) => {
          if (!r.ok) throw new Error(`Búsqueda no disponible (${String(r.status)})`);
          return (await r.json()) as SearchBundle;
        })
        .catch((e: unknown) => {
          pending = undefined; // un fallo no queda en caché: «Reintentar» vuelve a pedirlo
          throw e;
        });
      return pending;
    };
  }, [searchUrl]);

  return (
    <AppProvider
      catalog={catalog}
      loadSearch={loadSearch}
      services={services}
      navigation={navigation}
      storageKey={STORAGE_KEY}
      happyEnabled={happy === true}
      happyPending={happy === null}
    >
      <Shell>{children}</Shell>
    </AppProvider>
  );
}
