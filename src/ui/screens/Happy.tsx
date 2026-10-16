import { useEffect, useMemo, useRef, useState } from "react";
import { shortHeader } from "../../domain/curriculum/repository";
import type { Unit } from "../../domain/curriculum/schema";
import { catalogExperience, catalogLevel } from "../../domain/curriculum/views";
import type { HistoryTurn } from "../../domain/happy/prompt";
import { checkPrivacy, PRIVACY_MESSAGE } from "../../domain/happy/privacy";
import type { Block, HappyContext, HappyResponse, Mode } from "../../domain/happy/schema";
import { summarizeResponse } from "../../domain/happy/shape";
import { newId, now, useApp } from "../app/state";
import {
  HappyError,
  type HappyPartial,
  type HappyStatus,
  type Thread,
  type ThreadMessage,
} from "../app/types";
import { Button, ErrorState, Icon, IconButton, Literal, Provenance, Skeleton } from "../components";
import { HappyAvatar, HappyLockup, type HappyState } from "../happy/HappyAvatar";
import { ROMAN } from "../presentation";
import { INTENTS } from "./Home";
import { HappyComingSoon } from "./HappySoon";

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
  const { happyEnabled, services } = useApp();
  if (!happyEnabled) return <HappyComingSoon />;
  if (services.happyAccess) return <HappyGate {...props} />;
  return <HappyChat {...props} />;
}

/** Hasta F4: comprueba si Happy está habilitada y pide el código de acceso del piloto una vez. */
function HappyGate(props: HappyProps) {
  const { services } = useApp();
  const access = services.happyAccess;
  const [status, setStatus] = useState<{
    attempt: number;
    value: HappyStatus | "loading" | "error";
  }>({
    attempt: 0,
    value: "loading",
  });
  const [attempt, setAttemptState] = useState(0);
  const setAttempt = (fn: (n: number) => number) => {
    setAttemptState(fn);
  };
  // Al cambiar el intento, el estado vuelve a «cargando» en el mismo render (sin setState en efecto).
  let current: HappyStatus | "loading" | "error" = status.value;
  if (status.attempt !== attempt) current = "loading";
  useEffect(() => {
    let alive = true;
    access
      ?.status()
      .then((s) => {
        if (alive) setStatus({ attempt, value: s });
      })
      .catch(() => {
        if (alive) setStatus({ attempt, value: "error" });
      });
    return () => {
      alive = false;
    };
  }, [access, attempt]);

  const view = current;
  if (view === "loading")
    return (
      <div className="screen happy" aria-busy="true">
        <header className="happy__head">
          <HappyLockup size={48} />
        </header>
        <Skeleton lines={4} />
      </div>
    );
  if (view === "error")
    return (
      <div className="screen happy">
        <header className="happy__head">
          <HappyLockup size={48} />
        </header>
        <ErrorState
          message="No pudimos comprobar si Happy está disponible. Revisa tu conexión."
          onRetry={() => {
            setAttempt((n) => n + 1);
          }}
        />
      </div>
    );
  if (!view.enabled) return <HappyComingSoon />;
  if (view.needsCode && !view.hasCode)
    return (
      <AccessCodeForm
        onSaved={() => {
          setAttempt((n) => n + 1);
        }}
      />
    );
  return (
    <HappyChat
      {...props}
      onAccessDenied={() => {
        setStatus({ attempt, value: { ...view, hasCode: false } });
      }}
    />
  );
}

