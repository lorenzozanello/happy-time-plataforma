import { describe, expect, it } from "vitest";
import { BlockStreamReader } from "../../src/domain/happy/stream-json";

const sample = {
  blocks: [
    {
      kind: "malla_ref",
      unitId: "S2.3#juego",
      why: 'Dice "hola" y tiene } llaves ] y \\ barras',
      segment: "tema",
    },
    { kind: "paths", paths: [{ title: "Uno", summary: "Resumen {con} [corchetes]" }] },
    { kind: "question", text: "¿Y esto?\nCon salto de línea y unicode é 😀" },
  ],
  nextActions: [{ id: "a", label: "Ver", kind: "open_experience", payload: "S2.3" }],
};
const text = JSON.stringify(sample);

describe("F5-05 · lector incremental de bloques", () => {
  it("entrega cada bloque al cerrarse, con cualquier tamaño de trozo", () => {
    for (const size of [1, 2, 3, 5, 7, 11, 23, 64, text.length]) {
      const r = new BlockStreamReader();
      const got: unknown[] = [];
      for (let i = 0; i < text.length; i += size) got.push(...r.push(text.slice(i, i + size)));
      expect(got, `trozo ${String(size)}`).toEqual(sample.blocks);
      expect(r.blocksDone).toBe(true);
      expect(r.final()).toEqual(sample);
    }
  });

  it("cortando en cada posición posible, el primer bloque llega antes del final", () => {
    for (let cut = 1; cut < text.length; cut++) {
      const r = new BlockStreamReader();
      const first = r.push(text.slice(0, cut));
      const rest = r.push(text.slice(cut));
      expect([...first, ...rest]).toEqual(sample.blocks);
      // El primer bloque cierra en la posición de su llave: antes de eso no hay bloques.
      const closeOfFirst = text.indexOf('"segment":"tema"}') + '"segment":"tema"}'.length;
      if (cut < closeOfFirst) expect(first).toEqual([]);
      else expect(first.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("ignora espacios y un orden distinto de claves", () => {
    const t = `{\n "nextActions": [],\n "blocks" : [ {"kind":"idea","text":"a"} , {"kind":"idea","text":"b"} ]\n}`;
    const r = new BlockStreamReader();
    const got = r.push(t);
    expect(got).toEqual([
      { kind: "idea", text: "a" },
      { kind: "idea", text: "b" },
    ]);
  });

  it("no confunde una clave «blocks» anidada ni cadenas con llaves", () => {
    const t = JSON.stringify({
      meta: { blocks: [{ kind: "idea", text: "no soy un bloque" }] },
      blocks: [{ kind: "idea", text: '{"blocks":[]} }' }],
      nextActions: [],
    });
    const r = new BlockStreamReader();
    expect(r.push(t)).toEqual([{ kind: "idea", text: '{"blocks":[]} }' }]);
  });

  it("con JSON truncado entrega los bloques completos y `final()` es null", () => {
    const r = new BlockStreamReader();
    const got = r.push(text.slice(0, text.length - 15));
    expect(got.length).toBe(3);
    expect(r.final()).toBeNull();
  });

  it("un elemento ilegible no detiene los siguientes", () => {
    const t = `{"blocks":[{"kind":"idea","text":"a"},{bad json},{"kind":"idea","text":"b"}],"nextActions":[]}`;
    const r = new BlockStreamReader();
    expect(r.push(t)).toEqual([
      { kind: "idea", text: "a" },
      { kind: "idea", text: "b" },
    ]);
  });
});
