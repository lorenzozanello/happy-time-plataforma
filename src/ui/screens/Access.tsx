import { useState } from "react";
import type { LevelId } from "../../domain/curriculum/fields";
import { useApp } from "../app/state";
import { Button } from "../components";
import { HappyAvatar } from "../happy/HappyAvatar";
import { ROMAN } from "../presentation";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignInScreen() {
  const { services, dispatch } = useApp();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <main className="signin">
      <div className="signin__card">
        <HappyAvatar size={64} state={step === "code" ? "escucha" : "neutral"} />
        <h1 className="display">Happy Time</h1>
        <p className="lead">Malla curricular y Happy, tu asistente curricular.</p>

        {step === "email" ? (
          <form
            className="form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (!EMAIL.test(email.trim())) {
                setError("Escribe un correo válido, por ejemplo nombre@colegio.edu.co.");
                return;
              }
              setBusy(true);
              setError(null);
              void services.auth
                .requestCode(email.trim())
                .then(() => {
                  setStep("code");
                })
                .catch(() => {
                  setError("No pudimos enviar el código. Revisa tu conexión e inténtalo de nuevo.");
                })
                .finally(() => {
                  setBusy(false);
                });
            }}
          >
            <label htmlFor="email">Tu correo institucional</label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "signin-error" : undefined}
              onChange={(e) => {
                setEmail(e.target.value);
              }}
            />
            {error && (
              <p id="signin-error" className="form__error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "Enviando…" : "Enviarme un código"}
            </Button>
            <p className="muted small">
              Solo pueden entrar las docentes invitadas por la institución.
            </p>
          </form>
        ) : (
          <form
            className="form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (!/^\d{6}$/.test(code)) {
                setError("El código tiene 6 números.");
                return;
              }
              setBusy(true);
              setError(null);
              void services.auth
                .verifyCode(email.trim(), code)
                .then((session) => {
                  dispatch({ type: "signIn", session });
                })
                .catch(() => {
                  setError("El código no es válido o ya venció. Pide uno nuevo.");
                })
                .finally(() => {
                  setBusy(false);
                });
            }}
          >
            <label htmlFor="code">Código que enviamos a {email}</label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "signin-error" : "code-hint"}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ""));
              }}
            />
            <p id="code-hint" className="muted small">
              Prototipo: escribe cualquier código de 6 números. «000000» simula un código vencido.
            </p>
            {error && (
              <p id="signin-error" className="form__error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "Verificando…" : "Entrar"}
            </Button>
            <button
              type="button"
              className="link"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
            >
              Usar otro correo
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

/** Elegir niveles y periodo actual. Se usa al primer ingreso (omitible) y desde el perfil. */
export function LevelsSetup({
  onDone,
  firstTime = false,
}: {
  onDone: () => void;
  firstTime?: boolean;
}) {
  const { catalog, state, dispatch } = useApp();
  const [levels, setLevels] = useState<LevelId[]>(state.work.levelIds);
  const [period, setPeriod] = useState<number>(state.work.periodIndex ?? 1);
  const toggle = (id: LevelId) => {
    setLevels((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  };
  const save = () => {
    dispatch({ type: "work", patch: { levelIds: levels, periodIndex: period, onboarded: true } });
    onDone();
  };
  return (
    <section className="setup" aria-labelledby="setup-title">
      <h2 id="setup-title" className={firstTime ? "display" : "section-title"}>
        {firstTime ? "¿Con qué niveles trabajas?" : "Mis niveles y periodo"}
      </h2>
      <fieldset className="setup__levels">
        <legend className="muted">Puedes elegir varios.</legend>
        {catalog.levels.map((l) => (
          <label key={l.id} className={`check-card${levels.includes(l.id) ? " is-on" : ""}`}>
            <input
              type="checkbox"
              checked={levels.includes(l.id)}
              onChange={() => {
                toggle(l.id);
              }}
            />
            <span className="check-card__name">{l.labelLiteral}</span>
            <span className="check-card__eq">{l.equivalencia.text}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="setup__period">
        <legend>Periodo en curso</legend>
        <div className="chip-row">
          {[1, 2, 3, 4].map((p) => (
            <label
              key={p}
              className={`chip period-pick period-pick--p${p}${period === p ? " is-on" : ""}`}
            >
              <input
                type="radio"
                name="period"
                checked={period === p}
                onChange={() => {
                  setPeriod(p);
                }}
              />
              Periodo {ROMAN[p - 1]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="setup__actions">
        <Button variant="primary" onClick={save}>
          Guardar
        </Button>
        {firstTime && (
          <Button
            variant="ghost"
            onClick={() => {
              dispatch({ type: "work", patch: { onboarded: true } });
              onDone();
            }}
          >
            Omitir por ahora
          </Button>
        )}
      </div>
    </section>
  );
}

export function OnboardingScreen() {
  return (
    <main className="signin">
      <div className="signin__card signin__card--wide">
        <LevelsSetup firstTime onDone={() => undefined} />
      </div>
    </main>
  );
}
