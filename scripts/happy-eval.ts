/**
 * Corredor de la suite de evaluación de Happy (§8.8, F5-08).
 *
 *   npm run happy:eval                       # con Claude (requiere ANTHROPIC_API_KEY; usa HAPPY_MODEL)
 *   npm run happy:eval -- --composer=guion   # sin IA: verifica el corredor y el pipeline
 *   npm run happy:eval -- --solo=adv-01,pri-01
 *
 * Escribe evals/resultados/<fecha>-<composer>/{resultados.json,informe.md}. El informe trae cada
 * respuesta legible y columnas de rúbrica para que una persona la califique.
 * Sale con código 1 si algún criterio duro falla.
 * Costo: si se definen HAPPY_PRICE_IN_MTOK y HAPPY_PRICE_OUT_MTOK (USD por millón de tokens),
 * se estima con los precios vigentes que indique el owner; el script no fija precios.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import releaseJson from "../curriculum/build/curriculum.2026-06.json";
import { curriculumShortTexts, curriculumWindows } from "../src/domain/curriculum/fingerprint";
import { createRepository } from "../src/domain/curriculum/repository";
import { CurriculumReleaseSchema } from "../src/domain/curriculum/schema";
import { buildSearchIndex } from "../src/domain/curriculum/search";
import { createAnthropicComposer } from "../src/server/happy/anthropic";
import type { Composer } from "../src/server/happy/composer";
import { DEFAULT_MODEL } from "../src/server/happy/config";
import { HARD_CRITERIA, scoreEvents, summarize, SuiteSchema } from "../src/server/happy/eval";
import { createScriptComposer } from "../src/server/happy/guion";
import { runHappy, type HappyEvent, type HappyLog } from "../src/server/happy/pipeline";
import { PROMPT_VERSION } from "../src/server/happy/prompt.v1";
import { HappyApiRequestSchema } from "../src/server/happy/request";

const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const release = CurriculumReleaseSchema.parse(releaseJson);
const repo = createRepository(release);
const index = buildSearchIndex(release);
const windows = curriculumWindows(release.units);
const shorts = curriculumShortTexts(release.units);
const suite = SuiteSchema.parse(
  JSON.parse(readFileSync(join(process.cwd(), "evals/happy/escenarios.v1.json"), "utf8")),
);

const kind = arg("composer") ?? "claude";
let composer: Composer;
if (kind === "guion") composer = createScriptComposer();
else {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Falta ANTHROPIC_API_KEY (OD-2). Usa --composer=guion para probar sin IA.");
    process.exit(2);
  }
  composer = createAnthropicComposer({ apiKey, model: process.env.HAPPY_MODEL ?? DEFAULT_MODEL });
}

const only = arg("solo")?.split(",");
const scenarios = suite.escenarios.filter((s) => !only || only.includes(s.id));
const results = [];
for (const s of scenarios) {
  const req = HappyApiRequestSchema.parse({
    ...(s.modo ? { mode: s.modo } : {}),
    message: s.mensaje,
    context: s.contexto,
    history: s.historial,
  });
  const events: HappyEvent[] = [];
  let log: HappyLog | undefined;
  for await (const e of runHappy(req, {
    repo,
    index,
    windows,
    shorts,
    composer,
    log: (l) => {
      log = l;
    },
  }))
    events.push(e);
  const r = scoreEvents(s, events, log, { repo, windows });
  results.push(r);
  const exp = r.expected.filter((e) => !e.ok).map((e) => e.name);
  console.log(
    `${r.hardOk ? "✓" : "✗"} ${s.id.padEnd(7)} ${r.firstBlockMs === null ? "   -" : String(r.firstBlockMs).padStart(5)} ms` +
      (r.dropped ? ` · ${String(r.dropped)} bloques descartados` : "") +
      (exp.length ? ` · esperado: ${exp.join(", ")}` : "") +
      (r.errors.length ? `\n    ${r.errors.join("\n    ")}` : ""),
  );
}

const sum = summarize(results);
const priceIn = Number(process.env.HAPPY_PRICE_IN_MTOK);
const priceOut = Number(process.env.HAPPY_PRICE_OUT_MTOK);
const cost =
  priceIn > 0 && priceOut > 0
    ? (sum.inputTokens * priceIn + sum.outputTokens * priceOut) / 1_000_000
    : null;

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const out = arg("out") ?? join("evals", "resultados", `${stamp}-${kind}`);
mkdirSync(out, { recursive: true });
const meta = {
  suite: suite.version,
  composer: kind,
  model: composer.model,
  promptVersion: PROMPT_VERSION,
  release: release.release,
  fecha: new Date().toISOString(),
};
writeFileSync(
  join(out, "resultados.json"),
  JSON.stringify({ meta, resumen: sum, cost, results }, null, 2),
);

const md = [
  `# Evaluación de Happy — ${suite.version}`,
  "",
  `Modelo \`${composer.model}\` · prompt \`${PROMPT_VERSION}\` · release \`${release.release}\` · ${meta.fecha}`,
  "",
  "## Resumen",
  "",
  `| Medida | Valor |`,
  `|---|---|`,
  `| Criterios duros | ${String(sum.hardPassed)}/${String(sum.total)} (${(sum.hardRate * 100).toFixed(1)} %) |`,
  ...HARD_CRITERIA.map((k) => `| · ${k} | ${String(sum.byCriterion[k])}/${String(sum.total)} |`),
  `| Comportamiento esperado | ${String(sum.expectedPassed)}/${String(sum.expectedTotal)} |`,
  `| Bloques descartados por el validador | ${String(sum.droppedBlocks)} |`,
  `| Primer bloque p75 | ${sum.firstBlockP75 === null ? "—" : `${String(sum.firstBlockP75)} ms`} |`,
  `| Respuesta completa p75 | ${sum.totalP75 === null ? "—" : `${String(sum.totalP75)} ms`} |`,
  `| Tokens entrada / salida / caché leída | ${String(sum.inputTokens)} / ${String(sum.outputTokens)} / ${String(sum.cacheReadTokens)} |`,
  `| Costo estimado | ${cost === null ? "defina HAPPY_PRICE_IN_MTOK y HAPPY_PRICE_OUT_MTOK" : `USD ${cost.toFixed(4)} (${(cost / Math.max(1, sum.total)).toFixed(4)} por respuesta)`} |`,
  "",
  "## Rúbrica (la califica una persona: 0 no, 1 en parte, 2 sí)",
  "",
  "Relevancia curricular · Accionabilidad · Tono (colega cálida, clara, no efusiva) · Devuelve el control · Pregunta breve cuando falta información. Meta: ≥ 85 % del puntaje posible.",
  "",
  ...results.flatMap((r) => {
    const s = scenarios.find((x) => x.id === r.id);
    return [
      `### ${r.id} · ${r.categoria} ${r.hardOk ? "✓" : "✗"}`,
      "",
      `**Mensaje:** ${s?.mensaje ?? ""}  `,
      `**Contexto:** ${JSON.stringify(s?.contexto ?? {})}  `,
      `**Qué buscar:** ${s?.rubrica || "—"}`,
      "",
      "```",
      r.transcript || "(sin respuesta)",
      "```",
      "",
      r.errors.length ? `Errores: ${r.errors.join("; ")}\n` : "",
      "| Relevancia | Accionabilidad | Tono | Control | Pregunta |",
      "|---|---|---|---|---|",
      "|   |   |   |   |   |",
      "",
    ];
  }),
].join("\n");
writeFileSync(join(out, "informe.md"), md);

console.log(
  `\nCriterios duros: ${String(sum.hardPassed)}/${String(sum.total)} · esperado: ${String(sum.expectedPassed)}/${String(sum.expectedTotal)} · descartados: ${String(sum.droppedBlocks)} · primer bloque p75: ${String(sum.firstBlockP75 ?? "-")} ms`,
);
console.log(`Informe: ${join(out, "informe.md")}`);
process.exit(sum.hardRate === 1 ? 0 : 1);
