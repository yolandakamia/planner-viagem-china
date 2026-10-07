/* Import from China_Trip_Planner.html ("⬇ Backup .json").
   The backup holds S.cenarios = [{id, nome, eventos[], dias{date:{cidade}}}].
   Planner events: {id, data, dataFim, hora, fim, tipo, titulo, empresa,
   cidade, local, status, notas, det:{endereco, enderecoCn, ...}}.

   - Times are copied exactly as typed. The zone (only used for "now") comes
     from the event's city, else the day's city: Brazil → São Paulo, any
     other → China. "Shenzhen → Brazil" reads the first leg.
   - Cancelled events are skipped. Multi-day events ("ends on") become one
     all-day entry per day.
   - Every imported event keeps ref "planner:<id>[:date]": importing again
     UPDATES those events (the planner is the reference) and never touches
     events typed in the app. */
import { abrirBanco } from "../db/banco";
import type { Evento, TipoEvento, Dia } from "../db/tipos";
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

export interface Previa { novos: number; atualizados: number; ignorados: number; cidades: number }

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
      camada: "pessoal" as const, origemId: null,
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

export async function previa(b: BackupPlanner, opcaoId: string): Promise<Previa> {
  const { eventos, ignorados, cidades } = converter(b, opcaoId);
  const db = await abrirBanco();
  const refs = new Set((await db.getAll("eventos")).map((e) => e.ref).filter(Boolean));
  const atualizados = eventos.filter((e) => refs.has(e.ref)).length;
  return { novos: eventos.length - atualizados, atualizados, ignorados, cidades: cidades.length };
}

export async function importar(b: BackupPlanner, opcaoId: string, comCidades: boolean): Promise<Previa> {
  const { eventos, ignorados, cidades } = converter(b, opcaoId);
  const db = await abrirBanco();
  const tx = db.transaction(["eventos", "dias"], "readwrite");
  const st = tx.objectStore("eventos");
  const porRef = new Map<string, Evento>();
  for (const e of await st.getAll()) if (e.ref) porRef.set(e.ref, e);
  const t = agoraISO();
  let novos = 0, atualizados = 0;
  for (const e of eventos) {
    const velho = porRef.get(e.ref!);
    if (velho) { atualizados++; await st.put({ ...velho, ...e, id: velho.id, criadoEm: velho.criadoEm, atualizadoEm: t }); }
    else { novos++; await st.put({ ...e, id: uuid(), criadoEm: t, atualizadoEm: t }); }
  }
  let nCid = 0;
  if (comCidades) {
    const sd = tx.objectStore("dias"), idx = sd.index("porData");
    for (const [data, cidade] of cidades) {
      const d: Dia | undefined = await idx.get(data);
      if (d) { if (d.cidade !== cidade) { await sd.put({ ...d, cidade }); nCid++; } }
      else { await sd.put({ id: uuid(), data, cidade, lavanderia: false, lookIds: [], notas: "" }); nCid++; }
    }
  }
  await tx.done;
  avisarMudanca();
  return { novos, atualizados, ignorados, cidades: nCid };
}
