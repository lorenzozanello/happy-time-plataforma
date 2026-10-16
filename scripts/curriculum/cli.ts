/**
 * CLI del pipeline curricular.
 *   gate     → ejecuta el gate y muestra el resultado
 *   compile  → escribe curriculum/build/*
 *   check    → recompila en memoria y falla si difiere de lo versionado (CI)
 *   diff A B → reporte Markdown de diferencias entre dos releases compiladas
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CurriculumReleaseSchema } from "../../src/domain/curriculum/schema";
import { diffReleases, diffToMarkdown } from "./diff";
import { runGate } from "./gate";
import { LOCK_PATH, BUILD_DIR, ROOT, runPipeline } from "./pipeline";
import { SourceLockSchema, loadJson } from "./lock";
import { readWorkbook } from "./xlsx";

function printGate(): boolean {
  const lock = loadJson(LOCK_PATH, SourceLockSchema);
  const bytes = new Uint8Array(readFileSync(join(ROOT, lock.file)));
  const gate = runGate(bytes, readWorkbook(bytes), lock);
  for (const c of gate.checks) {
    console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.id}  ${c.description}`);
    if (!c.pass)
      console.log(
        `      esperado: ${JSON.stringify(c.expected)}\n      obtenido: ${JSON.stringify(c.actual)}`,
      );
  }
  console.log(
    `\nGate: ${gate.pass ? "PASS" : "FAIL"} (${gate.checks.filter((c) => c.pass).length}/${gate.checks.length})`,
  );
  return gate.pass;
}

function main(): number {
  const [cmd, ...args] = process.argv.slice(2);
  switch (cmd) {
    case "gate":
      return printGate() ? 0 : 1;
    case "compile": {
      const { files, compiled } = runPipeline();
      mkdirSync(BUILD_DIR, { recursive: true });
      for (const [name, content] of Object.entries(files))
        writeFileSync(join(BUILD_DIR, name), content);
      console.log(
        `Compilado: ${compiled.release.counts.units} unidades → ${Object.keys(files).join(", ")}`,
      );
      for (const w of compiled.warnings) console.warn(`AVISO: ${w}`);
      return 0;
    }
    case "check": {
      const { files } = runPipeline();
      let ok = true;
      for (const [name, content] of Object.entries(files)) {
        let onDisk: string;
        try {
          onDisk = readFileSync(join(BUILD_DIR, name), "utf8");
        } catch {
          onDisk = "";
        }
        const same = onDisk === content;
        ok &&= same;
        console.log(`${same ? "OK  " : "DIFF"}  curriculum/build/${name}`);
      }
      if (!ok)
        console.error(
          "\nLos artefactos versionados no coinciden con la fuente. Ejecuta `npm run curriculum:compile`.",
        );
      return ok ? 0 : 1;
    }
    case "diff": {
      const [a, b] = args;
      if (!a || !b) {
        console.error("Uso: npm run curriculum:diff -- <anterior.json> <nueva.json>");
        return 2;
      }
      const load = (p: string) =>
        CurriculumReleaseSchema.parse(JSON.parse(readFileSync(p, "utf8")));
      process.stdout.write(diffToMarkdown(diffReleases(load(a), load(b))));
      return 0;
    }
    default:
      console.error("Comandos: gate | compile | check | diff <a> <b>");
      return 2;
  }
}

process.exitCode = main();
