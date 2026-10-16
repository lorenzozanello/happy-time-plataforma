/**
 * Happy SIMULADA para el prototipo (F2). No usa IA: arma respuestas deterministas con el mismo
 * contrato que tendrá /api/happy en F5 (HappyResponse). Recupera unidades reales de la malla y
 * las CITA POR REFERENCIA (unitId); el texto generado es genérico y queda etiquetado en la UI.
 */
import type { ExperienceFieldKey } from "../src/domain/curriculum/fields";
import { curriculumWindows } from "../src/domain/curriculum/fingerprint";
import type { CurriculumRepository } from "../src/domain/curriculum/repository";
import type { SearchIndex } from "../src/domain/curriculum/search";
import { checkPrivacy, PRIVACY_MESSAGE } from "../src/domain/happy/privacy";
import {
  V1_MODES,
  validateResponse,
  type Block,
  type HappyContext,
  type HappyResponse,
} from "../src/domain/happy/schema";
import type { HappyRequest, HappyService } from "../src/ui/app/types";

export interface SimulatorControls {
  failNext: boolean;
  /** Pausas que simulan red y generación (ms). En pruebas se ponen en 0. */
  firstBlockDelay: number;
  blockDelay: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createHappySimulator(
  repo: CurriculumRepository,
  index: SearchIndex,
  controls: SimulatorControls,
): HappyService {
  const windows = curriculumWindows(repo.release.units);
  return {
    async respond(req, onProgress) {
      await sleep(controls.firstBlockDelay);
      if (controls.failNext) {
        controls.failNext = false;
        throw new Error("Happy no pudo responder");
      }
      const { response: full, retrieved } = compose(repo, index, req);
      const check = validateResponse(full, {
        unitExists: (id) => repo.maybeUnit(id) !== undefined,
        segmentExists: (id, seg) =>
          repo.maybeUnit(id)?.segments?.some((x) => x.key === seg) ?? false,
        experienceExists: (code) => repo.maybeExperience(code) !== undefined,
        retrieved,
        curriculumWindows: windows,
        allowedModes: V1_MODES,
      });
      if (!check.ok) throw new Error(`Respuesta inválida: ${check.errors.join("; ")}`);
      // Como el servidor: cada cita viaja con su unidad literal de la release compilada.
      const unitsOf = (blocks: Block[]) =>
        blocks.flatMap((b) => (b.kind === "malla_ref" ? [repo.unit(b.unitId)] : []));
      for (let i = 1; i <= full.blocks.length; i++) {
        const blocks = full.blocks.slice(0, i);
        onProgress({ response: { ...full, blocks, nextActions: [] }, units: unitsOf(blocks) });
        if (i < full.blocks.length) await sleep(controls.blockDelay);
      }
      return { response: full, units: unitsOf(full.blocks) };
    },
  };
}

function experienceOf(repo: CurriculumRepository, ctx: HappyContext): string | undefined {
  if (ctx.experienceCode && repo.maybeExperience(ctx.experienceCode)) return ctx.experienceCode;
  if (ctx.levelId && ctx.periodIndex) {
    const lvl = repo.levels.find((l) => l.id === ctx.levelId);
    if (lvl) return repo.experienceAt(lvl.id, ctx.periodIndex).code;
  }
  return undefined;
}

function retrieve(
  repo: CurriculumRepository,
  index: SearchIndex,
  query: string,
  levelId: string | undefined,
  limit: number,
): { unitId: string; terms: string[] }[] {
  if (!query.trim()) return [];
  return index
    .search(query, {
      prefix: (t) => t.length >= 4,
      fuzzy: (t) => (t.length >= 6 ? 0.15 : false),
      combineWith: "OR",
    })
    .filter((r) => {
      const u = repo.maybeUnit(String(r.id));
      return u?.kind === "experience_field" && (!levelId || u.levelId === levelId);
    })
    .slice(0, limit)
    .map((r) => ({ unitId: String(r.id), terms: r.terms }));
}

const ref = (unitId: string, why: string, segment?: string): Block => ({
  kind: "malla_ref",
  unitId,
  why,
  ...(segment ? { segment } : {}),
});

/**
 * Recuperación + composición. `retrieved` es el conjunto que la etapa de recuperación entregó
 * (campos de la experiencia activa + mejores coincidencias léxicas); el validador exige que toda
 * cita pertenezca a él.
 */
export function compose(
  repo: CurriculumRepository,
  index: SearchIndex,
  req: HappyRequest,
): { response: HappyResponse; retrieved: Set<string> } {
  const code = experienceOf(repo, req.context);
  const retrieved = new Set<string>([
    ...(code ? Object.values(repo.experience(code).fieldUnitIds) : []),
    ...retrieve(repo, index, req.message, req.context.levelId, 10).map((h) => h.unitId),
  ]);
  return { response: composeResponse(repo, index, req), retrieved };
}

function composeResponse(
  repo: CurriculumRepository,
  index: SearchIndex,
  req: HappyRequest,
): HappyResponse {
  const privacy = checkPrivacy(req.message);
  if (privacy.sensitive) {
    return {
      mode: req.mode,
      blocks: [{ kind: "notice", code: "privacy", text: PRIVACY_MESSAGE }],
      nextActions: [],
    };
  }
  const code = experienceOf(repo, req.context);
  const field = (k: ExperienceFieldKey) =>
    code ? repo.experience(code).fieldUnitIds[k] : undefined;

  if (req.mode === "explorar") {
    if (!code) {
      return {
        mode: req.mode,
        blocks: [
          {
            kind: "question",
            text: "¿Para qué experiencia buscamos ideas? Abre una ficha y toca «Pensemos juntas», o elige el nivel y el periodo en la malla.",
          },
        ],
        nextActions: [],
      };
    }
    const vivir = field("momento_vivir");
    const juego = field("juego");
    const caribe = field("contexto_caribe");
    const blocks: Block[] = [];
    if (vivir)
      blocks.push(
        ref(vivir, "Es el momento en que la experiencia sucede; de aquí parten las ideas."),
      );
    if (juego) blocks.push(ref(juego, "El tema de juego da un punto de partida concreto.", "tema"));
    if (caribe)
      blocks.push(ref(caribe, "Ancla la propuesta en el entorno de las niñas y los niños."));
    blocks.push({
      kind: "paths",
      paths: [
        {
          title: "Desde el juego",
          summary:
            "Convierte el tema de juego en una propuesta con materiales del aula y del patio, con tiempo para explorar libremente.",
        },
        {
          title: "Desde una historia",
          summary:
            "Parte de un cuento o una canción breve y deja que las preguntas del grupo guíen lo que sigue.",
        },
        {
          title: "Desde el entorno cercano",
          summary:
            "Sal al patio o a un espacio cercano a observar y recoger objetos que conecten con la experiencia.",
        },
      ],
    });
    return {
      mode: req.mode,
      blocks,
      nextActions: [
        {
          id: "aterrizar-1",
          label: "Aterrizar «Desde el juego»",
          kind: "send",
          payload: "Quiero aterrizar el camino «Desde el juego»",
        },
        { id: "ficha", label: "Ver la ficha", kind: "open_experience", payload: code },
      ],
    };
  }

  const levelId = req.context.levelId;
  if (req.mode === "aterrizar") {
    const hits = retrieve(repo, index, req.message, levelId, 3);
    if (hits.length === 0) {
      return {
        mode: req.mode,
        blocks: [
          {
            kind: "notice",
            code: "no_match",
            text: "No encontré en la malla un tema que coincida con tu idea. Puede que sea nueva para la malla: eso también vale.",
          },
          {
            kind: "question",
            text: "¿Me cuentas en qué nivel la quieres usar y qué quieres que vivan las niñas y los niños?",
          },
        ],
        nextActions: [],
      };
    }
    return {
      mode: req.mode,
      blocks: [
        ...hits.map((h) => {
          const u = repo.unit(h.unitId);
          return ref(
            h.unitId,
            `Comparte con tu idea: ${h.terms.slice(0, 3).join(", ")}.${u.code ? ` Está en ${u.code}.` : ""}`,
          );
        }),
        {
          kind: "steps",
          title: "Para aterrizarla",
          items: [
            "Prepara el ambiente: qué materiales, dónde y cuánto tiempo.",
            "Abre con una pregunta que despierte curiosidad y escucha las respuestas del grupo.",
            "Decide qué vas a observar y cómo lo vas a registrar.",
            "Cierra con un momento para que cuenten o muestren lo que vivieron.",
          ],
        },
      ],
      nextActions:
        hits[0] && repo.unit(hits[0].unitId).code
          ? [
              {
                id: "ficha",
                label: "Ver la experiencia relacionada",
                kind: "open_experience",
                payload: repo.unit(hits[0].unitId).code ?? "",
              },
            ]
          : [],
    };
  }

  // conectar y general
  const hits = retrieve(repo, index, req.message, levelId, req.mode === "conectar" ? 4 : 2);
  if (hits.length === 0) {
    return {
      mode: req.mode,
      blocks: [
        {
          kind: "notice",
          code: "no_match",
          text: "No encontré ese tema en la malla. Prueba con otra palabra o con un material concreto.",
        },
      ],
      nextActions: [],
    };
  }
  return {
    mode: req.mode,
    blocks: hits.map((h) => {
      const u = repo.unit(h.unitId);
      return ref(
        h.unitId,
        `Aparece en ${u.code ?? "la malla"} (${u.headerLiteral.split(":")[0] ?? ""}).`,
      );
    }),
    nextActions: [],
  };
}
