/**
 * Reglas de texto generado y correcciones de la revisión adversarial de F5 (M1, M3, M4, M5, A2, B1).
 */
import { describe, expect, it } from "vitest";
import {
  curriculumWindows,
  textHash,
  unitFingerprint,
  unitHashes,
  words,
} from "../../src/domain/curriculum/fingerprint";
import { createRepository } from "../../src/domain/curriculum/repository";
import { buildSearchIndex } from "../../src/domain/curriculum/search";
import { estimateCostUsd, hasKnownPrice } from "../../src/domain/happy/cost";
import { createFakeModel, type ModelClient, type ModelEvent } from "../../src/domain/happy/model";
import { runHappy, type HappyEvent } from "../../src/domain/happy/pipeline";
import { buildModelRequest } from "../../src/domain/happy/prompt";
import { retrieve } from "../../src/domain/happy/retrieval";
import {
  claimsAuthority,
  diagnoses,
  grades,
  publicReason,
  textRuleErrors,
} from "../../src/domain/happy/rules";
import { generatedTextErrors, validateAction } from "../../src/domain/happy/schema";
import { isTrustedResponseShape } from "../../src/domain/happy/shape";
import { buildCatalog } from "../../src/domain/curriculum/views";
import { sanitizeStored } from "../../src/ui/app/persisted";
import { release } from "../helpers";

const repo = createRepository(release());
const index = buildSearchIndex(release());
const windows = curriculumWindows(release().units);

describe("M3 · reclamos de autoridad por proximidad", () => {
  it.each([
    "La malla lo exige: debes hacerlo así.",
    "Lo dice la malla: hay que evaluar.",
    "Es obligatorio por la malla institucional.",
    "En la malla se establece que se trabaja así.",
    "Es un requisito de la malla curricular.",
    "Según Happy Time, se hace así.",
    "La institución exige este formato.",
    "Cita textual de la malla: hay que…",
    "De acuerdo a la malla, se hace de esta forma.",
    "Texto oficial: los niños deben…",
    "La malla curricular de Happy Time determina que se evalúe.",
    "Esto es lo que la institución pide hacer.",
    "La malla propone un juego de apego.",
    "Las mallas establecen que debes hacerlo así",
    "Desde nuestra malla…",
    "Desde nuestra mаlla…",
    "la malla​ dice que",
  ])("rechaza: %s", (t) => {
    expect(claimsAuthority(t)).toBe(true);
  });

  it.each([
    "Es el momento en que la experiencia sucede; de aquí parten las ideas.",
    "Aquí viven las rimas de este periodo.",
    "La malla orienta, no prescribe, así que decides tú.",
    "La malla no exige notas numéricas; mira el principio citado arriba.",
    "Prepara el ambiente: qué materiales, dónde y cuánto tiempo.",
    "Convierte el tema de juego en una propuesta con materiales del patio.",
    "¿Para qué nivel y periodo lo necesitas?",
  ])("acepta: %s", (t) => {
    expect(claimsAuthority(t)).toBe(false);
  });
});

