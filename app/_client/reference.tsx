"use client";
import type { LevelData, PrinciplesData, ProgressionData } from "../../src/domain/curriculum/views";
import { LevelScreen, PrinciplesScreen, ProgressionScreen } from "../../src/ui/screens/Reference";

export function LevelPage({ data }: { data: LevelData }) {
  return <LevelScreen data={data} />;
}

export function ProgressionPage({ data }: { data: ProgressionData }) {
  return <ProgressionScreen data={data} />;
}

export function PrinciplesPage({ data }: { data: PrinciplesData }) {
  return <PrinciplesScreen data={data} />;
}
