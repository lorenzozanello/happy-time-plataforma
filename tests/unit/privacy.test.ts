import { describe, expect, it } from "vitest";
import { checkPrivacy } from "../../src/domain/happy/privacy";

/** Corpus de la revisión adversarial de F2 (mensajes realistas de docentes en Colombia). */
const SENSITIVE = [
  "Mi alumna Sofía tiene TDAH",
  "Mi alumna Sofía Pérez tiene TDAH y su mamá es 3001234567",
  "la niña se llama Valentina y llora mucho",
  "Mariana Gómez de Step 2 tiene crisis cuando hay ruido",
  "Santi está medicado con Ritalina",
  "Samuel toma risperidona en las mañanas",
  "Vive en la Cra 45 # 23-10 barrio El Prado",
  "La fonoaudióloga dice que Thiago casi no pronuncia",
  "La pequeña Luciana es asmática",
  "Sara tiene hipoacusia",
  "Dylan tiene parálisis cerebral",
  "A Salomé la está viendo la psicóloga del ICBF",
  "Thiago está en tratamiento con la neuropediatra",
  "el niño juan vive con la abuela y no tiene papá",
  "Los papás de Camilo se están divorciando",
  "Celular 300.123.4567",
  "TI 1.043.567.890",
  "C.C. 72.123.456",
  "escríbele a familia.perez(at)gmail.com",
  "escríbele a la mamá a mama@correo.com",
  "registro civil 1234567890",
  "La mamá de Matías no contesta",
  "El papá de Isabella vino hoy",
  "Tengo una niña, Valentina, que se aísla",
  "Daniela tiene trastorno del espectro autista",
];

const NOT_SENSITIVE = [
  "ideas para trabajar rimas en el patio",
  "un niño de Step 2 que se abruma con el ruido",
  "un niño con autismo en Kínder, ¿cómo adapto el ambiente?",
  "Quiero aterrizar el camino «Desde el juego»",
  "materiales para Transición",
  "¿Dónde habla la malla del PIAR?",
  "¿qué es el DUA y el PIAR?",
  "apoyos para discapacidad visual",
  "el retraso del bus nos quitó media hora",
  "una terapia de juego con títeres",
  "sin hacer diagnóstico, ¿qué puedo observar?",
  "El juego se llama escondite",
  "La canción se llama arroz con leche",
  "año escolar 2025-2026",
  "mesas 1 2 3 4 5 en el aula",
  "contar del 1 al 10 con semillas",
  "Hoy trabajamos el Periodo III de Step 3",
  "¿Cómo conecto una feria de frutas con Barranquilla?",
  "Necesito ideas para el momento de Vivir la experiencia",
];

describe("privacidad: corpus de la revisión adversarial", () => {
  it.each(SENSITIVE)("marca como sensible: %s", (t) => {
    expect(checkPrivacy(t).sensitive).toBe(true);
  });

  it.each(NOT_SENSITIVE)("no bloquea: %s", (t) => {
    expect(checkPrivacy(t).findings).toEqual([]);
  });

  it.each([
    ["Mi alumna Sofía Pérez tiene TDAH y su mamá es 3001234567", ["Sofía", "Pérez", "3001234567"]],
    ["La niña María José llora", ["María", "José"]],
    ["Tengo una niña, Valentina, que se aísla", ["Valentina"]],
    [
      "Mateo López Pérez (TI 1.043.567.890) está en terapia",
      ["Mateo", "López", "Pérez", "1.043.567.890"],
    ],
    ["La mamá de Matías no contesta", ["Matías"]],
    ["escríbele a familia.perez(at)gmail.com", ["familia.perez", "gmail"]],
    ["Vive en la Cra 45 # 23-10", ["45 # 23-10"]],
  ])("la versión redactada no identifica: %s", (t, leaked) => {
    const r = checkPrivacy(t).redacted;
    for (const piece of leaked) expect(r).not.toContain(piece);
  });
});
