/** Modos de Happy, sin dependencias: la navegación y el almacenamiento los validan sin cargar Zod. */
export const MODES = [
  "explorar",
  "aterrizar",
  "conectar",
  "adaptar",
  "observar",
  "registrar",
  "general",
] as const;
export type Mode = (typeof MODES)[number];

export const isMode = (v: unknown): v is Mode =>
  typeof v === "string" && (MODES as readonly string[]).includes(v);