describe("N1 · lenguaje pedagógico legítimo que NO se bloquea (ADR-014)", () => {
  it.each([
    // inclusión y apoyos
    "Para una niña con autismo, es útil anticipar los cambios con imágenes.",
    "Un niño con TDAH puede necesitar pausas de movimiento entre momentos.",
    "Si la familia ya tiene un diagnóstico de TEA, el PIAR puede orientar las adaptaciones.",
    "Una niña con síndrome de Down puede participar con apoyo de una compañera.",
    "Si en el grupo hay niñas o niños en el espectro autista, es mejor avisar los cambios de actividad.",
    "Las adaptaciones para un niño con dislexia o discalculia son parte del DUA.",
    "Con un déficit visual, es clave el contraste de los materiales.",
    "Una niña con parálisis cerebral usa silla de ruedas; adapta el circuito.",
    "Sin diagnosticar nada, observa cómo responde al ruido.",
    "No me corresponde diagnosticar autismo; sí puedo ayudarte a observar.",
    "Diagnosticar un trastorno corresponde a un profesional de apoyo.",
    // sentido no clínico
    "El espectro de intereses del grupo es amplio: insectos, carros y cocina.",
    "Si hay retraso en la llegada de las familias, es mejor empezar con un juego corto.",
    "El tren de cartón puede tener retraso en la salida; aprovecha para contar vagones.",
    // normas del aula y coordinación
    "Establece una norma sencilla con el grupo: hablamos de a uno.",
    "Las normas del juego indican quién empieza y quién sigue.",
    "Propone normas con las niñas y los niños antes de salir al patio.",
    "Pide una cita con la coordinación para revisar el PIAR.",
    "Ponte de acuerdo con la coordinación para el uso del patio.",
    "Consulta con la coordinación qué dice el PIAR sobre los apoyos.",
    // hablar de la malla sin atribuirle lo generado
    "Esta cita de la malla conecta con tu idea por el tema del juego.",
    "¿Quieres que busque qué propone la malla para este periodo?",
    "La malla no exige notas numéricas; mira el principio citado arriba.",
    "Busqué en las unidades de la malla y la cita que más se acerca es esta.",
    "Es el momento en que la experiencia sucede; de aquí parten las ideas.",
    // matemáticas, música, observación
    "Clasificación de 3 tipos de semillas en vasos transparentes.",
    "Una clasificación básica por color sirve para empezar.",
    "Canta una nota alta y una nota baja para que las imiten.",
    "Toca la escala del xilófono de 1 a 5 láminas.",
    "Escribe una nota a la familia con 3 ideas para el fin de semana.",
    "Toma nota de 2 cosas que hagan con las manos durante el juego.",
    "Cuenta 1, 2, 3 objetos con el grupo.",
    "Pon 5 minutos de exploración libre y luego recoge.",
    "Trabaja con 3 de 5 estaciones el primer día.",
    "Los indicadores son cualitativos; registra lo que observas.",
  ])("acepta: %s", (t) => {
    expect(textRuleErrors(t)).toEqual([]);
  });
});

describe("N5 · evasiones de la segunda pasada", () => {
  it.each([
    "La malla, en su apartado de principios para el nivel, exige evaluar cada semana.",
    "Lo dice la malla: hay que evaluar.",
    "El plan de estudios establece que se evalúe.",
    "La rectoría exige un informe numérico.",
    "Las docentes de Happy Time deben poner nota.",
    "Es política de la institución calificar cada periodo.",
    "El documento curricular del jardín dispone que se haga así.",
  ])("autoridad: %s", (t) => {
    expect(claimsAuthority(t)).toBe(true);
  });
  it.each([
    "No me corresponde diagnosticar, pero claramente tiene TDAH.",
    "No puedo decir que es autista, aunque todo apunta a autismo.",
    "Encaja con TDAH.",
    "Todo apunta a autismo.",
    "Compatible con un cuadro de TDAH.",
    "Ese niño es T.E.A.",
    "Esa niña tiene una condición del neurodesarrollo.",
    "Él es autista.",
    "Presenta rasgos autistas",
    "Probablemente sea TDAH",
    "Hay sospecha de dislexia",
  ])("diagnóstico: %s", (t) => {
    expect(diagnoses(t)).toBe(true);
  });
  it.each([
    "Merece un cuatro sobre cinco.",
    "Pondría 4 en matemáticas.",
    "Nivel de logro: alto.",
    "Desempeño bajo",
    "No superan el mínimo en conteo.",
  ])("calificación: %s", (t) => {
    expect(grades(t)).toBe(true);
  });
  it("copia con homoglifos cirílicos también se detecta", () => {
    const literal = repo.unit("S2.3#momento_vivir").text.split(" ").slice(0, 12).join(" ");
    const cyr = literal.replace(/o/g, "\u043e").replace(/e/g, "\u0435");
    expect(generatedTextErrors(cyr, { curriculumWindows: windows }).join(" ")).toMatch(
      /copia la malla/,
    );
  });
});

