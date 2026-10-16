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
export const DEVICE_KEY = "ht.app.dispositivo";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null;

function deviceId(storage: KeyValueStorage): string {
  let id = storage.get(DEVICE_KEY);
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    storage.set(DEVICE_KEY, id);
  }
  return id;
}

export function createHappyAccess(storage: KeyValueStorage): HappyAccess {
  return {
    async status() {
      const r = await fetch("/api/happy", { cache: "no-store" });
      if (!r.ok) throw new HappyError("network", "Estado de Happy no disponible");
      const s = (await r.json()) as unknown;
      if (!isObj(s)) throw new HappyError("network", "Estado de Happy no disponible");
      return {
        enabled: s.enabled === true,
        needsCode: s.needsCode === true,
        hasCode: Boolean(storage.get(ACCESS_KEY)),
      };
    },
    setCode(code) {
      storage.set(ACCESS_KEY, code);
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
      const code = storage.get(ACCESS_KEY);
      const r = await fetch("/api/happy", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(code ? { "x-happy-access": code } : {}),
          "x-happy-device": deviceId(storage),
        },
        body: JSON.stringify({
          mode: req.mode,
          message: req.message,
          context: req.context,
          history: req.history ?? [],
        }),
      });
      if (!r.ok || !r.body) await readError(r);

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
      if (buffer.trim()) handle(buffer.trim());
      if (failure) throw failure;
      if (!result) throw new HappyError("network", "La respuesta de Happy se cortó.");
      return result;
    },
  };
}
