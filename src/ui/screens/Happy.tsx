import { useEffect, useRef, useState } from "react";
import { shortHeader } from "../../domain/curriculum/repository";
import { checkPrivacy, PRIVACY_MESSAGE } from "../../domain/happy/privacy";
import type { Block, HappyContext, HappyResponse, Mode } from "../../domain/happy/schema";
import { newId, now, useApp, useRepo } from "../app/state";
import type { Thread, ThreadMessage } from "../app/types";
import {
  Button,
  ErrorState,
  Icon,
  IconButton,
  Literal,
  Provenance,
  RouteLink,
  Skeleton,
} from "../components";
import { HappyAvatar, HappyLockup, type HappyState } from "../happy/HappyAvatar";
import { ROMAN } from "../presentation";
import { INTENTS } from "./Home";

const PLACEHOLDER: Record<Mode, string> = {
  explorar: "Cuéntame qué buscas, o pide ideas para la experiencia elegida",
  aterrizar: "Describe tu idea: qué quieres hacer y con quién",
  conectar: "Escribe un tema, material o propósito",
  adaptar: "Describe la situación sin nombres ni diagnósticos",
  observar: "¿Qué quieres observar?",
  registrar: "¿Qué quieres registrar?",
  general: "Escribe tu pregunta",
};

interface HappyProps {
  threadId?: string;
  mode?: Mode;
  context?: HappyContext;
}

export function HappyScreen(props: HappyProps) {
  const { repo, happyEnabled } = useApp();
  if (!repo || !happyEnabled) return <HappyComingSoon />;
  return <HappyChat {...props} />;
}

/** Happy aún no está disponible en este despliegue (F3: la Malla sale primero a producción). */
export function HappyComingSoon() {
  return (
    <div className="screen">
      <header className="screen__head">
        <HappyLockup />
        <h1 className="display">Happy llega pronto</h1>
        <p className="lead">
          Mientras tanto, toda la malla está disponible: experiencias, niveles, progresión y
          principios, con su referencia exacta.
        </p>
      </header>
      <div className="stack">
        <RouteLink to={{ name: "malla" }} className="btn btn--primary">
          Ir a la malla
        </RouteLink>
        <RouteLink to={{ name: "search" }} className="btn btn--secondary">
          Buscar en la malla
        </RouteLink>
      </div>
    </div>
  );
}