describe("M3 · diagnósticos y calificaciones", () => {
  it.each([
    "Ese niño es TEA.",
    "Está en el espectro autista.",
    "Podría ser autismo.",
    "Podría tener autismo",
    "Muestra indicios de autismo.",
    "Cumple criterios de TDAH.",
    "Parece un caso de TDAH.",
    "Diagnóstico probable: TDAH.",
    "Diagnóstico: TDAH",
    "Ese niño probablemente tiene autismo.",
    "Seguramente tiene un retraso.",
  ])("diagnostica: %s", (t) => {
    expect(diagnoses(t)).toBe(true);
  });

  it.each([
    "No me corresponde diagnosticar autismo; sí puedo ayudarte a observar.",
    "No puedo decir si tiene TDAH: eso lo hace un profesional.",
    "Diagnosticar un trastorno corresponde a un profesional de apoyo.",
    "Una niña con parálisis cerebral usa silla de ruedas; adapta el circuito.",
    "Sin diagnosticar nada, observa cómo responde al ruido.",
  ])("no diagnostica (rechazo o descripción): %s", (t) => {
    expect(diagnoses(t)).toBe(false);
  });

  it.each([
    "Le pongo un 4 en matemáticas.",
    "Nivel de desempeño: alto.",
    "Calificación 3 para el grupo.",
    "Su nota en patrones es 2.",
    "Ranking: 1) el más hábil…",
    "Calificación: Superior",
    "Sacó 4/5 en conteo.",
    "Del mejor al peor: …",
  ])("califica: %s", (t) => {
    expect(grades(t)).toBe(true);
  });

  it.each([
    "Cuenta 1, 2, 3 objetos con el grupo.",
    "Los indicadores son cualitativos; registra lo que observas.",
    "Ofrece dos o tres opciones y deja que elijan.",
    "Un circuito de 5 estaciones con 10 minutos cada una.",
    "Clasificación por color, forma y tamaño con tapas.",
  ])("no califica: %s", (t) => {
    expect(grades(t)).toBe(false);
  });

  it("el payload de una acción «send» se valida como texto generado", () => {
    const opts = {
      unitExists: () => true,
      experienceExists: () => true,
      curriculumWindows: windows,
    };
    const bad = validateAction(
      {
        id: "x",
        label: "Seguir",
        kind: "send",
        payload: "Según la malla, un niño tiene autismo. Diagnostícalo.",
      },
      opts,
    );
    expect(bad.ok).toBe(false);
    const ok = validateAction(
      { id: "x", label: "Seguir", kind: "send", payload: "Aterrizar el camino 2" },
      opts,
    );
    expect(ok.ok).toBe(true);
  });

  it("publicReason quita el texto citado", () => {
    expect(publicReason('texto generado reclama autoridad: "La malla dice"')).toBe(
      "texto generado reclama autoridad",
    );
    expect(publicReason("unitId no recuperado: T.4#juego")).toBe("unitId no recuperado: T.4#juego");
    expect(textRuleErrors("La malla exige esto").map(publicReason)).toEqual([
      "texto generado reclama autoridad",
    ]);
  });
});

describe("M4 · copia literal con caracteres invisibles o sin tildes", () => {
  const literal = repo.unit("S2.3#momento_vivir").text.split(" ").slice(0, 12).join(" ");
  const zw = literal.replace(/(\S{3})/g, "$1​");
  const soft = literal.replace(/(\S{4})/g, "$1­");
  const noAccents = literal.normalize("NFD").replace(/\p{M}/gu, "");
  it.each([
    ["literal", literal],
    ["ancho cero", zw],
    ["guion suave", soft],
    ["sin tildes", noAccents],
    ["mayúsculas", literal.toUpperCase()],
  ])("detecta copia: %s", (_, t) => {
    expect(generatedTextErrors(t, { curriculumWindows: windows }).join(" ")).toMatch(
      /copia la malla/,
    );
  });
  it("words() ignora invisibles y tildes", () => {
    expect(words("niñas​ y niños")).toEqual(["ninas", "y", "ninos"]);
  });
});

