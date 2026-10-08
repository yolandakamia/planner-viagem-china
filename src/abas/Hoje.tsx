import { useEffect, useState } from "preact/hooks";
import type { Viagem } from "../db/tipos";
import { useDadosViagem } from "../db/useViagem";
import { CartaoEvento, useEventosFolha } from "../comp/Eventos";
import { situacoes } from "../lib/agora";
import { LookDoDia } from "../comp/LookDoDia";
import { LembreteBackup } from "../comp/Backup";
import { LinhaRoteiro, AvisoEnviar } from "../comp/Roteiro";
import { conflitos } from "../lib/tempo";
import { t, tn } from "../lib/i18n";
import {
  FUSO_BRASIL, FUSO_CHINA, hojeEm, horaEm, dataLonga, dataCurta, diferencaDias,
  hojeDaViagem, cidadeNoBrasil, somaDias,
} from "../lib/datas";

/* "Today" of the trip: the date in China once the trip reaches China,
   whatever the phone's zone (hojeDaViagem). Ticks every 15 s, so it rolls
   over at midnight on its own, and refreshes when the app comes back. */
export function Hoje({ viagem }: { viagem: Viagem }) {
  const [agora, setAgora] = useState(() => new Date());
  const { dias, pronto, cidade, doDia } = useDadosViagem(viagem);
  const folha = useEventosFolha(cidade);

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 15000);
    const vis = () => document.visibilityState === "visible" && setAgora(new Date());
    document.addEventListener("visibilitychange", vis);
    addEventListener("focus", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); removeEventListener("focus", vis); };
  }, []);
  if (!pronto) return null;

  const hoje = hojeDaViagem(dias, agora);
  const antes = hoje < viagem.inicio, depois = hoje > viagem.fim;
  const diaRef = antes ? viagem.inicio : depois ? viagem.fim : hoje;
  const evs = doDia(diaRef);
  const faltam = diferencaDias(hoje, viagem.inicio);
  const nDia = diferencaDias(viagem.inicio, hoje) + 1, total = diferencaDias(viagem.inicio, viagem.fim) + 1;
  const choque = conflitos(evs);

  // statuses only make sense on the actual day
  const { sit, resto, idSeguir } = !antes && !depois ? situacoes(evs, agora.getTime()) : { sit: new Map(), resto: "", idSeguir: null };
  const amanha = !antes && !depois && !idSeguir ? doDia(somaDias(hoje, 1)) : [];

  return (
    <>
      <AvisoEnviar />
      <LembreteBackup />
      <div class="relogios">
        <div class="relogio"><div class="h">{horaEm(FUSO_CHINA, agora)}</div><div class="l">🇨🇳 {t("China")} · {dataCurta(hojeEm(FUSO_CHINA, agora))}</div></div>
        <div class="relogio"><div class="h">{horaEm(FUSO_BRASIL, agora)}</div><div class="l">🇧🇷 {t("Brasil")} · {dataCurta(hojeEm(FUSO_BRASIL, agora))}</div></div>
      </div>

      {antes && (
        <div class="cartao">
          <div class="muted pequeno">{t("Faltam")}</div>
          <div class="destaque">{tn(faltam, "{n} dia", "{n} dias")}</div>
          <p class="muted" style="margin:8px 0 0">{t("Primeiro dia:")} <b style="color:var(--texto)">{dataLonga(viagem.inicio)}</b>{cidade(diaRef) ? ` · ${cidade(diaRef)}` : ""}</p>
        </div>
      )}
      {!antes && !depois && (
        <div class="cartao cartao-dia">
          <div class="muted pequeno">{t("Dia {n} de {total}", { n: nDia, total })} · {cidadeNoBrasil(cidade(hoje)) ? t("data do Brasil") : t("data da China")}</div>
          <h2>{dataLonga(hoje)}</h2>
          <div class="cidade-dia">📍 {cidade(hoje) || <span class="muted">{t("cidade não definida")}</span>}</div>
        </div>
      )}
      {depois && (
        <div class="cartao">
          <div class="muted pequeno">{t("A viagem terminou")}</div>
          <p style="margin:6px 0 0">{t("Último dia:")} <b>{dataLonga(viagem.fim)}</b>{cidade(diaRef) ? ` · ${cidade(diaRef)}` : ""}</p>
        </div>
      )}

      <LinhaRoteiro />

      <h3 class="secao">{antes ? t("Programação do primeiro dia") : depois ? t("Programação do último dia") : t("Programação de hoje")}</h3>
      {choque.size > 0 && <div class="faixa-aviso">⚠️ {t("Há eventos com horários sobrepostos.")}</div>}
      {evs.length
        ? <div class="lista-ev">{evs.map((e) => (
            <CartaoEvento e={e} situacao={sit.get(e.id) ?? ""} resto={e.id === idSeguir ? resto : ""}
              conflito={choque.has(e.id)} aoAbrir={folha.abrir} />))}</div>
        : <div class="vazio"><div class="emo">🗓️</div>{t("Nada marcado para este dia.")}</div>}

      {amanha.length > 0 && (<>
        <h3 class="secao">{t("Amanhã")} · {dataCurta(somaDias(hoje, 1))}</h3>
        <div class="lista-ev">{amanha.map((e) => <CartaoEvento e={e} aoAbrir={folha.abrir} />)}</div>
      </>)}
      <div class="look-hoje"><LookDoDia dia={dias.find((d) => d.data === diaRef)} /></div>
      {folha.elemento}
    </>
  );
}
