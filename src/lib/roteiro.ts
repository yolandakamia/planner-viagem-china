/* The group itinerary as a message: made by the planner's "📤 Share itinerary"
   button or by the app's "📤 Compartilhar roteiro", read by both.

   It travels INSIDE the link, after "#roteiro=", as deflate-raw JSON encoded
   "B<bytes>L<base32>" (the first links used base64url; still accepted). The part after "#" never reaches any server: only whoever got the
   message has the itinerary. The same code is accepted pasted from the whole
   WhatsApp/WeChat message ("Colar roteiro"), which is how an iPhone gets it
   into the app installed on the Home Screen (iOS opens links in Safari,
   whose storage is separate).

   Payload v2: { app: "viagem-china-roteiro", v: 2, em: ISO time it was shared,
     de: who sent it ("planejador" or the traveller's name), plano: plan name,
     eventos: [{ref, ed, por, ...planner fields}], excluidos: [{ref, em}],
     dias?: {date: {cidade}} (only from the planner) }
   v1 (first links): no ref/ed/excluidos — a full snapshot of the planner.
   Merging rules: lib/grupo.ts. */
import { inflateSync, deflateSync, strFromU8, strToU8 } from "fflate";
import type { RoteiroRecebido, EvRoteiro } from "./grupo";
import { t } from "./i18n";
import { SEMANA_CURTA } from "./datas";

/* the link was cut short: its message is already the one to show */
class Cortado extends Error {}

const APP = "viagem-china-roteiro";
const RE = /roteiro=([A-Za-z0-9_-]{20,})/;


export const temRoteiro = (texto: string) => RE.test(texto);

function deBase64url(s: string): Uint8Array<ArrayBuffer> {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  const u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u;
}

/* current code: "B<bytes>L<base32 a–z2–7>" — letters and digits only, since
   WhatsApp reads "_" "-" "*" "~" as formatting and mangled base64url links */
function deBase32(s: string): Uint8Array<ArrayBuffer> {
  const AB = "abcdefghijklmnopqrstuvwxyz234567";
  const out: number[] = []; let bits = 0, val = 0;
  for (const c of s) {
    const i = AB.indexOf(c); if (i < 0) throw new Error("caractere");
    val = (val << 5) | i; bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
    val &= (1 << bits) - 1;
  }
  return new Uint8Array(out);
}
function decodificar(codigo: string): Uint8Array<ArrayBuffer> {
  const m = /^B(\d+)L([a-z2-7]+)$/.exec(codigo);
  if (!m) {
    if (/^B\d+L/.test(codigo)) throw new Error("alterado");
    return deBase64url(codigo);                     // first version of the links
  }
  const bytes = deBase32(m[2]), esperado = +m[1];
  if (bytes.length < esperado)
    throw new Cortado(t("O link chegou cortado ({p}% do roteiro). Peça para reenviar, ou copie a mensagem inteira e use \"Colar roteiro\".", { p: Math.round((bytes.length / esperado) * 100) }));
  return bytes.subarray(0, esperado);
}

/* fflate (bundled), not the browser's DecompressionStream: works the same
   on any browser, Samsung Internet included */
function inflar(bytes: Uint8Array): string {
  return strFromU8(inflateSync(bytes));
}

/* technical details shown under an error, so a screenshot says what went wrong */
export function diagnostico(texto: string): string {
  const m = RE.exec(texto), c = m?.[1] ?? "";
  const b = /^B(\d+)L([a-z2-7]*)/.exec(c);
  const partes = [`app ${__VERSAO__}`, t("código {n}", { n: c.length })];
  if (b) partes.push(`esperado ${b[1]} bytes, chegou ${Math.floor((b[2].length * 5) / 8)}`, `resto "${c.slice(2 + b[1].length + b[2].length, 2 + b[1].length + b[2].length + 12)}"`);
  else partes.push(`formato ${c ? "antigo" : "nenhum"}`);
  partes.push(`início "${c.slice(0, 14)}" fim "${c.slice(-10)}"`, `texto ${texto.length}`);
  return partes.join(" · ");
}

