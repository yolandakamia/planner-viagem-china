import { abrirBanco } from "./banco";
import type { Evento, TipoEvento } from "./tipos";
import { uuid, agoraISO } from "../lib/uuid";
import { FUSO_CHINA } from "../lib/datas";
import { avisarMudanca } from "./mudancas";
import { marcarPendente, anotarExclusao } from "../lib/grupo";
export { useVersaoDados } from "./mudancas";

export const TIPOS: Record<TipoEvento, { rot: string; emo: string }> = {
  feira:        { rot: "Feira",            emo: "🎪" },
  reuniao:      { rot: "Reunião / visita", emo: "🤝" },
  deslocamento: { rot: "Deslocamento",     emo: "🚗" },
  refeicao:     { rot: "Refeição",         emo: "🍽️" },
  livre:        { rot: "Livre",            emo: "☕" },
  outro:        { rot: "Outro",            emo: "📌" },
};

export function novoEvento(data: string, fuso = FUSO_CHINA): Evento {
  const t = agoraISO();
  return {
    id: uuid(), camada: "pessoal", origemId: null, ref: null,
    data, horaInicio: "", horaFim: "", fuso,
    titulo: "", tipo: "reuniao", local: "", enderecoCn: "", obs: "",
    criadoEm: t, atualizadoEm: t,
  };
}

/* all-day items first, then by start time as typed */
export const ordenar = (a: Evento, b: Evento) =>
  (a.horaInicio || "").localeCompare(b.horaInicio || "") || a.titulo.localeCompare(b.titulo);

export async function eventosDoDia(data: string): Promise<Evento[]> {
  const db = await abrirBanco();
  return (await db.getAllFromIndex("eventos", "porData", data)).sort(ordenar);
}
export async function todosEventos(): Promise<Evento[]> {
  const db = await abrirBanco();
  return (await db.getAllFromIndex("eventos", "porData")).sort((a, b) => a.data.localeCompare(b.data) || ordenar(a, b));
}

/* A group event saved here gets a new version (editadoEm) and raises the
   "send the itinerary to everyone" alert. Turning a group event back into a
   personal one is, for the others, a deletion. */
export async function salvarEvento(e: Evento): Promise<void> {
  const db = await abrirBanco();
  const antes = await db.get("eventos", e.id);
  const t = agoraISO();
  let novo: Evento = { ...e, atualizadoEm: t };
  if (e.camada === "coletivo") {
    const nome = (await db.getAll("viagem"))[0]?.viajante?.trim() ?? "";
    novo = { ...novo, ref: e.ref || `app:${uuid()}`, editadoEm: t, autor: e.autor || nome };
    await marcarPendente();
  } else if (antes?.camada === "coletivo" && antes.ref) {
    await anotarExclusao(antes.ref);
    novo = { ...novo, ref: null, editadoEm: undefined };
    await marcarPendente();
  }
  await db.put("eventos", novo);
  avisarMudanca();
}
export async function excluirEvento(id: string): Promise<void> {
  const db = await abrirBanco();
  const e = await db.get("eventos", id);
  if (e?.camada === "coletivo" && e.ref) { await anotarExclusao(e.ref); await marcarPendente(); }
  await db.delete("eventos", id);
  avisarMudanca();
}
/* a copy ready for the editor — only saved if the user taps Salvar */
export function copiaDeEvento(e: Evento): Evento {
  const t = agoraISO();
  return { ...e, id: uuid(), camada: "pessoal", origemId: null, ref: null, editadoEm: undefined, autor: undefined,
    titulo: e.titulo + " (cópia)", criadoEm: t, atualizadoEm: t };
}
