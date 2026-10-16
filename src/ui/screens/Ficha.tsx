import { EXPERIENCE_FIELDS, type ExperienceFieldKey } from "../../domain/curriculum/fields";
import { segmentValue, shortHeader } from "../../domain/curriculum/repository";
import type { Unit } from "../../domain/curriculum/schema";
import { useApp } from "../app/state";
import {
  Button,
  Icon,
  IconButton,
  Literal,
  PeriodChip,
  Provenance,
  UnitBlock,
} from "../components";
import {
  ALERTS_PRINCIPLE_UNIT,
  COLLAPSIBLE_GROUPS,
  GROUP_LABEL,
  OPENING_PRINCIPLE_UNIT,
} from "../presentation";

const MOMENTS: ExperienceFieldKey[] = [
  "momento_indagar",
  "momento_proyectar",
  "momento_vivir",
  "momento_valorar",
];
const RECTORAS: ExperienceFieldKey[] = ["juego", "exploracion_medio", "literatura", "arte"];
const SEGMENT_ROWS = [
  ["tema", "Tema"],
  ["competencia", "Competencia"],
  ["avance", "Avance"],
  ["evidencia", "Evidencia"],
] as const;

/** Etiqueta corta de un momento a partir de su encabezado literal ("Momento de Indagar" → "Indagar"). */
const momentName = (header: string) => header.replace(/^Momento de\s+/, "");

