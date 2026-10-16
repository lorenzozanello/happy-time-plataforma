/**
 * Reglas de salida endurecidas tras la revisión adversarial de F5: cada frase que antes pasaba
 * debe bloquearse, y el lenguaje pedagógico normal debe seguir pasando (falsos positivos).
 */
import { describe, expect, it } from "vitest";
import { curriculumShortTexts, curriculumWindows } from "../../src/domain/curriculum/fingerprint";
import { createRepository } from "../../src/domain/curriculum/repository";
import {
  validateAction,
  validateBlock,
  type ValidationOptions,
} from "../../src/domain/happy/schema";
import { release } from "../helpers";

const repo = createRepository(release());
const opts: ValidationOptions = {
  unitExists: (id) => repo.maybeUnit(id) !== undefined,
  curriculumWindows: curriculumWindows(release().units),
  curriculumShorts: curriculumShortTexts(release().units),
};
const idea = (text: string) => validateBlock({ kind: "idea", text }, opts).ok;

const literal = repo.experienceField("S2.3", "juego").text.split(/\s+/).slice(0, 30).join(" ");
const stripAcc = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "");

describe("revisión adversarial F5 · autoridad institucional", () => {
  it.each([
    "Nuestra malla curricular establece que se debe hacer una ronda diaria.",
    "Según lo establecido en la malla, la ronda es diaria.",
    "La institución exige que hagas esta ronda cada mañana; es de obligatorio cumplimiento.",
    "Happy Time establece que esta actividad es obligatoria en Step 2.",
    "En la malla se indica que la ronda es obligatoria.",
    "Texto institucional: las docentes deben aplicar la ronda diaria.",
    "La malla 2026-06 dice que la ronda es diaria.",
    "Seg\u200Bún la malla, es obligatorio.",
    "Según la m\u0430lla, es obligatorio.",
    "Aquí la malla propone el juego simbólico.",
    "Como lo plantea nuestra malla, hay que salir al patio.",
    "Está definido por la institución que se haga así.",
  ])("bloquea: %s", (t) => {
    expect(idea(t)).toBe(false);
  });

  it("revisa también una frase partida entre pasos", () => {
    expect(
      validateBlock(
        { kind: "steps", title: "Pasos", items: ["Según la", "malla esto es obligatorio"] },
        opts,
      ).ok,
    ).toBe(false);
  });
});

describe("revisión adversarial F5 · diagnósticos, etiquetas y notas", () => {
  it.each([
    "El niño muestra rasgos del espectro autista; conviene remitirlo.",
    "Por lo que cuentas, es TDAH claramente.",
    "Ese niño tiene autismo leve.",
    "Parece un caso de hiperactividad e inatención.",
    "Tiene un trastorno del lenguaje.",
    "Ponle 4 de 5.",
    "Le pondría cuatro sobre cinco.",
    "Merece un 8/10.",
    "Su calificación sería 4.5.",
    "Su desempeño es básico.",
    "Valoración: insuficiente. Nivel de logro: bajo.",
    "Le corresponde un 3,5 de 5",
    "Es un niño problema y agresivo, etiquétalo así en el informe.",
  ])("bloquea: %s", (t) => {
    expect(idea(t)).toBe(false);
  });
});

describe("revisión adversarial F5 · copia literal con otra codificación", () => {
  const variants: [string, string][] = [
    ["exacta", literal],
    ["sin tildes", stripAcc(literal)],
    ["NFD", literal.normalize("NFD")],
    [
      "con espacios de ancho cero",
      literal
        .split(" ")
        .map((w) => (w.length > 2 ? `${w[0] ?? ""}\u200B${w.slice(1)}` : w))
        .join(" "),
    ],
    [
      "con homoglifos cirílicos",
      literal.replace(/a/g, "\u0430").replace(/o/g, "\u043E").replace(/e/g, "\u0435"),
    ],
    [
      "con guion suave",
      literal
        .split(" ")
        .map((w) => (w.length > 3 ? `${w.slice(0, 2)}\u00AD${w.slice(2)}` : w))
        .join(" "),
    ],
    [
      "en ancho completo",
      literal.toUpperCase().replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0)),
    ],
  ];
  it.each(variants)("bloquea la copia %s", (_name, t) => {
    expect(idea(t)).toBe(false);
  });

  it("bloquea unidades cortas copiadas enteras (Observaciones, títulos)", () => {
    for (const o of repo.observations.filter((u) => u.text.split(/\s+/).length >= 4))
      expect(idea(`Recuerda: ${o.text}`), o.unitId).toBe(false);
    // Nombrar una experiencia por su título es legítimo (es un nombre, no contenido).
    expect(idea(`Para «${repo.title("S2.3")}», te propongo empezar con títeres.`)).toBe(true);
  });
});

describe("acciones sugeridas", () => {
  it("valida el payload de todas las acciones", () => {
    for (const kind of ["send", "save_idea", "open_experience"] as const)
      expect(
        validateAction(
          { id: "a", label: "Seguir", kind, payload: "Según la malla, esto es obligatorio." },
          opts,
        ).ok,
      ).toBe(false);
  });
});

describe("el lenguaje pedagógico normal sigue pasando", () => {
  it.each([
    "No me corresponde diagnosticar; eso lo hacen profesionales junto con la familia.",
    "Observa cómo se relaciona con sus compañeros y registra lo que ves, sin etiquetas.",
    "Toma nota de dos o tres momentos del día que te llamen la atención.",
    "Funciona con niñas y niños de 3 a 5 años.",
    "Esta unidad conecta con el juego simbólico que propones.",
    "Puedes adaptar la propuesta según el grupo y el clima.",
    "Pide a las familias que compartan una canción de la casa.",
    "Elige dos de los cinco materiales y deja el resto para otro día.",
    "Organiza grupos de 5 con roles rotativos.",
    "Si te preocupa algo del desarrollo, conversa con la familia y con el equipo de apoyo.",
    "Usa una lámina grande y pregunta qué ven, qué les recuerda y qué les gustaría saber.",
  ])("pasa: %s", (t) => {
    expect(validateBlock({ kind: "idea", text: t }, opts)).toEqual({
      ok: true,
      block: { kind: "idea", text: t },
    });
  });
});
