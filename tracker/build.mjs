// Baut tracker/src/index.ts → public/tracker.js (minifiziert, ES2017) und prüft das Größenbudget.
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const BUDGET_BYTES = 3 * 1024;
const outfile = new URL("../public/tracker.js", import.meta.url).pathname;

await build({
  entryPoints: [new URL("./src/index.ts", import.meta.url).pathname],
  outfile,
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2017",
  legalComments: "none",
  banner: { js: "/*! NOVA Analytics – datenschutzfreundliche Web-Analyse */" },
});

const size = gzipSync(readFileSync(outfile)).length;
console.log(`tracker.js: ${size} Bytes gzip (Budget ${BUDGET_BYTES})`);
if (size > BUDGET_BYTES) {
  console.error("Größenbudget überschritten");
  process.exit(1);
}
