/**
 * Lector XLSX mínimo y de solo lectura para la fuente curricular.
 *
 * Se escribe a mano (fflate + fast-xml-parser) en lugar de usar una librería de hojas de cálculo
 * para controlar exactamente cómo se decodifica el texto: sin recortes, sin conversión de tipos,
 * sin normalización Unicode. El validador independiente en Python (openpyxl) usa otro parser;
 * ambos deben coincidir celda por celda (ADR-002).
 */
import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";

export type CellType = "s" | "inlineStr" | "str" | "n" | "b" | "e" | "d";

export interface Cell {
  ref: string;
  row: number;
  col: number;
  type: CellType;
  value: string;
}

export interface Sheet {
  name: string;
  /** Celdas con valor, indexadas por referencia A1. Celdas vacías (solo estilo) se omiten. */
  cells: Map<string, Cell>;
  merges: string[];
  /** Cantidad de elementos <row> en el XML (incluye filas vacías con estilo). */
  xmlRowCount: number;
}

export interface Workbook {
  sheetNames: string[];
  sheets: Map<string, Sheet>;
}

const ARRAY_TAGS = new Set(["sheet", "Relationship", "si", "r", "row", "c", "mergeCell"]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  // Las entidades se decodifican a mano en una sola pasada (decodeXmlEntities): así las
  // referencias numéricas (&#10;, &#xD;) se resuelven y "&amp;#10;" queda como "&#10;" literal.
  processEntities: false,
  htmlEntities: false,
  ignoreDeclaration: true,
  isArray: (name) => ARRAY_TAGS.has(name),
});

const XML_ENTITY = /&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g;
const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Decodifica entidades XML predefinidas y referencias numéricas en una sola pasada. */
export function decodeXmlEntities(s: string): string {
  return s.replace(XML_ENTITY, (_m, body: string) => {
    if (body.startsWith("#x")) return String.fromCodePoint(parseInt(body.slice(2), 16));
    if (body.startsWith("#")) return String.fromCodePoint(parseInt(body.slice(1), 10));
    return NAMED[body] ?? _m;
  });
}

