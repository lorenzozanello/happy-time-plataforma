/**
 * Política de privacidad de entrada (Policy Layer, ADR-009).
 *
 * Criterio: la v1 no trata datos que IDENTIFIQUEN a una niña o un niño. Se marca como sensible un
 * mensaje que contiene un nombre de persona, datos de contacto, un documento o una dirección.
 * Los términos de salud o apoyo por sí solos (PIAR, discapacidad, DUA, “un niño con autismo”) NO
 * se bloquean: son vocabulario de la propia malla y de la inclusión; Happy igual tiene prohibido
 * diagnosticar (validador de salida). Si hay un nombre, los términos de salud también se redactan.
 *
 * Detector heurístico preliminar; la suite de evaluación de F5 lo mide y lo afina.
 */

export type PrivacyFinding = "named_person" | "contact" | "identifier" | "address";

export interface PrivacyResult {
  sensitive: boolean;
  findings: PrivacyFinding[];
  /** Texto seguro para guardar: los hallazgos se reemplazan por marcadores. */
  redacted: string;
}

/** Nombres frecuentes (Colombia), incluidos diminutivos. Se reconocen aun en minúscula. */
const COMMON_NAMES = new Set(
  (
    "mateo santiago samuel sebastián sebastian matías matias nicolás nicolas alejandro thiago tiago " +
    "emiliano gabriel lucas martín martin daniel david juan josé jose pablo andrés andres felipe " +
    "camilo santi tomás tomas miguel ángel angel emmanuel jerónimo jeronimo simón simon dylan " +
    "maximiliano benjamín benjamin joaquín joaquin luis carlos diego esteban julián julian " +
    "sofía sofia valentina isabella salomé salome mariana luciana valeria gabriela sara sarah " +
    "daniela antonella victoria emilia martina maría maria camila paula juliana manuela " +
    "ana lucía lucia natalia laura sara violeta abigail emma alejandra catalina allison " +
    "ximena jimena luna celeste regina renata elena andrea carolina"
  ).split(/\s+/),
);

/** Palabras que suelen ir en mayúscula sin ser nombres de niñas o niños. */
const NOT_NAMES = new Set(
  (
    "step kínder kinder transición transicion prejardín prejardin jardín jardin maternal párvulo " +
    "parvulo happy time malla periodo dua piar tea tdah icbf barranquilla caribe colombia gire " +
    "juego literatura arte exploración exploracion indagar proyectar vivir valorar " +
    "lunes martes miércoles miercoles jueves viernes sábado sabado domingo enero febrero marzo " +
    "abril mayo junio julio agosto septiembre octubre noviembre diciembre navidad " +
    "dios señor señora profe profesora profesor seño mamá mama papá papa abuela abuelo " +
    "el la los las un una mi mis su sus yo tú tu él ella nosotros ellos hoy ayer mañana " +
    "qué que cómo como cuándo cuando dónde donde por para hola gracias quiero tengo necesito " +
    "dame ayúdame ayudame puedes podrías podrias también tambien pero y o con sin en de del al " +
    "es está esta son hay"
  ).split(/\s+/),
);

/** Verbos o marcas que, tras una palabra en mayúscula, indican que habla de una persona. */
const PERSON_CUE =
  /^(tiene|tuvo|está|esta|es|anda|toma|tomó|vive|llora|grita|pega|muerde|no|casi|se|siempre|nunca|presenta|sufre|usa|llegó|llega|dijo|hace|hizo|empujó|empuja|come|duerme|habla|ya)$/i;
const CHILD_CONTEXT =
  /^(niñ[oa]s?|estudiantes?|alumn[oa]s?|hij[oa]s?|pequeñ[oa]s?|bebés?|sobrin[oa]s?|nene|nena)$/i;
const FAMILY_OF =
  /^(mamá|mama|papá|papa|madre|padre|abuela|abuelo|tía|tia|tío|tio|acudiente|hermana|hermano)$/i;

const EMAIL =
  /[\w.+-]+\s*(?:@|\(at\)|\[at\]|\sarroba\s)\s*[\w-]+\s*(?:\.|\(dot\)|\sdot\s)\s*[\w.]+/gi;
/**
 * Teléfonos: 7 a 12 dígitos con separadores habituales (espacios, puntos, guiones, paréntesis),
 * con o sin indicativo +57. Se evalúa sobre el texto NFKC (dígitos de ancho completo incluidos).
 */
const PHONE = /(?:\+\s?\d{1,3}[\s.-]*)?(?:\(\s*\d{1,4}\s*\)[\s.-]*)?\d(?:[\s.-]?\d){6,11}\b/g;
const DOC_ID =
  /\b(?:c\.?\s?c\.?|t\.?\s?i\.?|r\.?\s?c\.?|nuip|documento|c[eé]dula|tarjeta de identidad|registro civil|pasaporte)\s*(?:(?:n[uú]mero|num\.?|n[oº°.]*)\s*)?(?:de\s+identidad\s*)?:?\s*\d[\d.\s-]{4,}\d/gi;