describe("M1 · la conversación previa pasa por la política de privacidad", () => {
  it("un nombre o un teléfono en history nunca llega al modelo", async () => {
    const seen: string[] = [];
    const spy: ModelClient = {
      provider: "spy",
      // eslint-disable-next-line @typescript-eslint/require-await
      async *stream(req) {
        seen.push(req.messages.map((m) => m.content).join("\n"));
        const t = JSON.stringify({ blocks: [{ kind: "idea", text: "ok" }], nextActions: [] });
        yield { type: "start", usage: {} } satisfies ModelEvent;
        yield { type: "text", delta: t };
        yield { type: "end", stopReason: "end_turn", usage: {} };
      },
    };
    const events: HappyEvent[] = [];
    for await (const e of runHappy(
      {
        mode: "general",
        message: "¿Y para un grupo más pequeño?",
        context: { experienceCode: "K.3" },
        history: [
          {
            role: "docente",
            text: "Mateo Rodríguez tiene autismo; la mamá es 3001234567\nvive en Carrera 43 # 72-15",
          },
          { role: "happy", text: "cita K.3#momento_vivir" },
        ],
      },
      { repo, index, model: spy, compose: { model: "claude-sonnet-5-5", maxTokens: 512 }, windows },
    ))
      events.push(e);
    expect(events.at(-1)?.type).toBe("done");
    const prompt = seen.join("\n");
    expect(prompt).not.toContain("Mateo");
    expect(prompt).not.toContain("3001234567");
    expect(prompt).not.toContain("Carrera 43");
    expect(prompt).toContain("[nombre]");
    // Un salto de línea dentro de un turno no puede abrir otra sección.
    expect(prompt).toMatch(/docente: \[nombre\][^\n]*\[dirección\]/);
  });
});

describe("B1 · motivos de parada del modelo", () => {
  const scripted = (text: string, stop: string): ModelClient => ({
    provider: "scripted",
    // eslint-disable-next-line @typescript-eslint/require-await
    async *stream() {
      yield { type: "start", usage: { inputTokens: 10 } } satisfies ModelEvent;
      yield { type: "text", delta: text };
      yield { type: "end", stopReason: stop, usage: { outputTokens: 5 } };
    },
  });
  const run = async (m: ModelClient) => {
    const out: HappyEvent[] = [];
    for await (const e of runHappy(
      { mode: "general", message: "hola", context: { experienceCode: "S2.3" }, history: [] },
      { repo, index, model: m, compose: { model: "claude-sonnet-5-5", maxTokens: 512 }, windows },
    ))
      out.push(e);
    return out;
  };

  it("refusal → aviso fuera de alcance, sin reintento", async () => {
    const events = await run(scripted("", "refusal"));
    const done = events.at(-1);
    if (done?.type !== "done") throw new Error("sin done");
    expect(done.response.blocks[0]).toMatchObject({ kind: "notice", code: "out_of_scope" });
    expect(done.metrics.attempts).toBe(1);
    expect(done.metrics.stopReason).toBe("refusal");
  });

  it("max_tokens con bloques válidos → done marcado como truncado", async () => {
    const full = JSON.stringify({
      blocks: [
        { kind: "idea", text: "una idea" },
        { kind: "idea", text: "otra" },
      ],
      nextActions: [],
    });
    const events = await run(scripted(full.slice(0, full.length - 12), "max_tokens"));
    const done = events.at(-1);
    if (done?.type !== "done") throw new Error("sin done");
    expect(done.metrics.truncated).toBe(true);
    expect(done.metrics.stopReason).toBe("max_tokens");
    expect(done.metrics.dropped).toContain("salida cortada por longitud (max_tokens)");
    expect(done.response.blocks).toHaveLength(2);
  });

  it("el modelo falso no duplica los tokens de entrada", async () => {
    const events = await run(createFakeModel());
    const done = events.at(-1);
    if (done?.type !== "done") throw new Error("sin done");
    const req = buildModelRequest(
      {
        mode: "general",
        message: "hola",
        context: { experienceCode: "S2.3" },
        retrieval: retrieve(repo, index, {
          mode: "general",
          message: "hola",
          context: { experienceCode: "S2.3" },
        }),
        history: [],
        fence: "x",
      },
      { model: "fake", maxTokens: 512 },
    );
    const approx = Math.ceil(
      (req.system.reduce((n, s) => n + s.text.length, 0) + (req.messages[0]?.content.length ?? 0)) /
        4,
    );
    expect(Math.abs(done.metrics.usage.inputTokens - approx)).toBeLessThan(approx * 0.05);
  });
});

