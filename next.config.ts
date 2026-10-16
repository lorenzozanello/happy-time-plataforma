import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Política de contenido (F3-08). Todo se sirve desde el propio origen: sin CDN de terceros,
 * sin tipografías externas, sin analítica. 'unsafe-inline' en scripts es necesario para el
 * arranque de Next en páginas estáticas (los nonces obligarían a renderizar cada petición);
 * el riesgo se acota porque la app no inserta HTML de terceros ni de usuarios (ADR-015).
 */
export const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Vista previa sin autenticación: no indexar (se revisa en F4).
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // `next dev` no debe reescribir CLAUDE.md ni crear AGENTS.md (las reglas del repo son nuestras).
  agentRules: false,
  headers() {
    return Promise.resolve([{ source: "/:path*", headers: SECURITY_HEADERS }]);
  },
};

export default config;
