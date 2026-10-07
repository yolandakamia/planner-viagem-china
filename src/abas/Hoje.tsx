import { useEffect, useState } from "preact/hooks";
import type { Viagem, Dia } from "../db/tipos";
import { diasDaViagem } from "../db/viagem";
import { FUSO_BRASIL, FUSO_CHINA, hojeEm, horaEm, dataLonga, dataCurta, diferencaDias, hojeDaViagem, cidadeNoBrasil } from "../lib/datas";

/* Phase 1: clocks, the trip's "today" (the date in China once the trip
   reaches China, whatever the phone's zone — see hojeDaViagem) and the
   countdown. Events arrive in phase 2. */
export function Hoje({ viagem }: { viagem: Viagem }) {
  const [agora, setAgora] = useState(() => new Date());
  const [dias, setDias] = useState<Dia[]>([]);

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 15000);
    const vis = () => document.visibilityState === "visible" && setAgora(new Date());
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, []);
  useEffect(() => { diasDaViagem(viagem).then(setDias); }, [viagem]);

  const hoje = hojeDaViagem(dias, agora);
  const antes = hoje < viagem.inicio, depois = hoje > viagem.fim;
  const diaRef = antes ? viagem.inicio : depois ? viagem.fim : hoje;
  const dia = dias.find((d) => d.data === diaRef);
  const faltam = diferencaDias(hoje, viagem.inicio);
  const nDia = diferencaDias(viagem.inicio, hoje) + 1, total = diferencaDias(viagem.inicio, viagem.fim) + 1;

  return (
    <>
      <div class="cartao">
        <div class="relogios">
          <div class="relogio"><div class="h">{horaEm(FUSO_CHINA, agora)}</div><div class="l">🇨🇳 China · {dataCurta(hojeEm(FUSO_CHINA, agora))}</div></div>
          <div class="relogio"><div class="h">{horaEm(FUSO_BRASIL, agora)}</div><div class="l">🇧🇷 Brasil · {dataCurta(hojeEm(FUSO_BRASIL, agora))}</div></div>
        </div>
      </div>

      {antes && (
        <div class="cartao">
          <div class="muted pequeno">Faltam</div>
          <div class="destaque">{faltam} {faltam === 1 ? "dia" : "dias"}</div>
          <p class="muted" style="margin:8px 0 0">Primeiro dia: <b style="color:var(--texto)">{dataLonga(viagem.inicio)}</b>{dia?.cidade ? ` · ${dia.cidade}` : ""}</p>
        </div>
      )}
      {!antes && !depois && (
        <div class="cartao">
          <div class="muted pequeno">Dia {nDia} de {total} · {dia && !cidadeNoBrasil(dia.cidade) ? "data da China" : "data do Brasil"}</div>
          <h2 style="font-size:22px;margin:4px 0">{dataLonga(hoje)}</h2>
          <div style="font-size:18px">📍 {dia?.cidade || <span class="muted">cidade não definida</span>}</div>
        </div>
      )}
      {depois && (
        <div class="cartao">
          <div class="muted pequeno">A viagem terminou</div>
          <p style="margin:6px 0 0">Último dia: <b>{dataLonga(viagem.fim)}</b>{dia?.cidade ? ` · ${dia.cidade}` : ""}</p>
        </div>
      )}

      <div class="vazio"><div class="emo">🗓️</div>Os eventos do dia aparecem aqui na Fase 2.</div>
    </>
  );
}
