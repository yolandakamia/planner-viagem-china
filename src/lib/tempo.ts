/* Real instants of events. Used ONLY to work out "Agora", "A seguir",
   remaining time and overlaps — the screen always shows the times exactly
   as typed. Each event's wall-clock time is read in its own zone. */
import type { Evento } from "../db/tipos";
import { somaDias, FUSO_BRASIL, FUSO_CHINA, hojeEm, horaEm, dataCurta } from "./datas";

/* offset (ms) of a zone at a given instant, from Intl — no tz database shipped */
function offsetMs(fuso: string, t: number): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(t));
  const g = (k: string) => Number(p.find((x) => x.type === k)!.value);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - Math.floor(t / 1000) * 1000;
}

/* "2026-10-12" + "10:00" in "Asia/Shanghai" → epoch ms */
export function instante(data: string, hora: string, fuso: string): number {
  const [y, m, d] = data.split("-").map(Number);
  const [hh, mi] = hora.split(":").map(Number);
  const local = Date.UTC(y, m - 1, d, hh, mi);
  let t = local - offsetMs(fuso, local);
  t = local - offsetMs(fuso, t);           // second pass settles DST edges
  return t;
}

export interface Intervalo { ini: number; fim: number; temFim: boolean }

/* null for events without a start time (all-day notes) */
export function intervalo(e: Evento): Intervalo | null {
  if (!e.horaInicio) return null;
  const fuso = e.fuso || FUSO_CHINA;
  const ini = instante(e.data, e.horaInicio, fuso);
  if (!e.horaFim) return { ini, fim: ini, temFim: false };
  // an end earlier than the start means it ends the next day (overnight flight)
  const dFim = e.horaFim <= e.horaInicio ? somaDias(e.data, 1) : e.data;
  return { ini, fim: instante(dFim, e.horaFim, fuso), temFim: true };
}

/* Overlaps between timed events. An event without an end counts as a
   moment: it only clashes when it falls inside another one. */
export function conflitos(eventos: Evento[]): Set<string> {
  const iv = eventos.map((e) => ({ e, i: intervalo(e) })).filter((x) => x.i) as { e: Evento; i: Intervalo }[];
  const out = new Set<string>();
  for (let a = 0; a < iv.length; a++) for (let b = a + 1; b < iv.length; b++) {
    const A = iv[a].i, B = iv[b].i;
    const sobrepoe = A.temFim && B.temFim ? A.ini < B.fim && B.ini < A.fim
      : A.temFim ? B.ini >= A.ini && B.ini < A.fim
      : B.temFim ? A.ini >= B.ini && A.ini < B.fim
      : A.ini === B.ini;
    if (sobrepoe) { out.add(iv[a].e.id); out.add(iv[b].e.id); }
  }
  return out;
}

/* "1 h 20 min", "45 min", "2 dias" */
export function duracao(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  if (h < 48) return m ? `${h} h ${m} min` : `${h} h`;
  return `${Math.round(h / 24)} dias`;
}

/* the same moment on the other country's clock, for the description:
   a China event shows Brazil time and vice versa */
export function outroRelogio(e: Evento): { rot: string; texto: string } | null {
  const i = intervalo(e);
  if (!i) return null;
  const alvo = (e.fuso || FUSO_CHINA) === FUSO_BRASIL ? FUSO_CHINA : FUSO_BRASIL;
  const rot = alvo === FUSO_BRASIL ? "No Brasil" : "Na China";
  const dIni = hojeEm(alvo, new Date(i.ini));
  let texto = `${dataCurta(dIni)}, ${horaEm(alvo, new Date(i.ini))}`;
  if (i.temFim) {
    const dFim = hojeEm(alvo, new Date(i.fim));
    texto += `–${horaEm(alvo, new Date(i.fim))}${dFim !== dIni ? ` (${dataCurta(dFim)})` : ""}`;
  }
  return { rot, texto };
}

export const FUSOS: { id: string; rot: string; curto: string }[] = [
  { id: "Asia/Shanghai", rot: "China (Shanghai, Shenzhen, Pequim)", curto: "China" },
  { id: "America/Sao_Paulo", rot: "Brasil (Brasília)", curto: "hora de Brasília" },
  { id: "Asia/Hong_Kong", rot: "Hong Kong", curto: "hora de Hong Kong" },
  { id: "Africa/Addis_Ababa", rot: "Etiópia (Adis Abeba)", curto: "hora de Adis Abeba" },
  { id: "Asia/Qatar", rot: "Catar (Doha)", curto: "hora de Doha" },
  { id: "Asia/Dubai", rot: "Emirados (Dubai)", curto: "hora de Dubai" },
  { id: "Europe/Lisbon", rot: "Portugal (Lisboa)", curto: "hora de Lisboa" },
  { id: "Europe/Paris", rot: "Europa central (Paris, Frankfurt)", curto: "hora da Europa central" },
  { id: "UTC", rot: "UTC", curto: "UTC" },
];
export const rotuloFuso = (id: string) => FUSOS.find((f) => f.id === id)?.curto ?? id;
