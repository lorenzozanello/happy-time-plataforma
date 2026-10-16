/**
 * Construye el prototipo y lo empaqueta en un solo archivo HTML (sin plugins de terceros):
 *   dist/prototype/index.html          → documento completo (pruebas e2e, abrir localmente)
 *   dist/prototype/artifact.html       → fragmento para publicar como artifact (sin <html>/<head>/<body>)
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "vite";

const OUT = join(import.meta.dirname, "..", "dist", "prototype");

await build({ configFile: join(import.meta.dirname, "..", "vite.config.ts"), logLevel: "warn" });

let html = readFileSync(join(OUT, "index.html"), "utf8");
const assets = join(OUT, "assets");
for (const file of readdirSync(assets)) {
  const content = readFileSync(join(assets, file), "utf8");
  if (file.endsWith(".js")) {
    const tag = new RegExp(
      `<script type="module" crossorigin src="\\./assets/${file.replace(".", "\\.")}"></script>`,
    );
    if (!tag.test(html)) throw new Error(`No encontré la etiqueta de ${file}`);
    const safe = content.replace(/<\/script/gi, "<\\/script");
    html = html.replace(tag, () => `<script type="module">${safe}</script>`);
  } else if (file.endsWith(".css")) {
    const tag = new RegExp(
      `<link rel="stylesheet" crossorigin href="\\./assets/${file.replace(".", "\\.")}">`,
    );
    if (!tag.test(html)) throw new Error(`No encontré la etiqueta de ${file}`);
    html = html.replace(tag, () => `<style>${content}</style>`);
  }
}
if (/src="\.\/assets|href="\.\/assets/.test(html))
  throw new Error("Quedaron recursos sin incrustar");
writeFileSync(join(OUT, "index.html"), html);

// Fragmento para artifact: el publicador añade su propio esqueleto de documento.
const head = /<head>([\s\S]*?)<\/head>/.exec(html)?.[1] ?? "";
const body = /<body>([\s\S]*?)<\/body>/.exec(html)?.[1] ?? "";
const fragment = [
  head.replace(/<meta charset="utf-8" \/>\s*/, "").replace(/<meta name="viewport"[^>]*>\s*/, ""),
  body,
].join("\n");
writeFileSync(join(OUT, "artifact.html"), fragment);
const kb = (s: string) => `${Math.round(Buffer.byteLength(s) / 1024)} KB`;
console.log(`Prototipo: dist/prototype/index.html (${kb(html)}), artifact.html (${kb(fragment)})`);
