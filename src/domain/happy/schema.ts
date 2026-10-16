/**
 * Contrato de respuesta de Happy (Baseline v1 §8.4, ADR-007).
 * El modelo (o el simulador del prototipo) nunca transcribe texto institucional:
 * referencia unidades por `unitId` y la interfaz pinta el literal.
 */
import { z } from "zod";
import { findCopiedSequence, findCopiedShort } from "../curriculum/fingerprint";
import { normalizeForRules } from "../text/normalize";

export { normalizeForRules };
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
  /** Unidades cortas normalizadas (4–7 palabras): tampoco pueden aparecer enteras. */
  curriculumShorts?: readonly string[];
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

/*
 * Reglas sobre texto normalizado (sin tildes, minúsculas). Endurecidas tras la revisión adversarial
 * de F5: voz pasiva, sujetos institucionales, números en letras, desempeño cualitativo.
 */
const NORMATIVE =
  "(dice|dicen|establece|establecen|indica|indican|exige|exigen|ordena|ordenan|obliga|obligan|plantea|plantean|propone|proponen|senala|senalan|determina|determinan|manda|mandan|pide|piden|orienta|orientan|define|definen|prescribe|prescriben|estipula|estipulan|dispone|disponen|requiere|requieren|contempla|contemplan)";
const MALLA = "(mallas?|curriculo|plan de estudios)";
const CLAIMS_AUTHORITY = [
  new RegExp(
    `\\b(segun|de acuerdo (con|a)|conforme a|como (lo )?${NORMATIVE}|tal como (lo )?\\w+)\\s+(lo (establecido|indicado|dispuesto|planteado|definido) (en|por)\\s+)?(la |las |nuestra |nuestras |el |esta |nuestro )?${MALLA}\\b`,
  ),
  new RegExp(
    `\\b${MALLA}( curricular| institucional| oficial| \\d{4}[- ]?\\d{2}| de happy time| vigente)?\\s+(\\w+\\s+)?${NORMATIVE}\\b`,
  ),
  new RegExp(
    `\\b(se ${NORMATIVE}|(esta|estan) (establecid|indicad|definid|estipulad|planteado|dispuest)\\w*|lo (establecido|indicado|dispuesto|planteado|definido))\\s+(en|por)\\s+(la |las |nuestra |el |nuestro )?(${MALLA}|institucion|happy time)\\b`,
  ),
  new RegExp(`\\ben (la |nuestra )?${MALLA}\\s+(se\\s+)?${NORMATIVE}\\b`),
  new RegExp(
    `\\b(la institucion|happy time|el jardin|el colegio|la coordinacion|la direccion|la rectoria)\\s+(\\w+\\s+)?(exige|exigen|ordena|obliga|establece|dispone|manda|determina|estipula|requiere|prescribe)\\b`,
  ),
  /\bobligatorio cumplimiento\b/,
  /\b(institucional|curricular)mente obligatori/,
  /\bdesde (la|nuestra) malla\b/,
  /\btexto (literal|oficial|institucional)\b/,
  /\b(lineamiento|norma|requisito|mandato|directriz|disposicion) (institucional|oficial|curricular)\b/,
];

const DX =
  "(tea|tdah|tda|autismo|autista|autistas|espectro autista|espectro|asperger|dislexia|dislexic[oa]|discalculia|trastorno|sindrome|deficit|retraso|hiperactividad|hiperactiv[oa]|inatencion|discapacidad intelectual|negativista desafiante)";
const NUM = "(\\d+([.,]\\d+)?|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)";
const FORBIDDEN_OUTPUT = [
  // diagnósticos o sospechas clínicas sobre una persona
  /\bdiagnostico\s*[:=]/,
  /\b(su|el|un|este|ese) diagnostico (es|seria|sera|probable|de)\b/,
  /\bdiagnosticad[oa]s? con\b/,
  new RegExp(
    `\\b(es|son|seria|sera|parece|podria ser|probablemente (es|sea)|claramente es)\\s+(claramente\\s+)?(un caso de |un nino con |una nina con |un |una )?${DX}\\b`,
  ),
  new RegExp(
    `\\b(tiene|tienen|presenta|presentan|muestra|muestran|manifiesta|podria tener|puede tener|probablemente (sea|tenga)|parece tener|sospecha de|sospecho|indicios de|rasgos (de|del)|signos de|sintomas de)\\s+(\\w+\\s+){0,2}${DX}\\b`,
  ),
  /\b(es|son) (un|una)? ?(nino|nina|ninos|ninas)? ?(problema|problematic[oa]s?|agresiv[oa]s?|malcriad[oa]s?|vag[oa]s?)\b/,
  /\bnin[oa]s? problema\b/,
  // calificaciones numéricas o escalas de desempeño
  new RegExp(
    `\\b${NUM}\\s*(\\/|sobre|de)\\s*(5|10|100|cinco|diez|cien)\\b(?!\\s*(anos|meses|minutos|ninos|ninas))`,
  ),
  new RegExp(
    `\\b(su|la|una|tu) (nota|calificacion|puntaje|puntuacion)( final)?\\s*(es|sera|seria|:|=|de)\\s*${NUM}\\b`,
  ),
  /\b(nota|calificacion|puntaje)\s*[:=]/,
  /\b(calificacion|valoracion|nivel de logro|desempeno|nivel de desempeno)\s*(es|fue|sera|seria|:|=)?\s*(bajo|basico|alto|superior|insuficiente|deficiente|aceptable|sobresaliente|excelente)\b/,
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
  opts: Pick<ValidationOptions, "curriculumWindows" | "curriculumShorts">,
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
  if (opts.curriculumShorts) {
    const short = findCopiedShort(t, opts.curriculumShorts);
    if (short) errors.push(`texto generado copia la malla: "${short}"`);
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
  const strings = blockStrings(b);
  for (const t of strings) errors.push(...textErrors(t, opts));
  // Una frase partida entre campos (p. ej. dos pasos) se revisa también unida.
  if (strings.length > 1 && errors.length === 0)
    errors.push(...textErrors(strings.join(" "), opts));
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
  if (a.payload) errors.push(...textErrors(a.payload, opts));
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
