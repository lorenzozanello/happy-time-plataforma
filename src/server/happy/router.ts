/**
 * Intent Router (§8.2). La intención que la docente elige manda; el texto libre se clasifica
 * con reglas simples y, si no hay señales, queda en `general`. Solo modos de la v1.
 */
import { normalizeForRules, V1_MODES, type Mode } from "../../domain/happy/schema";

const RULES: [Mode, RegExp][] = [
  [
    "aterrizar",
    /\b(tengo una idea|se me ocurrio|quiero (hacer|montar|organizar|preparar)|como (lo )?aterrizo|aterriz\w*|planeo|estoy pensando en)\b/,
  ],
  [
    "conectar",
    /\b(donde (aparece|esta|se trabaja)|en que experiencia|conect\w*|relacion\w*|con que (de la malla|experiencia))\b/,
  ],
  ["explorar", /\b(ideas?|propuestas?|sugerencias?|actividades? para|que puedo hacer)\b/],
];

export function routeMode(explicit: Mode | undefined, message: string): Mode {
  if (explicit && explicit !== "general" && (V1_MODES as readonly Mode[]).includes(explicit))
    return explicit;
  const n = normalizeForRules(message);
  for (const [mode, re] of RULES) if (re.test(n)) return mode;
  return "general";
}
