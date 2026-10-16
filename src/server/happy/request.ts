/**
 * Contrato de la petición a /api/happy. Todo lo que llega del navegador es no confiable:
 * se valida con límites estrictos antes de tocar la malla o el modelo.
 */
import { z } from "zod";
import { ModeSchema } from "../../domain/happy/schema";

export const MAX_MESSAGE = 2000;
export const MAX_HISTORY_TURNS = 6;

export const HappyApiRequestSchema = z.strictObject({
  /** Intención elegida en la interfaz; "general" o ausente = texto libre (lo clasifica el router). */
  mode: ModeSchema.optional(),
  message: z.string().trim().min(1).max(MAX_MESSAGE),
  context: z
    .strictObject({
      levelId: z.string().max(20).optional(),
      periodIndex: z.number().int().min(1).max(4).optional(),
      experienceCode: z.string().max(10).optional(),
    })
    .default({}),
  /** Últimos turnos del hilo, ya redactados en el navegador (se vuelven a revisar aquí). */
  history: z
    .array(
      z.strictObject({
        role: z.enum(["docente", "happy"]),
        text: z.string().max(1500),
      }),
    )
    .max(MAX_HISTORY_TURNS)
    .default([]),
});
export type HappyApiRequest = z.infer<typeof HappyApiRequestSchema>;
