import { useEffect, useMemo, useRef, useState } from "react";
import type { LevelId } from "../../domain/curriculum/fields";
import { shortHeader } from "../../domain/curriculum/repository";
import {
  loadSearchIndex,
  searchUnits,
  snippet,
  type SearchIndex,
} from "../../domain/curriculum/search";
import { catalogLevel, catalogTitle, type SearchUnit } from "../../domain/curriculum/views";
import type { Route } from "../app/types";
import { useApp } from "../app/state";
import { EmptyState, ErrorState, Highlighted, Icon, RouteLink, Skeleton } from "../components";

interface Loaded {
  index: SearchIndex;
  units: Map<string, SearchUnit>;
}

export function SearchScreen({ q: initial = "" }: { q?: string }) {
  const { catalog, loadSearch, replace, dispatch } = useApp();
  const [q, setQ] = useState(initial);
  const [level, setLevel] = useState<LevelId | "all">("all");
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  useEffect(() => {
    let alive = true;
    loadSearch()
      .then((bundle) => {
        if (!alive) return;
        setData({
          index: loadSearchIndex(bundle.index),
          units: new Map(bundle.units.map((u) => [u.unitId, u])),
        });
        setFailed(false);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [loadSearch, attempt]);

  const groups = useMemo(() => {
    if (!data) return [];
    const hits = searchUnits(data.index, q, (id) => {
      if (level === "all") return true;
      return data.units.get(id)?.levelId === level;
    });
    const byKey = new Map<
      string,
      { key: string; code?: string; label: string; items: typeof hits }
    >();
    for (const h of hits.slice(0, 60)) {
      const u = data.units.get(h.unitId);
      if (!u) continue;
      const key = u.code ?? (u.kind === "observation" ? "principios" : (u.levelId ?? "otros"));
      const label = u.code
        ? catalogTitle(catalog, u.code)
        : u.kind === "observation"
          ? "Principios de la malla"
          : u.levelId
            ? `Perfil de ${catalogLevel(catalog, u.levelId)?.labelLiteral ?? u.levelId}`
            : "Otros";
      const g = byKey.get(key) ?? { key, ...(u.code ? { code: u.code } : {}), label, items: [] };
      g.items.push(h);
      byKey.set(key, g);
    }
    return [...byKey.values()];
  }, [q, level, data, catalog]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const target = (u: SearchUnit): Route =>
    u.code
      ? { name: "ficha", code: u.code }
      : u.kind === "observation"
        ? { name: "principles" }
        : u.kind === "progression"
          ? { name: "progression" }
          : u.levelId
            ? { name: "level", levelId: u.levelId }
            : { name: "malla" };

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="display">Buscar</h1>
        <form
          role="search"
          className="search-box"
          onSubmit={(e) => {
            e.preventDefault();
            dispatch({ type: "search", q });
          }}
        >
          <Icon name="search" size={20} />
          <label htmlFor="q" className="sr-only">
            Buscar en la malla
          </label>
          <input
            id="q"
            ref={input}
            type="search"
            value={q}
            placeholder="Rimas, patio, vínculo seguro…"
            autoComplete="off"
            onChange={(e) => {
              setQ(e.target.value);
              replace({ name: "search", q: e.target.value });
            }}
            onBlur={() => {
              dispatch({ type: "search", q });
            }}
          />
        </form>
        <div className="chip-row" role="group" aria-label="Filtrar por nivel">
          <button
            type="button"
            className={`chip${level === "all" ? " is-on" : ""}`}
            aria-pressed={level === "all"}
            onClick={() => {
              setLevel("all");
            }}
          >
            Todos
          </button>
          {catalog.levels.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`chip${level === l.id ? " is-on" : ""}`}
              aria-pressed={level === l.id}
              onClick={() => {
                setLevel(l.id);
              }}
            >
              {l.labelLiteral}
            </button>
          ))}
        </div>
      </header>

      {failed ? (
        <ErrorState
          message="No pudimos cargar la búsqueda. Revisa tu conexión e inténtalo de nuevo."
          onRetry={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
        />
      ) : !data ? (
        <div aria-busy="true" aria-label="Cargando la búsqueda">
          <Skeleton lines={4} />
        </div>
      ) : q.trim() === "" ? (
        <EmptyState
          title="Busca por tema, material o propósito"
          body="Encuentras cualquier palabra de las 20 experiencias, los perfiles de nivel, la progresión y los principios. No importan las tildes."
        />
      ) : total === 0 ? (
        <EmptyState
          title={`Sin resultados para «${q}»`}
          body="Prueba con una palabra más corta o quita el filtro de nivel."
        />
      ) : (
        <div className="results" aria-live="polite">
          <p className="muted">
            {total} {total === 1 ? "resultado" : "resultados"}
          </p>
          {groups.map((g) => (
            <section key={g.key} className="result-group">
              <h2 className="result-group__title">
                {g.code && <span className="code">{g.code}</span>} {g.label}
              </h2>
              <ul>
                {g.items.map((h) => {
                  const u = data.units.get(h.unitId);
                  if (!u) return null;
                  const sn = snippet(u.text, h.terms);
                  return (
                    <li key={h.unitId}>
                      <RouteLink to={target(u)} className="result">
                        <span className="result__field">{shortHeader(u.headerLiteral)}</span>
                        <span className="result__text">
                          {sn.cutStart && "… "}
                          <Highlighted text={sn.text} ranges={sn.ranges} />
                          {sn.cutEnd && " …"}
                        </span>
                      </RouteLink>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
