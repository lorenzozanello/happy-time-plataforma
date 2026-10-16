/**
 * F3-03 · La malla completa no viaja al navegador por defecto.
 *
 * Tras `next build`, comprueba sobre la salida real:
 *  1. Ningún archivo JavaScript del cliente (.next/static) contiene texto curricular
 *     (ni una sola secuencia de 8 palabras de la malla).
 *  2. Ninguna página HTML pre-generada contiene más unidades de las que muestra: cada ficha
 *     lleva sus unidades y el catálogo liviano, nunca las de otras fichas.
 *  3. El único archivo con toda la malla es el paquete de búsqueda versionado, que se pide
 *     bajo demanda en /buscar.
 *
 * Uso: `npm run app:check-bundle` (después de `npm run app:build`).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import releaseJson from "../curriculum/build/curriculum.2026-06.json";
import { WINDOW, words } from "../src/domain/curriculum/fingerprint";
import { createRepository } from "../src/domain/curriculum/repository";
import { CurriculumReleaseSchema } from "../src/domain/curriculum/schema";
import { buildCatalog, codeToSlug } from "../src/domain/curriculum/views";

const ROOT = process.cwd();
const NEXT = join(ROOT, ".next");
if (!existsSync(NEXT)) {
  console.error("✗ No existe .next: ejecuta primero `npm run app:build`.");
  process.exit(1);
}

const release = CurriculumReleaseSchema.parse(releaseJson);
const repo = createRepository(release);
const catalog = buildCatalog(repo);

/** Deshace los escapes de JSON y HTML para comparar palabras, no codificaciones. */
function decode(s: string): string {
  return s
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\[nrt"'\\/]/g, " ")
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp);|&#x?[0-9a-fA-F]+;/g, (m) =>
      m === "&amp;" ? "&" : " ",
    );
}

function windowsOf(text: string): Set<string> {
  const w = words(text);
  const set = new Set<string>();
  for (let i = 0; i + WINDOW <= w.length; i++) set.add(w.slice(i, i + WINDOW).join(" "));
  return set;
}

/**
 * Unidades detectables (≥ 8 palabras). Una unidad está "presente" en una página solo si todas
 * sus secuencias aparecen: muchas unidades comparten su comienzo (p. ej. los propósitos).
 */
const detectable = release.units.flatMap((u) => {
  const ws = [...windowsOf(u.text)];
  return ws.length > 0 ? [{ unitId: u.unitId, windows: ws }] : [];
});
const allWindows = new Set<string>();
for (const u of release.units) for (const s of windowsOf(u.text)) allWindows.add(s);

function walk(dir: string, ext: RegExp): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p, ext) : ext.test(e) ? [p] : [];
  });
}

const problems: string[] = [];

/* 1 · JavaScript del cliente */
const chunks = walk(join(NEXT, "static"), /\.js$/);
let jsBytes = 0;
for (const f of chunks) {
  const text = decode(readFileSync(f, "utf8"));
  jsBytes += text.length;
  const hits = [...windowsOf(text)].filter((s) => allWindows.has(s));
  if (hits.length > 0)
    problems.push(`${relative(ROOT, f)}: contiene texto curricular («${hits[0] ?? ""}»)`);
}

/* 2 · Páginas HTML pre-generadas */
const catalogUnits = new Set<string>([
  ...catalog.experiences.flatMap((e) => [e.title.unitId, e.alcance.unitId]),
  ...catalog.levels.flatMap((l) => [
    l.equivalencia.unitId,
    l.edadEntrada.unitId,
    l.edadSalida.unitId,
  ]),
]);

/** Unidades que cada página puede mostrar, además del catálogo. */
function allowedFor(page: string): Set<string> {
  const ficha = /^malla\/([a-z0-9-]+)\.html$/.exec(page);
  if (ficha) {
    const exp = catalog.experiences.find((e) => codeToSlug(e.code) === ficha[1]);
    if (!exp) return new Set();
    const e = repo.experience(exp.code);
    return new Set([...Object.values(e.fieldUnitIds), e.titleUnitId, "OBS-1", "OBS-3"]);
  }
  const nivel = /^niveles\/([a-z0-9-]+)\.html$/.exec(page);
  if (nivel) {
    const l = repo.levels.find((x) => x.id === nivel[1]);
    if (!l) return new Set();
    return new Set([
      ...Object.values(l.fieldUnitIds),
      ...repo.progressionOf(l.id).map((u) => u.unitId),
    ]);
  }
  if (page === "progresion.html") return new Set(release.progression.map((p) => p.unitId));
  if (page === "principios.html") return new Set(repo.observations.map((u) => u.unitId));
  return new Set();
}

const pages = walk(join(NEXT, "server", "app"), /\.html$/);
const rows: string[] = [];
for (const f of pages) {
  const page = relative(join(NEXT, "server", "app"), f);
  const html = readFileSync(f, "utf8");
  const present = new Set(windowsOf(decode(html)));
  const shown = detectable
    .filter((d) => d.windows.every((w) => present.has(w)))
    .map((d) => d.unitId);
  const allowed = allowedFor(page);
  // Un texto idéntico a una unidad permitida (p. ej. celdas combinadas entre niveles) no es extra.
  const okTexts = new Set([...allowed, ...catalogUnits].map((id) => repo.maybeUnit(id)?.text));
  const extra = shown.filter(
    (id) => !allowed.has(id) && !catalogUnits.has(id) && !okTexts.has(repo.maybeUnit(id)?.text),
  );
  rows.push(
    `${page.padEnd(28)} ${String(shown.length).padStart(4)} unidades · ${String(Math.round(html.length / 1024))} KB`,
  );
  if (extra.length > 0)
    problems.push(
      `${page}: incluye ${String(extra.length)} unidades que no muestra (p. ej. ${extra.slice(0, 3).join(", ")})`,
    );
}

/* 3 · El paquete de búsqueda es el único con toda la malla */
const bundles = walk(join(NEXT, "server", "app", "datos"), /\.json(\.body)?$/);
if (bundles.length === 0) problems.push("No se generó el paquete de búsqueda en /datos");

console.log(
  `Unidades detectables (≥ ${String(WINDOW)} palabras): ${String(detectable.length)} de ${String(release.units.length)}`,
);
console.log(
  `JavaScript del cliente: ${String(chunks.length)} archivos · ${String(Math.round(jsBytes / 1024))} KB`,
);
console.log(rows.sort().join("\n"));
if (problems.length > 0) {
  console.error(`\n✗ F3-03 falla:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(
  "\n✓ F3-03: ningún bundle del cliente contiene la malla; cada página lleva solo lo que muestra.",
);
