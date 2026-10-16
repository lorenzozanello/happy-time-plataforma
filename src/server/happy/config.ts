/**
 * Configuración de Happy en el servidor, leída de variables de entorno en cada solicitud.
 * Segura por defecto: sin `HAPPY_ENABLED=1` y sin proveedor válido, Happy está apagada.
 */
export type ComposerKind = "claude" | "guion";

export interface HappyConfig {
  enabled: boolean;
  reason?: string;
  composer: ComposerKind;
  model: string;
  apiKey?: string;
  /** Solicitudes por IP en la ventana (sin autenticación hasta F4: mejor esfuerzo). */
  perIpLimit: number;
  perIpWindowMs: number;
  /** Solicitudes por IP al día. */
  perIpDailyLimit: number;
  /** Tope global diario de solicitudes (cada una hace como máximo 2 llamadas al modelo). */
  dailyLimit: number;
  /** Confiar en X-Forwarded-For (solo detrás de un proxy propio que la reescribe). */
  trustXff: boolean;
}

const int = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : d;
};

export const DEFAULT_MODEL = "claude-sonnet-5-5";

export function readHappyConfig(
  env: Record<string, string | undefined> = process.env,
): HappyConfig {
  const base = {
    model: env.HAPPY_MODEL?.trim() || DEFAULT_MODEL,
    perIpLimit: int(env.HAPPY_IP_LIMIT, 12),
    perIpWindowMs: int(env.HAPPY_IP_WINDOW_MS, 10 * 60_000),
    perIpDailyLimit: int(env.HAPPY_IP_DAILY_LIMIT, 60),
    dailyLimit: int(env.HAPPY_DAILY_LIMIT, 300),
    trustXff: env.HAPPY_TRUST_XFF === "1",
  };
  if (env.HAPPY_ENABLED !== "1")
    return { ...base, enabled: false, composer: "claude", reason: "apagada" };

  // El guion solo existe para pruebas locales y de CI: nunca en ningún despliegue de Vercel.
  if (env.HAPPY_COMPOSER === "guion") {
    const allowed = env.HAPPY_TEST_MODE === "1" && !env.VERCEL && !env.VERCEL_ENV;
    return allowed
      ? { ...base, enabled: true, composer: "guion", model: "guion-de-pruebas" }
      : { ...base, enabled: false, composer: "guion", reason: "guion fuera de modo prueba" };
  }
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return { ...base, enabled: false, composer: "claude", reason: "sin clave" };
  return { ...base, enabled: true, composer: "claude", apiKey };
}
