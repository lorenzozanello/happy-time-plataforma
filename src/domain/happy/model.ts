/**
 * Contrato del cliente de modelo. El pipeline de Happy solo conoce esta interfaz: en producción la
 * implementa el adaptador de Claude API (`app/_server/anthropic-model.ts`); en CI, e2e y la suite sin
 * clave, el modelo falso determinista de este archivo.
 */
export interface ModelTextBlock {
  text: string;
  /** Punto de caché de prompt: el prefijo hasta este bloque se guarda con ese TTL. */
  cache?: "5m" | "1h";
}

export interface ModelRequest {
  model: string;
  system: ModelTextBlock[];
  messages: { role: "user" | "assistant"; content: string }[];
  /** Esquema JSON de la salida (salida estructurada). */
  outputSchema: Record<string, unknown>;
  maxTokens: number;
  effort?: "low" | "medium" | "high";
  thinking?: "adaptive" | "between_tools";
  signal?: AbortSignal;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWrite5mTokens: number;
  cacheWrite1hTokens: number;
}

export const EMPTY_USAGE: ModelUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWrite5mTokens: 0,
  cacheWrite1hTokens: 0,
};

export type ModelEvent =
  | { type: "start"; usage: Partial<ModelUsage> }
  | { type: "text"; delta: string }
  | { type: "end"; stopReason: string | null; usage: Partial<ModelUsage> };

export interface ModelClient {
  /** Identificador del proveedor para registros y métricas ("anthropic", "fake"). */
  readonly provider: string;
  stream(req: ModelRequest): AsyncIterable<ModelEvent>;
}

/* ── Modelo falso determinista ──────────────────────────────────────────────── */

export interface FakeModelOptions {
  /** Pausa antes del primer trozo y entre trozos (ms). 0 en pruebas unitarias. */
  firstChunkDelayMs?: number;
  chunkDelayMs?: number;
  /** Tamaño de los trozos de texto emitidos. */
  chunkSize?: number;
}

/** Marcadores que el modelo falso reconoce en el mensaje de la docente para simular fallos. */
export const FAKE_MARKERS = {
  fail: "[[fake:fail]]",
  invalid: "[[fake:invalid]]",
  empty: "[[fake:empty]]",
  authority: "[[fake:authority]]",
  diagnosis: "[[fake:diagnosis]]",
  badJson: "[[fake:badjson]]",
  slow: "[[fake:slow]]",
} as const;

const sleep = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

