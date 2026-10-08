/* Interface language: Português (default), English, 中文 (simplified).

   The Portuguese text IS the key: t("Salvar") returns "Save" in English and
   "保存" in Chinese, and falls back to the Portuguese when a translation is
   missing. Values go in braces: t("Dia {n} de {total}", { n, total }).
   Plurals: tn(n, "1 dia", "{n} dias").
   The dictionaries are src/i18n/en.json and zh.json (key = Portuguese text);
   `node scripts/chaves-i18n.mjs` lists the keys used in the code and the
   ones missing from each dictionary.

   The choice is per phone (localStorage) and applies with a reload, so no
   screen has to listen for it. What people typed (event titles, item
   names…) is data and is never translated. */
import en from "../i18n/en.json";
import zh from "../i18n/zh.json";

export type Idioma = "pt" | "en" | "zh";
export const IDIOMAS: { id: Idioma; rot: string }[] = [
  { id: "pt", rot: "Português" }, { id: "en", rot: "English" }, { id: "zh", rot: "中文" },
];
const CHAVE = "viagem-china:idioma";

export const idioma: Idioma = (() => {
  try { const v = localStorage.getItem(CHAVE); if (v === "pt" || v === "en" || v === "zh") return v; } catch { /* private mode */ }
  return "pt";
})();
export const LOCALE = { pt: "pt-BR", en: "en-GB", zh: "zh-CN" }[idioma];

const DIC: Record<Idioma, Record<string, string>> = { pt: {}, en, zh };

export function t(pt: string, v?: Record<string, string | number>): string {
  let s = DIC[idioma][pt] || pt;
  if (v) s = s.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m));
  return s;
}
export function tn(n: number, um: string, varios: string, v?: Record<string, string | number>): string {
  return t(n === 1 ? um : varios, { n, ...v });
}

export function mudarIdioma(i: Idioma) {
  try { localStorage.setItem(CHAVE, i); } catch { /* ignore */ }
  location.reload();
}
if (typeof document !== "undefined") document.documentElement.lang = LOCALE;
