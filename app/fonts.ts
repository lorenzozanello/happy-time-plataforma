/**
 * Tipografías alojadas en la app (F3-08): Fredoka y Atkinson Hyperlegible Next desde Fontsource,
 * servidas por next/font (precarga, sin peticiones a terceros, fallback ajustado para no mover
 * el texto al cargar). Exponen --face-display y --face-body, que usan los tokens de styles.css.
 */
import localFont from "next/font/local";

export const display = localFont({
  src: "../node_modules/@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2",
  weight: "300 700",
  style: "normal",
  display: "swap",
  variable: "--face-display",
  fallback: ["ui-rounded", "system-ui", "sans-serif"],
});

export const body = localFont({
  src: [
    {
      path: "../node_modules/@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2",
      weight: "200 800",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-italic.woff2",
      weight: "200 800",
      style: "italic",
    },
  ],
  display: "swap",
  variable: "--face-body",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});
