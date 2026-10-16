/**
 * /api/happy — GET: disponibilidad; POST: respuesta en streaming (NDJSON).
 * Toda la lógica vive en src/server/happy (probada sin servidor).
 */
import { readHappyConfig } from "../../../src/server/happy/config";
import { handleHappy, handleStatus } from "../../../src/server/happy/handler";
import { createLimiter, type Limiter } from "../../../src/server/happy/limits";
import { getCurriculumWindows, getRepository, getSearchIndex } from "../../_server/curriculum";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

let limiter: Limiter | undefined;

export function GET() {
  return handleStatus(readHappyConfig());
}

export async function POST(req: Request) {
  const config = readHappyConfig();
  limiter ??= createLimiter({
    perKey: config.perIpLimit,
    windowMs: config.perIpWindowMs,
    daily: config.dailyLimit,
  });
  return handleHappy(req, {
    config,
    repo: getRepository(),
    index: getSearchIndex(),
    windows: getCurriculumWindows(),
    limiter,
    log: (entry) => {
      // Registro operativo sin el texto de la docente (§8.5 minimización).
      console.info(JSON.stringify({ happy: entry }));
    },
  });
}