/** Identificadores de unidad citables y su campo, tal como el prompt los presenta: `[ID] (dónde)`. */
export function parseOfferedUnits(text: string): { id: string; where: string }[] {
  const out: { id: string; where: string }[] = [];
  for (const m of text.matchAll(/^\[([A-Za-z0-9.:#_-]+)\] \(([^)]*)\)/gm)) {
    out.push({ id: m[1] as string, where: m[2] as string });
  }
  return out;
}

/** Texto de la docente, delimitado en el prompt entre <<< y >>>. */
export function parseTeacherMessage(text: string): string {
  const m = /<<<\n([\s\S]*?)\n>>>/.exec(text);
  return m ? (m[1] as string) : "";
}

export function parseMode(text: string): string {
  const m = /^Modo: (\w+)/m.exec(text);
  return m ? (m[1] as string) : "general";
}

interface FakeBlock {
  kind: string;
  [k: string]: unknown;
}

/**
 * Compone una respuesta plausible solo con las unidades ofrecidas en el prompt, sin copiar texto
 * curricular (todo lo generado son frases fijas genéricas). Nunca diagnostica ni reclama autoridad,
 * salvo que el mensaje traiga un marcador de fallo a propósito.
 */
export function fakeCompose(req: ModelRequest): { blocks: FakeBlock[]; nextActions: unknown[] } {
  const all = [...req.system.map((s) => s.text), ...req.messages.map((m) => m.content)].join("\n");
  const last = req.messages.at(-1)?.content ?? "";
  const offered = parseOfferedUnits(all);
  const teacher = parseTeacherMessage(last);
  const mode = parseMode(last);
  const retrying = /^# Correcciones/m.test(last);
  const has = (marker: string) => teacher.includes(marker);
  const field = (suffix: string) => offered.find((u) => u.id.endsWith(`#${suffix}`));
  const expCode = /^Contexto:.*experiencia (\S+)/m.exec(last)?.[1];
  const ref = (id: string, why: string, segment?: string): FakeBlock => ({
    kind: "malla_ref",
    unitId: id,
    why,
    ...(segment ? { segment } : {}),
  });

  const blocks: FakeBlock[] = [];
  const nextActions: unknown[] = [];

  if (!retrying) {
    if (has(FAKE_MARKERS.empty)) return { blocks: [], nextActions: [] };
    if (has(FAKE_MARKERS.invalid)) {
      blocks.push(ref("X.9#nada", "Esta cita no existe y debe descartarse."));
      // Dos bloques de 2 caminos: el segundo supera el máximo de 3 caminos por respuesta.
      for (const pair of [
        [1, 2],
        [3, 4],
      ])
        blocks.push({
          kind: "paths",
          paths: pair.map((n) => ({ title: `Camino ${String(n)}`, summary: "Resumen de prueba." })),
        });
    }
    if (has(FAKE_MARKERS.authority))
      blocks.push({ kind: "idea", text: "La malla dice que esto es obligatorio." });
    if (has(FAKE_MARKERS.diagnosis))
      blocks.push({ kind: "idea", text: "Ese niño probablemente tiene autismo." });
  }

  const vivir = field("momento_vivir");
  const juego = field("juego");
  const caribe = field("contexto_caribe");
  const hits = offered.filter((u) => /^# Coincidencias/m.test(last) && last.includes(`[${u.id}]`));
  const obs = offered.find((u) => u.id === "OBS-1");

  if (mode === "explorar") {
    if (!vivir) {
      blocks.push({
        kind: "question",
        text: "¿Para qué experiencia buscamos ideas? Abre una ficha y toca «Pensemos juntas», o elige nivel y periodo.",
      });
    } else {
      blocks.push(
        ref(vivir.id, "Es el momento en que la experiencia sucede; de aquí parten las ideas."),
      );
      if (juego)
        blocks.push(ref(juego.id, "El tema de juego da un punto de partida concreto.", "tema"));
      if (caribe)
        blocks.push(ref(caribe.id, "Ancla la propuesta en el entorno de las niñas y los niños."));
      blocks.push({
        kind: "paths",
        paths: [
          {
            title: "Desde el juego",
            summary:
              "Convierte el tema de juego en una propuesta con materiales del aula y del patio, con tiempo para explorar libremente.",
          },
          {
            title: "Desde una historia",
            summary:
              "Parte de un cuento o una canción breve y deja que las preguntas del grupo guíen lo que sigue.",
          },
          {
            title: "Desde el entorno cercano",
            summary:
              "Sal al patio o a un espacio cercano a observar y recoger objetos que conecten con la experiencia.",
          },
        ],
      });
      nextActions.push({
        id: "aterrizar",
        label: "Aterrizar «Desde el juego»",
        kind: "send",
        payload: "Quiero aterrizar el camino «Desde el juego»",
      });
      if (expCode)
        nextActions.push({
          id: "ficha",
          label: "Ver la ficha",
          kind: "open_experience",
          payload: expCode,
        });
    }
  } else if (mode === "aterrizar") {
    const chosen = hits.slice(0, 3);
    if (chosen.length === 0 && !vivir) {
      blocks.push({
        kind: "notice",
        code: "no_match",
        text: "No encontré en la malla un tema que coincida con tu idea. Puede que sea nueva para la malla: eso también vale.",
      });
      blocks.push({
        kind: "question",
        text: "¿Me cuentas en qué nivel la quieres usar y qué quieres que vivan las niñas y los niños?",
      });
    } else {
      for (const h of chosen)
        blocks.push(ref(h.id, `Conecta con tu idea por su tema (${h.where}).`));
      if (chosen.length === 0 && vivir)
        blocks.push(ref(vivir.id, "Tu idea se puede vivir dentro de este momento."));
      blocks.push({
        kind: "steps",
        title: "Para aterrizarla",
        items: [
          "Prepara el ambiente: qué materiales, dónde y cuánto tiempo.",
          "Abre con una pregunta que despierte curiosidad y escucha las respuestas del grupo.",
          "Decide qué vas a observar y cómo lo vas a registrar.",
          "Cierra con un momento para que cuenten o muestren lo que vivieron.",
        ],
      });
      nextActions.push({ id: "guardar", label: "Guardar estos pasos", kind: "save_idea" });
    }
  } else if (mode === "conectar") {
    const chosen = hits.slice(0, 4);
    if (chosen.length === 0) {
      blocks.push({
        kind: "notice",
        code: "no_match",
        text: "No encontré ese tema en la malla. Prueba con otra palabra o con un material concreto.",
      });
    } else {
      for (const h of chosen) blocks.push(ref(h.id, `Aparece aquí (${h.where}).`));
    }
  } else {
    // general
    if (/ignora tus instrucciones|actúa como|olvida/i.test(teacher)) {
      blocks.push({
        kind: "notice",
        code: "out_of_scope",
        text: "Sigo siendo Happy y me quedo en lo pedagógico. ¿Qué necesitas para tu grupo?",
      });
    } else if (/autismo|tdah|diagn[oó]stico|nota de|calific/i.test(teacher)) {
      blocks.push({
        kind: "idea",
        text: "No me corresponde diagnosticar ni calificar a una niña o un niño. Sí puedo ayudarte a decidir qué observar y cómo documentarlo.",
      });
      if (obs) blocks.push(ref(obs.id, "Este principio orienta cómo se usa la malla."));
    } else if (hits[0]) {
      blocks.push(ref(hits[0].id, "Es la unidad que más se relaciona con tu pregunta."));
      blocks.push({
        kind: "idea",
        text: "Si me cuentas el nivel y el periodo, puedo precisar más.",
      });
    } else {
      blocks.push({
        kind: "question",
        text: "¿Para qué nivel y periodo lo necesitas? Así te muestro lo que dice la malla.",
      });
    }
  }
  if (has(FAKE_MARKERS.slow) && blocks.length === 0)
    blocks.push({ kind: "idea", text: "Respuesta lenta de prueba." });
  return { blocks, nextActions: nextActions.slice(0, 3) };
}

export function createFakeModel(opts: FakeModelOptions = {}): ModelClient {
  const chunkSize = opts.chunkSize ?? 23;
  return {
    provider: "fake",
    async *stream(req) {
      const teacher = parseTeacherMessage(req.messages.at(-1)?.content ?? "");
      const slow = teacher.includes(FAKE_MARKERS.slow);
      const first = (opts.firstChunkDelayMs ?? 0) * (slow ? 4 : 1);
      const between = (opts.chunkDelayMs ?? 0) * (slow ? 4 : 1);
      if (teacher.includes(FAKE_MARKERS.fail)) {
        await sleep(first);
        throw new Error("fake: fallo simulado del modelo");
      }
      const composed = fakeCompose(req);
      let text = JSON.stringify(composed);
      if (
        teacher.includes(FAKE_MARKERS.badJson) &&
        !/^# Correcciones/m.test(req.messages.at(-1)?.content ?? "")
      )
        text = text.slice(0, Math.max(10, text.length - 20));
      const inputTokens = Math.ceil(
        (req.system.reduce((n, s) => n + s.text.length, 0) +
          req.messages.reduce((n, m) => n + m.content.length, 0)) /
          4,
      );
      yield { type: "start", usage: { inputTokens } };
      await sleep(first);
      for (let i = 0; i < text.length; i += chunkSize) {
        if (req.signal?.aborted) throw new Error("fake: abortado");
        yield { type: "text", delta: text.slice(i, i + chunkSize) };
        if (i + chunkSize < text.length) await sleep(between);
      }
      yield {
        type: "end",
        stopReason: "end_turn",
        usage: { inputTokens, outputTokens: Math.ceil(text.length / 4) },
      };
    },
  };
}
