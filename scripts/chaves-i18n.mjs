// Lists the interface texts used in the code — t("…") and tn(n, "…", "…") —
// and, for each dictionary in src/i18n/, the ones still missing.
//   node scripts/chaves-i18n.mjs            → summary
//   node scripts/chaves-i18n.mjs --json     → every key, as JSON
//   node scripts/chaves-i18n.mjs --faltam   → missing keys per language, as JSON
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const arquivos = [];
(function andar(d) {
  for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) andar(p); else if (/\.(tsx?|mjs)$/.test(f)) arquivos.push(p); }
})("src");

const STR = '"((?:[^"\\\\]|\\\\.)*)"';                  // a "double-quoted" string literal
const reT = new RegExp("\\bt\\(\\s*" + STR, "g");
const reTn = new RegExp("\\btn\\(\\s*[^,]+,\\s*" + STR + "\\s*,\\s*" + STR, "g");
const des = (s) => JSON.parse('"' + s + '"');

const chaves = new Set();
for (const a of arquivos) {
  const s = readFileSync(a, "utf8");
  for (const m of s.matchAll(reT)) chaves.add(des(m[1]));
  for (const m of s.matchAll(reTn)) { chaves.add(des(m[1])); chaves.add(des(m[2])); }
}
const faltam = {};
for (const l of ["en", "zh"]) {
  const dic = JSON.parse(readFileSync(`src/i18n/${l}.json`, "utf8"));
  faltam[l] = [...chaves].filter((k) => !dic[k]).sort();
  const sobra = Object.keys(dic).filter((k) => !chaves.has(k));
  if (process.argv.length < 3) console.log(`${l}: ${chaves.size} chaves, faltam ${faltam[l].length}, sobram ${sobra.length}`);
}
if (process.argv.includes("--json")) console.log(JSON.stringify([...chaves].sort(), null, 1));
if (process.argv.includes("--faltam")) console.log(JSON.stringify(faltam, null, 1));
