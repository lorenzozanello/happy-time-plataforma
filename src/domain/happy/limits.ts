/**
 * Límites de uso de Happy (Baseline §8.6 y §9.1: abuso de costo). Contadores en memoria por
 * instancia: suficientes para el piloto y como primera barrera; el tope duro de gasto vive en la
 * consola del proveedor (ADR-008). En F4 los contadores pasan a la base de datos.
 */
export interface LimitsConfig {
  /** Peticiones por clave (código de acceso + dispositivo) en una hora móvil. */
  perKeyPerHour: number;
  /** Peticiones por clave en 24 horas móviles. */
  perKeyPerDay: number;
  /** Peticiones totales en 24 horas móviles (todas las claves). */
  globalPerDay: number;
  /** Tope de gasto estimado en el mes calendario (USD). */
  monthlyBudgetUsd: number;
}

export const DEFAULT_LIMITS: LimitsConfig = {
  perKeyPerHour: 40,
  perKeyPerDay: 150,
  globalPerDay: 1500,
  monthlyBudgetUsd: 20,
};

export type LimitReason = "rate" | "daily" | "global" | "budget";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export class UsageLimits {
  private readonly byKey = new Map<string, number[]>();
  private global: number[] = [];
  private month = "";
  private spentUsd = 0;

  constructor(
    private readonly cfg: LimitsConfig = DEFAULT_LIMITS,
    private readonly now: () => number = () => Date.now(),
  ) {}

  private prune(ts: number[], windowMs: number, t: number): number[] {
    const from = t - windowMs;
    let i = 0;
    while (i < ts.length && (ts[i] as number) <= from) i++;
    return i ? ts.slice(i) : ts;
  }

  private monthKey(t: number): string {
    const d = new Date(t);
    return `${String(d.getUTCFullYear())}-${String(d.getUTCMonth() + 1)}`;
  }

  /** ¿Puede esta clave hacer una petición ahora? No la cuenta: llamar a `record` al aceptarla. */
  check(key: string): { ok: true } | { ok: false; reason: LimitReason } {
    const t = this.now();
    if (this.monthKey(t) !== this.month) {
      this.month = this.monthKey(t);
      this.spentUsd = 0;
    }
    if (this.spentUsd >= this.cfg.monthlyBudgetUsd) return { ok: false, reason: "budget" };
    this.global = this.prune(this.global, DAY, t);
    if (this.global.length >= this.cfg.globalPerDay) return { ok: false, reason: "global" };
    const mine = this.prune(this.byKey.get(key) ?? [], DAY, t);
    this.byKey.set(key, mine);
    if (mine.length >= this.cfg.perKeyPerDay) return { ok: false, reason: "daily" };
    if (this.prune(mine, HOUR, t).length >= this.cfg.perKeyPerHour)
      return { ok: false, reason: "rate" };
    return { ok: true };
  }

  /** Cuenta una petición aceptada. */
  record(key: string): void {
    const t = this.now();
    this.global.push(t);
    const mine = this.byKey.get(key) ?? [];
    mine.push(t);
    this.byKey.set(key, mine);
    // Evitar crecimiento sin límite de claves olvidadas.
    if (this.byKey.size > 5000) {
      for (const [k, v] of this.byKey) {
        if (this.prune(v, DAY, t).length === 0) this.byKey.delete(k);
      }
    }
  }

  /** Suma el costo estimado de una respuesta al mes en curso. */
  spend(usd: number): void {
    const t = this.now();
    if (this.monthKey(t) !== this.month) {
      this.month = this.monthKey(t);
      this.spentUsd = 0;
    }
    this.spentUsd += usd;
  }

  get spentThisMonthUsd(): number {
    return this.spentUsd;
  }
}

/** Mensaje amable para la docente según el límite alcanzado. */
export function limitMessage(reason: LimitReason): string {
  switch (reason) {
    case "rate":
      return "Happy necesita un respiro: has enviado muchos mensajes seguidos. Inténtalo de nuevo en unos minutos.";
    case "daily":
      return "Alcanzaste el máximo de mensajes de hoy para este dispositivo. Mañana Happy vuelve a estar disponible.";
    case "global":
      return "Happy alcanzó su máximo de mensajes de hoy. Mañana vuelve a estar disponible.";
    case "budget":
      return "Happy alcanzó el presupuesto de este mes. La coordinación puede ampliarlo; mientras tanto, la malla sigue disponible.";
  }
}
