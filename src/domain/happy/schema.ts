/**
 * Contrato de respuesta de Happy (Baseline v1 §8.4, ADR-007).
 * El modelo (o el simulador del prototipo) nunca transcribe texto institucional:
 * referencia unidades por `unitId` y la interfaz pinta el literal.
 */
import { z } from "zod";

export const ModeSchema = z.enum([
  "explorar",
  "aterrizar",
  "conectar",
  "adaptar",
  "observar",
  "registrar",
  "general",
]);
export type Mode = z.infer<typeof ModeSchema>;

/** Modos disponibles en la v1 (los demás llegan en F6). */
export const V1_MODES = ["explorar", "aterrizar", "conectar"] as const satisfies readonly Mode[];

export const BlockSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("malla_ref"),
    unitId: z.string(),
    segment: z.string().optional(),
    /** Comentario generado sobre por qué esta unidad es pertinente. Se muestra como generado. */
    why: z.string(),
  }),
  z.strictObject({
    kind: z.literal("paths"),
    paths: z
      .array(z.strictObject({ title: z.string().min(1), summary: z.string().min(1) }))
      .min(1)
      .max(3),
  }),
  z.strictObject({
    kind: z.literal("steps"),
    title: z.string(),
    items: z.array(z.string().min(1)).min(1),
  }),
  z.strictObject({ kind: z.literal("idea"), text: z.string().min(1) }),
  z.strictObject({ kind: z.literal("question"), text: z.string().min(1) }),
  z.strictObject({
    kind: z.literal("notice"),
    code: z.enum(["privacy", "out_of_scope", "no_match"]),
    text: z.string().min(1),
  }),
]);
export type Block = z.infer<typeof BlockSchema>;

export const ActionSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["send", "open_experience", "save_idea"]),
  payload: z.string().optional(),
});
export type Action = z.infer<typeof ActionSchema>;

export const HappyResponseSchema = z.strictObject({
  mode: ModeSchema,
  blocks: z.array(BlockSchema).min(1),
  nextActions: z.array(ActionSchema).max(4),
});
export type HappyResponse = z.infer<typeof HappyResponseSchema>;

/** Contexto curricular activo que la docente ve como chips y puede quitar. */
export interface HappyContext {
  levelId?: string;
  periodIndex?: number;
  experienceCode?: string;
}

/**
 * Validación posterior a la generación (§8.4): esquema, unidades existentes y recuperadas,
 * y ningún bloque generado reclamando autoridad institucional.
 */
export function validateResponse(
  raw: unknown,
  opts: { unitExists: (id: string) => boolean; retrieved?: ReadonlySet<string> },
): { ok: true; response: HappyResponse } | { ok: false; errors: string[] } {
  const parsed = HappyResponseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const errors: string[] = [];
  for (const b of parsed.data.blocks) {
    if (b.kind === "malla_ref") {
      if (!opts.unitExists(b.unitId)) errors.push(`unitId inexistente: ${b.unitId}`);
      else if (opts.retrieved && !opts.retrieved.has(b.unitId))
        errors.push(`unitId no recuperado: ${b.unitId}`);
    }
    const generated =
      b.kind === "idea" || b.kind === "question"
        ? [b.text]
        : b.kind === "paths"
          ? b.paths.flatMap((p) => [p.title, p.summary])
          : b.kind === "steps"
            ? [b.title, ...b.items]
            : b.kind === "malla_ref"
              ? [b.why]
              : [];
    for (const t of generated) {
      if (CLAIMS_AUTHORITY.test(t)) errors.push(`texto generado reclama autoridad: "${t}"`);
      if (FORBIDDEN_OUTPUT.test(t))
        errors.push(`texto generado con diagnóstico o calificación: "${t}"`);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, response: parsed.data };
}

const CLAIMS_AUTHORITY =
  /\b(la malla (dice|establece|indica|exige|ordena)|desde nuestra malla|seg[uú]n la malla oficial)\b/i;
const FORBIDDEN_OUTPUT =
  /\b(diagn[oó]stico de|tiene (autismo|tdah|tea)|nota (de|final)|calificaci[oó]n de \d|\d(\.\d)?\s*\/\s*5)\b/i;
