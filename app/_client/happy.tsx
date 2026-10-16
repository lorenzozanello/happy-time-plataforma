"use client";
import { Suspense } from "react";
import { HappyScreen } from "../../src/ui/screens/Happy";
import { WithRoute } from "./params";

/** /happy?hilo=&modo=&experiencia= — si el servidor no tiene Happy encendida, «llega pronto». */
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
