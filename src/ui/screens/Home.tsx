import type { Mode } from "../../domain/happy/schema";
import { useApp } from "../app/state";
import { Button, EmptyState, Icon, PeriodChip } from "../components";
import { HappyAvatar } from "../happy/HappyAvatar";
import { ROMAN, greeting } from "../presentation";

export const INTENTS: { mode: Mode; label: string; hint: string }[] = [
  { mode: "explorar", label: "Necesito ideas", hint: "Caminos para vivir la experiencia" },
  { mode: "aterrizar", label: "Tengo una idea", hint: "Conectarla con la malla y aterrizarla" },
  { mode: "conectar", label: "Conectar con la malla", hint: "Encontrar dónde vive un tema" },
];

export function HomeScreen() {
  const { repo, state, navigate } = useApp();
  const { work, recentSearches, favorites } = state;
  const last = work.lastExperience ? repo.maybeExperience(work.lastExperience) : undefined;
  const lastThread = work.lastThreadId
    ? state.threads.find((t) => t.id === work.lastThreadId)
    : undefined;
  const period = work.periodIndex ?? 1;
  const mine = work.levelIds.map((l) => repo.experienceAt(l, period));
  const happyContext = last
    ? { levelId: last.levelId, periodIndex: last.periodIndex, experienceCode: last.code }
    : {};

  return (
    <div className="screen home">
      <header className="screen__head">
        <p className="eyebrowless">{greeting()}</p>
        <h1 className="display">¿Qué preparamos hoy?</h1>
      </header>

      {last && (
        <section aria-labelledby="continuar">
          <h2 id="continuar" className="section-title">
            Continuar donde quedaste
          </h2>
          <button
            type="button"
            className="exp-card exp-card--link"
            onClick={() => {
              navigate({ name: "ficha", code: last.code });
            }}
          >
            <span className="exp-card__meta">
              <span className="code">{last.code}</span>
              <PeriodChip index={last.periodIndex} label={last.periodLiteral} />
            </span>
            <span className="exp-card__title">{repo.title(last.code)}</span>
            <span className="exp-card__sub">{repo.level(last.levelId).labelLiteral}</span>
          </button>
        </section>
      )}

      <section aria-labelledby="periodo">
        <div className="section-row">
          <h2 id="periodo" className="section-title">
            Tu periodo {ROMAN[period - 1]}
          </h2>
          <button
            type="button"
            className="link"
            onClick={() => {
              navigate({ name: "malla" });
            }}
          >
            Ver toda la malla
          </button>
        </div>
        {mine.length === 0 ? (
          <EmptyState
            title="Elige tus niveles"
            body="Así verás aquí las experiencias de tu periodo sin buscarlas."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  navigate({ name: "tools" });
                }}
              >
                Elegir mis niveles
              </Button>
            }
          />
        ) : (
          <ul className="card-list">
            {mine.map((e) => (
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
                    <span className="exp-card__sub">{repo.level(e.levelId).labelLiteral}</span>
                  </span>
                  <span className="exp-card__title">{repo.title(e.code)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {lastThread && (
        <section aria-labelledby="retomar">
          <h2 id="retomar" className="section-title">
            Retomar con Happy
          </h2>
          <button
            type="button"
            className="thread-item"
            onClick={() => {
              navigate({ name: "happy", threadId: lastThread.id });
            }}
          >
            <span>{lastThread.title}</span>
            <Icon name="chevron" size={18} />
          </button>
        </section>
      )}

      <section className="happy-entry" aria-labelledby="happy-entry">
        <div className="happy-entry__head">
          <HappyAvatar size={48} state="neutral" />
          <div>
            <h2 id="happy-entry" className="happy-entry__title">
              Pensemos juntas.
            </h2>
            <p className="happy-entry__promise">
              Tú defines la intención. Happy te ayuda a encontrar el camino.
            </p>
          </div>
        </div>
        <div className="intent-grid">
          {INTENTS.map((i) => (
            <button
              key={i.mode}
              type="button"
              className="intent"
              onClick={() => {
                navigate({ name: "happy", mode: i.mode, context: happyContext });
              }}
            >
              <span className="intent__label">{i.label}</span>
              <span className="intent__hint">{i.hint}</span>
            </button>
          ))}
        </div>
      </section>

      {recentSearches.length > 0 && (
        <section aria-labelledby="recientes">
          <h2 id="recientes" className="section-title">
            Búsquedas recientes
          </h2>
          <div className="chip-row">
            {recentSearches.map((q) => (
              <button
                key={q}
                type="button"
                className="chip"
                onClick={() => {
                  navigate({ name: "search", q });
                }}
              >
                <Icon name="search" size={16} />
                {q}
              </button>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="favs">
        <div className="section-row">
          <h2 id="favs" className="section-title">
            Favoritos
          </h2>
          {favorites.length > 0 && (
            <button
              type="button"
              className="link"
              onClick={() => {
                navigate({ name: "saved", tab: "favoritos" });
              }}
            >
              Ver todos
            </button>
          )}
        </div>
        {favorites.length === 0 ? (
          <p className="muted">
            Marca con la estrella las experiencias que más usas y aparecerán aquí.
          </p>
        ) : (
          <ul className="card-list">
            {favorites.slice(0, 3).map((f) =>
              f.target.type === "experience" ? (
                <li key={f.id}>
                  <button
                    type="button"
                    className="exp-card exp-card--link exp-card--compact"
                    onClick={() => {
                      if (f.target.type === "experience")
                        navigate({ name: "ficha", code: f.target.code });
                    }}
                  >
                    <span className="code">{f.target.code}</span>
                    <span className="exp-card__title">{repo.title(f.target.code)}</span>
                  </button>
                </li>
              ) : null,
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
