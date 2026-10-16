import { describe, expect, it } from "vitest";
import { curriculumWindows } from "../../src/domain/curriculum/fingerprint";
import { createRepository } from "../../src/domain/curriculum/repository";
import {
  V1_MODES,
  validateResponse,
  type Block,
  type HappyResponse,
} from "../../src/domain/happy/schema";
import { release } from "../helpers";

const repo = createRepository(release());
const opts = {
  unitExists: (id: string) => repo.maybeUnit(id) !== undefined,
  segmentExists: (id: string, seg: string) =>
    repo.maybeUnit(id)?.segments?.some((x) => x.key === seg) ?? false,
  experienceExists: (code: string) => repo.maybeExperience(code) !== undefined,
  curriculumWindows: curriculumWindows(release().units),
  allowedModes: V1_MODES,
};
const resp = (blocks: Block[], extra: Partial<HappyResponse> = {}): HappyResponse => ({
  mode: "conectar",
  blocks,
  nextActions: [],
  ...extra,
});
const idea = (text: string): Block => ({ kind: "idea", text });

describe("validador de Happy: rechaza los atajos de la revisión adversarial", () => {
  it.each([
    "Las mallas establecen que debes hacerlo así",
    "Según la malla, debes trabajar rimas",
    "De acuerdo con la malla institucional esto es obligatorio",
    "La malla plantea que…",
    "El currículo oficial dice que…",
    "Desde la malla…",
    "Desde  nuestra malla…",
    "Desde nuestra m\u0430lla…",
    "la malla\u200b dice que",
    "Texto literal de la malla: …",
  ])("autoridad: %s", (t) => {
    expect(validateResponse(resp([idea(t)]), opts).ok).toBe(false);
  });

  it.each(["4,5 sobre 5", "Su nota es 3", "Calificación: Superior", "Desempeño bajo", "8/10"])(
    "calificación: %s",
    (t) => {
      expect(validateResponse(resp([idea(t)]), opts).ok).toBe(false);
    },
  );

  it.each([
    "Diagnóstico: TDAH",
    "Presenta rasgos autistas",
    "Probablemente sea TDAH",
    "Podría tener autismo",
    "Tiene un TEA leve",
    "Hay sospecha de dislexia",
  ])("diagnóstico: %s", (t) => {
    expect(validateResponse(resp([idea(t)]), opts).ok).toBe(false);
  });

  it("más de 3 caminos repartidos en varios bloques", () => {
    const p = { title: "a", summary: "b" };
    const r = resp([
      { kind: "paths", paths: [p, p, p] },
      { kind: "paths", paths: [p, p, p] },
    ]);
    expect(validateResponse(r, opts).ok).toBe(false);
  });

  it("texto generado que copia la malla literalmente (en steps, notice o etiquetas)", () => {
    const literal = repo.unit("S1.1#juego").text;
    expect(validateResponse(resp([{ kind: "steps", title: "x", items: [literal] }]), opts).ok).toBe(
      false,
    );
    expect(
      validateResponse(resp([{ kind: "notice", code: "no_match", text: `Mira: ${literal}` }]), opts)
        .ok,
    ).toBe(false);
    const label = repo.unit("T.1#alcance").text.split(" ").slice(0, 10).join(" ");
    expect(
      validateResponse(
        resp([idea("ok")], {
          nextActions: [{ id: "a", label: label.slice(0, 150), kind: "send" }],
        }),
        opts,
      ).ok,
    ).toBe(false);
  });

  it("autoridad o diagnóstico dentro de avisos y etiquetas de acción", () => {
    expect(
      validateResponse(
        resp([{ kind: "notice", code: "no_match", text: "Desde nuestra malla… tiene autismo" }]),
        opts,
      ).ok,
    ).toBe(false);
    expect(
      validateResponse(
        resp([idea("ok")], { nextActions: [{ id: "a", label: "Ponle 1/5", kind: "send" }] }),
        opts,
      ).ok,
    ).toBe(false);
  });

  it("segmento inexistente, why vacío, experiencia inexistente, texto enorme y modo no habilitado", () => {
    expect(
      validateResponse(
        resp([{ kind: "malla_ref", unitId: "S1.1#juego", segment: "nope", why: "x" }]),
        opts,
      ).ok,
    ).toBe(false);
    expect(
      validateResponse(resp([{ kind: "malla_ref", unitId: "S1.1#juego", why: "  " }]), opts).ok,
    ).toBe(false);
    expect(
      validateResponse(
        resp([idea("ok")], {
          nextActions: [{ id: "a", label: "Ver", kind: "open_experience", payload: "Z9.9" }],
        }),
        opts,
      ).ok,
    ).toBe(false);
    expect(validateResponse(resp([idea("a".repeat(200_000))]), opts).ok).toBe(false);
    expect(validateResponse(resp([idea("ok")], { mode: "registrar" }), opts).ok).toBe(false);
  });

  it("cita no recuperada", () => {
    const r = resp([{ kind: "malla_ref", unitId: "S1.1#juego", why: "porque sí" }]);
    expect(validateResponse(r, { ...opts, retrieved: new Set(["S1.2#juego"]) }).ok).toBe(false);
  });

  it("acepta una respuesta legítima", () => {
    const r = resp([
      {
        kind: "malla_ref",
        unitId: "S1.1#juego",
        segment: "tema",
        why: "Da un punto de partida concreto.",
      },
      {
        kind: "paths",
        paths: [{ title: "Desde el juego", summary: "Una propuesta con materiales del patio." }],
      },
    ]);
    const v = validateResponse(r, { ...opts, retrieved: new Set(["S1.1#juego"]) });
    expect(v.ok, JSON.stringify(v)).toBe(true);
  });
});
