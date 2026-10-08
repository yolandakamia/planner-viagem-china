/* The trip itinerary, from China_Trip_Planner.html. It arrives either as the
   planner's "⬇ Backup .json" or as the link / message made by its
   "📤 Share itinerary" button (lib/roteiro.ts), which carries the same shape.
   The backup holds S.cenarios = [{id, nome, eventos[], dias{date:{cidade}}}].
   Planner events: {id, data, dataFim, hora, fim, tipo, titulo, empresa,
   cidade, local, status, notas, det:{endereco, enderecoCn, ...}}.

   - Times are copied exactly as typed. The zone (only used for "now") comes
     from the event's city, else the day's city: Brazil → São Paulo, any
     other → China. "Shenzhen → Brazil" reads the first leg.
   - Cancelled events are skipped. Multi-day events ("ends on") become one
     all-day entry per day.
   - Imported events are the "coletivo" layer and keep ref "planner:<id>[:date]".
     A new version REPLACES the itinerary (the planner is the reference) and
     never touches events typed in the app. */
import { abrirBanco } from "../db/banco";
import type { Evento, TipoEvento, Dia, Meta } from "../db/tipos";
import { avisarMudanca } from "../db/mudancas";
import { cidadeNoBrasil, FUSO_BRASIL, FUSO_CHINA, listaDias } from "./datas";
import { uuid, agoraISO } from "./uuid";

interface EvPlanner {
  id?: string; data?: string; dataFim?: string; hora?: string; fim?: string;
  tipo?: string; titulo?: string; empresa?: string; cidade?: string; local?: string;
  status?: string; notas?: string; det?: Record<string, unknown>;
}
interface OpcaoPlanner { id: string; nome: string; eventos: EvPlanner[]; dias: Record<string, { cidade?: string }> }
export interface BackupPlanner { cenarios: OpcaoPlanner[]; cenPrincipal?: string }

const TIPO: Record<string, TipoEvento> = {
  voo: "deslocamento", traslado: "deslocamento", feira: "feira", visita: "reuniao",
  hotel: "outro", refeicao: "refeicao", livre: "livre", outro: "outro",
};

const ehData = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const ehHora = (s: unknown): s is string => typeof s === "string" && /^\d{2}:\d{2}$/.test(s);
const txt = (s: unknown) => (typeof s === "string" ? s.trim() : "");

/* reads and checks the file; throws a message in Portuguese when it is not a planner backup */
export function lerBackup(texto: string): BackupPlanner {
  let j: unknown;
  try { j = JSON.parse(texto); } catch { throw new Error("O arquivo não é um JSON válido."); }
  const b = j as BackupPlanner;
  if (!b || !Array.isArray(b.cenarios) || !b.cenarios.length || !b.cenarios.every((c) => Array.isArray(c?.eventos)))
    throw new Error("Esse arquivo não parece o Backup .json do China_Trip_Planner.");
  return b;
}

function converter(b: BackupPlanner, opcaoId: string) {
  const op = b.cenarios.find((c) => c.id === opcaoId) ?? b.cenarios[0];
  const dias = op.dias && typeof op.dias === "object" ? op.dias : {};
  const eventos: Omit<Evento, "id" | "criadoEm" | "atualizadoEm">[] = [];
  let ignorados = 0;
  for (const e of op.eventos) {
    if (!ehData(e.data) || e.status === "Cancelled") { ignorados++; continue; }
    const cidade = txt(e.cidade) || txt(dias[e.data]?.cidade);
    const fuso = cidade && cidadeNoBrasil(cidade) ? FUSO_BRASIL : FUSO_CHINA;
    const det = (e.det && typeof e.det === "object" ? e.det : {}) as Record<string, unknown>;
    const obs = [
      txt(e.empresa) && `Empresa: ${txt(e.empresa)}`,
      txt(e.status) && `Status: ${txt(e.status)}`,
      txt(e.notas),
    ].filter(Boolean).join("\n");
    const base = {
      camada: "coletivo" as const, origemId: null,
      fuso, titulo: txt(e.titulo) || "(sem título)",
      tipo: TIPO[e.tipo ?? ""] ?? "outro",
      local: [txt(e.local), txt(det.endereco), cidade].filter((x, i, a) => x && a.indexOf(x) === i).join(" · "),
      enderecoCn: txt(det.enderecoCn), obs,
    };
    const multi = ehData(e.dataFim) && e.dataFim > e.data;
    if (multi) {
      for (const d of listaDias(e.data, e.dataFim!))
        eventos.push({ ...base, ref: `planner:${e.id}:${d}`, data: d, horaInicio: "", horaFim: "" });
    } else {
      eventos.push({ ...base, ref: `planner:${e.id}`, data: e.data,
        horaInicio: ehHora(e.hora) ? e.hora : "", horaFim: ehHora(e.hora) && ehHora(e.fim) ? e.fim : "" });
    }
  }
  const cidades = Object.entries(dias).filter(([d, v]) => ehData(d) && txt(v?.cidade)).map(([d, v]) => [d, txt(v.cidade)] as const);
  return { eventos, ignorados, cidades };
}

