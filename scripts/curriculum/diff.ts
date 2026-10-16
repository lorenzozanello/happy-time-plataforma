/** Reporte de diferencias por unidad entre dos releases compiladas (ADR-003, criterio F1-11). */
import type { CurriculumRelease, Unit } from "../../src/domain/curriculum/schema";

export interface ReleaseDiff {
  from: string;
  to: string;
  added: Unit[];
  removed: Unit[];
  changed: { before: Unit; after: Unit }[];
  unchanged: number;
}

export function diffReleases(a: CurriculumRelease, b: CurriculumRelease): ReleaseDiff {
  const before = new Map(a.units.map((u) => [u.unitId, u]));
  const after = new Map(b.units.map((u) => [u.unitId, u]));
  const added = b.units.filter((u) => !before.has(u.unitId));
  const removed = a.units.filter((u) => !after.has(u.unitId));
  const changed: ReleaseDiff["changed"] = [];
  let unchanged = 0;
  for (const u of b.units) {
    const prev = before.get(u.unitId);
    if (!prev) continue;
    if (prev.text !== u.text || prev.headerLiteral !== u.headerLiteral)
      changed.push({ before: prev, after: u });
    else unchanged++;
  }
  return { from: a.release, to: b.release, added, removed, changed, unchanged };
}

const quote = (s: string) =>
  s
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");

export function diffToMarkdown(d: ReleaseDiff): string {
  const out: string[] = [
    `# Diferencias curriculares ${d.from} → ${d.to}`,
    "",
    `| Agregadas | Eliminadas | Modificadas | Sin cambios |`,
    `|---|---|---|---|`,
    `| ${d.added.length} | ${d.removed.length} | ${d.changed.length} | ${d.unchanged} |`,
    "",
  ];
  for (const { before, after } of d.changed) {
    out.push(
      `## Modificada · \`${after.unitId}\` (${after.source.sheet}!${after.source.cell})`,
      "",
    );
    out.push("**Antes**", "", quote(before.text), "", "**Después**", "", quote(after.text), "");
  }
  for (const u of d.added) {
    out.push(
      `## Agregada · \`${u.unitId}\` (${u.source.sheet}!${u.source.cell})`,
      "",
      quote(u.text),
      "",
    );
  }
  for (const u of d.removed) {
    out.push(
      `## Eliminada · \`${u.unitId}\` (${u.source.sheet}!${u.source.cell})`,
      "",
      quote(u.text),
      "",
    );
  }
  return `${out.join("\n").trimEnd()}\n`;
}
