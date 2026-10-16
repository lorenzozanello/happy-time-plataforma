"use client";
/**
 * Último recurso si falla el propio armazón: HTML mínimo en español, sin depender de la app.
 * Usa estilos en línea porque en este punto la hoja de estilos puede no estar disponible.
 */
import { TOKENS } from "../src/ui/theme";

const T = TOKENS.light;

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="es-CO">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: T.bg,
          color: T.fg,
          padding: "48px 16px",
        }}
      >
        <main style={{ maxWidth: 520, margin: "0 auto" }}>
          <h1 style={{ fontSize: 28 }}>Algo no salió bien</h1>
          <p style={{ fontSize: 17, lineHeight: 1.55 }}>
            La aplicación tuvo un error inesperado. Intenta de nuevo; si continúa, recarga la
            página.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: 44,
              padding: "10px 18px",
              fontSize: 17,
              fontWeight: 700,
              borderRadius: 14,
              border: `1.5px solid ${T.fg}`,
              background: T.surface,
              color: T.fg,
              cursor: "pointer",
            }}
          >
            Intentar de nuevo
          </button>
        </main>
      </body>
    </html>
  );
}