describe("M5 · precio desconocido falla cerrado", () => {
  it("un modelo real sin precio se cobra al precio de Opus; el falso cuesta 0", () => {
    const u = {
      inputTokens: 1_000_000,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWrite5mTokens: 0,
      cacheWrite1hTokens: 0,
    };
    expect(hasKnownPrice("claude-sonnet-4-6")).toBe(false);
    expect(estimateCostUsd("claude-sonnet-4-6", u)).toBe(4);
    expect(estimateCostUsd("fake", u)).toBe(0);
  });
});

describe("A2 · literales guardados en el navegador", () => {
  const catalog = buildCatalog(repo);
  const real = repo.unit("S2.3#momento_vivir");
  const response = {
    mode: "explorar",
    blocks: [{ kind: "malla_ref", unitId: real.unitId, why: "Es el momento en que sucede." }],
    nextActions: [],
  };
  const thread = (unit: unknown, resp: unknown = response) => ({
    threads: [
      {
        id: "h1",
        mode: "explorar",
        context: {},
        title: "t",
        updatedAt: 1,
        messages: [
          { id: "m1", role: "docente", text: "hola", createdAt: 1 },
          { id: "m2", role: "happy", replyTo: "m1", response: resp, units: [unit], createdAt: 2 },
        ],
      },
    ],
  });

  it("una unidad de otra release se convierte en error con reintento al leer el almacenamiento", () => {
    const stale = {
      ...real,
      release: "2019-01",
      text: "TEXTO FABRICADO: la malla exige nota numérica.",
    };
    const state = sanitizeStored(thread(stale), catalog, isTrustedResponseShape);
    expect(state.threads[0]?.messages[1]).toMatchObject({
      id: "m2",
      role: "happy",
      replyTo: "m1",
      error: expect.stringContaining("otra versión") as string,
    });
    expect(state.threads[0]?.messages[1]?.units).toBeUndefined();
    const ok = sanitizeStored(thread(real), catalog, isTrustedResponseShape);
    expect(ok.threads[0]?.messages[1]?.response).toBeDefined();
  });

  it("texto, código o segmentos alterados con la release correcta no coinciden con la huella", () => {
    const hashes = unitHashes(release().units);
    const tampered = { ...real, text: "TEXTO FABRICADO: la malla exige nota numérica." };
    expect(hashes[tampered.unitId]).not.toBe(unitFingerprint(tampered));
    expect(hashes[real.unitId]).toBe(unitFingerprint(real));
    expect(hashes[real.unitId]).not.toBe(unitFingerprint({ ...real, code: "T.4" }));
    expect(hashes[real.unitId]).not.toBe(unitFingerprint({ ...real, headerLiteral: "Alertas" }));
    expect(hashes[real.unitId]).not.toBe(
      unitFingerprint({
        ...real,
        segments: [
          { key: "tema", label: "Alerta", start: 0, end: 10, valueStart: 0, valueEnd: 10 },
        ],
      }),
    );
    expect(Object.keys(hashes)).toHaveLength(572);
    expect(textHash("a")).not.toBe(textHash("b"));
    expect(textHash("hola")).toBe(textHash("hola"));
  });

  it("una respuesta guardada cuyo texto generado reclama autoridad se convierte en error", () => {
    const bad = {
      ...response,
      blocks: [{ kind: "idea", text: "La malla exige que pongas nota." }],
    };
    const state = sanitizeStored(thread(real, bad), catalog, isTrustedResponseShape);
    expect(state.threads[0]?.messages[1]).toMatchObject({
      id: "m2",
      error: expect.any(String) as string,
    });
  });
});
