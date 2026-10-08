import { useEffect, useState } from "preact/hooks";
import type { Viagem } from "../db/tipos";
import { useDadosViagem } from "../db/useViagem";
import { CartaoEvento, useEventosFolha } from "../comp/Eventos";
import { situacoes } from "../lib/agora";
import { LookDoDia } from "../comp/LookDoDia";
import { LembreteBackup } from "../comp/Backup";
import { conflitos } from "../lib/tempo";
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
      <LembreteBackup />
      <div class="relogios">
        <div class="relogio"><div class="h">{horaEm(FUSO_CHINA, agora)}</div><div class="l">🇨🇳 China · {dataCurta(hojeEm(FUSO_CHINA, agora))}</div></div>
        <div class="relogio"><div class="h">{horaEm(FUSO_BRASIL, agora)}</div><div class="l">🇧🇷 Brasil · {dataCurta(hojeEm(FUSO_BRASIL, agora))}</div></div>
      </div>

      {antes && (
        <div class="cartao">
          <div class="muted pequeno">Faltam</div>
          <div class="destaque">{faltam} {faltam === 1 ? "dia" : "dias"}</div>
          <p class="muted" style="margin:8px 0 0">Primeiro dia: <b style="color:var(--texto)">{dataLonga(viagem.inicio)}</b>{cidade(diaRef) ? ` · ${cidade(diaRef)}` : ""}</p>
        </div>
      )}
      {!antes && !depois && (
        <div class="cartao cartao-dia">
          <div class="muted pequeno">Dia {nDia} de {total} · {cidadeNoBrasil(cidade(hoje)) ? "data do Brasil" : "data da China"}</div>
          <h2>{dataLonga(hoje)}</h2>
          <div class="cidade-dia">📍 {cidade(hoje) || <span class="muted">cidade não definida</span>}</div>
        </div>
      )}
      {depois && (
        <div class="cartao">
          <div class="muted pequeno">A viagem terminou</div>
          <p style="margin:6px 0 0">Último dia: <b>{dataLonga(viagem.fim)}</b>{cidade(diaRef) ? ` · ${cidade(diaRef)}` : ""}</p>
        </div>
      )}

      <LookDoDia dia={dias.find((d) => d.data === diaRef)} />

      <h3 class="secao">{antes ? "Programação do primeiro dia" : depois ? "Programação do último dia" : "Programação de hoje"}</h3>
      {choque.size > 0 && <div class="faixa-aviso">⚠️ Há eventos com horários sobrepostos.</div>}
      {evs.length
        ? <div class="lista-ev">{evs.map((e) => (
            <CartaoEvento e={e} situacao={sit.get(e.id) ?? ""} resto={e.id === idSeguir ? resto : ""}
              conflito={choque.has(e.id)} aoAbrir={folha.abrir} />))}</div>
        : <div class="vazio"><div class="emo">🗓️</div>Nada marcado para este dia.</div>}

      {amanha.length > 0 && (<>
        <h3 class="secao">Amanhã · {dataCurta(somaDias(hoje, 1))}</h3>
        <div class="lista-ev">{amanha.map((e) => <CartaoEvento e={e} aoAbrir={folha.abrir} />)}</div>
      </>)}
      {folha.elemento}
    </>
  );
}
