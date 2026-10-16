import { describe, expect, it } from "vitest";
import { compose } from "../../prototype/happy-simulator";
import { curriculumWindows } from "../../src/domain/curriculum/fingerprint";
import { createRepository } from "../../src/domain/curriculum/repository";
import { buildSearchIndex, highlightRanges, snippet } from "../../src/domain/curriculum/search";
import {
  HappyResponseSchema,
  validateResponse,
  type HappyResponse,
} from "../../src/domain/happy/schema";
import { CONTRAST_PAIRS, TOKENS, contrast, themeCss } from "../../src/ui/theme";
import { release } from "../helpers";

describe("F2-01 · tokens de diseño", () => {
  for (const theme of ["light", "dark"] as const) {
    it.each(CONTRAST_PAIRS)(`${theme}: $use ≥ $min:1`, ({ fg, bg, min }) => {
      expect(contrast(TOKENS[theme][fg], TOKENS[theme][bg])).toBeGreaterThanOrEqual(min);
    });
  }

  it("el CSS define todos los tokens en claro y los redefine en ambos bloques oscuros", () => {
    const css = themeCss();
    const blocks = css.split("\n");
    expect(blocks).toHaveLength(3);
    for (const k of Object.keys(TOKENS.light)) {
      for (const b of blocks) expect(b).toContain(`--${k}:`);
    }
    expect(css).toContain('@media (prefers-color-scheme: dark) { :root:not([data-theme="light"])');
    expect(css).toContain(':root[data-theme="dark"]');
  });
});

describe("repositorio curricular", () => {
  const repo = createRepository(release());
  it("resuelve nivel × periodo a exactamente una experiencia", () => {
    for (const l of repo.levels) {
      for (const p of [1, 2, 3, 4]) expect(repo.experienceAt(l.id, p).levelId).toBe(l.id);
    }
  });
  it("navega en el orden oficial", () => {
    expect(repo.neighbors("S1.1").prev).toBeUndefined();
    expect(repo.neighbors("S1.4").next?.code).toBe("S2.1");
    expect(repo.neighbors("T.4").next).toBeUndefined();
  });
  it("el título viene de la unidad literal", () => {
    expect(repo.title("K.3")).toBe(repo.unit("K.3#titulo").text);
  });
});

describe("búsqueda: resaltado sobre el literal", () => {
  it("encuentra coincidencias sin tildes y devuelve rangos del texto original", () => {
    const text = "Exploración del medio y canción";
    const r = highlightRanges(text, ["exploracion", "cancion"]);
    expect(r.map(([a, b]) => text.slice(a, b))).toEqual(["Exploración", "canción"]);
  });
  it("el fragmento conserva el texto literal", () => {
    const u = release().units.find((x) => x.unitId === "S2.3#literatura");
    if (!u) throw new Error("falta unidad");
    const sn = snippet(u.text, ["rimas"]);
    expect(u.text.includes(sn.text)).toBe(true);
  });
});

describe("F2-05 · contrato de Happy", () => {
  const repo = createRepository(release());
  const index = buildSearchIndex(release());
  const exists = (id: string) => repo.maybeUnit(id) !== undefined;
  const strict = {
    unitExists: exists,
    segmentExists: (id: string, seg: string) =>
      repo.maybeUnit(id)?.segments?.some((x) => x.key === seg) ?? false,
    experienceExists: (code: string) => repo.maybeExperience(code) !== undefined,
    curriculumWindows: curriculumWindows(release().units),
  };

  it("rechaza unidades inexistentes, autoridad reclamada y diagnósticos", () => {
    const bad: HappyResponse = {
      mode: "conectar",
      blocks: [
        { kind: "malla_ref", unitId: "X#no", why: "razón" },
        { kind: "idea", text: "Según la malla oficial esto es obligatorio" },
        { kind: "idea", text: "El niño tiene autismo" },
      ],
      nextActions: [],
    };
    const r = validateResponse(bad, { unitExists: exists });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(3);
  });

  it("rechaza más de 3 caminos", () => {
    const four = { title: "a", summary: "b" };
    expect(
      HappyResponseSchema.safeParse({
        mode: "explorar",
        blocks: [{ kind: "paths", paths: [four, four, four, four] }],
        nextActions: [],
      }).success,
    ).toBe(false);
  });

  it.each([
    ["explorar", "Dame ideas", { experienceCode: "S2.3" }],
    ["aterrizar", "Quiero hacer una feria de frutas con canciones", { levelId: "kinder" }],
    ["conectar", "rimas y sonidos", {}],
    ["general", "patio", {}],
  ] as const)("el simulador produce respuestas válidas (%s)", (mode, message, context) => {
    const { response: res, retrieved } = compose(repo, index, { mode, message, context });
    const v = validateResponse(res, { ...strict, retrieved });
    expect(v.ok, JSON.stringify(v)).toBe(true);
    for (const b of res.blocks) {
      if (b.kind === "paths") expect(b.paths.length).toBeLessThanOrEqual(3);
      if (b.kind === "malla_ref") expect(repo.unit(b.unitId).authority).toBe("official_curriculum");
    }
  });

  it("explorar sin experiencia pide contexto con una pregunta breve", () => {
    const { response: res } = compose(repo, index, {
      mode: "explorar",
      message: "ideas",
      context: {},
    });
    expect(res.blocks.map((b) => b.kind)).toEqual(["question"]);
  });

  it("ante datos sensibles responde solo con el aviso de privacidad", () => {
    const { response: res } = compose(repo, index, {
      mode: "aterrizar",
      message: "Tengo un niño llamado Mateo con diagnóstico de TEA",
      context: { experienceCode: "S2.1" },
    });
    expect(res.blocks).toEqual([expect.objectContaining({ kind: "notice", code: "privacy" })]);
  });
});