export interface Previa { novos: number; atualizados: number; removidos: number; ignorados: number; cidades: number }
export interface VersaoRoteiro { em: string; plano: string }

/* events that belong to the itinerary: the coletivo layer, plus events
   imported before the layer existed (pessoal with a planner ref) */
const doRoteiro = (e: Evento) => e.camada === "coletivo" || !!e.ref?.startsWith("planner:");

export async function previa(b: BackupPlanner, opcaoId: string): Promise<Previa> {
  const { eventos, ignorados, cidades } = converter(b, opcaoId);
  const db = await abrirBanco();
  const atuais = (await db.getAll("eventos")).filter(doRoteiro);
  const refs = new Set(atuais.map((e) => e.ref));
  const novasRefs = new Set(eventos.map((e) => e.ref));
  const atualizados = eventos.filter((e) => refs.has(e.ref)).length;
  return { novos: eventos.length - atualizados, atualizados, removidos: atuais.filter((e) => !novasRefs.has(e.ref)).length,
    ignorados, cidades: cidades.length };
}

/* The itinerary REPLACES the previous one: its events are updated in place
   (same id, so nothing that points to them breaks), new ones are created and
   the ones that left the planner are removed. Events typed in the app
   (pessoal, no planner ref) are never touched. One transaction. */
export async function importar(b: BackupPlanner, opcaoId: string, comCidades: boolean, versao?: VersaoRoteiro): Promise<Previa> {
  const { eventos, ignorados, cidades } = converter(b, opcaoId);
  const db = await abrirBanco();
  const tx = db.transaction(["eventos", "dias", "meta"], "readwrite");
  const st = tx.objectStore("eventos");
  const porRef = new Map<string, Evento>();
  for (const e of await st.getAll()) if (doRoteiro(e) && e.ref) porRef.set(e.ref, e);
  const t = agoraISO();
  let novos = 0, atualizados = 0, removidos = 0;
  for (const e of eventos) {
    const velho = porRef.get(e.ref!);
    if (velho) { atualizados++; porRef.delete(e.ref!); await st.put({ ...velho, ...e, id: velho.id, criadoEm: velho.criadoEm, atualizadoEm: t }); }
    else { novos++; await st.put({ ...e, id: uuid(), criadoEm: t, atualizadoEm: t }); }
  }
  for (const velho of porRef.values()) { removidos++; await st.delete(velho.id); }
  let nCid = 0;
  if (comCidades) {
    const sd = tx.objectStore("dias"), idx = sd.index("porData");
    for (const [data, cidade] of cidades) {
      const d: Dia | undefined = await idx.get(data);
      if (d) { if (d.cidade !== cidade) { await sd.put({ ...d, cidade }); nCid++; } }
      else { await sd.put({ id: uuid(), data, cidade, lavanderia: false, lookIds: [], notas: "" }); nCid++; }
    }
  }
  const sm = tx.objectStore("meta"), m = await sm.get("meta");
  if (m) {
    const op = b.cenarios.find((c) => c.id === opcaoId) ?? b.cenarios[0];
    await sm.put({ ...m, roteiro: { em: versao?.em ?? t, recebidoEm: t, plano: versao?.plano ?? op.nome ?? "" } });
  }
  await tx.done;
  avisarMudanca();
  return { novos, atualizados, removidos, ignorados, cidades: nCid };
}

export async function versaoAtual(): Promise<Meta["roteiro"] | null> {
  const db = await abrirBanco();
  return (await db.get("meta", "meta"))?.roteiro ?? null;
}
