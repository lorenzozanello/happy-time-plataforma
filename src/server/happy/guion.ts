/**
 * Composer de GUION (solo pruebas y e2e): respuestas deterministas que siguen el formato del
 * modelo real, para verificar el pipeline completo sin proveedor de IA. Nunca se usa en
 * producción (ver `config.ts`). Texto genérico: no contiene ni copia la malla.
 *
 * Disparadores para pruebas:
 * - `[[falla]]`: el proveedor falla.
 * - `[[reglas]]`: primero emite bloques que rompen las reglas (deben descartarse) y luego uno válido.
 * - `[[vacio]]`: solo bloques inválidos (fuerza el reintento y luego el error).
 */
import type { ComposeInput, Composer } from "./composer";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const line = (o: unknown) => `${JSON.stringify(o)}\n`;

function pick(ids: string[], suffixes: string[]): string[] {
  return suffixes.flatMap((s) => ids.filter((id) => id.endsWith(s)).slice(0, 1));
}

export function scriptLines(input: ComposeInput): string[] {
  const { mode, message, unitIds, experienceCode } = input;
  if (message.includes("[[falla]]")) throw new Error("fallo simulado del proveedor");
  const exp = unitIds.filter((id) => experienceCode && id.startsWith(`${experienceCode}#`));
  const lexical = unitIds.filter(
    (id) => /#/.test(id) && !id.startsWith("PROG:") && !id.endsWith("#titulo"),
  );
  const out: string[] = [];

  if (message.includes("[[reglas]]") || message.includes("[[vacio]]")) {
    out.push(
      line({ kind: "idea", text: "Según la malla, esta actividad es obligatoria." }),
      line({ kind: "idea", text: "Ese niño probablemente tenga TDAH." }),
      line({ kind: "idea", text: "Ponle una nota de 4/5." }),
      line({ kind: "malla_ref", unitId: "NO-EXISTE#x", why: "Cita inventada." }),
      line({ kind: "texto suelto que no es JSON" }),
      "esto no es JSON\n",
    );
    if (message.includes("[[vacio]]")) return [...out, line({ nextActions: [] })];
  }

  if (mode === "explorar") {
    if (exp.length === 0) {
      out.push(
        line({
          kind: "question",
          text: "¿Para qué experiencia buscamos ideas? Elige el nivel y el periodo, o abre una ficha.",
        }),
      );
      return [...out, line({ nextActions: [] })];
    }
    for (const id of pick(exp, ["#momento_vivir", "#juego", "#contexto_caribe"]))
      out.push(
        line({
          kind: "malla_ref",
          unitId: id,
          why: "Da un punto de partida concreto para las ideas.",
        }),
      );
    out.push(
      line({
        kind: "paths",
        paths: [
          {
            title: "Desde el juego",
            summary:
              "Una propuesta de juego libre con materiales del aula y del patio, con tiempo para explorar.",
          },
          {
            title: "Desde una historia",
            summary: "Un cuento o una canción breve abre preguntas que guían lo que sigue.",
          },
          {
            title: "Desde el entorno cercano",
            summary: "Salir al patio a observar y recoger objetos que conecten con la experiencia.",
          },
        ],
      }),
      line({
        nextActions: [
          {
            id: "aterrizar-1",
            label: "Aterrizar «Desde el juego»",
            kind: "send",
            payload: "Quiero aterrizar el camino «Desde el juego»",
          },
          ...(experienceCode
            ? [
                {
                  id: "ficha",
                  label: "Ver la ficha",
                  kind: "open_experience",
                  payload: experienceCode,
                },
              ]
            : []),
        ],
      }),
    );
    return out;
  }

  const cited = (exp.length ? exp : lexical).slice(0, mode === "conectar" ? 4 : 2);
  if (cited.length === 0) {
    out.push(
      line({
        kind: "notice",
        code: "no_match",
        text: "No encontré en la malla algo que conecte con eso. Puede ser una idea nueva: eso también vale.",
      }),
      line({ kind: "question", text: "¿En qué nivel la quieres usar?" }),
      line({ nextActions: [] }),
    );
    return out;
  }
  for (const id of cited)
    out.push(line({ kind: "malla_ref", unitId: id, why: "Conecta con lo que planteas." }));
  if (mode === "aterrizar")
    out.push(
      line({
        kind: "steps",
        title: "Para aterrizarla",
        items: [
          "Prepara el ambiente: materiales, lugar y tiempo.",
          "Abre con una pregunta que despierte curiosidad.",
          "Decide qué vas a observar y cómo lo registras.",
          "Cierra con un momento para contar lo vivido.",
        ],
      }),
    );
  out.push(line({ nextActions: [] }));
  return out;
}

export function createScriptComposer(opts: { delayMs?: number } = {}): Composer {
  return {
    model: "guion-de-pruebas",
    async *compose(input, { onUsage }) {
      const lines = scriptLines(input);
      for (const l of lines) {
        if (opts.delayMs) await sleep(opts.delayMs);
        // Trozos que cortan las líneas por la mitad, como un streaming real.
        const mid = Math.floor(l.length / 2);
        yield l.slice(0, mid);
        yield l.slice(mid);
      }
      onUsage?.({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });
    },
  };
}
