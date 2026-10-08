/* The itinerary sent by the planner's "📤 Share itinerary" button.

   It travels INSIDE the link, after "#roteiro=", as deflate-raw JSON encoded
   "B<bytes>L<base32>" (the first links used base64url; still accepted). The part after "#" never reaches any server: only whoever got the
   message has the itinerary. The same code is accepted pasted from the whole
   WhatsApp/WeChat message ("Colar roteiro"), which is how an iPhone gets it
   into the app installed on the Home Screen (iOS opens links in Safari,
   whose storage is separate).

   Payload: { app: "viagem-china-roteiro", v: 1, em: ISO time it was shared,
              plano: plan name, eventos: [planner events], dias: {date: {cidade}} } */
import { inflateSync, strFromU8 } from "fflate";
import type { BackupPlanner, VersaoRoteiro } from "./importarPlanner";

const APP = "viagem-china-roteiro";
const RE = /roteiro=([A-Za-z0-9_-]{20,})/;

export interface RoteiroRecebido { versao: VersaoRoteiro; backup: BackupPlanner; nEventos: number }

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
    throw new Error(`O link chegou cortado (${Math.round((bytes.length / esperado) * 100)}% do roteiro). Peça para reenviar, ou copie a mensagem inteira e use "Colar roteiro".`);
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
  const b = /^B(d+)L([a-z2-7]*)/.exec(c);
  const partes = [`app ${__VERSAO__}`, `código ${c.length}`];
  if (b) partes.push(`esperado ${b[1]} bytes, chegou ${Math.floor((b[2].length * 5) / 8)}`, `resto "${c.slice(2 + b[1].length + b[2].length, 2 + b[1].length + b[2].length + 12)}"`);
  else partes.push(`formato ${c ? "antigo" : "nenhum"}`);
  partes.push(`início "${c.slice(0, 14)}" fim "${c.slice(-10)}"`, `texto ${texto.length}`);
  return partes.join(" · ");
}

/* finds the code anywhere in a link or a pasted message and opens it;
   throws a message in Portuguese */
export async function lerRoteiro(texto: string): Promise<RoteiroRecebido> {
  const m = RE.exec(texto);
  if (!m) throw new Error("Não encontrei nenhum roteiro nesse texto. Copie a mensagem inteira (com o link) e tente de novo.");
  let j: { app?: string; v?: number; em?: string; plano?: string; eventos?: unknown; dias?: unknown };
  let bytes: Uint8Array<ArrayBuffer>;
  try { bytes = decodificar(m[1]); }
  catch (e) {
    if ((e as Error).message.startsWith("O link")) throw e;
    throw new Error("O link do roteiro chegou alterado. Peça para reenviar a mensagem.");
  }
  let json: string;
  try { json = inflar(bytes); }
  catch { throw new Error("O roteiro chegou com defeito (não consegui descompactar). Peça para reenviar a mensagem."); }
  try { j = JSON.parse(json); }
  catch { throw new Error("O roteiro chegou com defeito (dados ilegíveis). Peça para reenviar a mensagem."); }
  if (j.app !== APP || !Array.isArray(j.eventos) || typeof j.em !== "string")
    throw new Error("Esse link não é um roteiro do planejador da viagem.");
  if ((j.v ?? 0) > 1) throw new Error("Esse roteiro foi feito por uma versão mais nova. Atualize o app (com internet) e tente de novo.");
  const plano = typeof j.plano === "string" ? j.plano : "";
  const dias = j.dias && typeof j.dias === "object" ? j.dias as Record<string, { cidade?: string }> : {};
  return {
    versao: { em: j.em, plano },
    backup: { cenarios: [{ id: "roteiro", nome: plano, eventos: j.eventos as BackupPlanner["cenarios"][0]["eventos"], dias }], cenPrincipal: "roteiro" },
    nEventos: j.eventos.length,
  };
}

/* "qua 14/10 15:20", in the phone's own clock */
export function quandoRoteiro(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getDay()]} ${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const ehIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const instalado = () => matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
