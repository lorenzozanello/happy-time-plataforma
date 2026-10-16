import { useState } from "react";
import { useApp } from "../app/state";
import { Button, Icon, RouteLink } from "../components";
import {
  HAPPY_SIZES,
  HAPPY_STATES,
  HappyAvatar,
  HappyLockup,
  STATE_LABEL,
} from "../happy/HappyAvatar";
import { PALETTE } from "../theme";
import { LevelsSetup } from "./Access";

export function ProfileScreen() {
  const { state, dispatch, services, catalog } = useApp();
  const [saved, setSaved] = useState(false);
  const [failOn, setFailOn] = useState(() => services.prototype?.getFailHappy() ?? false);
  const releaseLine = (
    <p className="muted small">
      Release curricular {catalog.release} · {catalog.unitCount} unidades · huella{" "}
      {catalog.sourceSha256.slice(0, 12)}…
    </p>
  );
  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="display">Tu perfil</h1>
        {state.session && <p className="lead">{state.session.email}</p>}
      </header>

      <LevelsSetup
        onDone={() => {
          setSaved(true);
        }}
      />
      {saved && (
        <p className="ok" role="status">
          <Icon name="check" size={18} /> Guardado
        </p>
      )}

      <nav className="link-list" aria-label="Más">
        <RouteLink to={{ name: "identity" }}>
          <span>Identidad de Happy (provisional)</span>
          <Icon name="chevron" size={18} />
        </RouteLink>
      </nav>

      {services.prototype ? (
        <section className="proto-tools" aria-labelledby="proto-tools">
          <h2 id="proto-tools" className="section-title">
            Herramientas del prototipo
          </h2>
          <p className="muted">Para revisar estados que en uso normal casi no se ven.</p>
          <div className="stack">
            <label className="switch">
              <input
                type="checkbox"
                checked={failOn}
                onChange={(e) => {
                  setFailOn(e.target.checked);
                  services.prototype?.setFailHappy(e.target.checked);
                }}
              />
              <span>La próxima respuesta de Happy falla</span>
            </label>
            {releaseLine}
            <Button
              variant="secondary"
              onClick={() => {
                dispatch({ type: "reset" });
              }}
            >
              Borrar mis datos del prototipo
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                dispatch({ type: "signOut" });
              }}
            >
              Cerrar sesión
            </Button>
          </div>
        </section>
      ) : (
        <section aria-labelledby="tus-datos">
          <h2 id="tus-datos" className="section-title">
            Tus datos
          </h2>
          <div className="stack">
            <p className="muted">
              Tus niveles, tu periodo y tus favoritos se guardan solo en este navegador. No se
              envían a ningún servidor.
            </p>
            {releaseLine}
            <Button
              variant="secondary"
              onClick={() => {
                dispatch({ type: "reset" });
              }}
            >
              Borrar mis datos de este navegador
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

/** Hoja de identidad de Happy (F2-02). Re-ilustración provisional hasta recibir el SVG fuente. */
export function IdentityScreen() {
  return (
    <div className="screen identity">
      <header className="screen__head">
        <h1 className="display">Identidad de Happy</h1>
        <p className="lead">
          Re-ilustración provisional a partir de la especificación del handoff. Se reemplaza por el
          SVG institucional del reloj cuando la institución lo entregue.
        </p>
      </header>

      <section aria-labelledby="lockup">
        <h2 id="lockup" className="section-title">
          Lockup
        </h2>
        <div className="identity__lockups">
          <HappyLockup size={64} />
          <HappyLockup size={32} compact />
        </div>
      </section>

      <section aria-labelledby="estados">
        <h2 id="estados" className="section-title">
          Estados y tamaños
        </h2>
        <div
          className="identity__grid-wrap"
          role="region"
          aria-label="Estados y tamaños de Happy"
          tabIndex={0}
        >
          <table className="identity__grid">
            <thead>
              <tr>
                <th scope="col">Estado</th>
                {HAPPY_SIZES.map((s) => (
                  <th key={s} scope="col">
                    {s} px
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HAPPY_STATES.map((st) => (
                <tr key={st}>
                  <th scope="row">{STATE_LABEL[st]}</th>
                  {HAPPY_SIZES.map((s) => (
                    <td key={s}>
                      <HappyAvatar size={s} state={st} label={`Happy ${STATE_LABEL[st]} ${s} px`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="identity__rules">
          <li>
            Neutral: reposo. Escucha: la docente escribe. Piensa: mensaje enviado, esperando la
            primera parte.
          </li>
          <li>Idea: llegan los primeros bloques. Resultado: respuesta completa y validada.</li>
          <li>
            Reloj circular, sin cuerpo ni brazos; manecillas negras; pivote rojo; punta cian arriba
            y morada abajo.
          </li>
        </ul>
      </section>

      <section aria-labelledby="paleta">
        <h2 id="paleta" className="section-title">
          Paleta funcional
        </h2>
        <ul className="swatches">
          {(
            [
              ["Morado Happy", PALETTE.happy],
              ["Fucsia", PALETTE.fuchsia],
              ["Amarillo", PALETTE.yellow],
              ["Cian", PALETTE.cyan],
              ["Ink", PALETTE.ink],
            ] as const
          ).map(([name, hex]) => (
            <li key={name} className="swatch">
              <span className="swatch__chip" style={{ background: hex }} />
              <span>{name}</span>
              <code>{hex}</code>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
