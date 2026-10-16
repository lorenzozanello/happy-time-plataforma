/**
 * /api/happy (F5-01, F5-10).
 *
 *   GET  → estado para la interfaz: { enabled, needsCode, provider, release }. Sin secretos.
 *   POST → { mode, message, context, history } con cabecera `x-happy-access` (código del piloto)
 *          y `x-happy-device` (id anónimo del dispositivo, para los límites).
 *          Respuesta `application/x-ndjson`: un evento JSON por línea (meta, block, reset, done, error).
 *
 * Códigos: 400 cuerpo inválido · 401 código ausente o incorrecto · 429 límite alcanzado ·
 * 503 Happy no habilitada. Nunca se registra el texto del mensaje: solo métricas.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { LEVEL_IDS } from "../../../src/domain/curriculum/fields";
import { limitMessage } from "../../../src/domain/happy/limits";
import { ModeSchema } from "../../../src/domain/happy/schema";
import { getRepository } from "../../_server/curriculum";
import { getHappyRuntime, runHappyOnServer } from "../../_server/happy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.strictObject({
  mode: ModeSchema,
  message: z.string().min(1).max(4000),
  context: z
    .strictObject({
      levelId: z.enum(LEVEL_IDS).optional(),
      periodIndex: z.int().min(1).max(4).optional(),
      experienceCode: z.string().max(20).optional(),
    })
    .default({}),
  history: z
    .array(z.strictObject({ role: z.enum(["docente", "happy"]), text: z.string().max(2000) }))
    .max(12)
    .default([]),
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

function codeMatches(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Clave anónima para los límites: id del dispositivo si lo envía; si no, la IP. Nunca se registra en claro. */
function limitKey(req: Request): string {
  const device = req.headers.get("x-happy-device")?.trim().slice(0, 64);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "sin-ip";
  return createHash("sha256")
    .update(device ? `d:${device}` : `ip:${ip}`)
    .digest("hex")
    .slice(0, 16);
}

export function GET(): Response {
  const { config } = getHappyRuntime();
  return json(200, {
    enabled: config.provider !== "off",
    needsCode: Boolean(config.accessCode),
    provider: config.provider,
    release: getRepository().release.release,
  });
}

export async function POST(req: Request): Promise<Response> {
  const rt = getHappyRuntime();
  const { config } = rt;
  if (config.provider === "off" || !rt.model)
    return json(503, {
      error: "disabled",
      message: "Happy no está habilitada en este despliegue.",
    });
  if (config.accessCode && !codeMatches(req.headers.get("x-happy-access"), config.accessCode))
    return json(401, { error: "access", message: "El código de acceso no es válido." });

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return json(400, { error: "invalid", message: "La solicitud no tiene el formato esperado." });
  }

  const key = limitKey(req);
  const allowed = rt.limits.check(key);
  if (!allowed.ok)
    return json(429, {
      error: "limit",
      reason: allowed.reason,
      message: limitMessage(allowed.reason),
    });
  rt.limits.record(key);

  const requestId = createHash("sha256")
    .update(`${key}:${String(Date.now())}:${Math.random()}`)
    .digest("hex")
    .slice(0, 12);
  const encoder = new TextEncoder();
  const c = body.context;
  const events = runHappyOnServer({
    mode: body.mode,
    message: body.message,
    context: {
      ...(c.levelId ? { levelId: c.levelId } : {}),
      ...(c.periodIndex ? { periodIndex: c.periodIndex } : {}),
      ...(c.experienceCode ? { experienceCode: c.experienceCode } : {}),
    },
    history: body.history,
    signal: req.signal,
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const ev of events) {
          if (ev.type === "done" || ev.type === "error") {
            const m = ev.metrics;
            if (m) {
              rt.limits.spend(m.costUsd);
              // Registro estructurado sin texto de la docente (solo métricas).
              console.log(
                JSON.stringify({
                  at: "happy",
                  requestId,
                  key,
                  mode: body.mode,
                  outcome: ev.type === "done" ? "ok" : ev.code,
                  ...m,
                  dropped: m.dropped.length,
                }),
              );
            }
          }
          controller.enqueue(encoder.encode(`${JSON.stringify(ev)}\n`));
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "error";
        controller.enqueue(
          encoder.encode(
            `${JSON.stringify({ type: "error", code: "model", message: "Happy no pudo responder esta vez." })}\n`,
          ),
        );
        console.error(JSON.stringify({ at: "happy", requestId, outcome: "exception", message }));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-request-id": requestId,
    },
  });
}
