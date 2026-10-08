import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Viagem } from "../db/tipos";
import { useDadosViagem } from "../db/useViagem";
import { TIPOS } from "../db/eventos";
import { CartaoEvento, useEventosFolha } from "../comp/Eventos";
import { LookDoDia } from "../comp/LookDoDia";
import type { Dia } from "../db/tipos";
import { conflitos } from "../lib/tempo";
import { dataLonga, diaSemana, somaDias, hojeDaViagem, listaDias } from "../lib/datas";

/* the chosen day and view survive switching tabs (not reloads) */
let memoria: { modo: "dia" | "viagem"; data: string | null } = { modo: "dia", data: null };

export function Calendario({ viagem }: { viagem: Viagem }) {
  const { dias, eventos, pronto, cidade, doDia } = useDadosViagem(viagem);
  const [modo, setModo] = useState(memoria.modo);
  const hoje = hojeDaViagem(dias);
  const padrao = hoje < viagem.inicio ? viagem.inicio : hoje > viagem.fim ? viagem.fim : hoje;
  /* null = "today" — resolved only once the days are loaded */
  const [escolhida, setData] = useState<string | null>(memoria.data);
  const data = escolhida ?? padrao;
  useEffect(() => { memoria = { modo, data: escolhida }; }, [modo, escolhida]);
  const folha = useEventosFolha(cidade);

  /* out-of-range events still show up (a date typed by mistake must be findable) */
  const datas = useMemo(() => {
    const s = new Set(listaDias(viagem.inicio, viagem.fim));
    eventos.forEach((e) => s.add(e.data));
    return [...s].sort();
  }, [viagem, eventos]);

  if (!pronto) return null;
  return (
    <>
      <div class="seg" role="tablist">
        <button role="tab" aria-selected={modo === "dia"} class={modo === "dia" ? "on" : ""} onClick={() => setModo("dia")}>Dia</button>
        <button role="tab" aria-selected={modo === "viagem"} class={modo === "viagem" ? "on" : ""} onClick={() => setModo("viagem")}>Viagem inteira</button>
      </div>
      {modo === "dia"
        ? <VistaDia data={data} setData={setData} datas={datas} hoje={hoje} cidade={cidade(data)} dia={dias.find((d) => d.data === data)}
            evs={doDia(data)} abrir={folha.abrir} />
        : <VistaViagem datas={datas} hoje={hoje} cidade={cidade} doDia={doDia}
            irPara={(d) => { setData(d); setModo("dia"); scrollTo(0, 0); }} />}
      <button class="fab" aria-label="Novo evento" onClick={() => folha.novo(modo === "dia" ? data : padrao)}>＋</button>
      {folha.elemento}
    </>
  );
}

function VistaDia({ data, setData, datas, hoje, cidade, dia, evs, abrir }: {
  data: string; dia: Dia | undefined; setData: (d: string) => void; datas: string[]; hoje: string; cidade: string;
  evs: ReturnType<ReturnType<typeof useDadosViagem>["doDia"]>; abrir: Parameters<typeof CartaoEvento>[0]["aoAbrir"];
}) {
  const choque = conflitos(evs);
  const faixa = useRef<HTMLDivElement>(null);
  useEffect(() => {   // keep the chosen day visible in the strip
    faixa.current?.querySelector(".on")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [data]);

  /* swipe left/right to change day */
  const x0 = useRef<number | null>(null);
  const toque = {
    onTouchStart: (e: TouchEvent) => { x0.current = e.touches[0].clientX; },
    onTouchEnd: (e: TouchEvent) => {
      if (x0.current == null) return;
      const dx = e.changedTouches[0].clientX - x0.current; x0.current = null;
      if (Math.abs(dx) > 70) setData(somaDias(data, dx < 0 ? 1 : -1));
    },
  };

  return (
    <div {...toque}>
      <div class="faixa-dias" ref={faixa}>
        {datas.map((d) => (
          <button class={`fd ${d === data ? "on" : ""} ${d === hoje ? "hoje" : ""}`} onClick={() => setData(d)} aria-label={dataLonga(d)}>
            <span>{diaSemana(d)}</span><b>{+d.slice(8)}</b>
          </button>))}
      </div>
      <div class="nav-dia">
        <button class="btn-icone" aria-label="Dia anterior" onClick={() => setData(somaDias(data, -1))}>‹</button>
        <div class="nav-dia-meio">
          <b>{dataLonga(data)}</b>
          <span class="muted pequeno">{d0(cidade)}{data === hoje ? " · hoje" : ""}</span>
        </div>
        <button class="btn-icone" aria-label="Dia seguinte" onClick={() => setData(somaDias(data, 1))}>›</button>
      </div>
      <LookDoDia dia={dia} compacto />
      {choque.size > 0 && <div class="faixa-aviso">⚠️ Há eventos com horários sobrepostos neste dia.</div>}
      {evs.length
        ? <div class="lista-ev">{evs.map((e) => <CartaoEvento e={e} conflito={choque.has(e.id)} aoAbrir={abrir} />)}</div>
        : <div class="vazio"><div class="emo">🗓️</div>Nenhum evento neste dia.<br /><span class="pequeno">Toque em ＋ para criar.</span></div>}
    </div>
  );
}
const d0 = (c: string) => (c ? `📍 ${c}` : "cidade não definida");

function VistaViagem({ datas, hoje, cidade, doDia, irPara }: {
  datas: string[]; hoje: string; cidade: (d: string) => string;
  doDia: ReturnType<typeof useDadosViagem>["doDia"]; irPara: (d: string) => void;
}) {
  return (
    <div class="lista-dias">
      {datas.map((d) => {
        const evs = doDia(d), choque = conflitos(evs);
        return (
          <button class={`resumo-dia ${d === hoje ? "hoje" : ""}`} onClick={() => irPara(d)}>
            <div class="rd-data"><span>{diaSemana(d)}</span><b>{+d.slice(8)}</b><span>{d.slice(5, 7)}/{d.slice(2, 4)}</span></div>
            <div class="rd-corpo">
              <div class="rd-cidade">{cidade(d) || <span class="muted">—</span>}
                {d === hoje && <span class="selo selo-agora">Hoje</span>}
                {choque.size > 0 && <span class="tag tag-aviso">⚠️ conflito</span>}</div>
              {evs.length === 0 && <div class="muted pequeno">sem eventos</div>}
              {evs.slice(0, 4).map((e) => (
                <div class="rd-ev"><span class={`rd-h ${e.horaInicio ? "" : "rd-todo"}`}>{e.horaInicio || "dia todo"}</span> {TIPOS[e.tipo]?.emo} {e.titulo}</div>))}
              {evs.length > 4 && <div class="muted pequeno">+ {evs.length - 4} eventos</div>}
            </div>
          </button>);
      })}
    </div>
  );
}
