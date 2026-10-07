import { abrirBanco } from "./banco";
import type { Evento, TipoEvento } from "./tipos";
import { uuid, agoraISO } from "../lib/uuid";
import { FUSO_CHINA } from "../lib/datas";
import { avisarMudanca } from "./mudancas";
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

export async function salvarEvento(e: Evento): Promise<void> {
  const db = await abrirBanco();
  await db.put("eventos", { ...e, atualizadoEm: agoraISO() });
  avisarMudanca();
}
export async function excluirEvento(id: string): Promise<void> {
  const db = await abrirBanco();
  await db.delete("eventos", id);
  avisarMudanca();
}
/* a copy ready for the editor — only saved if the user taps Salvar */
export function copiaDeEvento(e: Evento): Evento {
  const t = agoraISO();
  return { ...e, id: uuid(), camada: "pessoal", origemId: null, ref: null,
    titulo: e.titulo + " (cópia)", criadoEm: t, atualizadoEm: t };
}
