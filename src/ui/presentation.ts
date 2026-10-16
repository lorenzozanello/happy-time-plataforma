/**
 * Etiquetas de interfaz (no curriculares). El contenido institucional nunca vive aquí:
 * siempre se lee de las unidades por unitId.
 */
import type { FieldGroup } from "../domain/curriculum/fields";

export const GROUP_LABEL: Record<FieldGroup, string> = {
  alcance_propositos: "Alcance y propósitos",
  ciclo_pedagogico: "Ciclo pedagógico",
  actividades_rectoras: "Actividades rectoras",
  nucleos_saberes: "Núcleos y saberes",
  competencias_evidencias: "Competencias, evidencias e indicadores",
  inclusion: "Inclusión y apoyos",
  contexto: "Contexto y ambientes",
  procesos: "Procesos imprescindibles",
  emocional_familia: "Educación emocional y familia",
  documentacion_valoracion: "Documentación y valoración",
};

/** Orden de los grupos plegables en la ficha (después de propósitos, ciclo y actividades). */
export const COLLAPSIBLE_GROUPS: FieldGroup[] = [
  "nucleos_saberes",
  "competencias_evidencias",
  "inclusion",
  "contexto",
  "procesos",
  "emocional_familia",
  "documentacion_valoracion",
];

export const ROMAN = ["I", "II", "III", "IV"] as const;

/**
 * Observación institucional que acompaña las alertas en la ficha.
 * Referencia estructural por id (Observaciones!A4 en la release 2026-06); si una release
 * reordena las observaciones, el diff de releases lo marcará y debe revisarse aquí.
 */
export const ALERTS_PRINCIPLE_UNIT = "OBS-3";
/** Principio que abre la malla en la primera visita (Observaciones!A2). */
export const OPENING_PRINCIPLE_UNIT = "OBS-1";

export function greeting(now = new Date()): string {
  const h = now.getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}