/** Decodifica escapes OOXML `_xHHHH_` (ECMA-376 §22.4.2.4). `_x005F_` escapa el guion bajo. */
export function decodeOoxmlEscapes(s: string): string {
  return s.replace(/_x([0-9A-Fa-f]{4})_/g, (_m, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
}

type XmlNode = Record<string, unknown>;

function asNode(v: unknown, what: string): XmlNode {
  if (v === null || typeof v !== "object" || Array.isArray(v)) {
    throw new Error(`XLSX: se esperaba un elemento en ${what}`);
  }
  return v as XmlNode;
}

function asArray(v: unknown): unknown[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function attr(node: XmlNode, name: string): string | undefined {
  const v = node[`@_${name}`];
  return typeof v === "string" ? decodeXmlEntities(v) : undefined;
}

/** Texto de un elemento <t>: puede llegar como string o como objeto con #text y atributos. */
function textOf(t: unknown): string {
  if (t === undefined) return "";
  if (typeof t === "string") return decodeXmlEntities(t);
  if (typeof t === "number") return String(t);
  const node = asNode(t, "<t>");
  const inner = node["#text"];
  if (inner === undefined) return "";
  if (typeof inner === "string") return decodeXmlEntities(inner);
  if (typeof inner === "number") return String(inner);
  throw new Error("XLSX: contenido inesperado dentro de <t>");
}

/** Texto de un <si>/<is>: <t> directo o concatenación de corridas <r><t>. Ignora <rPh>. */
function richText(node: XmlNode): string {
  if (node.t !== undefined) return decodeOoxmlEscapes(textOf(node.t));
  return decodeOoxmlEscapes(
    asArray(node.r)
      .map((r) => textOf(asNode(r, "<r>").t))
      .join(""),
  );
}

export function colToIndex(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

export function indexToCol(n: number): string {
  let s = "";
  let x = n;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

export function parseRef(ref: string): { row: number; col: number } {
  const m = /^([A-Z]{1,3})(\d+)$/.exec(ref);
  if (!m?.[1] || !m[2]) throw new Error(`XLSX: referencia inválida ${ref}`);
  return { col: colToIndex(m[1]), row: Number(m[2]) };
}

export function cellRef(row: number, col: number): string {
  return `${indexToCol(col)}${row}`;
}

function readPart(files: Record<string, Uint8Array>, path: string): XmlNode {
  const bytes = files[path];
  if (!bytes) throw new Error(`XLSX: falta la parte ${path}`);
  return asNode(parser.parse(strFromU8(bytes)), path);
}

export function readWorkbook(bytes: Uint8Array): Workbook {
  const files = unzipSync(bytes);

  const wb = asNode(readPart(files, "xl/workbook.xml").workbook, "workbook");
  const rels = asNode(readPart(files, "xl/_rels/workbook.xml.rels").Relationships, "rels");
  const relTarget = new Map<string, string>();
  for (const r of asArray(rels.Relationship)) {
    const node = asNode(r, "Relationship");
    const id = attr(node, "Id");
    const target = attr(node, "Target");
    if (id && target) {
      relTarget.set(id, target.startsWith("/") ? target.slice(1) : `xl/${target}`);
    }
  }

  const shared: string[] = [];
  if (files["xl/sharedStrings.xml"]) {
    const sst = asNode(readPart(files, "xl/sharedStrings.xml").sst, "sst");
    for (const si of asArray(sst.si)) shared.push(richText(asNode(si, "si")));
  }

  const sheetNames: string[] = [];
  const sheets = new Map<string, Sheet>();
  for (const s of asArray(asNode(wb.sheets, "sheets").sheet)) {
    const node = asNode(s, "sheet");
    const name = attr(node, "name");
    const rid = attr(node, "r:id");
    if (!name || !rid) throw new Error("XLSX: hoja sin nombre o relación");
    const path = relTarget.get(rid);
    if (!path) throw new Error(`XLSX: relación ${rid} no encontrada`);
    sheetNames.push(name);
    sheets.set(name, readSheet(name, readPart(files, path), shared));
  }
  return { sheetNames, sheets };
}

function readSheet(name: string, doc: XmlNode, shared: string[]): Sheet {
  const ws = asNode(doc.worksheet, "worksheet");
  const cells = new Map<string, Cell>();
  const rows = asArray(asNode(ws.sheetData ?? {}, "sheetData").row);
  for (const r of rows) {
    for (const c of asArray(asNode(r, "row").c)) {
      const node = asNode(c, "c");
      const ref = attr(node, "r");
      if (!ref) throw new Error(`XLSX: celda sin referencia en ${name}`);
      const type = (attr(node, "t") ?? "n") as CellType;
      let value: string | undefined;
      if (type === "inlineStr") {
        value = node.is === undefined ? undefined : richText(asNode(node.is, "is"));
      } else if (node.v !== undefined) {
        const raw = textOf(node.v);
        if (type === "s") {
          const idx = Number(raw);
          const sv = shared[idx];
          if (sv === undefined)
            throw new Error(`XLSX: índice de cadena compartida ${raw} inválido`);
          value = sv;
        } else {
          value = raw;
        }
      }
      if (value === undefined) continue;
      const { row, col } = parseRef(ref);
      cells.set(ref, { ref, row, col, type, value });
    }
  }
  const merges = asArray(asNode(ws.mergeCells ?? {}, "mergeCells").mergeCell).map((m) => {
    const ref = attr(asNode(m, "mergeCell"), "ref");
    if (!ref) throw new Error("XLSX: mergeCell sin ref");
    return ref;
  });
  return { name, cells, merges, xmlRowCount: rows.length };
}

/** Celdas con contenido no vacío (cadena distinta de ""), tal como las ve el gate. */
export function nonEmptyCells(sheet: Sheet): Cell[] {
  return [...sheet.cells.values()].filter((c) => c.value !== "");
}

export function contentRange(sheet: Sheet): string {
  let maxRow = 0;
  let maxCol = 0;
  for (const c of nonEmptyCells(sheet)) {
    maxRow = Math.max(maxRow, c.row);
    maxCol = Math.max(maxCol, c.col);
  }
  return maxRow === 0 ? "" : `A1:${cellRef(maxRow, maxCol)}`;
}
