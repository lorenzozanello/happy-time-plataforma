/**
 * Manejador HTTP de /api/happy, independiente del framework (Request → Response) para probarlo
 * sin servidor. La ruta de Next.js solo lo conecta.
 */
import type { CurriculumRepository } from "../../domain/curriculum/repository";
import type { SearchIndex } from "../../domain/curriculum/search";
import { createAnthropicComposer } from "./anthropic";
import type { Composer } from "./composer";
import type { HappyConfig } from "./config";
import { createScriptComposer } from "./guion";
import type { Limiter } from "./limits";
import { runHappy, type HappyLog } from "./pipeline";
import { HappyApiRequestSchema } from "./request";

/** Mensaje (2 000 caracteres) + 6 turnos de historial, con margen para UTF-8 de varios bytes. */
export const MAX_BODY_BYTES = 48 * 1024;

export interface HandlerDeps {
  config: HappyConfig;
  repo: CurriculumRepository;
  index: SearchIndex;
  windows: ReadonlySet<string>;
  shorts?: readonly string[];
  limiter: Limiter;
  /** Inyectable en pruebas; si no, se crea según la configuración. */
  composer?: Composer;
  log?: (entry: HappyLog) => void;
  nowMs?: () => number;
}

const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extra,
    },
  });

/** Disponibilidad para la interfaz (sin detalles internos). */
export function handleStatus(config: HappyConfig): Response {
  return json(200, { disponible: config.enabled });
}

/**
 * IP del cliente para los límites. Solo se confía en cabeceras que pone la plataforma
 * (Vercel: `x-real-ip` / `x-vercel-forwarded-for`, que el cliente no puede fijar). Fuera de
 * Vercel, `X-Forwarded-For` lo controla el cliente: solo se usa si `HAPPY_TRUST_XFF=1`
 * (detrás de un proxy propio que la reescribe). Sin IP fiable, todas comparten la clave.
 */
function clientKey(req: Request, trustXff: boolean): string {
  const platform =
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim();
  if (platform) return platform;
  if (trustXff) return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonimo";
  return "anonimo";
}

/** Lee el cuerpo en streaming y corta al pasar el límite (sin cargar cuerpos enormes). */
async function readLimited(req: Request, max: number): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

/** Solo el propio sitio puede llamar a Happy (sin CORS, sin formularios de terceros). */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") === "same-origin";
  try {
    return (
      new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"))
    );
  } catch {
    return false;
  }
}

function composerFor(config: HappyConfig): Composer {
  if (config.composer === "guion") return createScriptComposer({ delayMs: 40 });
  if (!config.apiKey) throw new Error("Happy sin clave del proveedor");
  return createAnthropicComposer({ apiKey: config.apiKey, model: config.model });
}

export async function handleHappy(req: Request, deps: HandlerDeps): Promise<Response> {
  const { config } = deps;
  if (!config.enabled) return json(503, { error: "Happy no está disponible en este momento." });
  if (!sameOrigin(req)) return json(403, { error: "Solicitud no permitida." });
  if (!(req.headers.get("content-type") ?? "").includes("application/json"))
    return json(415, { error: "Formato no admitido." });
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return json(413, { error: "El mensaje es demasiado largo." });
  const raw = await readLimited(req, MAX_BODY_BYTES);
  if (raw === null) return json(413, { error: "El mensaje es demasiado largo." });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "Solicitud inválida." });
  }
  const parsed = HappyApiRequestSchema.safeParse(body);
  if (!parsed.success) return json(400, { error: "Solicitud inválida." });

  const limit = deps.limiter.check(clientKey(req, config.trustXff), (deps.nowMs ?? Date.now)());
  if (!limit.ok)
    return json(
      429,
      {
        error:
          limit.reason === "ip"
            ? "Muchas solicitudes seguidas. Espera unos minutos."
            : "Happy alcanzó el límite de hoy. Vuelve mañana.",
      },
      { "Retry-After": limit.reason === "ip" ? "120" : "3600" },
    );

  const composer = deps.composer ?? composerFor(config);
  const encoder = new TextEncoder();
  const events = runHappy(parsed.data, {
    repo: deps.repo,
    index: deps.index,
    windows: deps.windows,
    ...(deps.shorts ? { shorts: deps.shorts } : {}),
    composer,
    signal: req.signal,
    ...(deps.log ? { log: deps.log } : {}),
  });
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await events.next();
        if (next.done) controller.close();
        else controller.enqueue(encoder.encode(`${JSON.stringify(next.value)}\n`));
      } catch {
        controller.enqueue(
          encoder.encode(
            `${JSON.stringify({ type: "error", code: "upstream", message: "Happy no pudo responder esta vez." })}\n`,
          ),
        );
        controller.close();
      }
    },
    async cancel() {
      await events.return(undefined);
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
