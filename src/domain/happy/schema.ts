/**
 * Contrato de respuesta de Happy (Baseline v1 §8.4, ADR-007).
 * El modelo (o el simulador del prototipo) nunca transcribe texto institucional:
 * referencia unidades por `unitId` y la interfaz pinta el literal.
 */
import { z } from "zod";
import { findCopiedSequence } from "../curriculum/fingerprint";
import { textRuleErrors } from "./rules";
import { MODES, type Mode } from "./modes";

export const ModeSchema = z.enum(MODES);
export type { Mode };

/** Modos disponibles en la v1 (los demás llegan en F6). */
export const V1_MODES = [
  "explorar",
  "aterrizar",
  "conectar",
  "general",
] as const satisfies readonly Mode[];

const short = z.string().trim().min(1).max(160);
const text = z.string().trim().min(1).max(1200);

export const BlockSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("malla_ref"),
    unitId: z.string().min(1).max(80),
    segment: z.string().min(1).max(40).optional(),
    /** Comentario generado sobre por qué esta unidad es pertinente. Se muestra como generado. */
    why: text,
  }),
  z.strictObject({
    kind: z.literal("paths"),
    paths: z
      .array(z.strictObject({ title: short, summary: text }))
      .min(1)
      .max(3),
  }),
  z.strictObject({ kind: z.literal("steps"), title: short, items: z.array(text).min(1).max(8) }),
  z.strictObject({ kind: z.literal("idea"), text }),
  z.strictObject({ kind: z.literal("question"), text }),
  z.strictObject({
    kind: z.literal("notice"),
    code: z.enum(["privacy", "out_of_scope", "no_match"]),
    text,
  }),
]);
export type Block = z.infer<typeof BlockSchema>;

export const ActionSchema = z.strictObject({
  id: z.string().min(1).max(40),
  label: short,
  kind: z.enum(["send", "open_experience", "save_idea"]),
  payload: z.string().max(400).optional(),
});
export type Action = z.infer<typeof ActionSchema>;

export const HappyResponseSchema = z.strictObject({
  mode: ModeSchema,
  blocks: z.array(BlockSchema).min(1).max(8),
  nextActions: z.array(ActionSchema).max(4),
});
export type HappyResponse = z.infer<typeof HappyResponseSchema>;

/** Contexto curricular activo que la docente ve como chips y puede quitar. */
export interface HappyContext {
  levelId?: string;
  periodIndex?: number;
  experienceCode?: string;
}

export const MAX_PATHS = 3;

export interface ValidationOptions {
  unitExists: (id: string) => boolean;
  segmentExists?: (unitId: string, segment: string) => boolean;
  experienceExists?: (code: string) => boolean;
  /** Unidades recuperadas para esta respuesta; si se da, toda cita debe pertenecer al conjunto. */
  retrieved?: ReadonlySet<string>;
  /** Secuencias de 8 palabras de la malla: el texto generado no puede copiarlas. */
  curriculumWindows?: ReadonlySet<string>;
  allowedModes?: readonly Mode[];
  /** true cuando lo validado viene del modelo: no puede emitir el aviso de privacidad. */
  modelOutput?: boolean;
}

/** Todo el texto que el modelo redacta (y que por lo tanto es generado). */
export function generatedStrings(r: HappyResponse): string[] {
  const out: string[] = [];
  for (const b of r.blocks) {
    if (b.kind === "malla_ref") out.push(b.why);
    else if (b.kind === "paths") out.push(...b.paths.flatMap((p) => [p.title, p.summary]));
    else if (b.kind === "steps") out.push(b.title, ...b.items);
    else out.push(b.text);
  }
  for (const a of r.nextActions) {
    out.push(a.label);
    if (a.payload && a.kind === "send") out.push(a.payload);
  }
  return out;
}

/** Todo el texto generado de un solo bloque. */
export function blockStrings(b: Block): string[] {
  if (b.kind === "malla_ref") return [b.why];
  if (b.kind === "paths") return b.paths.flatMap((p) => [p.title, p.summary]);
  if (b.kind === "steps") return [b.title, ...b.items];
  return [b.text];
}

