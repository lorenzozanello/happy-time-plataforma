import { useState } from "react";
import { LEVEL_FIELDS, type DimensionKey, type LevelId } from "../../domain/curriculum/fields";
import { useApp } from "../app/state";
import { Literal, PeriodChip, Provenance, UnitBlock } from "../components";

export function LevelScreen({ levelId }: { levelId: LevelId }) {
  const { repo, navigate } = useApp();
  const level = repo.level(levelId);
  const field = (k: (typeof LEVEL_FIELDS)[number]["key"]) => repo.levelField(levelId, k);
  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="display">{level.labelLiteral}</h1>
        <p className="lead">
          {field("equivalencia").text} · {field("edad_entrada").text} a {field("edad_salida").text}
        </p>
        <p className="muted">
          <Literal text={field("ciclo_normativo").text} />{" "}
          <Provenance unit={field("ciclo_normativo")} />
        </p>
      </header>
      <UnitBlock unit={field("perfil_entrada")} level={2} />
      <UnitBlock unit={field("perfil_salida")} level={2} />

      <section aria-labelledby="prog-nivel">
        <h2 id="prog-nivel" className="section-title">
          Progresión en {level.labelLiteral}
        </h2>
        <div className="stack">
          {repo.progressionOf(levelId).map((u) => (
            <UnitBlock key={u.unitId} unit={u} heading={u.headerLiteral} />
          ))}
        </div>
      </section>

      <section aria-labelledby="exps-nivel">
        <h2 id="exps-nivel" className="section-title">
          Experiencias del año
        </h2>
        <ul className="card-list">
          {repo.experiencesOf(levelId).map((e) => (
            <li key={e.code}>
              <button
                type="button"
                className="exp-card exp-card--link"
                onClick={() => {
                  navigate({ name: "ficha", code: e.code });
                }}
              >
                <span className="exp-card__meta">
                  <span className="code">{e.code}</span>
                  <PeriodChip index={e.periodIndex} label={e.periodLiteral} />
                </span>
                <span className="exp-card__title">{repo.title(e.code)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function ProgressionScreen() {
  const { repo } = useApp();
  const dims = repo.release.dimensions;
  const [dim, setDim] = useState<DimensionKey>(dims[0]?.key ?? "cognitiva");
  const cell = (levelId: LevelId, d: DimensionKey) => {
    const p = repo.release.progression.find((x) => x.levelId === levelId && x.dimensionKey === d);
    return p ? repo.unit(p.unitId) : undefined;
  };
  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="display">Progresión por dimensión</h1>
        <p className="lead">
          Cómo avanza cada dimensión del desarrollo de {repo.levels[0]?.labelLiteral} a{" "}
          {repo.levels.at(-1)?.labelLiteral}.
        </p>
      </header>
      <div className="chip-row" role="group" aria-label="Dimensión">
        {dims.map((d) => (
          <button
            key={d.key}
            type="button"
            aria-pressed={dim === d.key}
            className={`chip${dim === d.key ? " is-on" : ""}`}
            onClick={() => {
              setDim(d.key);
            }}
          >
            {d.headerLiteral}
          </button>
        ))}
      </div>
      <ol
        className="progression"
        aria-label={`Dimensión ${dims.find((d) => d.key === dim)?.headerLiteral ?? ""}`}
      >
        {repo.levels.map((l) => {
          const u = cell(l.id, dim);
          return (
            <li key={l.id} className="progression__step">
              <span className="progression__level">{l.progresionLabelLiteral}</span>
              {u && (
                <div className="progression__body">
                  <p className="unit__text">
                    <Literal text={u.text} />
                  </p>
                  <Provenance unit={u} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function PrinciplesScreen() {
  const { repo } = useApp();
  const head = repo.observations[0]?.headerLiteral ?? "";
  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="display">Principios de la malla</h1>
        <p className="lead">
          {head} institucionales que orientan todo el uso de la malla y de Happy.
        </p>
      </header>
      <ol className="principles">
        {repo.observations.map((u) => (
          <li key={u.unitId} className="principles__item">
            <p>
              <Literal text={u.text} />
            </p>
            <Provenance unit={u} />
          </li>
        ))}
      </ol>
    </div>
  );
}
