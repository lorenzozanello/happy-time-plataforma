"use client";
import { Suspense } from "react";
import { SearchScreen } from "../../src/ui/screens/Search";
import { WithRoute } from "./params";

export function SearchPage() {
  return (
    <Suspense fallback={<SearchScreen />}>
      <WithRoute>
        {(r) => <SearchScreen {...(r.name === "search" && r.q ? { q: r.q } : {})} />}
      </WithRoute>
    </Suspense>
  );
}
