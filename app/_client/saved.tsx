"use client";
import { Suspense } from "react";
import { SavedScreen } from "../../src/ui/screens/Saved";
import { WithRoute } from "./params";

export function SavedPage() {
  return (
    <Suspense fallback={<SavedScreen />}>
      <WithRoute>
        {(r) => <SavedScreen {...(r.name === "saved" && r.tab ? { tab: r.tab } : {})} />}
      </WithRoute>
    </Suspense>
  );
}
