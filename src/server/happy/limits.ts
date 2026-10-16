/**
 * Límites en memoria del proceso (mejor esfuerzo). Sin autenticación hasta F4, protegen el costo
 * en una vista previa: por IP en una ventana y un tope global por día (UTC). En F4 se reemplazan
 * por límites por usuaria persistidos en la base de datos.
 */
export interface Limiter {
  check(key: string, nowMs: number): { ok: true } | { ok: false; reason: "ip" | "daily" };
}

export function createLimiter(opts: { perKey: number; windowMs: number; daily: number }): Limiter {
  const hits = new Map<string, number[]>();
  let day = "";
  let dayCount = 0;
  return {
    check(key, nowMs) {
      const today = new Date(nowMs).toISOString().slice(0, 10);
      if (today !== day) {
        day = today;
        dayCount = 0;
      }
      if (dayCount >= opts.daily) return { ok: false, reason: "daily" };
      const recent = (hits.get(key) ?? []).filter((t) => nowMs - t < opts.windowMs);
      if (recent.length >= opts.perKey) {
        hits.set(key, recent);
        return { ok: false, reason: "ip" };
      }
      recent.push(nowMs);
      hits.set(key, recent);
      dayCount++;
      // Limpieza ocasional para que el mapa no crezca sin fin.
      if (hits.size > 5000)
        for (const [k, v] of hits) if (v.every((t) => nowMs - t >= opts.windowMs)) hits.delete(k);
      return { ok: true };
    },
  };
}
