import type { KeyValueStorage } from "./types";

/** localStorage protegido: si el navegador lo bloquea, la app sigue en memoria. */
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
