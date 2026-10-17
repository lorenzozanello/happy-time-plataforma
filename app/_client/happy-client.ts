"use client";
/**
 * Cliente de /api/happy para la app (F5): envía el mensaje, lee el NDJSON a medida que llega y
 * entrega bloques parciales a la pantalla. Valida la forma de cada evento sin Zod (shape.ts):
 * nada que no tenga la forma esperada llega a la interfaz.
 */
import type { Unit } from "../../src/domain/curriculum/schema";
import type { HappyMetrics } from "../../src/domain/happy/pipeline";
import type { HappyResponse } from "../../src/domain/happy/schema";
import {
  isActionShape,
  isBlockShape,
  isHappyResponseShape,
  isMetricsShape,
  isUnitShape,
} from "../../src/domain/happy/shape";
import {
  HappyError,
  type HappyAccess,
  type HappyService,
  type KeyValueStorage,
} from "../../src/ui/app/types";

export const ACCESS_KEY = "ht.app.happy.acceso";
/** Id de dispositivo firmado por el servidor (lo emite GET /api/happy al presentar el código). */
export const DEVICE_KEY = "ht.app.happy.dispositivo";

/** Tiempo máximo hasta el primer byte y total de una respuesta (revisión F5, M6). */
export const FIRST_BYTE_TIMEOUT_MS = 45_000;
export const TOTAL_TIMEOUT_MS = 90_000;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null;

function authHeaders(storage: KeyValueStorage): Record<string, string> {
  const code = storage.get(ACCESS_KEY);
  const device = storage.get(DEVICE_KEY);
  return {
    ...(code ? { "x-happy-access": code } : {}),
    ...(device ? { "x-happy-device": device } : {}),
  };
}

export function createHappyAccess(storage: KeyValueStorage): HappyAccess {
  return {
    async status() {
      const r = await fetch("/api/happy", { cache: "no-store", headers: authHeaders(storage) });
      if (!r.ok) throw new HappyError("network", "Estado de Happy no disponible");
      const s = (await r.json()) as unknown;
      if (!isObj(s)) throw new HappyError("network", "Estado de Happy no disponible");
      if (typeof s.device === "string" && s.device.length <= 80) storage.set(DEVICE_KEY, s.device);
      return {
        enabled: s.enabled === true,
        needsCode: s.needsCode === true,
        hasCode: Boolean(storage.get(ACCESS_KEY)),
      };
    },
    setCode(code) {
      storage.set(ACCESS_KEY, code);
      storage.remove(DEVICE_KEY); // el siguiente estado emite un dispositivo para este código
    },
  };
}

async function readError(r: Response): Promise<never> {
  let body: unknown;
  try {
    body = await r.json();
  } catch {
    body = undefined;
  }
  const message = isObj(body) && typeof body.message === "string" ? body.message : "";
  if (r.status === 401)
    throw new HappyError("access", message || "El código de acceso no es válido.");
  if (r.status === 429) throw new HappyError("limit", message || "Happy alcanzó un límite de uso.");
  if (r.status === 503) throw new HappyError("disabled", message || "Happy no está habilitada.");
  if (r.status === 400) throw new HappyError("invalid", message || "Solicitud inválida.");
  throw new HappyError("network", message || `Happy no respondió (${String(r.status)}).`);
}

export function createHappyClient(storage: KeyValueStorage): HappyService {
  return {
    async respond(req, onProgress) {
      // Cancelación: por la docente (req.signal) o por tiempo (primer byte / total).
      const controller = new AbortController();
      let why: "cancelled" | "timeout" | undefined;
      const abort = (reason: "cancelled" | "timeout") => {
        why ??= reason;
        controller.abort();
      };
      req.signal?.addEventListener("abort", () => {
        abort("cancelled");
      });
      if (req.signal?.aborted) abort("cancelled");
      const firstByte = setTimeout(() => {
        abort("timeout");
      }, FIRST_BYTE_TIMEOUT_MS);
      const total = setTimeout(() => {
        abort("timeout");
      }, TOTAL_TIMEOUT_MS);
      const fail = (e: unknown): never => {
        if (why === "cancelled") throw new HappyError("cancelled", "Respuesta cancelada.");
        if (why === "timeout")
          throw new HappyError(
            "timeout",
            "Happy tardó demasiado en responder. Vuelve a intentarlo.",
          );
        if (e instanceof HappyError) throw e;
        throw new HappyError(
          "network",
          "No hay conexión con Happy. Revisa tu red e inténtalo de nuevo.",
        );
      };

      let r: Response;
      try {
        r = await fetch("/api/happy", {
          method: "POST",
          headers: { "content-type": "application/json", ...authHeaders(storage) },
          body: JSON.stringify({
            mode: req.mode,
            message: req.message,
            context: req.context,
            history: req.history ?? [],
          }),
          signal: controller.signal,
        });
      } catch (e) {
        clearTimeout(firstByte);
        clearTimeout(total);
        return fail(e);
      }
      clearTimeout(firstByte);
      if (!r.ok || !r.body) {
        clearTimeout(total);
        await readError(r);
      }

      const reader = (r.body as ReadableStream<Uint8Array>).getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let blocks: HappyResponse["blocks"] = [];
      const units = new Map<string, Unit>();
      let result: { response: HappyResponse; units: Unit[]; metrics?: HappyMetrics } | undefined;
      let failure: HappyError | undefined;

      const handle = (line: string) => {
        let ev: unknown;
        try {
          ev = JSON.parse(line);
        } catch {
          return;
        }
        if (!isObj(ev)) return;
        switch (ev.type) {
          case "block": {
            if (!isBlockShape(ev.block)) return;
            for (const u of Array.isArray(ev.units) ? ev.units : [])
              if (isUnitShape(u)) units.set(u.unitId, u);
            blocks = [...blocks, ev.block];
            onProgress({
              response: { mode: req.mode, blocks, nextActions: [] },
              units: [...units.values()],
            });
            return;
          }
          case "reset":
            blocks = [];
            units.clear();
            return;
          case "done": {
            const response = ev.response;
            if (!isHappyResponseShape(response)) {
              failure = new HappyError(
                "invalid",
                "Happy devolvió una respuesta que no se pudo leer.",
              );
              return;
            }
            const us = (Array.isArray(ev.units) ? ev.units : []).filter(isUnitShape);
            const metrics = isMetricsShape(ev.metrics) ? ev.metrics : undefined;
            result = {
              response: { ...response, nextActions: response.nextActions.filter(isActionShape) },
              units: us,
              ...(metrics ? { metrics } : {}),
            };
            return;
          }
          case "error": {
            const code = ev.code === "aborted" ? "network" : "invalid";
            failure = new HappyError(
              code,
              typeof ev.message === "string" ? ev.message : "Happy no pudo responder.",
            );
            return;
          }
          default:
            return;
        }
      };

      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl = buffer.indexOf("\n");
          while (nl !== -1) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (line) handle(line);
            nl = buffer.indexOf("\n");
          }
        }
      } catch (e) {
        return fail(e);
      } finally {
        clearTimeout(total);
      }
      if (buffer.trim()) handle(buffer.trim());
      if (failure) throw failure;
      if (!result) throw new HappyError("network", "La respuesta de Happy se cortó.");
      return result;
    },
  };
}
