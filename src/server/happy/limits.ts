/**
 * Límites en memoria del proceso (mejor esfuerzo). Sin autenticación hasta F4 solo frenan el abuso
 * casual en una vista previa: por IP en una ventana, por IP al día y un tope global por día (UTC).
 * NO son un control de costo fiable: en serverless cada instancia lleva su propia cuenta y se
 * reinicia en frío. El tope real de gasto es el límite mensual que se fija en la consola del
 * proveedor (owner, OD-2). En F4 se reemplazan por límites por usuaria en la base de datos.
 */
export interface Limiter {
  check(
    key: string,
    nowMs: number,
  ): { ok: true } | { ok: false; reason: "ip" | "ip_daily" | "daily" };
}

export function createLimiter(opts: {
  perKey: number;
  windowMs: number;
  daily: number;
  /** Tope diario por clave: una sola persona no agota el tope de todas. */
  perKeyDaily?: number;
}): Limiter {
  const hits = new Map<string, number[]>();
  const perDay = new Map<string, number>();
  let day = "";
  let dayCount = 0;
  return {
    check(key, nowMs) {
      const today = new Date(nowMs).toISOString().slice(0, 10);
      if (today !== day) {
        day = today;
        dayCount = 0;
        perDay.clear();
      }
      if (dayCount >= opts.daily) return { ok: false, reason: "daily" };
      if (opts.perKeyDaily !== undefined && (perDay.get(key) ?? 0) >= opts.perKeyDaily)
        return { ok: false, reason: "ip_daily" };
      const recent = (hits.get(key) ?? []).filter((t) => nowMs - t < opts.windowMs);
      if (recent.length >= opts.perKey) {
        hits.set(key, recent);
        return { ok: false, reason: "ip" };
      }
      recent.push(nowMs);
      hits.set(key, recent);
      dayCount++;
      perDay.set(key, (perDay.get(key) ?? 0) + 1);
      // Limpieza ocasional para que el mapa no crezca sin fin.
      if (hits.size > 5000)
        for (const [k, v] of hits) if (v.every((t) => nowMs - t >= opts.windowMs)) hits.delete(k);
      return { ok: true };
    },
  };
}
