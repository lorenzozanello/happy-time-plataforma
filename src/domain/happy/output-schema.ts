/**
 * Esquema JSON que el modelo debe producir (salida estructurada, `output_config.format`).
 *
 * Es deliberadamente más simple que `HappyResponseSchema` (Zod): solo usa lo que la API de salida
 * estructurada admite (objetos cerrados, `anyOf`, `const`, `enum`, `required`), sin límites de
 * longitud ni de cantidad. Los límites, la existencia de unidades, la política y el modo los
 * impone después el validador (`validateResponse`). El modelo nunca emite `mode` ni el aviso de
 * privacidad: ambos los pone el servidor.
 */
export const MODEL_OUTPUT_SCHEMA_VERSION = "happy-output-v1";

const text = { type: "string" } as const;

const closed = <P extends Record<string, unknown>>(properties: P, required: (keyof P & string)[]) =>
  ({ type: "object", properties, required, additionalProperties: false }) as const;

export const MODEL_OUTPUT_SCHEMA = closed(
  {
    blocks: {
      type: "array",
      items: {
        anyOf: [
          closed(
            {
              kind: { const: "malla_ref" },
              unitId: text,
              why: text,
              segment: text,
            },
            ["kind", "unitId", "why"],
          ),
          closed(
            {
              kind: { const: "paths" },
              paths: {
                type: "array",
                items: closed({ title: text, summary: text }, ["title", "summary"]),
              },
            },
            ["kind", "paths"],
          ),
          closed({ kind: { const: "steps" }, title: text, items: { type: "array", items: text } }, [
            "kind",
            "title",
            "items",
          ]),
          closed({ kind: { const: "idea" }, text }, ["kind", "text"]),
          closed({ kind: { const: "question" }, text }, ["kind", "text"]),
          closed(
            { kind: { const: "notice" }, code: { enum: ["out_of_scope", "no_match"] }, text },
            ["kind", "code", "text"],
          ),
        ],
      },
    },
    nextActions: {
      type: "array",
      items: closed(
        {
          id: text,
          label: text,
          kind: { enum: ["send", "open_experience", "save_idea"] },
          payload: text,
        },
        ["id", "label", "kind"],
      ),
    },
  },
  ["blocks", "nextActions"],
);

export type ModelOutputSchema = typeof MODEL_OUTPUT_SCHEMA;

/** Palabras clave de JSON Schema que la salida estructurada admite (cualquier otra es un error). */
export const SUPPORTED_SCHEMA_KEYWORDS = new Set([
  "type",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "anyOf",
  "const",
  "enum",
  "description",
]);

/** Recorre un esquema y devuelve las palabras clave no admitidas que encuentre. */
export function unsupportedSchemaKeywords(schema: unknown, path = "$"): string[] {
  if (Array.isArray(schema))
    return schema.flatMap((s, i) => unsupportedSchemaKeywords(s, `${path}[${i}]`));
  if (typeof schema !== "object" || schema === null) return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(schema)) {
    if (k === "properties" && typeof v === "object" && v !== null) {
      for (const [name, sub] of Object.entries(v as Record<string, unknown>))
        out.push(...unsupportedSchemaKeywords(sub, `${path}.properties.${name}`));
      continue;
    }
    if (k === "required" || k === "enum" || k === "const" || k === "type" || k === "description")
      continue;
    if (!SUPPORTED_SCHEMA_KEYWORDS.has(k)) out.push(`${path}.${k}`);
    else out.push(...unsupportedSchemaKeywords(v, `${path}.${k}`));
  }
  if (
    (schema as { type?: unknown }).type === "object" &&
    (schema as { additionalProperties?: unknown }).additionalProperties !== false
  )
    out.push(`${path}: additionalProperties debe ser false`);
  return out;
}
