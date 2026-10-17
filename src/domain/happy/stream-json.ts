/**
 * Lector incremental de la salida JSON del modelo.
 *
 * El modelo produce un objeto `{ "blocks": [ … ], "nextActions": [ … ] }` como texto en streaming.
 * Este lector recibe los trozos a medida que llegan y entrega cada elemento de `blocks` en cuanto
 * se cierra su llave, sin esperar al final: así la interfaz pinta el primer bloque en cuanto existe.
 * Es un autómata carácter a carácter (cadenas, escapes, profundidad), de modo que los cortes pueden
 * caer en cualquier posición, incluso dentro de una secuencia de escape.
 */
export class BlockStreamReader {
  private text = "";
  private depth = 0;
  private inString = false;
  private escape = false;
  private key = "";
  private expectKey = true;
  private pendingBlocksKey = false;
  private blocksDepth: number | null = null;
  private blocksClosed = false;
  private elementStart = -1;
  private emitted = 0;

  /** Texto completo recibido hasta ahora. */
  get raw(): string {
    return this.text;
  }

  /** Cantidad de bloques entregados. */
  get count(): number {
    return this.emitted;
  }

  /** ¿Ya se cerró el arreglo `blocks`? */
  get blocksDone(): boolean {
    return this.blocksClosed;
  }

  /** Agrega un trozo y devuelve los bloques que se completaron con él (ya parseados). */
  push(delta: string): unknown[] {
    const out: unknown[] = [];
    const base = this.text.length;
    this.text += delta;
    for (let i = 0; i < delta.length; i++) {
      const ch = delta[i] as string;
      const pos = base + i;
      if (this.inString) {
        if (this.escape) {
          this.escape = false;
          if (this.depth === 1 && this.expectKey) this.key += ch;
        } else if (ch === "\\") {
          this.escape = true;
        } else if (ch === '"') {
          this.inString = false;
          if (this.depth === 1 && this.expectKey) {
            this.pendingBlocksKey = this.key === "blocks";
            this.expectKey = false;
          }
        } else if (this.depth === 1 && this.expectKey) {
          this.key += ch;
        }
        continue;
      }
      switch (ch) {
        case '"':
          this.inString = true;
          this.escape = false;
          if (this.depth === 1 && this.expectKey) this.key = "";
          break;
        case "{":
        case "[": {
          if (
            ch === "[" &&
            this.pendingBlocksKey &&
            this.depth === 1 &&
            this.blocksDepth === null
          ) {
            this.blocksDepth = this.depth + 1;
            this.pendingBlocksKey = false;
          }
          this.depth++;
          if (
            ch === "{" &&
            this.blocksDepth !== null &&
            this.depth === this.blocksDepth + 1 &&
            !this.blocksClosed
          )
            this.elementStart = pos;
          if (this.depth === 1) this.expectKey = true;
          break;
        }
        case "}":
        case "]": {
          const closing = this.depth;
          this.depth--;
          if (
            ch === "}" &&
            this.blocksDepth !== null &&
            closing === this.blocksDepth + 1 &&
            this.elementStart >= 0
          ) {
            const slice = this.text.slice(this.elementStart, pos + 1);
            this.elementStart = -1;
            try {
              out.push(JSON.parse(slice));
              this.emitted++;
            } catch {
              /* un elemento ilegible no detiene el flujo: el parseo final decide */
            }
          }
          if (ch === "]" && this.blocksDepth !== null && closing === this.blocksDepth)
            this.blocksClosed = true;
          if (this.depth === 1) this.expectKey = false;
          break;
        }
        case ",":
          if (this.depth === 1) this.expectKey = true;
          break;
        case ":":
          if (this.depth === 1) this.expectKey = false;
          break;
        default:
          break;
      }
    }
    return out;
  }

  /** Parseo completo del texto acumulado, o `null` si no es JSON válido. */
  final(): unknown {
    try {
      return JSON.parse(this.text) as unknown;
    } catch {
      return null;
    }
  }
}
