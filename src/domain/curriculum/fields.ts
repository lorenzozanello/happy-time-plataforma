/**
 * Mapa de campos curriculares (ADR-002, H-13).
 * Cada campo se enlaza por su ENCABEZADO LITERAL en la fuente, nunca por letra de columna.
 * Si un encabezado cambia en una release, la compilación falla y obliga a revisar este mapa.
 * Los encabezados son metadatos de estructura, no contenido curricular.
 */

export const LEVEL_FIELDS = [
  { key: "nivel", header: "Nivel" },
  { key: "ciclo_normativo", header: "Ciclo normativo" },
  { key: "equivalencia", header: "Equivalencia" },
  { key: "edad_entrada", header: "Edad de entrada aprox." },
  { key: "edad_salida", header: "Edad de salida aprox." },
  { key: "perfil_entrada", header: "Perfil de entrada sintetizado" },
  { key: "perfil_salida", header: "Perfil de salida sintetizado" },
] as const;

export const PERIOD_HEADER = "Periodo / código";
export const TITLE_HEADER = "Experiencia integradora";

export type FieldGroup =
  | "alcance_propositos"
  | "ciclo_pedagogico"
  | "actividades_rectoras"
  | "nucleos_saberes"
  | "competencias_evidencias"
  | "inclusion"
  | "contexto"
  | "procesos"
  | "emocional_familia"
  | "documentacion_valoracion";

export const EXPERIENCE_FIELDS = [
  { key: "alcance", header: "Alcance de la experiencia integradora", group: "alcance_propositos" },
  { key: "propositos", header: "Propósitos esenciales", group: "alcance_propositos" },
  { key: "momento_indagar", header: "Momento de Indagar", group: "ciclo_pedagogico" },
  { key: "momento_proyectar", header: "Momento de Proyectar", group: "ciclo_pedagogico" },
  { key: "momento_vivir", header: "Momento de Vivir la experiencia", group: "ciclo_pedagogico" },
  { key: "momento_valorar", header: "Momento de Valorar el proceso", group: "ciclo_pedagogico" },
  {
    key: "juego",
    header: "Juego: tema, competencia, avance y evidencia",
    group: "actividades_rectoras",
  },
  {
    key: "exploracion_medio",
    header: "Exploración del medio: tema, competencia, avance y evidencia",
    group: "actividades_rectoras",
  },
  {
    key: "literatura",
    header: "Literatura: tema, competencia, avance y evidencia",
    group: "actividades_rectoras",
  },
  {
    key: "arte",
    header: "Arte: tema, competencia, avance y evidencia",
    group: "actividades_rectoras",
  },
  { key: "nucleos", header: "Núcleos de experiencia", group: "nucleos_saberes" },
  { key: "saberes", header: "Saberes y nociones movilizadas", group: "nucleos_saberes" },
  { key: "competencias", header: "Competencias de desarrollo", group: "competencias_evidencias" },
  {
    key: "evidencias",
    header: "Evidencias pedagógicas integradas",
    group: "competencias_evidencias",
  },
  {
    key: "dua_apoyos_piar",
    header: "Diferenciación, DUA, apoyos razonables y PIAR cuando aplique",
    group: "inclusion",
  },
  { key: "contexto_caribe", header: "Contexto Caribe", group: "contexto" },
  { key: "gire", header: "GIRE", group: "contexto" },
  { key: "procesos_imprescindibles", header: "Procesos imprescindibles", group: "procesos" },
  { key: "ambientes_saludables", header: "Ambientes saludables", group: "contexto" },
  { key: "indicadores", header: "Indicadores de desarrollo", group: "competencias_evidencias" },
  {
    key: "documentacion_alertas",
    header: "Documentación pedagógica y alertas",
    group: "documentacion_valoracion",
  },
  {
    key: "educacion_emocional",
    header: "Eje de Educación Emocional",
    group: "emocional_familia",
  },
  { key: "familia_escuela", header: "Alianza familia-escuela", group: "emocional_familia" },
  {
    key: "observacion_valoracion",
    header: "Observación y valoración",
    group: "documentacion_valoracion",
  },
] as const satisfies readonly { key: string; header: string; group: FieldGroup }[];

export const PROGRESSION_DIMENSIONS = [
  { key: "cognitiva", header: "Cognitiva" },
  { key: "comunicativa", header: "Comunicativa" },
  { key: "socioemocional", header: "Socioemocional" },
  { key: "corporal", header: "Corporal" },
  { key: "estetica", header: "Estética" },
  { key: "etico_moral", header: "Ético-moral" },
] as const;

export type LevelFieldKey = (typeof LEVEL_FIELDS)[number]["key"];
export type ExperienceFieldKey = (typeof EXPERIENCE_FIELDS)[number]["key"];
export type DimensionKey = (typeof PROGRESSION_DIMENSIONS)[number]["key"];

export const LEVEL_IDS = ["step-1", "step-2", "step-3", "kinder", "transicion"] as const;
export type LevelId = (typeof LEVEL_IDS)[number];

export const PERIOD_ROMANS = ["I", "II", "III", "IV"] as const;
