"use client";
import type { FichaData } from "../../src/domain/curriculum/views";
import { FichaScreen } from "../../src/ui/screens/Ficha";

export function FichaPage({ data }: { data: FichaData }) {
  return <FichaScreen data={data} />;
}