function HappyChat({ threadId, mode: initialMode, context: initialContext }: HappyProps) {
  const app = useApp();
  const repo = useRepo();
  const { state, navigate, replace, dispatch, services, online } = app;
  const existing = threadId ? state.threads.find((t) => t.id === threadId) : undefined;
  const [thread, setThread] = useState<Thread | undefined>(existing);
  const [mode, setMode] = useState<Mode | undefined>(existing?.mode ?? initialMode);
  const [context, setContext] = useState<HappyContext>(existing?.context ?? initialContext ?? {});
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const [phase, setPhase] = useState<"idle" | "thinking" | "streaming" | "done">("idle");
  const [partial, setPartial] = useState<HappyResponse | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  const avatarState: HappyState =
    phase === "thinking"
      ? "piensa"
      : phase === "streaming"
        ? "idea"
        : phase === "done"
          ? "resultado"
          : focused && draft.trim()
            ? "escucha"
            : "neutral";

  useEffect(() => {
    if (phase !== "done") return;
    const t = setTimeout(() => {
      setPhase("idle");
    }, 2400);
    return () => {
      clearTimeout(t);
    };
  }, [phase]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [thread?.messages.length, partial]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => {
      setToast(null);
    }, 2200);
    return () => {
      clearTimeout(t);
    };
  }, [toast]);

  const persist = (t: Thread) => {
    setThread(t);
    dispatch({ type: "upsertThread", thread: t });
    dispatch({ type: "work", patch: { lastThreadId: t.id } });
    // La ruta guarda la conversación: al volver desde una ficha se retoma donde estaba.
    replace({ name: "happy", threadId: t.id });
  };

  const updateContext = (next: HappyContext) => {
    setContext(next);
    if (thread) persist({ ...thread, context: next });
  };

  async function send(
    text: string,
    m: Mode = mode ?? "general",
    from: Thread | undefined = thread,
  ) {
    const raw = text.trim();
    if (!raw || phase === "thinking" || phase === "streaming") return;
    setMode(m);
    // Política de entrada (ADR-009): solo se guarda la versión redactada; si identifica a una
    // persona, no se envía a Happy y se pide reformular.
    const privacy = checkPrivacy(raw);
    const stored = privacy.redacted;
    const userMsg: ThreadMessage = {
      id: newId(),
      role: "docente",
      text: stored,
      mode: m,
      createdAt: now(),
    };
    const base: Thread = from ?? {
      id: newId(),
      mode: m,
      context,
      title: stored.length > 60 ? `${stored.slice(0, 57)}…` : stored,
      messages: [],
      updatedAt: now(),
    };
    let current: Thread = { ...base, messages: [...base.messages, userMsg], updatedAt: now() };
    setDraft("");
    if (privacy.sensitive) {
      persist({
        ...current,
        messages: [
          ...current.messages,
          {
            id: newId(),
            role: "happy",
            replyTo: userMsg.id,
            response: {
              mode: m,
              blocks: [{ kind: "notice", code: "privacy", text: PRIVACY_MESSAGE }],
              nextActions: [],
            },
            createdAt: now(),
          },
        ],
      });
      return;
    }
    persist(current);
    setPhase("thinking"); // feedback local inmediato (<150 ms)
    setPartial(null);
    try {
      const response = await services.happy.respond({ mode: m, message: raw, context }, (p) => {
        setPhase("streaming");
        setPartial(p);
      });
      current = {
        ...current,
        messages: [
          ...current.messages,
          { id: newId(), role: "happy", replyTo: userMsg.id, response, createdAt: now() },
        ],
        updatedAt: now(),
      };
      persist(current);
      setPartial(null);
      setPhase("done");
    } catch {
      current = {
        ...current,
        messages: [
          ...current.messages,
          {
            id: newId(),
            role: "happy",
            replyTo: userMsg.id,
            error:
              "Happy no pudo responder esta vez. Tu mensaje quedó guardado; vuelve a intentarlo.",
            createdAt: now(),
          },
        ],
      };
      persist(current);
      setPartial(null);
      setPhase("idle");
    }
  }

  /** Reintenta el mensaje que falló (solo el último error), con el modo con que se envió. */
  const retry = (errorId: string) => {
    if (!thread) return;
    const err = thread.messages.find((x) => x.id === errorId);
    const original = thread.messages.find((x) => x.id === err?.replyTo);
    if (!err || !original?.text) return;
    const cleaned = {
      ...thread,
      messages: thread.messages.filter((x) => x.id !== err.id && x.id !== original.id),
    };
    void send(original.text, original.mode ?? thread.mode, cleaned);
  };

  const saveIdea = (title: string, text: string, response: HappyResponse) => {
    const dup = state.ideas.some(
      (i) => i.title === title && i.text === text && i.threadId === thread?.id,
    );
    if (dup) {
      setToast("Esa idea ya está en Guardados");
      return;
    }
    dispatch({
      type: "saveIdea",
      idea: {
        id: newId(),
        title,
        text,
        sourceUnitIds: response.blocks.flatMap((b) => (b.kind === "malla_ref" ? [b.unitId] : [])),
        ...(context.experienceCode ? { experienceCode: context.experienceCode } : {}),
        ...(thread ? { threadId: thread.id } : {}),
        release: repo.release.release,
        createdAt: now(),
      },
    });
    setToast("Idea guardada en Guardados");
  };

  const setFeedback = (msgId: string, value: "up" | "down") => {
    if (!thread) return;
    persist({
      ...thread,
      messages: thread.messages.map((m) => (m.id === msgId ? { ...m, feedback: value } : m)),
    });
    setToast("Gracias. Tu valoración ayuda a mejorar a Happy.");
  };

  const busy = phase === "thinking" || phase === "streaming";
  const started = (thread?.messages.length ?? 0) > 0;

  return (
    <div className="screen happy">
      <header className="happy__head">
        {started && <h1 className="sr-only">Conversación con Happy</h1>}
        <HappyLockup state={avatarState} size={48} />
        <p className="sr-only" aria-live="polite">
          {avatarState === "piensa"
            ? "Happy está pensando"
            : avatarState === "resultado"
              ? "Respuesta lista"
              : ""}
        </p>
      </header>

      <p className="proto-note" role="note">
        Prototipo: Happy está simulada. Responde con ejemplos fijos construidos con la malla real;
        no usa IA.
      </p>

      <ContextChips
        context={context}
        onRemove={(k) => {
          // Nivel + periodo identifican una experiencia: quitar uno quita lo que depende de él.
          const drop =
            k === "levelId"
              ? ["levelId", "periodIndex", "experienceCode"]
              : ["periodIndex", "experienceCode"];
          updateContext(
            Object.fromEntries(Object.entries(context).filter(([key]) => !drop.includes(key))),
          );
        }}
      />

      {!started && (
        <section className="happy__open" aria-labelledby="happy-open">
          <h1 id="happy-open" className="display">
            Pensemos juntas.
          </h1>
          <p className="lead">Tú defines la intención. Happy te ayuda a encontrar el camino.</p>
          <div className="intent-grid" role="radiogroup" aria-label="Intención">
            {INTENTS.map((i) => (
              <button
                key={i.mode}
                type="button"
                role="radio"
                aria-checked={mode === i.mode}
                className={`intent${mode === i.mode ? " is-on" : ""}`}
                onClick={() => {
                  setMode(i.mode);
                }}
              >
                <span className="intent__label">{i.label}</span>
                <span className="intent__hint">{i.hint}</span>
              </button>
            ))}
          </div>
          {mode === "explorar" && context.experienceCode && (
            <Button
              variant="primary"
              onClick={() => {
                void send(`Dame ideas para ${context.experienceCode ?? ""}`, "explorar");
              }}
            >
              Pedir ideas para {context.experienceCode}
            </Button>
          )}
          <ThreadList
            threads={state.threads}
            onOpen={(id) => {
              navigate({ name: "happy", threadId: id });
            }}
          />
        </section>
      )}

      {started && thread && (
        <div className="conversation" aria-live="polite">
          {thread.messages.map((m) =>
            m.role === "docente" ? (
              <p key={m.id} className="bubble bubble--docente">
                {m.text}
              </p>
            ) : m.error ? (
              <ErrorState
                key={m.id}
                message={m.error}
                {...(m.id === thread.messages.at(-1)?.id && !busy
                  ? {
                      onRetry: () => {
                        retry(m.id);
                      },
                    }
                  : {})}
              />
            ) : m.response ? (
              <ResponseView
                key={m.id}
                response={m.response}
                feedback={m.feedback}
                onFeedback={(v) => {
                  setFeedback(m.id, v);
                }}
                onSaveIdea={saveIdea}
                onAction={(a) => {
                  if (a.kind === "open_experience" && a.payload)
                    navigate({ name: "ficha", code: a.payload });
                  else if (a.kind === "send" && a.payload) void send(a.payload, "aterrizar");
                }}
                onLand={(title) => {
                  void send(`Quiero aterrizar el camino «${title}»`, "aterrizar");
                }}
              />
            ) : null,
          )}
          {phase === "thinking" && (
            <div className="response response--pending">
              <Skeleton lines={3} />
            </div>
          )}
          {partial && <ResponseView response={partial} pending />}
          <div ref={end} className="conversation__end" />
        </div>
      )}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <label htmlFor="happy-input" className="sr-only">
          Mensaje para Happy
        </label>
        <textarea
          id="happy-input"
          rows={2}
          value={draft}
          disabled={!online}
          placeholder={
            online
              ? PLACEHOLDER[mode ?? "general"]
              : "Sin conexión: Happy vuelve cuando recuperes la red"
          }
          onFocus={() => {
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
          }}
          onChange={(e) => {
            setDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(draft);
            }
          }}
        />
        <button
          type="submit"
          className="composer__send"
          aria-label="Enviar"
          disabled={!draft.trim() || busy || !online}
        >
          <Icon name="send" />
        </button>
      </form>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function ContextChips({
  context,
  onRemove,
}: {
  context: HappyContext;
  onRemove: (k: keyof HappyContext) => void;
}) {
  const repo = useRepo();
  const items: { key: keyof HappyContext; label: string }[] = [];
  const lvl = context.levelId ? repo.levels.find((l) => l.id === context.levelId) : undefined;
  if (lvl) items.push({ key: "levelId", label: lvl.labelLiteral });
  if (context.periodIndex)
    items.push({ key: "periodIndex", label: `Periodo ${ROMAN[context.periodIndex - 1] ?? ""}` });
  if (context.experienceCode && repo.maybeExperience(context.experienceCode))
    items.push({
      key: "experienceCode",
      label: `${context.experienceCode} · ${repo.title(context.experienceCode)}`,
    });
  if (items.length === 0) {
    return <p className="muted context-empty">Sin contexto: Happy buscará en toda la malla.</p>;
  }
  return (
    <ul className="context-chips" aria-label="Contexto activo">
      {items.map((i) => (
        <li key={i.key} className="context-chip">
          <span>{i.label}</span>
          <button
            type="button"
            aria-label={`Quitar ${i.label} del contexto`}
            onClick={() => {
              onRemove(i.key);
            }}
          >
            <Icon name="close" size={16} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function ThreadList({ threads, onOpen }: { threads: Thread[]; onOpen: (id: string) => void }) {
  if (threads.length === 0) return null;
  return (
    <section aria-labelledby="threads" className="threads">
      <h2 id="threads" className="section-title">
        Conversaciones recientes
      </h2>
      <ul className="card-list">
        {threads.slice(0, 5).map((t) => (
          <li key={t.id}>
            <button
              type="button"
              className="thread-item"
              onClick={() => {
                onOpen(t.id);
              }}
            >
              <span>{t.title}</span>
              <Icon name="chevron" size={18} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ResponseView({
  response,
  pending = false,
  feedback,
  onFeedback,
  onSaveIdea,
  onAction,
  onLand,
}: {
  response: HappyResponse;
  pending?: boolean;
  feedback?: "up" | "down" | undefined;
  onFeedback?: (v: "up" | "down") => void;
  onSaveIdea?: (title: string, text: string, r: HappyResponse) => void;
  onAction?: (a: HappyResponse["nextActions"][number]) => void;
  onLand?: (title: string) => void;
}) {
  return (
    <div className={`response${pending ? " response--pending" : ""}`}>
      {response.blocks.map((b, i) => (
        <BlockView key={i} block={b} response={response} onSaveIdea={onSaveIdea} onLand={onLand} />
      ))}
      {!pending && response.nextActions.length > 0 && (
        <div className="response__actions">
          {response.nextActions.map((a) => (
            <Button
              key={a.id}
              variant="secondary"
              onClick={() => {
                onAction?.(a);
              }}
            >
              {a.label}
            </Button>
          ))}
        </div>
      )}
      {!pending && onFeedback && (
        <div className="feedback" role="group" aria-label="¿Te sirvió esta respuesta?">
          <span className="muted">¿Te sirvió?</span>
          <IconButton
            icon="up"
            label="Me sirvió"
            pressed={feedback === "up"}
            onClick={() => {
              onFeedback("up");
            }}
          />
          <IconButton
            icon="down"
            label="No me sirvió"
            pressed={feedback === "down"}
            onClick={() => {
              onFeedback("down");
            }}
          />
        </div>
      )}
    </div>
  );
}

function BlockView({
  block,
  response,
  onSaveIdea,
  onLand,
}: {
  block: Block;
  response: HappyResponse;
  onSaveIdea?: ((title: string, text: string, r: HappyResponse) => void) | undefined;
  onLand?: ((title: string) => void) | undefined;
}) {
  const { navigate } = useApp();
  const repo = useRepo();
  switch (block.kind) {
    case "malla_ref": {
      const u = repo.maybeUnit(block.unitId);
      if (!u) return null; // el validador ya lo impide; defensa adicional
      const seg = block.segment ? u.segments?.find((s) => s.key === block.segment) : undefined;
      const text = seg ? u.text.slice(seg.valueStart, seg.valueEnd) : u.text;
      const segLabel = seg?.label;
      return (
        <section className="block block--malla" data-unit-id={u.unitId}>
          <p className="block__label">Desde nuestra malla…</p>
          <p className="block__where">
            {u.code && <span className="code">{u.code}</span>} {u.code ? repo.title(u.code) : ""} ·{" "}
            {shortHeader(u.headerLiteral)}
            {segLabel && ` · ${segLabel} (fragmento)`}
          </p>
          <p className="block__literal">
            <Literal text={text} />
          </p>
          <div className="block__foot">
            <Provenance unit={u} />
            {u.code && (
              <button
                type="button"
                className="link"
                onClick={() => {
                  if (u.code) navigate({ name: "ficha", code: u.code });
                }}
              >
                Ver en la ficha
              </button>
            )}
          </div>
          <p className="block__why">
            <span className="tag-generated">Generado</span> {block.why}
          </p>
        </section>
      );
    }
    case "paths":
      return (
        <section className="block block--generated">
          <p className="block__label">Como idea complementaria…</p>
          <ul className="paths">
            {block.paths.map((p) => (
              <li key={p.title} className="path">
                <h3 className="path__title">{p.title}</h3>
                <p>{p.summary}</p>
                <div className="path__actions">
                  {onLand && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        onLand(p.title);
                      }}
                    >
                      Aterrizar
                    </Button>
                  )}
                  {onSaveIdea && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        onSaveIdea(p.title, p.summary, response);
                      }}
                    >
                      Guardar idea
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      );
    case "steps":
      return (
        <section className="block block--generated">
          <p className="block__label">Como idea complementaria…</p>
          <h3 className="path__title">{block.title}</h3>
          <ol className="steps">
            {block.items.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {onSaveIdea && (
            <Button
              variant="ghost"
              onClick={() => {
                onSaveIdea(block.title, block.items.join("\n"), response);
              }}
            >
              Guardar idea
            </Button>
          )}
        </section>
      );
    case "idea":
      return (
        <section className="block block--generated">
          <p className="block__label">Como idea complementaria…</p>
          <p>{block.text}</p>
        </section>
      );
    case "question":
      return (
        <div className="bubble bubble--happy">
          <HappyAvatar size={24} state="neutral" />
          <p>{block.text}</p>
        </div>
      );
    case "notice":
      return (
        <div className={`notice notice--${block.code}`} role="note">
          <Icon name="info" size={18} />
          <p>{block.text}</p>
        </div>
      );
  }
}
