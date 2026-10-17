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

/**
 * Deshace los escapes de JSON (también anidados: el payload RSC va como cadena JSON dentro de un
 * script, así que un salto de línea llega como `\\n`) y de HTML, para comparar palabras y no
 * codificaciones.
 */
export function decode(input: string): string {
  let s = input;
  for (let prev = ""; prev !== s;) {
    prev = s;
    s = s
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\x([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\\\/g, "\\");
  }
  return s
    .replace(/\\[nrtbf"'/\\]/g, " ")
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp);|&#x?[0-9a-fA-F]+;/g, (m) =>
      m === "&amp;" ? "&" : " ",
    )
    .replace(/\s+/g, " ");
}

function windowsOf(text: string): Set<string> {
  const w = words(text);
  const set = new Set<string>();
  for (let i = 0; i + WINDOW <= w.length; i++) set.add(w.slice(i, i + WINDOW).join(" "));
  return set;
}

/**
 * Huella de cada unidad. Con ≥ 8 palabras: sus secuencias de 8; se considera presente si aparece
 * al menos el 60 % (muchas unidades comparten el comienzo, p. ej. los propósitos, así que una
 * sola secuencia no basta; exigir todas dejaría pasar una copia con un corte). Las unidades
 * cortas (< 8 palabras) con al menos 20 caracteres se buscan como texto literal.
 */
const norm = (t: string) => t.replace(/\s+/g, " ").trim();
interface Probe {
  unitId: string;
  windows: string[];
  literal: string | null;
}
const detectable = release.units.flatMap((u): Probe[] => {
  const ws = [...windowsOf(u.text)];
  if (ws.length > 0) return [{ unitId: u.unitId, windows: ws, literal: null }];
  const lit = norm(u.text);
  return lit.length >= 20 ? [{ unitId: u.unitId, windows: [], literal: lit }] : [];
});
const allWindows = new Set<string>();
for (const u of release.units) for (const s of windowsOf(u.text)) allWindows.add(s);
const shortLiterals = detectable.flatMap((d) => (d.literal ? [d] : []));

function presentUnits(decoded: string): string[] {
  const present = windowsOf(decoded);
  return detectable
    .filter((d) => {
      if (d.literal) return decoded.includes(d.literal);
      const hits = d.windows.filter((w) => present.has(w)).length;
      return d.windows.length <= 2 ? hits === d.windows.length : hits / d.windows.length >= 0.6;
    })
    .map((d) => d.unitId);
}

function walk(dir: string, ext: RegExp): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p, ext) : ext.test(e) ? [p] : [];
  });
}

const problems: string[] = [];

/**
 * Marcas de código que solo debe existir en el servidor (F5-01): el prompt de Happy, el SDK del
 * proveedor y el nombre de la clave. Si aparecen en un chunk del cliente, algo se filtró.
 */
const SERVER_ONLY = [
  "Eres Happy, la asistente curricular",
  "anthropic-version",
  "ANTHROPIC_API_KEY",
];

/* 1 · JavaScript del cliente */
const chunks = walk(join(NEXT, "static"), /\.js$/);
let jsBytes = 0;
for (const f of chunks) {
  const raw = readFileSync(f, "utf8");
  jsBytes += raw.length;
  const text = decode(raw);
  const hits = [
    ...[...windowsOf(text)].filter((s) => allWindows.has(s)),
    ...shortLiterals.filter((d) => d.literal && text.includes(d.literal)).map((d) => d.literal),
  ];
  if (hits.length > 0)
    problems.push(`${relative(ROOT, f)}: contiene texto curricular («${hits[0] ?? ""}»)`);
  for (const marker of SERVER_ONLY)
    if (raw.includes(marker))
      problems.push(`${relative(ROOT, f)}: contiene código solo de servidor («${marker}»)`);
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

/**
 * Cada página se sirve como HTML (carga directa) y como payload RSC (.rsc y segmentos .rsc,
 * navegación en el cliente): se revisan todos sus archivos.
 */
const APP_DIR = join(NEXT, "server", "app");
const pages = walk(APP_DIR, /\.html$/);
const rows: string[] = [];
for (const f of pages) {
  const page = relative(APP_DIR, f);
  const base = f.slice(0, -".html".length);
  const files = [
    f,
    ...(existsSync(`${base}.rsc`) ? [`${base}.rsc`] : []),
    ...walk(`${base}.segments`, /\.rsc$/),
  ];
  const allowed = allowedFor(page);
  // Un texto idéntico a una unidad permitida o contenido en ella (p. ej. celdas combinadas entre
  // niveles, «Ciclo II: preescolar» dentro de «Ciclo II: preescolar - transición…») no es extra.
  const okTexts = [...allowed, ...catalogUnits].map((id) => norm(repo.maybeUnit(id)?.text ?? ""));
  const coveredByAllowed = (id: string) => {
    const t = norm(repo.maybeUnit(id)?.text ?? "");
    return t !== "" && okTexts.some((ok) => ok.includes(t));
  };
  let shownMax = 0;
  for (const file of files) {
    const shown = presentUnits(decode(readFileSync(file, "utf8")));
    shownMax = Math.max(shownMax, shown.length);
    const extra = shown.filter(
      (id) => !allowed.has(id) && !catalogUnits.has(id) && !coveredByAllowed(id),
    );
    if (extra.length > 0)
      problems.push(
        `${relative(APP_DIR, file)}: incluye ${String(extra.length)} unidades que la página no muestra (p. ej. ${extra.slice(0, 3).join(", ")})`,
      );
  }
  rows.push(
    `${page.padEnd(28)} ${String(shownMax).padStart(4)} unidades · ${String(files.length)} archivos`,
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