export function FichaScreen({ code }: { code: string }) {
  const { repo, navigate, dispatch, isFavorite, state } = useApp();
  const exp = repo.maybeExperience(code);
  const principleSeen = state.work.principleSeen ?? false;
  if (!exp) {
    return (
      <div className="screen">
        <p role="alert">Esa experiencia no existe en la release vigente.</p>
        <Button
          onClick={() => {
            navigate({ name: "malla" });
          }}
        >
          Ir a la malla
        </Button>
      </div>
    );
  }
  const f = (k: ExperienceFieldKey) => repo.experienceField(code, k);
  const level = repo.level(exp.levelId);
  const fav = isFavorite({ type: "experience", code });
  const { prev, next } = repo.neighbors(code);
  const title = repo.unit(exp.titleUnitId);

  return (
    <article className="screen ficha" aria-labelledby="ficha-title">
      <header className="ficha__head">
        <div className="ficha__meta">
          <span className="code">{exp.code}</span>
          <PeriodChip index={exp.periodIndex} label={exp.periodLiteral} />
        </div>
        <h1 id="ficha-title" className="display ficha__title">
          {title.text}
        </h1>
        <p className="ficha__level">
          {level.labelLiteral} · {repo.levelField(level.id, "equivalencia").text} ·{" "}
          {repo.levelField(level.id, "edad_entrada").text} a{" "}
          {repo.levelField(level.id, "edad_salida").text}
        </p>
        <div className="ficha__actions">
          <IconButton
            icon="star"
            label={fav ? "Quitar de favoritos" : "Guardar en favoritos"}
            pressed={fav}
            onClick={() => {
              dispatch({
                type: "toggleFavorite",
                target: { type: "experience", code },
                release: repo.release.release,
              });
            }}
          />
          <Button
            variant="primary"
            onClick={() => {
              navigate({
                name: "happy",
                context: {
                  levelId: exp.levelId,
                  periodIndex: exp.periodIndex,
                  experienceCode: code,
                },
              });
            }}
          >
            Pensemos juntas
          </Button>
        </div>
      </header>

      {!principleSeen && (
        <aside className="principle" aria-label="Principio de la malla">
          <p>
            <Literal text={repo.unit(OPENING_PRINCIPLE_UNIT).text} />
          </p>
          <button
            type="button"
            className="link"
            onClick={() => {
              dispatch({ type: "work", patch: { principleSeen: true } });
            }}
          >
            Entendido
          </button>
        </aside>
      )}

      <UnitBlock unit={f("alcance")} level={2} />

      <section className="unit" data-unit-id={f("propositos").unitId}>
        <div className="unit__head">
          <h2 className="unit__title">{f("propositos").headerLiteral}</h2>
          <Provenance unit={f("propositos")} />
        </div>
        <Purposes unit={f("propositos")} />
      </section>

      <section aria-labelledby="ciclo">
        <h2 id="ciclo" className="section-title">
          {GROUP_LABEL.ciclo_pedagogico}
        </h2>
        <ol className="moments">
          {MOMENTS.map((k, i) => {
            const u = f(k);
            return (
              <li key={k} className="moment" data-unit-id={u.unitId}>
                <span className="moment__step" aria-hidden="true">
                  {i + 1}
                </span>
                <div className="moment__body">
                  <div className="unit__head">
                    <h3 className="moment__name">{momentName(u.headerLiteral)}</h3>
                    <Provenance unit={u} />
                  </div>
                  <p className="unit__text">
                    <Literal text={u.text} />
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="rectoras">
        <h2 id="rectoras" className="section-title">
          {GROUP_LABEL.actividades_rectoras}
        </h2>
        <div className="rectoras">
          {RECTORAS.map((k) => (
            <Rectora key={k} unit={f(k)} />
          ))}
        </div>
      </section>

      {COLLAPSIBLE_GROUPS.map((g) => {
        const fields = EXPERIENCE_FIELDS.filter((x) => x.group === g);
        return (
          <details key={g} className="group">
            <summary>
              <span>{GROUP_LABEL[g]}</span>
              <Icon name="chevron" size={18} />
            </summary>
            <div className="group__body">
              {fields.map((x) =>
                x.key === "documentacion_alertas" ? (
                  <Alerts
                    key={x.key}
                    unit={f(x.key)}
                    principle={repo.unit(ALERTS_PRINCIPLE_UNIT)}
                  />
                ) : (
                  <UnitBlock key={x.key} unit={f(x.key)} />
                ),
              )}
            </div>
          </details>
        );
      })}

      <nav className="ficha__nav" aria-label="Otras experiencias">
        {prev ? (
          <button
            type="button"
            onClick={() => {
              navigate({ name: "ficha", code: prev.code });
            }}
          >
            <Icon name="back" size={18} />
            <span>
              <span className="code">{prev.code}</span> {repo.title(prev.code)}
            </span>
          </button>
        ) : (
          <span />
        )}
        {next && (
          <button
            type="button"
            className="ficha__next"
            onClick={() => {
              navigate({ name: "ficha", code: next.code });
            }}
          >
            <span>
              <span className="code">{next.code}</span> {repo.title(next.code)}
            </span>
            <Icon name="chevron" size={18} />
          </button>
        )}
      </nav>
    </article>
  );
}

function Purposes({ unit }: { unit: Unit }) {
  if (!unit.segments) {
    return (
      <p className="unit__text">
        <Literal text={unit.text} />
      </p>
    );
  }
  return (
    <ol className="purposes">
      {[1, 2, 3].map((n) => (
        <li key={n} className="purpose">
          <p className="purpose__statement">
            <Literal text={segmentValue(unit, `proposito_${n}`) ?? ""} />
          </p>
          <p className="purpose__logro">
            <Literal text={segmentValue(unit, `logro_${n}`) ?? ""} />
          </p>
        </li>
      ))}
    </ol>
  );
}

function Rectora({ unit }: { unit: Unit }) {
  return (
    <section className="rectora" data-unit-id={unit.unitId}>
      <div className="unit__head">
        <h3 className="rectora__name">{shortHeader(unit.headerLiteral)}</h3>
        <Provenance unit={unit} />
      </div>
      {unit.segments ? (
        <dl className="rectora__rows">
          {SEGMENT_ROWS.map(([key, label]) => (
            <div key={key} className="rectora__row">
              <dt>{label}</dt>
              <dd>
                <Literal text={segmentValue(unit, key) ?? ""} />
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="unit__text">
          <Literal text={unit.text} />
        </p>
      )}
    </section>
  );
}

function Alerts({ unit, principle }: { unit: Unit; principle: Unit }) {
  const doc = segmentValue(unit, "documentacion");
  const alerts = segmentValue(unit, "alertas");
  return (
    <section className="unit" data-unit-id={unit.unitId}>
      <div className="unit__head">
        <h3 className="unit__title">{unit.headerLiteral}</h3>
        <Provenance unit={unit} />
      </div>
      {doc && alerts ? (
        <>
          <p className="unit__text">
            <Literal text={doc} />
          </p>
          <div className="alerts">
            <p className="alerts__label">Alertas</p>
            <p className="unit__text">
              <Literal text={alerts} />
            </p>
            <p className="alerts__principle">
              <Icon name="info" size={16} />
              <Literal text={principle.text} />
            </p>
          </div>
        </>
      ) : (
        <p className="unit__text">
          <Literal text={unit.text} />
        </p>
      )}
    </section>
  );
}