/* finds the code anywhere in a link or a pasted message and opens it;
   throws a message in Portuguese */
export async function lerRoteiro(texto: string): Promise<RoteiroRecebido> {
  const m = RE.exec(texto);
  if (!m) throw new Error(t("Não encontrei nenhum roteiro nesse texto. Copie a mensagem inteira (com o link) e tente de novo."));
  let j: { app?: string; v?: number; em?: string; de?: string; plano?: string; eventos?: unknown; excluidos?: unknown; dias?: unknown };
  let bytes: Uint8Array<ArrayBuffer>;
  try { bytes = decodificar(m[1]); }
  catch (e) {
    if (e instanceof Cortado) throw e;
    throw new Error(t("O link do roteiro chegou alterado. Peça para reenviar a mensagem."));
  }
  let json: string;
  try { json = inflar(bytes); }
  catch { throw new Error(t("O roteiro chegou com defeito (não consegui descompactar). Peça para reenviar a mensagem.")); }
  try { j = JSON.parse(json); }
  catch { throw new Error(t("O roteiro chegou com defeito (dados ilegíveis). Peça para reenviar a mensagem.")); }
  if (j.app !== APP || !Array.isArray(j.eventos) || typeof j.em !== "string")
    throw new Error(t("Esse link não é um roteiro do planejador da viagem."));
  if ((j.v ?? 0) > 2) throw new Error(t("Esse roteiro foi feito por uma versão mais nova. Atualize o app (com internet) e tente de novo."));
  return {
    em: j.em, plano: typeof j.plano === "string" ? j.plano : "", de: typeof j.de === "string" ? j.de : "planejador",
    eventos: j.eventos as EvRoteiro[],
    excluidos: Array.isArray(j.excluidos) ? j.excluidos as RoteiroRecebido["excluidos"] : [],
    dias: j.dias && typeof j.dias === "object" ? j.dias as Record<string, { cidade?: string }> : null,
    // the planner always sends ALL its events: a planner event missing from it was deleted there
    completo: (j.v ?? 1) < 2 || j.de === "planejador",
  };
}

/* ---------- making a message on the phone (same format as the planner) ---------- */
const URL_APP = "https://yolandakamia.github.io/planner-viagem-china/";
function base32(u: Uint8Array): string {
  const AB = "abcdefghijklmnopqrstuvwxyz234567"; let out = "", bits = 0, val = 0;
  for (const b of u) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += AB[(val >>> (bits - 5)) & 31]; bits -= 5; } val &= (1 << bits) - 1; }
  if (bits > 0) out += AB[(val << (5 - bits)) & 31];
  return out;
}
export function montarMensagem(r: { eventos: EvRoteiro[]; excluidos: { ref: string; em: string }[]; nome: string; plano: string }, agora = new Date()): string {
  const bytes = deflateSync(strToU8(JSON.stringify({ app: APP, v: 2, em: agora.toISOString(), de: r.nome || "celular",
    plano: r.plano, eventos: r.eventos, excluidos: r.excluidos })), { level: 9 });
  return t("🇨🇳 *Roteiro da viagem* — versão de {quando}", { quando: quandoRoteiro(agora.toISOString()) })
    + (r.nome ? t(" · por {nome}", { nome: r.nome }) : "") + "\n\n"
    + t("Toque no link para atualizar o app.") + "\n"
    + t("📱 iPhone: copie esta mensagem inteira, abra o app e toque em \"📋 Colar roteiro\".") + "\n\n"
    + URL_APP + "#roteiro=B" + bytes.length + "L" + base32(bytes);
}

/* "qua 14/10 15:20", in the phone's own clock */
export function quandoRoteiro(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${SEMANA_CURTA[d.getDay()]} ${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const ehIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const instalado = () => matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
