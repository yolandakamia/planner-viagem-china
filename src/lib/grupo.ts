/* The group itinerary ("coletivo" events), shared between the phones and the
   planner by message (WhatsApp / WeChat), with no server.

   Every group event has a stable `ref`, the same on every phone and in the
   planner: "planner:<id>" (made in the planner; "planner:<id>:<date>" for one
   day of a multi-day event) or "app:<uuid>" (made on a phone). Its version is
   `editadoEm`, the time of its last edit.

   Receiving an itinerary MERGES, event by event:
   - a new event is added; an event in both places keeps the newest version;
   - a deletion travels in the message (`excluidos`) and removes the event
     here, unless it was edited here after the deletion;
   - personal events (camada "pessoal") are never touched.
   A message from the planner (and its Backup .json) carries ALL the planner's
   events: a planner event missing from it was deleted there and is removed
   here too (unless edited here later). Events made on phones are never
   removed that way. */
import { abrirBanco } from "../db/banco";
import type { Evento, TipoEvento, Meta, Dia } from "../db/tipos";
import { avisarMudanca } from "../db/mudancas";
import { cidadeNoBrasil, FUSO_BRASIL, FUSO_CHINA, listaDias } from "./datas";
import { uuid, agoraISO } from "./uuid";

/* an event as it travels in the message: the planner's vocabulary */
export interface EvRoteiro {
  ref?: string; id?: string; ed?: string; por?: string;
  data?: string; dataFim?: string; hora?: string; fim?: string;
  tipo?: string; titulo?: string; empresa?: string; cidade?: string; local?: string;
  status?: string; notas?: string; det?: { endereco?: string; enderecoCn?: string };
}
export interface RoteiroRecebido {
  em: string; plano: string; de: string;
  eventos: EvRoteiro[]; excluidos: { ref: string; em: string }[];
  dias: Record<string, { cidade?: string }> | null;
  completo: boolean;            // from the planner (any version) or its Backup .json: all of its events
}

export const DO_PLANNER: Record<string, TipoEvento> = {
  voo: "deslocamento", traslado: "deslocamento", feira: "feira", visita: "reuniao",
  hotel: "outro", refeicao: "refeicao", livre: "livre", outro: "outro",
};
const PARA_PLANNER: Record<TipoEvento, string> = {
  deslocamento: "traslado", feira: "feira", reuniao: "visita", refeicao: "refeicao", livre: "livre", outro: "outro",
};

const ehData = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const ehHora = (s: unknown): s is string => typeof s === "string" && /^\d{2}:\d{2}$/.test(s);
const txt = (s: unknown) => (typeof s === "string" ? s.trim() : "");
export const ehGrupo = (e: Evento) => e.camada === "coletivo" || !!e.ref?.startsWith("planner:");
const base = (ref: string) => ref.replace(/:\d{4}-\d{2}-\d{2}$/, "");

/* "Vista Aérea · Rua X · Shanghai" — what the lists show as the place */
export const ondeEvento = (e: Evento) =>
  [e.local, e.endereco, e.cidade].filter((x, i, a) => x && a.indexOf(x) === i).join(" · ");

/* ---------- message → app events ---------- */
type Novo = Omit<Evento, "id" | "criadoEm" | "atualizadoEm">;
function paraApp(p: EvRoteiro, ref: string, ed: string, cidadeDia: (d: string) => string): Novo[] {
  const cidade = txt(p.cidade);
  const det = p.det && typeof p.det === "object" ? p.det : {};
  const fusoDe = (d: string) => { const c = cidade || cidadeDia(d); return c && cidadeNoBrasil(c) ? FUSO_BRASIL : FUSO_CHINA; };
  const b = {
    camada: "coletivo" as const, origemId: null, titulo: txt(p.titulo) || "(sem título)",
    tipo: DO_PLANNER[p.tipo ?? ""] ?? (["feira", "reuniao", "deslocamento", "refeicao", "livre", "outro"].includes(p.tipo ?? "") ? p.tipo as TipoEvento : "outro"),
    tipoOrig: txt(p.tipo), local: txt(p.local), enderecoCn: txt(det.enderecoCn), obs: txt(p.notas),
    editadoEm: ed, autor: txt(p.por), empresa: txt(p.empresa), status: txt(p.status), cidade, endereco: txt(det.endereco),
  };
  if (ehData(p.dataFim) && p.dataFim > p.data!)
    return listaDias(p.data!, p.dataFim).map((d) => ({ ...b, ref: `${ref}:${d}`, data: d, fuso: fusoDe(d), horaInicio: "", horaFim: "" }));
  return [{ ...b, ref, data: p.data!, fuso: fusoDe(p.data!),
    horaInicio: ehHora(p.hora) ? p.hora : "", horaFim: ehHora(p.hora) && ehHora(p.fim) ? p.fim : "" }];
}