export function AccessCodeForm({ onSaved, message }: { onSaved: () => void; message?: string }) {
  const { services } = useApp();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(message ?? null);
  return (
    <div className="screen happy">
      <header className="screen__head">
        <HappyLockup size={48} state="escucha" />
        <h1 className="display">Código de acceso</h1>
        <p className="lead">
          Durante el piloto, Happy se abre con el código que te compartió la coordinación. Se guarda
          en este teléfono; solo lo escribes una vez.
        </p>
      </header>
      <form
        className="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const v = code.trim();
          if (v.length < 4) {
            setError("Escribe el código completo.");
            return;
          }
          services.happyAccess?.setCode(v);
          onSaved();
        }}
      >
        <label htmlFor="happy-code">Código del piloto</label>
        <input
          id="happy-code"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="off"
          value={code}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "happy-code-error" : undefined}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
        />
        {error && (
          <p id="happy-code-error" className="form__error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary">
          Abrir Happy
        </Button>
      </form>
    </div>
  );
}

function historyOf(thread: Thread | undefined): HistoryTurn[] {
  if (!thread) return [];
  return thread.messages
    .flatMap((m): HistoryTurn[] => {
      if (m.role === "docente" && m.text) return [{ role: "docente", text: m.text }];
      if (m.role === "happy" && m.response)
        return [{ role: "happy", text: summarizeResponse(m.response) }];
      return [];
    })
    .slice(-6);
}

