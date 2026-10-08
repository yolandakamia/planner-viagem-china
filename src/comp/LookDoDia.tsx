import type { Dia } from "../db/tipos";
import { useLooks } from "../db/looks";
import { useFotoUrl } from "../db/fotos";
import { t } from "../lib/i18n";

/* the day's look, for Hoje (large) and the calendar day view (compact).
   Tapping goes to the Looks tab, "Por dia". */
export function LookDoDia({ dia, compacto = false }: { dia: Dia | undefined; compacto?: boolean }) {
  const { looks } = useLooks();
  const l = dia?.lookIds[0] ? looks.find((x) => x.id === dia.lookIds[0]) : undefined;
  const url = useFotoUrl(l?.imagemFotoId, compacto ? "mini" : "cheia");
  if (!dia) return null;
  if (!l) {
    if (compacto) return null;
    return <a class="look-dia vazio-look" href="#/looks">👔 {t("Sem look para este dia")} · <u>{t("montar")}</u></a>;
  }
  return (
    <a class={`look-dia ${compacto ? "compacto" : ""}`} href="#/looks" aria-label={t("Look do dia: {nome}", { nome: l.nome })}>
      <span class="ld-img">{url && <img src={url} alt="" />}</span>
      <span class="ld-txt"><span class="muted pequeno">{t("Look do dia")}</span><b>{l.favorito ? "★ " : ""}{l.nome}</b>
        {dia.lavanderia && <span class="pequeno">🧺 {t("dia de lavanderia")}</span>}</span>
    </a>
  );
}
