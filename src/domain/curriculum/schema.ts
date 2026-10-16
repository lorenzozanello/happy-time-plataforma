import { z } from "zod";
import { EXPERIENCE_FIELDS, LEVEL_FIELDS, LEVEL_IDS, PROGRESSION_DIMENSIONS } from "./fields";

/** Esquema canónico de una release curricular compilada (Baseline v1 §6.3). */

const levelId = z.enum(LEVEL_IDS);
const experienceFieldKey = z.enum(EXPERIENCE_FIELDS.map((f) => f.key));
const levelFieldKey = z.enum(LEVEL_FIELDS.map((f) => f.key));
const dimensionKey = z.enum(PROGRESSION_DIMENSIONS.map((d) => d.key));

export const SourceRefSchema = z.strictObject({
  sheet: z.string(),
  cell: z.string().regex(/^[A-Z]{1,3}\d{1,4}$/),
  range: z
    .string()
    .regex(/^[A-Z]{1,3}\d{1,4}:[A-Z]{1,3}\d{1,4}$/)
    .optional(),
  header: z.string(),
});

/**
 * Segmento derivado (ADR-011). Rangos en índices de código UTF-16 sobre `text`.
 * [start, end) cubre el segmento completo; [valueStart, valueEnd) es el valor sin etiqueta.
 * Los segmentos de una unidad son contiguos y cubren el texto completo.
 */
export const SegmentSchema = z.strictObject({
  key: z.string(),
  label: z.string(),
  start: z.int().nonnegative(),
  end: z.int().nonnegative(),
  valueStart: z.int().nonnegative(),
  valueEnd: z.int().nonnegative(),
});

export const UnitKindSchema = z.enum([
  "experience_field",
  "experience_title",
  "level_field",
  "observation",
  "progression",
]);

export const UnitSchema = z.strictObject({
  unitId: z.string(),
  kind: UnitKindSchema,
  fieldKey: z.string(),
  headerLiteral: z.string(),
  text: z.string().min(1),
  source: SourceRefSchema,
  authority: z.literal("official_curriculum"),
  release: z.string(),
  levelId: levelId.optional(),
  code: z.string().optional(),
  segments: z.array(SegmentSchema).optional(),
});

export const LevelSchema = z.strictObject({
  id: levelId,
  codePrefix: z.string(),
  labelLiteral: z.string(),
  progresionLabelLiteral: z.string(),
  aliases: z.array(z.string()),
  fieldUnitIds: z.record(levelFieldKey, z.string()),
  periodCodes: z.array(z.string()).length(4),
});

export const ExperienceSchema = z.strictObject({
  code: z.string().regex(/^(S[123]|K|T)\.[1-4]$/),
  levelId,
  periodIndex: z.int().min(1).max(4),
  periodLiteral: z.string(),
  periodSource: SourceRefSchema,
  titleUnitId: z.string(),
  fieldUnitIds: z.record(experienceFieldKey, z.string()),
});

/**
 * Propósito esencial compartido (derivado, H-15). No es una unidad nueva: su texto es la porción
 * `segmentKey` de cada unidad listada en `unitIds`, idéntica en todas. Para citar, se usa la unidad.
 */
export const PurposeSchema = z.strictObject({
  n: z.int().min(1).max(3),
  text: z.string(),
  derived: z.literal(true),
  segmentKey: z.string(),
  unitIds: z.array(z.string()),
});

export const CurriculumReleaseSchema = z.strictObject({
  schemaVersion: z.literal(1),
  release: z.string(),
  source: z.strictObject({
    file: z.string(),
    certifiedName: z.string(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    sizeBytes: z.int().positive(),
    sheets: z.array(z.string()),
  }),
  compiler: z.strictObject({ name: z.string(), version: z.string() }),
  counts: z.strictObject({
    units: z.int(),
    experienceFields: z.int(),
    experienceTitles: z.int(),
    levelFields: z.int(),
    observations: z.int(),
    progression: z.int(),
  }),
  levels: z.array(LevelSchema).length(5),
  experiences: z.array(ExperienceSchema).length(20),
  observationUnitIds: z.array(z.string()).length(7),
  dimensions: z.array(z.strictObject({ key: dimensionKey, headerLiteral: z.string() })).length(6),
  progression: z.array(z.strictObject({ levelId, dimensionKey, unitId: z.string() })).length(30),
  purposes: z.array(PurposeSchema),
  units: z.array(UnitSchema),
});

export type SourceRef = z.infer<typeof SourceRefSchema>;
export type Segment = z.infer<typeof SegmentSchema>;
export type Unit = z.infer<typeof UnitSchema>;
export type Level = z.infer<typeof LevelSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;
export type CurriculumRelease = z.infer<typeof CurriculumReleaseSchema>;
