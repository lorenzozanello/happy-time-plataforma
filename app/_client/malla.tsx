"use client";
import { Suspense } from "react";
import { MallaScreen } from "../../src/ui/screens/Malla";
import { WithRoute } from "./params";

/** /malla?nivel=&periodo= — el HTML estático trae el esqueleto; la experiencia, al conocer la URL. */
export function MallaPage() {
  return (
    <Suspense fallback={<MallaScreen />}>
      <WithRoute>
        {(r) => (
          <MallaScreen
            {...(r.name === "malla" && r.levelId ? { levelId: r.levelId } : {})}
            {...(r.name === "malla" && r.periodIndex ? { periodIndex: r.periodIndex } : {})}
          />
        )}
      </WithRoute>
    </Suspense>
  );
}
