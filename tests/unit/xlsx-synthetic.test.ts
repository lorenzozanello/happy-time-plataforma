import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { readWorkbook } from "../../scripts/curriculum/xlsx";

/** Construye un XLSX mínimo en memoria para probar la decodificación de texto del lector. */
function workbook(sharedStrings: string[], sheetXmlCells: string, sheetName = "Hoja"): Uint8Array {
  const sst = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${sharedStrings.join("")}</sst>`;
  return zipSync({
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    ),
    "xl/sharedStrings.xml": strToU8(sst),
    "xl/worksheets/sheet1.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${sheetXmlCells}</row></sheetData></worksheet>`,
    ),
  });
}

describe("lector XLSX · decodificación exacta de texto (sintético)", () => {
  const strings = [
    "<si><t>línea&#10;siguiente</t></si>",
    "<si><t>literal &amp;#10; sin decodificar dos veces</t></si>",
    "<si><t>&lt;b&gt; &quot;comillas&quot; &apos;</t></si>",
    '<si><t xml:space="preserve">  dos espacios  </t></si>',
    "<si><r><t>Ho</t></r><r><rPr><b/></rPr><t>la</t></r><rPh><t>X</t></rPh></si>",
    "<si><t>007</t></si>",
    "<si><t>retorno_x000D_aquí</t></si>",
    "<si><t>emoji &#x1F331; y tilde ñ</t></si>",
  ];
  const cells = [
    ...strings.map((_, i) => `<c r="${String.fromCharCode(65 + i)}1" t="s"><v>${i}</v></c>`),
    '<c r="I1" t="inlineStr"><is><t>en línea</t></is></c>',
    '<c r="J1" s="3"/>',
  ].join("");
  const wb = readWorkbook(workbook(strings, cells, "A &amp; B"));
  const sheet = wb.sheets.get("A & B");
  const v = (ref: string) => sheet?.cells.get(ref)?.value;

  it("decodifica nombres de hoja con entidades", () => {
    expect(wb.sheetNames).toEqual(["A & B"]);
  });

  it("resuelve referencias numéricas y entidades sin doble decodificación", () => {
    expect(v("A1")).toBe("línea\nsiguiente");
    expect(v("B1")).toBe("literal &#10; sin decodificar dos veces");
    expect(v("C1")).toBe(`<b> "comillas" '`);
    expect(v("H1")).toBe("emoji \u{1F331} y tilde ñ");
  });

  it("conserva espacios, concatena corridas, ignora fonética y no convierte tipos", () => {
    expect(v("D1")).toBe("  dos espacios  ");
    expect(v("E1")).toBe("Hola");
    expect(v("F1")).toBe("007");
    expect(sheet?.cells.get("F1")?.type).toBe("s");
  });

  it("decodifica escapes OOXML y lee cadenas en línea", () => {
    expect(v("G1")).toBe("retorno\raquí");
    expect(v("I1")).toBe("en línea");
  });

  it("omite celdas vacías con solo estilo", () => {
    expect(sheet?.cells.has("J1")).toBe(false);
  });
});