/* ---------- app event → message ---------- */
export function paraRoteiro(e: Evento): EvRoteiro {
  const r: EvRoteiro = {
    ref: e.ref!, ed: e.editadoEm || e.atualizadoEm, por: e.autor || undefined,
    data: e.data, hora: e.horaInicio || undefined, fim: e.horaFim || undefined,
    // the planner's own type when the app type still matches it (✈️ flight stays a flight)
    tipo: e.tipoOrig && DO_PLANNER[e.tipoOrig] === e.tipo ? e.tipoOrig : PARA_PLANNER[e.tipo] ?? "outro",
    titulo: e.titulo, empresa: e.empresa || undefined, cidade: e.cidade || undefined, local: e.local || undefined,
    status: e.status || undefined, notas: e.obs || undefined,
  };
  if (e.endereco || e.enderecoCn) r.det = { endereco: e.endereco || undefined, enderecoCn: e.enderecoCn || undefined };
  return JSON.parse(JSON.stringify(r));        // drops the undefined keys
}

/* ---------- the merge plan (pure: the preview and the write use the same) ---------- */
export interface Plano {
  gravar: Evento[]; apagar: Evento[]; novos: number; atualizados: number; removidos: number;
  iguais: number; maisAntigos: number; excluidos: { ref: string; em: string }[]; cidades: [string, string][];
}
export function planejar(r: RoteiroRecebido, atuais: Evento[], meta: Meta | undefined, dias: Dia[]): Plano {
  const t = agoraISO();
  const porRef = new Map<string, Evento>();
  for (const e of atuais) if (ehGrupo(e) && e.ref) porRef.set(e.ref, e);
  const tumbas = new Map((meta?.excluidos ?? []).map((x) => [x.ref, x.em]));
  const cidadeDia = (d: string) => txt(r.dias?.[d]?.cidade) || dias.find((x) => x.data === d)?.cidade || "";
  const gravar = new Map<string, Evento>(), apagar = new Map<string, Evento>();
  let novos = 0, atualizados = 0, iguais = 0, maisAntigos = 0;
  const vistos = new Set<string>();

  for (const p of r.eventos) {
    const ref = txt(p.ref) || (p.id ? `planner:${p.id}` : "");
    if (!ref || !ehData(p.data) || p.status === "Cancelled") continue;
    const ed = txt(p.ed) || r.em;
    const entradas = paraApp(p, ref, ed, cidadeDia);
    entradas.forEach((x) => vistos.add(x.ref!)); vistos.add(ref);
    const tumba = tumbas.get(ref);
    if (tumba && tumba >= ed) { maisAntigos++; continue; }
    let mudou = false;
    for (const x of entradas) {
      const velho = porRef.get(x.ref!);
      if (velho && (velho.editadoEm ?? "") >= ed && velho.camada === "coletivo") { iguais++; continue; }
      mudou = true;
      if (velho) atualizados++; else novos++;
      gravar.set(x.ref!, { ...(velho ?? {}), ...x, id: velho?.id ?? uuid(), criadoEm: velho?.criadoEm ?? t, atualizadoEm: t } as Evento);
    }
    // a multi-day event that got shorter: drop the days that left
    if (mudou) for (const [rf, e] of porRef)
      if (base(rf) === ref && rf !== ref && !entradas.some((x) => x.ref === rf) && (e.editadoEm ?? "") <= ed) apagar.set(rf, e);
  }

  const excluidos = new Map(tumbas);
  for (const x of r.excluidos ?? []) {
    if (!x?.ref || !x.em) continue;
    if ((excluidos.get(x.ref) ?? "") < x.em) excluidos.set(x.ref, x.em);
    for (const [rf, e] of porRef)
      if ((rf === x.ref || base(rf) === x.ref) && (e.editadoEm ?? "") <= x.em && !gravar.has(rf)) apagar.set(rf, e);
  }
  if (r.completo)                       // snapshot of the planner: what is not there was removed
    for (const [rf, e] of porRef)
      if (rf.startsWith("planner:") && !vistos.has(rf) && !vistos.has(base(rf)) && (e.editadoEm ?? "") <= r.em) apagar.set(rf, e);
  for (const rf of apagar.keys()) gravar.delete(rf);

  const cidades = r.dias ? Object.entries(r.dias).filter(([d, v]) => ehData(d) && txt(v?.cidade))
    .map(([d, v]) => [d, txt(v.cidade)] as [string, string])
    .filter(([d, c]) => dias.find((x) => x.data === d)?.cidade !== c) : [];
  return { gravar: [...gravar.values()], apagar: [...apagar.values()], novos, atualizados, removidos: apagar.size,
    iguais, maisAntigos, excluidos: [...excluidos].map(([ref, em]) => ({ ref, em })), cidades };
}

