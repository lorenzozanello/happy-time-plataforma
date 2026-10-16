import { useState } from "react";
import type { DimensionKey } from "../../domain/curriculum/fields";
import type { LevelData, PrinciplesData, ProgressionData } from "../../domain/curriculum/views";
import { Literal, PeriodChip, Provenance, RouteLink, UnitBlock } from "../components";

export function LevelScreen({ data }: { data: LevelData }) {
  const { level, fields } = data;
  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="display">{level.labelLiteral}</h1>
        <p className="lead">
          {level.equivalencia.text} · {level.edadEntrada.text} a {level.edadSalida.text}
        </p>
        <p className="muted" data-unit-id={fields.ciclo_normativo.unitId}>
          <Literal text={fields.ciclo_normativo.text} />{" "}
          <Provenance unit={fields.ciclo_normativo} />
        </p>
      </header>
      <UnitBlock unit={fields.perfil_entrada} level={2} />
      <UnitBlock unit={fields.perfil_salida} level={2} />

      <section aria-labelledby="prog-nivel">
        <h2 id="prog-nivel" className="section-title">
          Progresión en {level.labelLiteral}
        </h2>
        <div className="stack">
          {data.progression.map((u) => (
            <UnitBlock key={u.unitId} unit={u} heading={u.headerLiteral} />
          ))}
        </div>
      </section>

      <section aria-labelledby="exps-nivel">
        <h2 id="exps-nivel" className="section-title">
          Experiencias del año
        </h2>
        <ul className="card-list">
          {data.experiences.map((e) => (
            <li key={e.code}>
              <RouteLink to={{ name: "ficha", code: e.code }} className="exp-card exp-card--link">
                <span className="exp-card__meta">
                  <span className="code">{e.code}</span>
                  <PeriodChip index={e.periodIndex} label={e.periodLiteral} />
                </span>
                <span className="exp-card__title">{e.title.text}</span>
              </RouteLink>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function ProgressionScreen({ data }: { data: ProgressionData }) {
  const dims = data.dimensions;
  const [dim, setDim] = useState<DimensionKey>(dims[0]?.key ?? "cognitiva");
  const cell = (levelId: string, d: DimensionKey) =>
    data.cells.find((x) => x.levelId === levelId && x.dimensionKey === d)?.unit;
  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="display">Progresión por dimensión</h1>
        <p className="lead">
          Cómo avanza cada dimensión del desarrollo de {data.levels[0]?.labelLiteral} a{" "}
          {data.levels.at(-1)?.labelLiteral}.
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
        {data.levels.map((l) => {
          const u = cell(l.id, dim);
          return (
            <li key={l.id} className="progression__step">
              <span className="progression__level">{l.progresionLabelLiteral}</span>
              {u && (
                <div className="progression__body" data-unit-id={u.unitId}>
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

export function PrinciplesScreen({ data }: { data: PrinciplesData }) {
  const head = data.units[0]?.headerLiteral ?? "";
  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="display">Principios de la malla</h1>
        <p className="lead">
          {head} institucionales que orientan todo el uso de la malla y de Happy.
        </p>
      </header>
      <ol className="principles">
        {data.units.map((u) => (
          <li key={u.unitId} className="principles__item" data-unit-id={u.unitId}>
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
