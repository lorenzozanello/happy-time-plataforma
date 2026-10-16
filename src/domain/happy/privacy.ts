/**
 * Detector preliminar de datos sensibles en lo que escribe la docente (Policy Layer, ADR-009).
 * Conservador a propósito: ante la duda, pide reformular sin datos identificables.
 * Se refinará con la suite de evaluación de F5; no es un clasificador clínico.
 */

const CLINICAL = [
  "autismo",
  "autista",
  "tea",
  "tdah",
  "asperger",
  "síndrome",
  "sindrome",
  "diagnóstico",
  "diagnostico",
  "diagnosticado",
  "diagnosticada",
  "trastorno",
  "medicación",
  "medicacion",
  "medicamento",
  "terapia",
  "terapeuta",
  "neurólogo",
  "neurologo",
  "psiquiatra",
  "psicólogo",
  "psicologo",
  "discapacidad",
  "retraso",
  "epilepsia",
  "convulsiones",
  "piar",
];

const CHILD_WORDS = /\b(niñ[oa]s?|estudiantes?|alumn[oa]s?|hij[oa]s?|bebés?|pequeñ[oa]s?)\b/i;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
const PHONE = /(\+?\d[\d\s-]{7,}\d)/;
const DOC_ID = /\b(c\.?c\.?|t\.?i\.?|r\.?c\.?|documento|registro civil)\s*:?\s*\d{5,}/i;

export type PrivacyFinding = "clinical" | "contact" | "identifier" | "named_child";

export interface PrivacyResult {
  sensitive: boolean;
  findings: PrivacyFinding[];
  /** Texto seguro para guardar: los hallazgos se reemplazan por marcadores. */
  redacted: string;
}

const NAME_AFTER_CHILD =
  /\b(?:niñ[oa]|estudiante|alumn[oa]|hij[oa])\s+(?:llamad[oa]\s+)?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/;
const NAME_LEAD = /\b(?:se llama|llamad[oa])\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/i;

export function checkPrivacy(text: string): PrivacyResult {
  const findings = new Set<PrivacyFinding>();
  let redacted = text;
  const lower = text.toLowerCase();

  for (const term of CLINICAL) {
    const re = new RegExp(`(^|[^\\p{L}])${term}(?=$|[^\\p{L}])`, "iu");
    if (re.test(lower)) {
      findings.add("clinical");
      redacted = redacted.replace(
        new RegExp(`(^|[^\\p{L}])(${term})(?=$|[^\\p{L}])`, "giu"),
        "$1[dato de salud]",
      );
    }
  }
  if (EMAIL.test(text) || PHONE.test(text)) {
    findings.add("contact");
    redacted = redacted
      .replace(new RegExp(EMAIL, "g"), "[contacto]")
      .replace(new RegExp(PHONE, "g"), "[contacto]");
  }
  if (DOC_ID.test(text)) {
    findings.add("identifier");
    redacted = redacted.replace(new RegExp(DOC_ID, "gi"), "[documento]");
  }
  const named = NAME_AFTER_CHILD.exec(text) ?? NAME_LEAD.exec(text);
  if (named?.[1] && (CHILD_WORDS.test(text) || NAME_LEAD.test(text))) {
    findings.add("named_child");
    redacted = redacted.replace(named[1], "[nombre]");
  }
  return { sensitive: findings.size > 0, findings: [...findings], redacted };
}

export const PRIVACY_MESSAGE =
  "Para cuidar la privacidad de las niñas y los niños, cuéntame la situación sin nombres, diagnósticos ni datos de contacto. Por ejemplo: «un niño de Step 2 que se abruma con el ruido».";
