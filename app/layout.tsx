import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { TOKENS, themeCss } from "../src/ui/theme";
import "../src/ui/styles.css";
import { Providers } from "./_client/Providers";
import { getCatalog, searchFileName } from "./_server/curriculum";
import { body, display } from "./fonts";

export const metadata: Metadata = {
  title: { default: "Happy Time · Malla curricular", template: "%s · Happy Time" },
  description: "Malla curricular Happy Time: experiencias, niveles, progresión y principios.",
  applicationName: "Happy Time",
  // Vista previa sin autenticación (F3): no se indexa hasta F4 (también por cabecera).
  robots: { index: false, follow: false },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: TOKENS.light.bg },
    { media: "(prefers-color-scheme: dark)", color: TOKENS.dark.bg },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-CO" className={`${display.variable} ${body.variable}`}>
      <head>
        <style>{themeCss()}</style>
      </head>
      <body>
        <div id="root">
          <Providers catalog={getCatalog()} searchUrl={`/datos/${searchFileName()}`}>
            {children}
          </Providers>
        </div>
      </body>
    </html>
  );
}
