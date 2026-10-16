/**
 * Tokens de diseño de Happy Time (fuente única). De aquí salen el CSS de la interfaz y la
 * prueba de contraste (F2-01). Paleta funcional del handoff §8: Morado Happy, Fucsia, Amarillo,
 * Cian e Ink; los neutros tienen un leve sesgo violeta hacia el morado de marca.
 *
 * Concepto de layout: columna de lectura cómoda (≤ 44rem) sobre un fondo “papel” frío; navegación
 * inferior en móvil y riel lateral en escritorio; los cuatro periodos del año se leen como los
 * cuatro cuartos de un reloj (el reloj histórico de Happy Time).
 */

export const PALETTE = {
  happy: "#8B18E8",
  fuchsia: "#FF1765",
  yellow: "#FFE600",
  cyan: "#08BFE8",
  ink: "#17233F",
  pivot: "#E3263B",
} as const;

export type ThemeName = "light" | "dark";

export const TOKENS = {
  light: {
    bg: "#F6F5FA",
    surface: "#FFFFFF",
    "surface-2": "#EFEDF6",
    line: "#DEDAEA",
    fg: "#17233F",
    "fg-2": "#4A5470",
    accent: "#8B18E8",
    "accent-fg": "#FFFFFF",
    "accent-soft": "#F1E7FD",
    "accent-ink": "#6A0FB5",
    alert: "#C8004A",
    "alert-soft": "#FFE8EF",
    highlight: "#FFE600",
    "highlight-fg": "#17233F",
    focus: "#0A7896",
    "p1-bg": "#08BFE8",
    "p1-fg": "#17233F",
    "p2-bg": "#FFE600",
    "p2-fg": "#17233F",
    "p3-bg": "#FF1765",
    "p3-fg": "#FFFFFF",
    "p4-bg": "#8B18E8",
    "p4-fg": "#FFFFFF",
    "dial-idle": "#E6E2F1",
    "dial-idle-fg": "#17233F",
    hand: "#17233F",
    face: "#FFFFFF",
    "face-line": "#17233F",
    ok: "#0A7A4B",
  },
  dark: {
    bg: "#11162A",
    surface: "#1A2139",
    "surface-2": "#232B47",
    line: "#333D60",
    fg: "#EEECF7",
    "fg-2": "#B6B2CC",
    accent: "#B98AFF",
    "accent-fg": "#17233F",
    "accent-soft": "#2C2350",
    "accent-ink": "#D4B8FF",
    alert: "#FF7FA6",
    "alert-soft": "#3A1D2E",
    highlight: "#FFE600",
    "highlight-fg": "#17233F",
    focus: "#4FD6F5",
    "p1-bg": "#08BFE8",
    "p1-fg": "#17233F",
    "p2-bg": "#FFE600",
    "p2-fg": "#17233F",
    "p3-bg": "#FF1765",
    "p3-fg": "#FFFFFF",
    "p4-bg": "#9B3DF0",
    "p4-fg": "#FFFFFF",
    "dial-idle": "#2A3352",
    "dial-idle-fg": "#EEECF7",
    hand: "#17233F",
    face: "#FFFFFF",
    "face-line": "#17233F",
    ok: "#5FD39B",
  },
} as const satisfies Record<ThemeName, Record<string, string>>;

export type TokenName = keyof (typeof TOKENS)["light"];

/** Pares texto/fondo que la interfaz usa. min = contraste mínimo exigido (WCAG 2.2 AA). */
export const CONTRAST_PAIRS: { fg: TokenName; bg: TokenName; min: number; use: string }[] = [
  { fg: "fg", bg: "bg", min: 4.5, use: "texto base sobre fondo" },
  { fg: "fg", bg: "surface", min: 4.5, use: "texto base sobre tarjeta" },
  { fg: "fg", bg: "surface-2", min: 4.5, use: "texto base sobre superficie secundaria" },
  { fg: "fg-2", bg: "bg", min: 4.5, use: "texto secundario sobre fondo" },
  { fg: "fg-2", bg: "surface", min: 4.5, use: "texto secundario sobre tarjeta" },
  { fg: "fg-2", bg: "surface-2", min: 4.5, use: "texto secundario sobre superficie secundaria" },
  { fg: "accent", bg: "surface", min: 4.5, use: "enlaces y nombre Happy sobre tarjeta" },
  { fg: "accent", bg: "bg", min: 4.5, use: "enlaces sobre fondo" },
  { fg: "accent-fg", bg: "accent", min: 4.5, use: "botón primario" },
  { fg: "accent-ink", bg: "accent-soft", min: 4.5, use: "chips de contexto" },
  { fg: "fg", bg: "accent-soft", min: 4.5, use: "texto en burbuja de la docente" },
  { fg: "alert", bg: "surface", min: 4.5, use: "texto de alerta" },
  { fg: "alert", bg: "alert-soft", min: 4.5, use: "aviso de privacidad" },
  { fg: "highlight-fg", bg: "highlight", min: 4.5, use: "coincidencias de búsqueda" },
  { fg: "p1-fg", bg: "p1-bg", min: 4.5, use: "periodo I" },
  { fg: "p2-fg", bg: "p2-bg", min: 4.5, use: "periodo II" },
  { fg: "p3-fg", bg: "p3-bg", min: 3, use: "periodo III (solo numeral grande ≥24 px)" },
  { fg: "p4-fg", bg: "p4-bg", min: 4.5, use: "periodo IV" },
  { fg: "dial-idle-fg", bg: "dial-idle", min: 4.5, use: "cuartos del reloj no seleccionados" },
  { fg: "focus", bg: "bg", min: 3, use: "anillo de foco (elemento gráfico)" },
  { fg: "line", bg: "bg", min: 1, use: "líneas divisorias (decorativas)" },
  { fg: "ok", bg: "surface", min: 4.5, use: "confirmaciones" },
];

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = ch;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const vars = (t: ThemeName) =>
  Object.entries(TOKENS[t])
    .map(([k, v]) => `--${k}: ${v};`)
    .join(" ");

/** CSS de tokens: claro en :root, oscuro por preferencia del sistema o por data-theme. */
export function themeCss(): string {
  return [
    `:root { ${vars("light")} --happy: ${PALETTE.happy}; --cyan: ${PALETTE.cyan}; --pivot: ${PALETTE.pivot}; color-scheme: light; }`,
    `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${vars("dark")} color-scheme: dark; } }`,
    `:root[data-theme="dark"] { ${vars("dark")} color-scheme: dark; }`,
  ].join("\n");
}

export const FONTS = {
  display: `"Fredoka", "Baloo 2", ui-rounded, system-ui, sans-serif`,
  body: `"Atkinson Hyperlegible Next", "Atkinson Hyperlegible", system-ui, -apple-system, "Segoe UI", sans-serif`,
  googleHref:
    "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:ital,wght@0,400;0,700;1,400&family=Fredoka:wght@500;600&display=swap",
};
