import { readFileSync } from "node:fs";
import { z } from "zod";

export const SourceLockSchema = z.object({
  release: z.string().regex(/^\d{4}-\d{2}$/),
  file: z.string(),
  certified_name: z.string(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  size_bytes: z.int().positive(),
  sheets: z.array(z.string()).length(3),
  malla: z.object({
    sheet: z.string(),
    content_range: z.string(),
    headers: z.array(z.string()).length(33),
    nonempty_cells_total: z.int(),
    nonempty_cells_experience_rows: z.int(),
    level_block_rows: z.int(),
    period_codes: z.array(z.string()).length(20),
  }),
  observaciones: z.object({
    sheet: z.string(),
    content_range: z.string(),
    header: z.string(),
    count: z.int(),
  }),
  progresion: z.object({
    sheet: z.string(),
    content_range: z.string(),
    headers: z.array(z.string()).length(7),
    row_labels: z.array(z.string()).length(5),
    count: z.int(),
  }),
});
export type SourceLock = z.infer<typeof SourceLockSchema>;

export const LevelAliasesSchema = z.object({
  levels: z
    .array(
      z.object({
        id: z.enum(["step-1", "step-2", "step-3", "kinder", "transicion"]),
        codePrefix: z.string(),
        mallaLabel: z.string(),
        progresionLabel: z.string(),
        aliases: z.array(z.string()),
      }),
    )
    .length(5),
});
export type LevelAliases = z.infer<typeof LevelAliasesSchema>;

export function loadJson<T>(path: string, schema: z.ZodType<T>): T {
  return schema.parse(JSON.parse(readFileSync(path, "utf8")));
}
