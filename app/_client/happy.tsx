"use client";
import { Suspense } from "react";
import { HappyScreen } from "../../src/ui/screens/Happy";
import { WithRoute } from "./params";

/** F5: Happy real. Los parámetros (hilo, modo, experiencia) se leen dentro de <Suspense>. */
export function HappyPage() {
  return (
    <Suspense fallback={<HappyScreen />}>
      <WithRoute>
        {(r) =>
          r.name === "happy" ? (
            <HappyScreen
              {...(r.threadId ? { threadId: r.threadId } : {})}
              {...(r.mode ? { mode: r.mode } : {})}
              {...(r.context ? { context: r.context } : {})}
            />
          ) : (
            <HappyScreen />
          )
        }
      </WithRoute>
    </Suspense>
  );
}
