/**
 * Composer (§8.6): la única pieza que habla con un modelo. Entrega texto en trozos (streaming);
 * el pipeline lo convierte en bloques y los valida. Así el proveedor es reemplazable (R11).
 */
import type { Mode } from "../../domain/happy/schema";

export interface ComposeInput {
  system: string;
  user: string;
  /** Datos estructurados del turno (los usa el composer de guion de pruebas). */
  mode: Mode;
  message: string;
  unitIds: string[];
  experienceCode?: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface Composer {
  /** Identificador del modelo, se registra por respuesta. */
  readonly model: string;
  compose(
    input: ComposeInput,
    opts: { signal?: AbortSignal; onUsage?: (u: Usage) => void },
  ): AsyncIterable<string>;
}

/** Convierte trozos de texto en líneas completas (NDJSON), tolerando cercas de markdown. */
export async function* ndjsonLines(chunks: AsyncIterable<string>): AsyncGenerator<string> {
  let buffer = "";
  const clean = (line: string) => {
    const t = line.trim();
    return t === "" || t.startsWith("```") ? null : t;
  };
  for await (const chunk of chunks) {
    buffer += chunk;
    let nl = buffer.indexOf("\n");
    while (nl !== -1) {
      const line = clean(buffer.slice(0, nl));
      buffer = buffer.slice(nl + 1);
      if (line) yield line;
      nl = buffer.indexOf("\n");
    }
  }
  const last = clean(buffer);
  if (last) yield last;
}