/** Rangos de años y fechas con guiones (2025-2026, 12-10-2026) no son teléfonos. */
const NOT_A_PHONE = /^(?:(?:19|20)\d{2}\s*-\s*(?:19|20)?\d{2}|\d{1,2}-\d{1,2}-(?:19|20)?\d{2})$/;
/** Usuarios de redes sociales (@usuario). */
const HANDLE = /(?<![\w.])@[a-z0-9_.]{3,30}\b/gi;
const ADDRESS =
  /\b(?:cra|kra|carrera|calle|cll|cl|diagonal|dg|transversal|tv|avenida|av)\.?\s*\d+\s*[a-z]?\s*(?:(?:#|no\.?|n°|nº|n[uú]mero)\s*\d+[a-z]?(?:\s*-\s*\d+)?|con\s+(?:cra|kra|carrera|calle|cll|cl|diagonal|dg|transversal|tv|avenida|av)\.?\s*\d+)/gi;

interface Token {
  text: string;
  start: number;
  end: number;
}

function tokens(text: string): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(/[\p{L}][\p{L}'’-]*/gu)) {
    out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return out;
}

const isCapitalized = (w: string) => /^\p{Lu}\p{Ll}/u.test(w);
const lower = (w: string) => w.toLocaleLowerCase("es");

/** Inicio de oración: primer token o precedido por . ! ? ¿ ¡ : o salto de línea. */
function atSentenceStart(text: string, t: Token): boolean {
  const before = text.slice(0, t.start).trimEnd();
  return before === "" || /[.!?¿¡:\n]$/.test(before);
}

/** Índices de tokens que parecen nombres de persona. */
function nameTokens(text: string): Set<number> {
  const ts = tokens(text);
  const names = new Set<number>();
  ts.forEach((t, i) => {
    const w = lower(t.text);
    if (NOT_NAMES.has(w)) return;
    const prev = ts[i - 1] ? lower(ts[i - 1]?.text ?? "") : "";
    const prev2 = ts[i - 2] ? lower(ts[i - 2]?.text ?? "") : "";
    const next = ts[i + 1]?.text ?? "";
    const known = COMMON_NAMES.has(w);
    const cap = isCapitalized(t.text);
    const childBefore =
      CHILD_CONTEXT.test(prev) ||
      prev === "llamado" ||
      prev === "llamada" ||
      (prev === "llama" && prev2 === "se");
    const familyOf = prev === "de" && FAMILY_OF.test(prev2);
    const personVerbAfter = PERSON_CUE.test(next);
    const aPerson = prev === "a" && cap; // “A Salomé la …”
    if (known && (cap || childBefore || familyOf || personVerbAfter)) names.add(i);
    else if (
      cap &&
      !atSentenceStart(text, t) &&
      (childBefore || familyOf || personVerbAfter || aPerson)
    )
      names.add(i);
    else if (cap && atSentenceStart(text, t) && personVerbAfter && !NOT_NAMES.has(w)) names.add(i);
    else if (cap && childBefore && (prev === "llamado" || prev === "llamada" || prev === "llama"))
      names.add(i);
  });
  // Apellidos y nombres compuestos: palabras en mayúscula contiguas a un nombre detectado.
  for (const i of [...names]) {
    for (let j = i + 1; j < ts.length; j++) {
      const t = ts[j];
      const between = t ? text.slice(ts[j - 1]?.end ?? 0, t.start) : "";
      if (!t || !isCapitalized(t.text) || NOT_NAMES.has(lower(t.text)) || !/^\s+$/.test(between))
        break;
      names.add(j);
    }
  }
  return names;
}

export function checkPrivacy(input: string): PrivacyResult {
  // NFKC: dígitos y signos de ancho completo («３００…», «＠») cuentan como los normales.
  const text = input.normalize("NFKC");
  const findings = new Set<PrivacyFinding>();
  const spans: [number, number, string][] = [];
  const collect = (
    re: RegExp,
    finding: PrivacyFinding,
    marker: string,
    keep: (match: string) => boolean = () => true,
  ) => {
    for (const m of text.matchAll(re)) {
      if (!keep(m[0])) continue;
      findings.add(finding);
      spans.push([m.index, m.index + m[0].length, marker]);
    }
  };
  collect(EMAIL, "contact", "[contacto]");
  collect(DOC_ID, "identifier", "[documento]");
  collect(ADDRESS, "address", "[dirección]");
  collect(PHONE, "contact", "[contacto]", (m) => !NOT_A_PHONE.test(m.trim()));
  collect(HANDLE, "contact", "[contacto]");

  const ts = tokens(text);
  for (const i of nameTokens(text)) {
    const t = ts[i];
    if (!t) continue;
    findings.add("named_person");
    spans.push([t.start, t.end, "[nombre]"]);
  }

  // Ordenar, descartar solapados y reemplazar de atrás hacia adelante.
  spans.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const kept: [number, number, string][] = [];
  for (const s of spans) {
    const last = kept.at(-1);
    if (last && s[0] < last[1]) continue;
    kept.push(s);
  }
  let redacted = text;
  for (const [a, b, marker] of kept.reverse())
    redacted = redacted.slice(0, a) + marker + redacted.slice(b);
  return { sensitive: findings.size > 0, findings: [...findings], redacted };
}

export const PRIVACY_MESSAGE =
  "Para cuidar la privacidad de las niñas y los niños, cuéntame la situación sin nombres, datos de contacto ni documentos. Por ejemplo: «un niño de 3 años que se abruma con el ruido».";
