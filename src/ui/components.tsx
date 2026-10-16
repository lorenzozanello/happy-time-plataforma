import { useId, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { Unit } from "../domain/curriculum/schema";

/* ── Iconos (trazos simples, heredan currentColor) ─────────────────────────── */
const PATHS = {
  home: "M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1z",
  malla: "M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z",
  saved: "M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z",
  search: "M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM15.5 15.5 20 20",
  back: "M15 5l-7 7 7 7",
  chevron: "M9 5l7 7-7 7",
  star: "M12 4.5l2.3 4.7 5.2.8-3.8 3.7.9 5.2L12 16.4l-4.6 2.5.9-5.2L4.5 10l5.2-.8z",
  copy: "M8 8h11v12H8zM5 16V4h11",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.5",
  up: "M7 11l5-5 5 5M12 6v13",
  down: "M7 13l5 5 5-5M12 18V5",
  send: "M4 12l16-8-6 16-3-6.5z",
  close: "M6 6l12 12M18 6 6 18",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12h2M3 12h2M12 3v2M12 19v2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4",
  offline:
    "M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4-2.4M12 20h.01M19 13a10 10 0 0 0-2.3-1.7M2 9.5a15 15 0 0 1 5-3M22 9.5a15 15 0 0 0-10-4",
  check: "M5 12.5l4.5 4.5L19 7.5",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z",
} as const;
export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const filled = name === "malla";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill={filled ? "currentColor" : "none"}
      fillOpacity={filled ? 0.18 : 1}
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/* ── Botones ──────────────────────────────────────────────────────────────── */
type Variant = "primary" | "secondary" | "ghost";
export function Button({
  variant = "secondary",
  icon,
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: IconName }) {
  return (
    <button type="button" className={`btn btn--${variant} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={20} />}
      {children && <span>{children}</span>}
    </button>
  );
}

export function IconButton({
  icon,
  label,
  pressed,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; pressed?: boolean }) {
  return (
    <button
      type="button"
      className={`icon-btn${pressed ? " is-on" : ""}`}
      aria-label={label}
      title={label}
      {...(pressed !== undefined ? { "aria-pressed": pressed } : {})}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}

/* ── Chips ────────────────────────────────────────────────────────────────── */
export function PeriodChip({ index, label }: { index: number; label: string }) {
  return <span className={`period-chip period-chip--p${index}`}>{label}</span>;
}

/* ── Procedencia (F2-04) ──────────────────────────────────────────────────── */
export function Provenance({ unit }: { unit: Unit }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const where = unit.source.range ?? unit.source.cell;
  return (
    <span className="prov">
      <button
        type="button"
        className="prov__toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen((v) => !v);
        }}
      >
        <Icon name="info" size={16} />
        <span>Fuente</span>
      </button>
      {open && (
        <span id={id} className="prov__detail">
          {unit.source.sheet} · celda {where} · release {unit.release}
        </span>
      )}
    </span>
  );
}

/** Texto curricular literal. Conserva saltos de línea del original. */
export function Literal({ text, className = "" }: { text: string; className?: string }) {
  return <span className={`literal ${className}`}>{text}</span>;
}

/** Unidad completa: encabezado literal, texto literal y procedencia. */
export function UnitBlock({
  unit,
  heading,
  level = 3,
  children,
}: {
  unit: Unit;
  heading?: string;
  level?: 2 | 3 | 4;
  children?: ReactNode;
}) {
  const H = `h${level}` as const;
  return (
    <section className="unit" data-unit-id={unit.unitId}>
      <div className="unit__head">
        <H className="unit__title">{heading ?? unit.headerLiteral}</H>
        <Provenance unit={unit} />
      </div>
      {children ?? (
        <p className="unit__text">
          <Literal text={unit.text} />
        </p>
      )}
    </section>
  );
}

/* ── Estados ──────────────────────────────────────────────────────────────── */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty" role="status">
      <p className="empty__title">{title}</p>
      <p className="empty__body">{body}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <p>{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="skeleton__line" style={{ width: `${92 - i * 14}%` }} />
      ))}
    </div>
  );
}

export function OfflineBanner() {
  return (
    <div className="offline" role="status">
      <Icon name="offline" size={18} />
      <span>
        Sin conexión. La malla sigue disponible; Happy y los guardados esperan a que vuelvas.
      </span>
    </div>
  );
}

/** Texto con coincidencias resaltadas (rangos sobre el literal, sin alterarlo). */
export function Highlighted({ text, ranges }: { text: string; ranges: [number, number][] }) {
  const parts: ReactNode[] = [];
  let at = 0;
  ranges.forEach(([a, b], i) => {
    if (a > at) parts.push(text.slice(at, a));
    parts.push(<mark key={i}>{text.slice(a, b)}</mark>);
    at = b;
  });
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}

export function Toast({ message }: { message: string | null }) {
  return (
    <div className="toast" role="status" aria-live="polite">
      {message && <span>{message}</span>}
    </div>
  );
}
