/** Context Builder (§8.1-3): el contexto que manda la interfaz se valida contra la release. */
import type { LevelId } from "../../domain/curriculum/fields";
import type { CurriculumRepository } from "../../domain/curriculum/repository";
import type { HappyApiRequest } from "./request";

export interface ResolvedContext {
  levelId?: LevelId;
  periodIndex?: number;
  experienceCode?: string;
}

export function resolveContext(
  raw: HappyApiRequest["context"],
  repo: CurriculumRepository,
): ResolvedContext {
  const exp = raw.experienceCode ? repo.maybeExperience(raw.experienceCode) : undefined;
  const level = exp
    ? repo.levels.find((l) => l.id === exp.levelId)
    : repo.levels.find((l) => l.id === raw.levelId);
  const periodIndex = exp?.periodIndex ?? raw.periodIndex;
  const experienceCode =
    exp?.code ?? (level && periodIndex ? repo.experienceAt(level.id, periodIndex).code : undefined);
  return {
    ...(level ? { levelId: level.id } : {}),
    ...(level && periodIndex ? { periodIndex } : {}),
    ...(experienceCode ? { experienceCode } : {}),
  };
}
