import { useRef, useState } from "react";
import type { LevelId } from "../../domain/curriculum/fields";
import { useApp } from "../app/state";
import { Button, Icon, Literal, PeriodChip } from "../components";
import { ROMAN } from "../presentation";

/** Selector de periodo con forma de reloj: los cuatro periodos del año como cuatro cuartos. */
export function PeriodDial({
  value,
  onChange,
  titles,
}: {
  value: number;
  onChange: (p: number) => void;
  titles: string[];
}) {
  // Orden visual en sentido horario desde las 12: I arriba-derecha, II abajo-derecha,
  // III abajo-izquierda, IV arriba-izquierda.
  const cells = [4, 1, 3, 2];
  const refs = useRef<Record<number, HTMLButtonElement | null>>({});
  const move = (p: number) => {
    onChange(p);
    requestAnimationFrame(() => refs.current[p]?.focus());
  };
  const angle = { 1: 45, 2: 135, 3: 225, 4: 315 }[value] ?? 45;
  return (
    <div className="dial" role="radiogroup" aria-label="Periodo">
      {cells.map((p) => (
        <button
          key={p}
          ref={(el) => {
            refs.current[p] = el;
          }}
          type="button"
          role="radio"
          aria-checked={value === p}
          aria-label={`Periodo ${ROMAN[p - 1] ?? ""}: ${titles[p - 1] ?? ""}`}
          className={`dial__q dial__q--${p}${value === p ? " is-on" : ""}`}
          onClick={() => {
            onChange(p);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
              e.preventDefault();
              move((value % 4) + 1);
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
              e.preventDefault();
              move(((value + 2) % 4) + 1);
            }
          }}
          tabIndex={value === p ? 0 : -1}
        >
          <span className="dial__num">{ROMAN[p - 1]}</span>
        </button>
      ))}
      <span className="dial__hand" style={{ transform: `rotate(${angle}deg)` }} aria-hidden="true">
        <span className="dial__hand-tip" />
      </span>
      <span className="dial__pivot" aria-hidden="true" />
    </div>
  );
}

export function LevelPicker({
  value,
  onChange,
}: {
  value: LevelId;
  onChange: (l: LevelId) => void;
}) {
  const { repo } = useApp();
  return (
    <div className="level-picker" role="group" aria-label="Nivel">
      {repo.levels.map((l) => (
        <button
          key={l.id}
          type="button"
          aria-pressed={value === l.id}
          className={`level-tab${value === l.id ? " is-on" : ""}`}
          onClick={() => {
            onChange(l.id);
          }}
        >
          <span className="level-tab__name">{l.labelLiteral}</span>
          <span className="level-tab__eq">{repo.levelField(l.id, "equivalencia").text}</span>
        </button>
      ))}
    </div>
  );
}

export function MallaScreen({ levelId, periodIndex }: { levelId?: LevelId; periodIndex?: number }) {
  const { repo, state, navigate, replace } = useApp();
  const [level, setLevel] = useState<LevelId>(levelId ?? state.work.levelIds[0] ?? "step-1");
  const [period, setPeriod] = useState<number>(periodIndex ?? state.work.periodIndex ?? 1);
  const exps = repo.experiencesOf(level);
  const exp = repo.experienceAt(level, period);
  const titles = exps.map((e) => repo.title(e.code));
  const alcance = repo.experienceField(exp.code, "alcance");

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="display">Malla curricular</h1>
        <button
          type="button"
          className="search-trigger"
          onClick={() => {
            navigate({ name: "search" });
          }}
        >
          <Icon name="search" size={20} />
          <span>Buscar en la malla</span>
        </button>
      </header>

      <LevelPicker
        value={level}
        onChange={(l) => {
          setLevel(l);
          replace({ name: "malla", levelId: l, periodIndex: period });
        }}
      />

      <section className="dial-row" aria-label="Experiencia del periodo">
        <PeriodDial
          value={period}
          onChange={(p) => {
            setPeriod(p);
            replace({ name: "malla", levelId: level, periodIndex: p });
          }}
          titles={titles}
        />
        <article className="exp-card exp-card--hero">
          <div className="exp-card__meta">
            <PeriodChip index={exp.periodIndex} label={exp.periodLiteral} />
          </div>
          <h2 className="exp-card__title">{repo.title(exp.code)}</h2>
          <p className="exp-card__body">
            <Literal text={alcance.text} />
          </p>
          <div className="exp-card__actions">
            <Button
              variant="primary"
              onClick={() => {
                navigate({ name: "ficha", code: exp.code });
              }}
            >
              Abrir ficha
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                navigate({
                  name: "happy",
                  context: { levelId: level, periodIndex: period, experienceCode: exp.code },
                });
              }}
            >
              Pensemos juntas
            </Button>
          </div>
        </article>
      </section>

      <section className="stack" aria-labelledby="year-title">
        <h2 id="year-title" className="section-title">
          El año en {repo.level(level).labelLiteral}
        </h2>
        <ol className="year-list">
          {exps.map((e) => (
            <li key={e.code}>
              <button
                type="button"
                className={`year-item${e.code === exp.code ? " is-on" : ""}`}
                aria-current={e.code === exp.code ? "true" : undefined}
                onClick={() => {
                  navigate({ name: "ficha", code: e.code });
                }}
              >
                <PeriodChip index={e.periodIndex} label={ROMAN[e.periodIndex - 1] ?? ""} />
                <span className="year-item__title">
                  {repo.title(e.code)}
                  {e.code === exp.code && <span className="year-item__now"> · seleccionado</span>}
                </span>
                <Icon name="chevron" size={18} />
              </button>
            </li>
          ))}
        </ol>
      </section>

      <nav className="link-list" aria-label="Más de la malla">
        <button
          type="button"
          onClick={() => {
            navigate({ name: "level", levelId: level });
          }}
        >
          <span>Perfil de {repo.level(level).labelLiteral}</span>
          <Icon name="chevron" size={18} />
        </button>
        <button
          type="button"
          onClick={() => {
            navigate({ name: "progression" });
          }}
        >
          <span>Progresión por dimensión</span>
          <Icon name="chevron" size={18} />
        </button>
        <button
          type="button"
          onClick={() => {
            navigate({ name: "principles" });
          }}
        >
          <span>Principios de la malla</span>
          <Icon name="chevron" size={18} />
        </button>
      </nav>
    </div>
  );
}
