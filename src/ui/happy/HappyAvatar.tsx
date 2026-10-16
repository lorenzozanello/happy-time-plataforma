/**
 * Happy Master — re-ilustración PROVISIONAL desde la especificación del handoff §8 (OD-6).
 * Reloj circular sin cuerpo; manecillas negras; pivote rojo visible; punta cian arriba y morada
 * abajo; expresión amable y contenida. Este es el único archivo a reemplazar cuando llegue el SVG
 * fuente institucional: el resto de la interfaz solo usa <HappyAvatar size state />.
 */
import { PALETTE } from "../theme";

export type HappyState = "neutral" | "escucha" | "piensa" | "idea" | "resultado";
export const HAPPY_STATES: HappyState[] = ["neutral", "escucha", "piensa", "idea", "resultado"];
export const HAPPY_SIZES = [24, 32, 48, 64, 96] as const;
export type HappySize = (typeof HAPPY_SIZES)[number];

export const STATE_LABEL: Record<HappyState, string> = {
  neutral: "Neutral",
  escucha: "Escucha",
  piensa: "Piensa",
  idea: "Idea",
  resultado: "Resultado",
};

const HAND = "#141414";
const FACE = "#FFFFFF";

interface Props {
  size?: HappySize;
  state?: HappyState;
  /** Si se da, el avatar se anuncia como imagen; si no, es decorativo. */
  label?: string;
}

export function HappyAvatar({ size = 48, state = "neutral", label }: Props) {
  const detail = size >= 32;
  const stroke = size <= 24 ? 7 : size <= 32 ? 6 : 5;
  const a11y = label
    ? { role: "img" as const, "aria-label": label }
    : { "aria-hidden": true as const, focusable: "false" as const };
  return (
    <svg
      className={`happy-avatar happy-avatar--${state}`}
      width={size}
      height={size}
      viewBox="0 0 96 96"
      data-state={state}
      {...a11y}
    >
      {state === "idea" && (
        <g
          className="happy-avatar__spark"
          stroke={PALETTE.yellow}
          strokeWidth="5"
          strokeLinecap="round"
        >
          <line x1="80" y1="14" x2="87" y2="7" />
          <line x1="86" y1="26" x2="94" y2="24" />
          <line x1="70" y1="7" x2="72" y2="1" />
        </g>
      )}
      {(state === "escucha" || state === "resultado") && (
        <circle
          className="happy-avatar__ring"
          cx="48"
          cy="48"
          r="46"
          fill="none"
          stroke={state === "resultado" ? PALETTE.happy : PALETTE.cyan}
          strokeWidth="3"
        />
      )}
      <circle cx="48" cy="48" r="40" fill={FACE} stroke={PALETTE.ink} strokeWidth={stroke} />
      {detail && (
        <g stroke={PALETTE.ink} strokeWidth="3" strokeLinecap="round" opacity="0.45">
          <line x1="48" y1="13" x2="48" y2="17" />
          <line x1="83" y1="48" x2="79" y2="48" />
          <line x1="48" y1="83" x2="48" y2="79" />
          <line x1="13" y1="48" x2="17" y2="48" />
        </g>
      )}
      {detail && <Eyes state={state} />}
      <g className="happy-avatar__hands">
        <g className="happy-avatar__hand-up">
          <line
            x1="48"
            y1="48"
            x2="48"
            y2="30"
            stroke={HAND}
            strokeWidth="6"
            strokeLinecap="round"
          />
          <line
            x1="48"
            y1="30"
            x2="48"
            y2="22"
            stroke={PALETTE.cyan}
            strokeWidth="6"
            strokeLinecap="round"
          />
        </g>
        <g className="happy-avatar__hand-down">
          <line
            x1="48"
            y1="48"
            x2="48"
            y2="66"
            stroke={HAND}
            strokeWidth="5"
            strokeLinecap="round"
          />
          <line
            x1="48"
            y1="66"
            x2="48"
            y2="74"
            stroke={PALETTE.happy}
            strokeWidth="5"
            strokeLinecap="round"
          />
        </g>
      </g>
      <circle cx="48" cy="48" r={size <= 24 ? 7 : 6} fill={PALETTE.pivot} />
    </svg>
  );
}

/** Ojos: arcos tranquilos en reposo y resultado; abiertos al escuchar, pensar o tener una idea. */
function Eyes({ state }: { state: HappyState }) {
  const calm = state === "neutral" || state === "resultado";
  if (calm) {
    return (
      <g fill="none" stroke={PALETTE.ink} strokeWidth="3.5" strokeLinecap="round">
        <path d="M27 42 q5 -5 10 0" />
        <path d="M59 42 q5 -5 10 0" />
      </g>
    );
  }
  const dy = state === "piensa" ? -3 : 0;
  const r = state === "idea" ? 4.2 : 3.4;
  return (
    <g fill={PALETTE.ink}>
      <circle cx="32" cy={41 + dy} r={r} />
      <circle cx="64" cy={41 + dy} r={r} />
    </g>
  );
}

/** Lockup: avatar + “Happy” (morado sólido) + descriptor. Nunca “IA” ni “Bot”. */
export function HappyLockup({
  state = "neutral",
  size = 32,
  compact = false,
}: {
  state?: HappyState;
  size?: HappySize;
  compact?: boolean;
}) {
  return (
    <span className="happy-lockup">
      <HappyAvatar size={size} state={state} />
      <span className="happy-lockup__text">
        <span className="happy-lockup__name">Happy</span>
        {!compact && <span className="happy-lockup__desc">Asistente curricular de Happy Time</span>}
      </span>
    </span>
  );
}
