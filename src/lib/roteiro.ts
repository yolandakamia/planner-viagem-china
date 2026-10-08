/* The itinerary sent by the planner's "📤 Share itinerary" button.

   It travels INSIDE the link, after "#roteiro=", as deflate-raw + base64url
   JSON. The part after "#" never reaches any server: only whoever got the
   message has the itinerary. The same code is accepted pasted from the whole
   WhatsApp/WeChat message ("Colar roteiro"), which is how an iPhone gets it
   into the app installed on the Home Screen (iOS opens links in Safari,
   whose storage is separate).

   Payload: { app: "viagem-china-roteiro", v: 1, em: ISO time it was shared,
              plano: plan name, eventos: [planner events], dias: {date: {cidade}} } */
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

async function inflar(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const fluxo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(fluxo).text();
}

/* finds the code anywhere in a link or a pasted message and opens it;
   throws a message in Portuguese */
export async function lerRoteiro(texto: string): Promise<RoteiroRecebido> {
  const m = RE.exec(texto);
  if (!m) throw new Error("Não encontrei nenhum roteiro nesse texto. Copie a mensagem inteira (com o link) e tente de novo.");
  let j: { app?: string; v?: number; em?: string; plano?: string; eventos?: unknown; dias?: unknown };
  try { j = JSON.parse(await inflar(deBase64url(m[1]))); }
  catch { throw new Error("O roteiro chegou cortado ou com defeito. Peça para reenviar a mensagem."); }
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
