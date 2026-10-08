/* Calendar dates as plain "YYYY-MM-DD" strings. All arithmetic is done in
   UTC so the phone's own time zone never shifts a day. */

export const FUSO_CHINA = "Asia/Shanghai";
export const FUSO_BRASIL = "America/Sao_Paulo";

import { idioma } from "./i18n";

/* names in the interface language (lib/i18n.ts) */
const NOMES = {
  pt: { sem: ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"],
        semLongo: ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"],
        mes: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"],
        mesLongo: ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"] },
  en: { sem: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        semLongo: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        mes: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        mesLongo: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] },
  zh: { sem: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],
        semLongo: ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"],
        mes: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
        mesLongo: ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"] },
}[idioma];
const DIAS_SEM = NOMES.sem, DIAS_SEM_LONGO = NOMES.semLongo, MESES = NOMES.mes;
export const MESES_LONGOS = NOMES.mesLongo;
export const SEMANA_CURTA = NOMES.sem;   // sun..sat, for calendar headers

const partes = (d: string) => d.split("-").map(Number) as [number, number, number];
const utc = (d: string) => { const [y, m, dd] = partes(d); return new Date(Date.UTC(y, m - 1, dd)); };
const paraISO = (t: Date) => t.toISOString().slice(0, 10);

export function somaDias(d: string, n: number): string {
  const t = utc(d); t.setUTCDate(t.getUTCDate() + n); return paraISO(t);
}
export function diferencaDias(de: string, ate: string): number {
  return Math.round((utc(ate).getTime() - utc(de).getTime()) / 86400000);
}
export function listaDias(inicio: string, fim: string): string[] {
  if (!inicio || !fim || fim < inicio) return [];
  const n = diferencaDias(inicio, fim);
  return Array.from({ length: n + 1 }, (_, i) => somaDias(inicio, i));
}
export const diaSemana = (d: string) => DIAS_SEM[utc(d).getUTCDay()];
export const diaSemanaLongo = (d: string) => DIAS_SEM_LONGO[utc(d).getUTCDay()];
export function dataCurta(d: string): string {       // "seg 12 out" · "Mon 12 Oct" · "10月12日 周一"
  const [, m, dd] = partes(d);
  if (idioma === "zh") return `${m}月${dd}日 ${diaSemana(d)}`;
  return `${diaSemana(d)} ${dd} ${MESES[m - 1]}`;
}
export function dataLonga(d: string): string {       // "segunda, 12 de out de 2026" · "Monday, 12 Oct 2026" · "2026年10月12日 星期一"
  const [y, m, dd] = partes(d);
  if (idioma === "zh") return `${y}年${m}月${dd}日 ${diaSemanaLongo(d)}`;
  if (idioma === "en") return `${diaSemanaLongo(d)}, ${dd} ${MESES[m - 1]} ${y}`;
  return `${diaSemanaLongo(d)}, ${dd} de ${MESES[m - 1]} de ${y}`;
}

/* today's date and the clock in a given zone, whatever the phone is set to */
export function hojeEm(fuso: string, agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(agora);
}
export function horaEm(fuso: string, agora = new Date()): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(agora);
}

/* Is this day's city in Brazil? Reads the first leg: "Shenzhen → Brasil"
   departs from China, "São Paulo → em trânsito" departs from Brazil. */
export function cidadeNoBrasil(cidade: string): boolean {
  const c = (cidade || "").split(/→|->/)[0].toLowerCase();
  return /brasil|brazil|s[ãa]o paulo|guarulhos|\bgru\b|campinas|viracopos/.test(c);
}

/* The trip's "today". From the first day spent in China to the last one,
   it is the date in China, whatever the phone's zone; before and after,
   the date in Brazil (so the day of departure is not "day 1" while still
   at home just because it is already tomorrow in Shanghai). */
export function hojeDaViagem(dias: { data: string; cidade: string }[], agora = new Date()): string {
  const naChina = dias.filter((d) => d.cidade.trim() && !cidadeNoBrasil(d.cidade)).map((d) => d.data).sort();
  const cn = hojeEm(FUSO_CHINA, agora);
  if (naChina.length && cn >= naChina[0] && cn <= naChina[naChina.length - 1]) return cn;
  return hojeEm(FUSO_BRASIL, agora);
}
