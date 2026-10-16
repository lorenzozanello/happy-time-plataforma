import { useEffect, useMemo, useRef, useState } from "react";
import type { LevelId } from "../../domain/curriculum/fields";
import { shortHeader } from "../../domain/curriculum/repository";
import { searchUnits, snippet } from "../../domain/curriculum/search";
import { useApp } from "../app/state";
import { EmptyState, Highlighted, Icon } from "../components";

export function SearchScreen({ q: initial = "" }: { q?: string }) {
  const { repo, search, navigate, dispatch } = useApp();
  const [q, setQ] = useState(initial);
  const [level, setLevel] = useState<LevelId | "all">("all");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const groups = useMemo(() => {
    const hits = searchUnits(search, q, (id) => {
      if (level === "all") return true;
      return repo.maybeUnit(id)?.levelId === level;
    });
    const byKey = new Map<
      string,
      { key: string; code?: string; label: string; items: typeof hits }
    >();
    for (const h of hits.slice(0, 60)) {
      const u = repo.unit(h.unitId);
      const key = u.code ?? (u.kind === "observation" ? "principios" : (u.levelId ?? "otros"));
      const label = u.code
        ? repo.title(u.code)
        : u.kind === "observation"
          ? "Principios de la malla"
          : u.levelId
            ? `Perfil de ${repo.level(u.levelId).labelLiteral}`
            : "Otros";
      const g = byKey.get(key) ?? { key, ...(u.code ? { code: u.code } : {}), label, items: [] };
      g.items.push(h);
      byKey.set(key, g);
    }
    return [...byKey.values()];
  }, [q, level, repo, search]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);

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
          {repo.levels.map((l) => (
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

      {q.trim() === "" ? (
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
                  const u = repo.unit(h.unitId);
                  const sn = snippet(u.text, h.terms);
                  return (
                    <li key={h.unitId}>
                      <button
                        type="button"
                        className="result"
                        onClick={() => {
                          dispatch({ type: "search", q });
                          if (u.code) navigate({ name: "ficha", code: u.code });
                          else if (u.kind === "observation") navigate({ name: "principles" });
                          else if (u.kind === "progression") navigate({ name: "progression" });
                          else if (u.levelId) navigate({ name: "level", levelId: u.levelId });
                        }}
                      >
                        <span className="result__field">{shortHeader(u.headerLiteral)}</span>
                        <span className="result__text">
                          {sn.cutStart && "… "}
                          <Highlighted text={sn.text} ranges={sn.ranges} />
                          {sn.cutEnd && " …"}
                        </span>
                      </button>
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
