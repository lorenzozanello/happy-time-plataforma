/** Servicios del prototipo: autenticación simulada, Happy simulada y almacenamiento del navegador. */
import type { CurriculumRepository } from "../src/domain/curriculum/repository";
import type { SearchIndex } from "../src/domain/curriculum/search";
import type { KeyValueStorage, Services } from "../src/ui/app/types";
import { createHappySimulator, type SimulatorControls } from "./happy-simulator";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** localStorage protegido: si el navegador lo bloquea, el prototipo sigue en memoria. */
export function browserStorage(): KeyValueStorage {
  const memory = new Map<string, string>();
  const safe = <T>(fn: () => T, fallback: T): T => {
    try {
      return fn();
    } catch {
      return fallback;
    }
  };
  return {
    get: (k) =>
      safe(() => window.localStorage.getItem(k), memory.get(k) ?? null) ?? memory.get(k) ?? null,
    set: (k, v) => {
      memory.set(k, v);
      safe(() => {
        window.localStorage.setItem(k, v);
      }, undefined);
    },
    remove: (k) => {
      memory.delete(k);
      safe(() => {
        window.localStorage.removeItem(k);
      }, undefined);
    },
  };
}

export function createPrototypeServices(
  repo: CurriculumRepository,
  index: SearchIndex,
  opts: { fast?: boolean } = {},
): Services {
  const controls: SimulatorControls = {
    failNext: false,
    firstBlockDelay: opts.fast ? 0 : 700,
    blockDelay: opts.fast ? 0 : 280,
  };
  return {
    auth: {
      async requestCode() {
        await sleep(opts.fast ? 0 : 400);
      },
      async verifyCode(email, code) {
        await sleep(opts.fast ? 0 : 400);
        if (code === "000000") throw new Error("código vencido");
        return { email, role: "docente" };
      },
    },
    happy: createHappySimulator(repo, index, controls),
    storage: browserStorage(),
    prototype: {
      setFailHappy(v) {
        controls.failNext = v;
      },
      getFailHappy() {
        return controls.failNext;
      },
    },
  };
}