function HappyChat({
  threadId,
  mode: initialMode,
  context: initialContext,
  onAccessDenied,
}: HappyProps & { onAccessDenied?: () => void }) {
  const app = useApp();
  const { state, catalog, navigate, replace, dispatch, services, online } = app;
  const existing = threadId ? state.threads.find((t) => t.id === threadId) : undefined;
  const [thread, setThread] = useState<Thread | undefined>(existing);
  const [mode, setMode] = useState<Mode | undefined>(existing?.mode ?? initialMode);
  const [context, setContext] = useState<HappyContext>(existing?.context ?? initialContext ?? {});
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const [phase, setPhase] = useState<"idle" | "thinking" | "streaming" | "done">("idle");
  const [partial, setPartial] = useState<HappyPartial | null>(null);
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
    // Política de entrada (ADR-009/014): solo se guarda la versión redactada; si identifica a una
    // persona, no se envía a Happy y se pide reformular. El servidor repite la comprobación.
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
      const result = await services.happy.respond(
        { mode: m, message: raw, context, history: historyOf(from) },
        (p) => {
          setPhase("streaming");
          setPartial(p);
        },
      );
      current = {
        ...current,
        messages: [
          ...current.messages,
          {
            id: newId(),
            role: "happy",
            replyTo: userMsg.id,
            response: result.response,
            units: result.units,
            ...(result.metrics ? { metrics: result.metrics } : {}),
            createdAt: now(),
          },
        ],
        updatedAt: now(),
      };
      persist(current);
      setPartial(null);
      setPhase("done");
    } catch (e) {
      const err = e instanceof HappyError ? e : undefined;
      if (err?.code === "access") {
        // El código del piloto no sirve: se pide de nuevo; el mensaje queda guardado.
        setPartial(null);
        setPhase("idle");
        onAccessDenied?.();
        return;
      }
      current = {
        ...current,
        messages: [
          ...current.messages,
          {
            id: newId(),
            role: "happy",
            replyTo: userMsg.id,
            error:
              err?.code === "limit" || err?.code === "disabled"
                ? err.message
                : "Happy no pudo responder esta vez. Tu mensaje quedó guardado; vuelve a intentarlo.",
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
        release: catalog.release,
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

      {services.prototype && (
        <p className="proto-note" role="note">
          Prototipo: Happy está simulada. Responde con ejemplos fijos construidos con la malla real;
          no usa IA.
        </p>
      )}

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
                units={m.units ?? []}
                metrics={m.metrics}
                feedback={m.feedback}
                onFeedback={(v) => {
                  setFeedback(m.id, v);
                }}
                onSaveIdea={saveIdea}
                onAction={(a) => {
                  if (a.kind === "open_experience" && a.payload)
                    navigate({ name: "ficha", code: a.payload });
                  else if (a.kind === "send" && a.payload) void send(a.payload, "aterrizar");
                  else if (a.kind === "save_idea") {
                    const steps = m.response?.blocks.find((b) => b.kind === "steps");
                    if (steps && m.response)
                      saveIdea(steps.title, steps.items.join("\n"), m.response);
                    else setToast("Guarda un camino o unos pasos desde su botón «Guardar idea».");
                  }
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
          {partial && <ResponseView response={partial.response} units={partial.units} pending />}
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
  const { catalog } = useApp();
  const items: { key: keyof HappyContext; label: string }[] = [];
  const lvl = context.levelId ? catalogLevel(catalog, context.levelId) : undefined;
  if (lvl) items.push({ key: "levelId", label: lvl.labelLiteral });
  if (context.periodIndex)
    items.push({ key: "periodIndex", label: `Periodo ${ROMAN[context.periodIndex - 1] ?? ""}` });
  const exp = context.experienceCode
    ? catalogExperience(catalog, context.experienceCode)
    : undefined;
  if (exp) items.push({ key: "experienceCode", label: `${exp.code} · ${exp.title.text}` });
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

const fmtSeconds = (ms: number) =>
  `${(ms / 1000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} s`;
const fmtUsd = (usd: number) =>
  usd === 0
    ? "sin costo"
    : `US$${usd.toLocaleString("es-CO", { minimumFractionDigits: 3, maximumFractionDigits: 4 })}`;

export function ResponseView({
  response,
  units,
  metrics,
  pending = false,
  feedback,
  onFeedback,
  onSaveIdea,
  onAction,
  onLand,
}: {
  response: HappyResponse;
  /** Literales de las unidades citadas (en producción llegan con la respuesta). */
  units: Unit[];
  metrics?: ThreadMessage["metrics"] | undefined;
  pending?: boolean;
  feedback?: "up" | "down" | undefined;
  onFeedback?: (v: "up" | "down") => void;
  onSaveIdea?: (title: string, text: string, r: HappyResponse) => void;
  onAction?: (a: HappyResponse["nextActions"][number]) => void;
  onLand?: (title: string) => void;
}) {
  const { repo } = useApp();
  const byId = useMemo(() => new Map(units.map((u) => [u.unitId, u])), [units]);
  const resolve = (id: string): Unit | undefined => byId.get(id) ?? repo?.maybeUnit(id);
  return (
    <div className={`response${pending ? " response--pending" : ""}`}>
      {response.blocks.map((b, i) => (
        <BlockView
          key={i}
          block={b}
          unit={b.kind === "malla_ref" ? resolve(b.unitId) : undefined}
          response={response}
          onSaveIdea={onSaveIdea}
          onLand={onLand}
        />
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
          {metrics && metrics.provider !== "policy" && (
            <span className="metrics muted" data-testid="metrics">
              {metrics.firstBlockMs !== null ? `${fmtSeconds(metrics.firstBlockMs)} · ` : ""}
              {fmtUsd(metrics.costUsd)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function BlockView({
  block,
  unit,
  response,
  onSaveIdea,
  onLand,
}: {
  block: Block;
  unit: Unit | undefined;
  response: HappyResponse;
  onSaveIdea?: ((title: string, text: string, r: HappyResponse) => void) | undefined;
  onLand?: ((title: string) => void) | undefined;
}) {
  const { navigate, catalog } = useApp();
  switch (block.kind) {
    case "malla_ref": {
      const u = unit;
      if (!u) return null; // el validador y el servidor ya lo impiden; defensa adicional
      const seg = block.segment ? u.segments?.find((s) => s.key === block.segment) : undefined;
      const text = seg ? u.text.slice(seg.valueStart, seg.valueEnd) : u.text;
      const segLabel = seg?.label;
      const title = u.code ? catalogExperience(catalog, u.code)?.title.text : undefined;
      return (
        <section className="block block--malla" data-unit-id={u.unitId}>
          <p className="block__label">Desde nuestra malla…</p>
          <p className="block__where">
            {u.code && <span className="code">{u.code}</span>} {title ?? ""} ·{" "}
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
