/* Calendar dates as plain "YYYY-MM-DD" strings. All arithmetic is done in
   UTC so the phone's own time zone never shifts a day. */

export const FUSO_CHINA = "Asia/Shanghai";
export const FUSO_BRASIL = "America/Sao_Paulo";

const DIAS_SEM = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const DIAS_SEM_LONGO = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

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
export function dataCurta(d: string): string {       // "seg 12 out"
  const [, m, dd] = partes(d);
  return `${diaSemana(d)} ${dd} ${MESES[m - 1]}`;
}
export function dataLonga(d: string): string {       // "segunda, 12 de out de 2026"
  const [y, m, dd] = partes(d);
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
