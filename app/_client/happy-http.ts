"use client";
/**
 * Happy por HTTP: POST /api/happy y lectura del streaming (NDJSON) evento por evento.
 * Los bloques llegan ya validados por el servidor, con el literal de cada cita.
 */
import type { Unit } from "../../src/domain/curriculum/schema";
import type { Action, Block, HappyResponse, Mode } from "../../src/domain/happy/schema";
import { HappyUserError, type HappyReply, type HappyService } from "../../src/ui/app/types";

type Event =
  | { type: "meta"; mode: Mode }
  | { type: "block"; block: Block; units: Unit[] }
  | { type: "done"; nextActions: Action[] }
  | { type: "error"; message: string };

const TIMEOUT_MS = 60_000;

export function createHttpHappyService(endpoint = "/api/happy"): HappyService {
  return {
    async respond(req, onProgress) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => {
        ctrl.abort();
      }, TIMEOUT_MS);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: req.mode,
            message: req.message,
            context: req.context,
            history: req.history ?? [],
          }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const msg = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new HappyUserError(msg?.error ?? "Happy no pudo responder esta vez.");
        }
        let mode: Mode = req.mode;
        const blocks: Block[] = [];
        const units = new Map<string, Unit>();
        const reply = (nextActions: Action[]): HappyReply => {
          const response: HappyResponse = { mode, blocks: [...blocks], nextActions };
          return { response, units: [...units.values()] };
        };
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (value) buffer += value;
          let nl = buffer.indexOf("\n");
          while (nl !== -1) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            nl = buffer.indexOf("\n");
            if (!line) continue;
            const ev = JSON.parse(line) as Event;
            if (ev.type === "meta") mode = ev.mode;
            else if (ev.type === "block") {
              blocks.push(ev.block);
              for (const u of ev.units) units.set(u.unitId, u);
              onProgress(reply([]));
            } else if (ev.type === "error") throw new HappyUserError(ev.message);
            else return reply(ev.nextActions);
          }
          if (done) break;
        }
        throw new HappyUserError("La respuesta de Happy se interrumpió.");
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
