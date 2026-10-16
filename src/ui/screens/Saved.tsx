import { useApp } from "../app/state";
import { Button, EmptyState, Icon, PeriodChip } from "../components";

type Tab = "favoritos" | "ideas" | "planeaciones";
const TABS: { id: Tab; label: string }[] = [
  { id: "favoritos", label: "Favoritos" },
  { id: "ideas", label: "Ideas" },
  { id: "planeaciones", label: "Planeaciones" },
];

export function SavedScreen({ tab = "favoritos" }: { tab?: Tab }) {
  const { state, repo, navigate, replace, dispatch } = useApp();
  const select = (t: Tab) => {
    replace({ name: "saved", tab: t });
  };

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="display">Guardados</h1>
      </header>
      <div className="tabs" role="tablist" aria-label="Tipo de guardado">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            className={`tabs__tab${tab === t.id ? " is-on" : ""}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => {
              select(t.id);
            }}
            onKeyDown={(e) => {
              const i = TABS.findIndex((x) => x.id === tab);
              const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
              if (!d) return;
              e.preventDefault();
              const next = TABS[(i + d + TABS.length) % TABS.length];
              if (next) {
                select(next.id);
                requestAnimationFrame(() => document.getElementById(`tab-${next.id}`)?.focus());
              }
            }}
          >
            {t.label}
            {t.id === "favoritos" && state.favorites.length > 0 && (
              <span className="count">{state.favorites.length}</span>
            )}
            {t.id === "ideas" && state.ideas.length > 0 && (
              <span className="count">{state.ideas.length}</span>
            )}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "favoritos" &&
          (state.favorites.length === 0 ? (
            <EmptyState
              title="Aún no tienes favoritos"
              body="Toca la estrella en una ficha para tenerla siempre a mano."
              action={
                <Button
                  onClick={() => {
                    navigate({ name: "malla" });
                  }}
                >
                  Ir a la malla
                </Button>
              }
            />
          ) : (
            <ul className="card-list">
              {state.favorites.map((f) => {
                if (f.target.type !== "experience") return null;
                const e = repo.maybeExperience(f.target.code);
                if (!e) return null;
                const changed = f.release !== repo.release.release;
                return (
                  <li key={f.id}>
                    <div className="saved-item">
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
                        <span className="exp-card__sub">
                          {repo.level(e.levelId).labelLiteral}
                          {changed && " · actualizada desde que la guardaste"}
                        </span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ))}

        {tab === "ideas" &&
          (state.ideas.length === 0 ? (
            <EmptyState
              title="Aún no tienes ideas guardadas"
              body="Cuando Happy te proponga un camino que te sirva, toca «Guardar idea»."
              action={
                <Button
                  variant="primary"
                  onClick={() => {
                    navigate({ name: "happy", mode: "explorar" });
                  }}
                >
                  Pedir ideas a Happy
                </Button>
              }
            />
          ) : (
            <ul className="card-list">
              {state.ideas.map((i) => (
                <li key={i.id} className="idea">
                  <div className="idea__head">
                    <h2 className="idea__title">{i.title}</h2>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Eliminar la idea «${i.title}»`}
                      onClick={() => {
                        dispatch({ type: "removeIdea", id: i.id });
                      }}
                    >
                      <Icon name="close" />
                    </button>
                  </div>
                  <p className="idea__text">{i.text}</p>
                  <p className="tag-generated">Idea complementaria de Happy</p>
                  {i.sourceUnitIds.length > 0 && (
                    <p className="muted">
                      Basada en:{" "}
                      {[
                        ...new Set(
                          i.sourceUnitIds.map((id) => repo.maybeUnit(id)?.code).filter(Boolean),
                        ),
                      ].map((code) => (
                        <button
                          key={code}
                          type="button"
                          className="link"
                          onClick={() => {
                            if (code) navigate({ name: "ficha", code });
                          }}
                        >
                          {code}
                        </button>
                      ))}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ))}

        {tab === "planeaciones" && (
          <EmptyState
            title="Las planeaciones llegan en la siguiente versión"
            body="Podrás armar una planeación por los cuatro momentos de cada experiencia y exportarla. Mientras tanto, guarda ideas desde Happy."
          />
        )}
      </div>
    </div>
  );
}