export async function previa(r: RoteiroRecebido): Promise<Plano> {
  const db = await abrirBanco();
  return planejar(r, await db.getAll("eventos"), await db.get("meta", "meta"), await db.getAll("dias"));
}

export async function receber(r: RoteiroRecebido): Promise<Plano> {
  const db = await abrirBanco();
  const tx = db.transaction(["eventos", "dias", "meta"], "readwrite");
  const st = tx.objectStore("eventos"), sd = tx.objectStore("dias"), sm = tx.objectStore("meta");
  const meta = await sm.get("meta");
  const plano = planejar(r, await st.getAll(), meta, await sd.getAll());
  for (const e of plano.apagar) await st.delete(e.id);
  for (const e of plano.gravar) await st.put(e);
  const idx = sd.index("porData");
  for (const [data, cidade] of plano.cidades) {
    const d = await idx.get(data);
    await sd.put(d ? { ...d, cidade } : { id: uuid(), data, cidade, lavanderia: false, lookIds: [], notas: "" });
  }
  if (meta) await sm.put({ ...meta, excluidos: plano.excluidos,
    roteiro: { em: r.em, recebidoEm: agoraISO(), plano: r.plano, de: r.de } });
  await tx.done;
  avisarMudanca();
  return plano;
}

/* ---------- edits made on this phone ---------- */
export async function marcarPendente() {
  const db = await abrirBanco();
  const m = await db.get("meta", "meta");
  if (!m) return;
  await db.put("meta", { ...m, pendente: { desde: m.pendente?.desde ?? agoraISO(), n: (m.pendente?.n ?? 0) + 1 } });
}
export async function limparPendente() {
  const db = await abrirBanco();
  const m = await db.get("meta", "meta");
  if (m) await db.put("meta", { ...m, pendente: null });
  avisarMudanca();
}
export async function anotarExclusao(ref: string) {
  const db = await abrirBanco();
  const m = await db.get("meta", "meta");
  if (!m) return;
  const l = (m.excluidos ?? []).filter((x) => x.ref !== ref);
  l.push({ ref, em: agoraISO() });
  await db.put("meta", { ...m, excluidos: l });
}

/* ---------- what this phone sends ---------- */
export async function roteiroParaEnviar(): Promise<{ eventos: EvRoteiro[]; excluidos: { ref: string; em: string }[]; nome: string; plano: string }> {
  const db = await abrirBanco();
  const evs = (await db.getAll("eventos")).filter((e) => e.camada === "coletivo" && e.ref);
  const meta = await db.get("meta", "meta");
  const v = (await db.getAll("viagem"))[0];
  return {
    eventos: evs.sort((a, b) => (a.data + a.horaInicio).localeCompare(b.data + b.horaInicio)).map(paraRoteiro),
    excluidos: meta?.excluidos ?? [], nome: v?.viajante?.trim() ?? "", plano: meta?.roteiro?.plano || v?.nome || "",
  };
}
