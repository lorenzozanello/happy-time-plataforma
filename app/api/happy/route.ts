/**
 * /api/happy (F5-01, F5-10).
 *
 *   GET  → estado para la interfaz: { enabled, needsCode, provider, release } y, si la cabecera
 *          `x-happy-access` trae el código del piloto, un `device` firmado para este dispositivo.
 *   POST → { mode, message, context, history } con cabeceras `x-happy-access` (código del piloto)
 *          y `x-happy-device` (id firmado por el servidor; sin él o alterado, cuenta solo por IP con
 *          un límite más estricto). Respuesta `application/x-ndjson`: un evento JSON por línea
 *          (meta, block, reset, done, error).
 *
 * Códigos: 400 cuerpo inválido · 401 código ausente o incorrecto · 429 límite alcanzado ·
 * 503 Happy no habilitada. Nunca se registra el texto del mensaje: solo métricas.
 * Límites (revisión F5, M2): se aplican a la vez por dispositivo firmado y por IP; en serverless
 * son por instancia, por lo que el tope duro vive en la consola del proveedor (ADR-008).
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { LEVEL_IDS } from "../../../src/domain/curriculum/fields";
import { limitMessage, type LimitReason } from "../../../src/domain/happy/limits";
import { ModeSchema } from "../../../src/domain/happy/schema";
import { getRepository } from "../../_server/curriculum";
import { issueDevice, verifyDevice } from "../../_server/device";
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

const sha = (s: string) => createHash("sha256").update(s).digest();

function codeMatches(given: string | null, expected: string): boolean {
  return given ? timingSafeEqual(sha(given), sha(expected)) : false;
}

/** IP del cliente: la que fija la plataforma (Vercel) antes que la cabecera reenviada. */
function clientIp(req: Request): string {
  return (
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "sin-ip"
  );
}

const hashKey = (s: string) => sha(s).toString("hex").slice(0, 16);

export function GET(req: Request): Response {
  const { config } = getHappyRuntime();
  const authorized =
    Boolean(config.accessCode) &&
    codeMatches(req.headers.get("x-happy-access"), config.accessCode ?? "");
  return json(200, {
    enabled: config.provider !== "off",
    needsCode: Boolean(config.accessCode),
    provider: config.provider,
    release: getRepository().release.release,
    // Un dispositivo nuevo recibe su id firmado solo si presenta el código.
    ...(authorized && !verifyDevice(req.headers.get("x-happy-device"))
      ? { device: issueDevice() }
      : {}),
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

  // Límites: por dispositivo firmado (si lo hay) y siempre por IP. Sin dispositivo válido, la IP
  // carga con el límite completo del dispositivo además del suyo.
  const device = verifyDevice(req.headers.get("x-happy-device"));
  const ipKey = hashKey(`ip:${clientIp(req)}`);
  const keys = device ? [hashKey(`d:${device}`), ipKey] : [ipKey, hashKey(`anon:${clientIp(req)}`)];
  let blocked: LimitReason | undefined;
  for (const k of keys) {
    const allowed = rt.limits.check(k);
    if (!allowed.ok) {
      blocked = allowed.reason;
      break;
    }
  }
  if (blocked)
    return json(429, { error: "limit", reason: blocked, message: limitMessage(blocked) });
  for (const k of keys) rt.limits.record(k);

  const requestId = randomBytes(6).toString("hex");
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
              // Registro estructurado sin texto de la docente ni texto generado: solo métricas y motivos.
              console.log(
                JSON.stringify({
                  at: "happy",
                  requestId,
                  key: keys[0],
                  mode: body.mode,
                  outcome: ev.type === "done" ? "ok" : ev.code,
                  ...m,
                  dropped: m.dropped.length,
                  droppedReasons: m.dropped,
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
