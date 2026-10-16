import { catalogExperience, catalogLevel, experienceAt } from "../../domain/curriculum/views";
import type { Mode } from "../../domain/happy/schema";
import { useApp } from "../app/state";
import { EmptyState, Icon, PeriodChip, RouteLink } from "../components";
import { HappyAvatar } from "../happy/HappyAvatar";
import { ROMAN, greeting } from "../presentation";

export const INTENTS: { mode: Mode; label: string; hint: string }[] = [
  { mode: "explorar", label: "Necesito ideas", hint: "Caminos para vivir la experiencia" },
  { mode: "aterrizar", label: "Tengo una idea", hint: "Conectarla con la malla y aterrizarla" },
  { mode: "conectar", label: "Conectar con la malla", hint: "Encontrar dónde vive un tema" },
];

export function HomeScreen() {
  const { catalog, state, hydrated, happyEnabled: happyAvailable } = useApp();
  const { work, recentSearches, favorites } = state;
  const last = work.lastExperience ? catalogExperience(catalog, work.lastExperience) : undefined;
  const lastThread =
    happyAvailable && work.lastThreadId
      ? state.threads.find((t) => t.id === work.lastThreadId)
      : undefined;
  const period = work.periodIndex ?? 1;
  const mine = work.levelIds.map((l) => experienceAt(catalog, l, period));
  const happyContext = last
    ? { levelId: last.levelId, periodIndex: last.periodIndex, experienceCode: last.code }
    : {};
  const levelLabel = (id: string) => catalogLevel(catalog, id)?.labelLiteral ?? id;

  return (
    <div className="screen home">
      <header className="screen__head">
        <p className="eyebrowless" suppressHydrationWarning>
          {hydrated ? greeting() : "Hola"}
        </p>
        <h1 className="display">¿Qué preparamos hoy?</h1>
      </header>

      {last && (
        <section aria-labelledby="continuar">
          <h2 id="continuar" className="section-title">
            Continuar donde quedaste
          </h2>
          <RouteLink to={{ name: "ficha", code: last.code }} className="exp-card exp-card--link">
            <span className="exp-card__meta">
              <span className="code">{last.code}</span>
              <PeriodChip index={last.periodIndex} label={last.periodLiteral} />
            </span>
            <span className="exp-card__title">{last.title.text}</span>
            <span className="exp-card__sub">{levelLabel(last.levelId)}</span>
          </RouteLink>
        </section>
      )}

      <section aria-labelledby="periodo">
        <div className="section-row">
          <h2 id="periodo" className="section-title">
            Tu periodo {ROMAN[period - 1]}
          </h2>
          <RouteLink to={{ name: "malla" }} className="link">
            Ver toda la malla
          </RouteLink>
        </div>
        {!hydrated ? null : mine.length === 0 ? (
          <EmptyState
            title="Elige tus niveles"
            body="Así verás aquí las experiencias de tu periodo sin buscarlas."
            action={
              <RouteLink to={{ name: "tools" }} className="btn btn--secondary">
                Elegir mis niveles
              </RouteLink>
            }
          />
        ) : (
          <ul className="card-list">
            {mine.map((e) => (
              <li key={e.code}>
                <RouteLink to={{ name: "ficha", code: e.code }} className="exp-card exp-card--link">
                  <span className="exp-card__meta">
                    <span className="code">{e.code}</span>
                    <span className="exp-card__sub">{levelLabel(e.levelId)}</span>
                  </span>
                  <span className="exp-card__title">{e.title.text}</span>
                </RouteLink>
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
          <RouteLink to={{ name: "happy", threadId: lastThread.id }} className="thread-item">
            <span>{lastThread.title}</span>
            <Icon name="chevron" size={18} />
          </RouteLink>
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
              {happyAvailable
                ? "Tú defines la intención. Happy te ayuda a encontrar el camino."
                : "Happy llega en la próxima versión. Mientras tanto, la malla completa está aquí."}
            </p>
          </div>
        </div>
        {happyAvailable && (
          <div className="intent-grid">
            {INTENTS.map((i) => (
              <RouteLink
                key={i.mode}
                to={{ name: "happy", mode: i.mode, context: happyContext }}
                className="intent"
              >
                <span className="intent__label">{i.label}</span>
                <span className="intent__hint">{i.hint}</span>
              </RouteLink>
            ))}
          </div>
        )}
      </section>

      {recentSearches.length > 0 && (
        <section aria-labelledby="recientes">
          <h2 id="recientes" className="section-title">
            Búsquedas recientes
          </h2>
          <div className="chip-row">
            {recentSearches.map((q) => (
              <RouteLink key={q} to={{ name: "search", q }} className="chip">
                <Icon name="search" size={16} />
                {q}
              </RouteLink>
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
            <RouteLink to={{ name: "saved", tab: "favoritos" }} className="link">
              Ver todos
            </RouteLink>
          )}
        </div>
        {favorites.length === 0 ? (
          <p className="muted">
            Marca con la estrella las experiencias que más usas y aparecerán aquí.
          </p>
        ) : (
          <ul className="card-list">
            {favorites.slice(0, 3).map((f) => {
              if (f.target.type !== "experience") return null;
              const e = catalogExperience(catalog, f.target.code);
              if (!e) return null;
              return (
                <li key={f.id}>
                  <RouteLink
                    to={{ name: "ficha", code: e.code }}
                    className="exp-card exp-card--link exp-card--compact"
                  >
                    <span className="code">{e.code}</span>
                    <span className="exp-card__title">{e.title.text}</span>
                  </RouteLink>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
