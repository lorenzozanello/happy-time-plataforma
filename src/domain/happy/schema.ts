/**
 * Contrato de respuesta de Happy (Baseline v1 §8.4, ADR-007).
 * El modelo (o el simulador del prototipo) nunca transcribe texto institucional:
 * referencia unidades por `unitId` y la interfaz pinta el literal.
 */
import { z } from "zod";
import { findCopiedSequence } from "../curriculum/fingerprint";
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
  out.push(...r.nextActions.map((a) => a.label));
  return out;
}

/**
 * Normaliza para comparar reglas: compatibilidad Unicode, sin caracteres invisibles, homoglifos
 * cirílicos/griegos comunes plegados, sin tildes, minúsculas y espacios simples.
 */
export function normalizeForRules(s: string): string {
  const confusables: Record<string, string> = {
    а: "a",
    е: "e",
    о: "o",
    р: "p",
    с: "c",
    у: "y",
    х: "x",
    і: "i",
    ј: "j",
    ѕ: "s",
    А: "a",
    Е: "e",
    О: "o",
    Р: "p",
    С: "c",
    Х: "x",
    І: "i",
    Т: "t",
    М: "m",
    Н: "h",
    К: "k",
    В: "b",
    α: "a",
    ο: "o",
    ε: "e",
    ι: "i",
    ν: "v",
    ρ: "p",
    τ: "t",
  };
  return s
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u2060\uFEFF\u00AD]/g, "")
    .replace(/[\u0370-\u03FF\u0400-\u04FF]/g, (c) => confusables[c] ?? c)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const CLAIMS_AUTHORITY = [
  /\b(segun|de acuerdo con|conforme a|como (dice|indica|establece))\s+(la|las|nuestra|el)\s+(malla|mallas|curriculo)\b/,
  /\b(la|las|nuestra|nuestras)\s+mallas?\s+(oficial\s+|institucional\s+)?(dice|dicen|establece|establecen|indica|indican|exige|exigen|ordena|ordenan|plantea|plantean|propone|proponen|senala|senalan|determina|determinan|manda|pide)\b/,
  /\bel curriculo\s+(oficial|institucional)?\s*(dice|establece|indica|exige)\b/,
  /\bdesde (la|nuestra) malla\b/,
  /\btexto (literal|oficial) de la malla\b/,
  /\b(lineamiento|norma|requisito) (institucional|oficial)\b/,
];

const FORBIDDEN_OUTPUT = [
  // diagnósticos o sospechas clínicas sobre una persona
  /\bdiagnostic[oa]\s*[:=]/,
  /\b(tiene|presenta|podria tener|puede tener|probablemente (sea|tenga)|parece tener|sospecha de|sospecho|rasgos|signos de)\s+(un |una |el |la )?(tea|tdah|autismo|autista|autistas|dislexia|discalculia|trastorno|sindrome|deficit|retraso)\b/,
  /\b(es|parece|seria) (autista|hiperactiv[oa]|dislexic[oa])\b/,
  // calificaciones numéricas o escalas de desempeño
  /\b\d+([.,]\d+)?\s*(\/|sobre|de)\s*(5|10|100)\b/,
  /\bnota\s*(es|de|final|:|=)\s*\d/,
  /\bcalificacion\s*[:=]/,
  /\b(desempeno|nivel de desempeno)\s+(bajo|basico|alto|superior)\b/,
  /\b(reprueba|reprobo|pierde el (ano|grado))\b/,
];

/** Texto que redacta el modelo dentro de un bloque. */
export function blockStrings(b: Block): string[] {
  if (b.kind === "malla_ref") return [b.why];
  if (b.kind === "paths") return b.paths.flatMap((p) => [p.title, p.summary]);
  if (b.kind === "steps") return [b.title, ...b.items];
  return [b.text];
}

/** Reglas sobre texto generado: autoridad institucional, diagnóstico/calificación, copia. */
export function textErrors(
  t: string,
  opts: Pick<ValidationOptions, "curriculumWindows">,
): string[] {
  const errors: string[] = [];
  const n = normalizeForRules(t);
  if (CLAIMS_AUTHORITY.some((re) => re.test(n)))
    errors.push(`texto generado reclama autoridad: "${t}"`);
  if (FORBIDDEN_OUTPUT.some((re) => re.test(n)))
    errors.push(`texto generado con diagnóstico o calificación: "${t}"`);
  if (opts.curriculumWindows) {
    const copied = findCopiedSequence(t, opts.curriculumWindows);
    if (copied) errors.push(`texto generado copia la malla: "${copied}"`);
  }
  return errors;
}

/**
 * Valida un bloque aislado (para mostrarlo en streaming apenas llega). No cubre las reglas de
 * conjunto (total de caminos), que aplica `validateResponse` o el pipeline del servidor.
 */
export function validateBlock(
  raw: unknown,
  opts: ValidationOptions,
): { ok: true; block: Block } | { ok: false; errors: string[] } {
  const parsed = BlockSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
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
  for (const t of blockStrings(b)) errors.push(...textErrors(t, opts));
  return errors.length ? { ok: false, errors } : { ok: true, block: b };
}

/** Valida una acción sugerida (etiqueta generada y destino). */
export function validateAction(
  raw: unknown,
  opts: ValidationOptions,
): { ok: true; action: Action } | { ok: false; errors: string[] } {
  const parsed = ActionSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  const a = parsed.data;
  const errors = textErrors(a.label, opts);
  if (
    a.kind === "open_experience" &&
    opts.experienceExists &&
    !opts.experienceExists(a.payload ?? "")
  )
    errors.push(`acción hacia una experiencia inexistente: ${a.payload ?? ""}`);
  if (a.payload && a.kind === "send") errors.push(...textErrors(a.payload, opts));
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
