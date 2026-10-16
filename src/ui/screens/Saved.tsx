import { catalogExperience, catalogLevel, unitExperienceCode } from "../../domain/curriculum/views";
import { useApp } from "../app/state";
import { Button, EmptyState, Icon, PeriodChip, RouteLink } from "../components";

type Tab = "favoritos" | "ideas" | "planeaciones";
const TABS: { id: Tab; label: string }[] = [
  { id: "favoritos", label: "Favoritos" },
  { id: "ideas", label: "Ideas" },
  { id: "planeaciones", label: "Planeaciones" },
];

export function SavedScreen({ tab = "favoritos" }: { tab?: Tab }) {
  const { state, catalog, navigate, replace, dispatch, happyEnabled } = useApp();
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
                const e = catalogExperience(catalog, f.target.code);
                if (!e) return null;
                const changed = f.release !== catalog.release;
                return (
                  <li key={f.id}>
                    <div className="saved-item">
                      <RouteLink
                        to={{ name: "ficha", code: e.code }}
                        className="exp-card exp-card--link"
                      >
                        <span className="exp-card__meta">
                          <span className="code">{e.code}</span>
                          <PeriodChip index={e.periodIndex} label={e.periodLiteral} />
                        </span>
                        <span className="exp-card__title">{e.title.text}</span>
                        <span className="exp-card__sub">
                          {catalogLevel(catalog, e.levelId)?.labelLiteral ?? e.levelId}
                          {changed && " · actualizada desde que la guardaste"}
                        </span>
                      </RouteLink>
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
              body={
                happyEnabled
                  ? "Cuando Happy te proponga un camino que te sirva, toca «Guardar idea»."
                  : "Cuando Happy llegue, podrás guardar aquí los caminos que te sirvan."
              }
              {...(happyEnabled
                ? {
                    action: (
                      <RouteLink
                        to={{ name: "happy", mode: "explorar" }}
                        className="btn btn--primary"
                      >
                        Pedir ideas a Happy
                      </RouteLink>
                    ),
                  }
                : {})}
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
                          i.sourceUnitIds
                            .map((id) => unitExperienceCode(catalog, id))
                            .filter(Boolean),
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