/** Compatibilidad: las reglas viven en rules.ts. */
export { normalizeForRules } from "./rules";

/** Reglas sobre un texto generado: autoridad, diagnóstico/calificación y copia literal. */
export function generatedTextErrors(
  t: string,
  opts: Pick<ValidationOptions, "curriculumWindows">,
): string[] {
  const errors = textRuleErrors(t);
  if (opts.curriculumWindows) {
    const copied = findCopiedSequence(t, opts.curriculumWindows);
    if (copied) errors.push(`texto generado copia la malla: "${copied}"`);
  }
  return errors;
}

/**
 * Validación de un solo bloque (se usa durante el streaming, antes de mostrarlo). Comprueba el
 * esquema, la existencia y recuperación de la unidad citada, el segmento y las reglas de texto.
 * El aviso de privacidad solo lo emite el servidor, nunca el modelo.
 */
export function validateBlock(
  raw: unknown,
  opts: ValidationOptions,
): { ok: true; block: Block } | { ok: false; errors: string[] } {
  const parsed = BlockSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `bloque ${i.path.join(".")}: ${i.message}`),
    };
  const b = parsed.data;
  const errors: string[] = [];
  if (b.kind === "malla_ref") {
    if (!opts.unitExists(b.unitId)) errors.push(`unitId inexistente: ${b.unitId}`);
    else if (opts.retrieved && !opts.retrieved.has(b.unitId))
      errors.push(`unitId no recuperado: ${b.unitId}`);
    if (b.segment && opts.segmentExists && !opts.segmentExists(b.unitId, b.segment))
      errors.push(`segmento inexistente: ${b.unitId}/${b.segment}`);
  }
  if (b.kind === "notice" && b.code === "privacy" && opts.modelOutput)
    errors.push("el modelo no puede emitir el aviso de privacidad");
  for (const t of blockStrings(b)) errors.push(...generatedTextErrors(t, opts));
  return errors.length ? { ok: false, errors } : { ok: true, block: b };
}

/** Validación de una acción sugerida. */
export function validateAction(
  raw: unknown,
  opts: ValidationOptions,
): { ok: true; action: Action } | { ok: false; errors: string[] } {
  const parsed = ActionSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `acción ${i.path.join(".")}: ${i.message}`),
    };
  const a = parsed.data;
  const errors: string[] = [];
  if (
    a.kind === "open_experience" &&
    opts.experienceExists &&
    !opts.experienceExists(a.payload ?? "")
  )
    errors.push(`acción hacia una experiencia inexistente: ${a.payload ?? ""}`);
  errors.push(...generatedTextErrors(a.label, opts));
  if (a.payload && a.kind === "send") errors.push(...generatedTextErrors(a.payload, opts));
  return errors.length ? { ok: false, errors } : { ok: true, action: a };
}

/**
 * Validación posterior a la generación (§8.4). Devuelve errores legibles; la capa de servicio
 * reintenta una vez y, si persiste, descarta la respuesta.
 */
export function validateResponse(
  raw: unknown,
  opts: ValidationOptions,
): { ok: true; response: HappyResponse } | { ok: false; errors: string[] } {
  const parsed = HappyResponseSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  const r = parsed.data;
  const errors: string[] = [];

  if (opts.allowedModes && !opts.allowedModes.includes(r.mode))
    errors.push(`modo no habilitado: ${r.mode}`);

  const totalPaths = r.blocks.reduce((n, b) => n + (b.kind === "paths" ? b.paths.length : 0), 0);
  if (totalPaths > MAX_PATHS)
    errors.push(`más de ${MAX_PATHS} caminos en la respuesta (${totalPaths})`);

  for (const b of r.blocks) {
    const v = validateBlock(b, opts);
    if (!v.ok) errors.push(...v.errors);
  }
  for (const a of r.nextActions) {
    const v = validateAction(a, opts);
    if (!v.ok) errors.push(...v.errors);
  }
  return errors.length ? { ok: false, errors } : { ok: true, response: r };
}
