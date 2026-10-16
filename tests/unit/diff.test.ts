import { describe, expect, it } from "vitest";
import { diffReleases, diffToMarkdown } from "../../scripts/curriculum/diff";
import type { CurriculumRelease } from "../../src/domain/curriculum/schema";
import { release } from "../helpers";

describe("F1-11 · diferencias entre releases", () => {
  it("una release idéntica no tiene diferencias", () => {
    const d = diffReleases(release(), release());
    expect([d.added.length, d.removed.length, d.changed.length, d.unchanged]).toEqual([
      0, 0, 0, 572,
    ]);
  });

  it("detecta unidades modificadas, agregadas y eliminadas en una release sintética", () => {
    const next: CurriculumRelease = structuredClone(release());
    next.release = "2027-01";
    const target = next.units.find((u) => u.unitId === "S3.2#saberes");
    if (!target) throw new Error("unidad faltante");
    target.text = `${target.text} (texto de prueba)`;
    const removed = next.units.findIndex((u) => u.unitId === "OBS-7");
    next.units.splice(removed, 1);
    next.units.push({
      ...target,
      unitId: "OBS-8",
      kind: "observation",
      text: "Observación de prueba",
    });

    const d = diffReleases(release(), next);
    expect(d.changed.map((c) => c.after.unitId)).toEqual(["S3.2#saberes"]);
    expect(d.removed.map((u) => u.unitId)).toEqual(["OBS-7"]);
    expect(d.added.map((u) => u.unitId)).toEqual(["OBS-8"]);

    const md = diffToMarkdown(d);
    expect(md).toContain("2026-06 → 2027-01");
    expect(md).toContain("`S3.2#saberes`");
    expect(md).toContain("(texto de prueba)");
  });
});
