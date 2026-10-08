import { useEffect, useRef, useState } from "preact/hooks";
import type { Evento } from "../db/tipos";
import { TIPOS } from "../db/eventos";
import { conflitos } from "../lib/tempo";
import { somaDias, diaSemana, dataCurta, listaDias, diferencaDias } from "../lib/datas";

/* Calendar grids: the week with hours (like Google Calendar) and the month.
   Times are drawn exactly as typed, the same as everywhere else in the app. */

type DoDia = (d: string) => Evento[];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const min = (h: string) => { const [a, b] = h.split(":").map(Number); return a * 60 + b; };
const PX_HORA = 52;

/* how many days fit side by side: 3 on a phone, up to 7 on a wide screen */
function useColunas() {
  const calc = () => Math.max(3, Math.min(7, Math.floor((innerWidth - 60) / 110)));
  const [n, setN] = useState(calc);
  useEffect(() => { const f = () => setN(calc()); addEventListener("resize", f); return () => removeEventListener("resize", f); }, []);
  return n;
}

function useDeslizar(mudar: (passo: number) => void) {
  const x0 = useRef<[number, number] | null>(null);
  return {
    onTouchStart: (e: TouchEvent) => { x0.current = [e.touches[0].clientX, e.touches[0].clientY]; },
    onTouchEnd: (e: TouchEvent) => {
      if (!x0.current) return;
      const dx = e.changedTouches[0].clientX - x0.current[0], dy = e.changedTouches[0].clientY - x0.current[1];
      x0.current = null;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) mudar(dx < 0 ? 1 : -1);
    },
  };
}

/* side-by-side columns for events that overlap in time */
interface Bloco { e: Evento; ini: number; fim: number; col: number; cols: number }
function arrumar(evs: Evento[]): Bloco[] {
  const bl: Bloco[] = evs.filter((e) => e.horaInicio).map((e) => {
    const ini = min(e.horaInicio);
    let fim = e.horaFim ? min(e.horaFim) : ini + 60;
    if (fim <= ini) fim = e.horaFim ? 24 * 60 : ini + 60;   // ends the next day: draw until midnight
    return { e, ini, fim: Math.max(fim, ini + 30), col: 0, cols: 1 };
  }).sort((a, b) => a.ini - b.ini || b.fim - a.fim);
  let grupo: Bloco[] = [], fimGrupo = -1;
  const fechar = () => { const n = Math.max(...grupo.map((b) => b.col)) + 1; grupo.forEach((b) => (b.cols = n)); };
  for (const b of bl) {
    if (grupo.length && b.ini >= fimGrupo) { fechar(); grupo = []; fimGrupo = -1; }
    const usadas = new Set(grupo.filter((g) => g.fim > b.ini).map((g) => g.col));
    let c = 0; while (usadas.has(c)) c++;
    b.col = c; grupo.push(b); fimGrupo = Math.max(fimGrupo, b.fim);
  }
  if (grupo.length) fechar();
  return bl;
}

/* ---------- week with hours ---------- */
export function VistaSemana({ data, setData, hoje, cidade, doDia, abrir, novo }: {
  data: string; setData: (d: string) => void; hoje: string; cidade: (d: string) => string;
  doDia: DoDia; abrir: (e: Evento) => void; novo: (data: string, hora?: string) => void;
}) {
  const n = useColunas();
  const dias = listaDias(data, somaDias(data, n - 1));
  const porDia = dias.map((d) => doDia(d));
  const blocos = porDia.map(arrumar);
  const todoDia = porDia.map((evs) => evs.filter((e) => !e.horaInicio));
  const temTodoDia = todoDia.some((l) => l.length);

  // hours on screen: 7h–22h, stretched to fit every event of these days
  const ts = blocos.flat();
  const h0 = Math.min(7, ...ts.map((b) => Math.floor(b.ini / 60)));
  const h1 = Math.max(22, ...ts.map((b) => Math.ceil(b.fim / 60)));
  const horas = Array.from({ length: h1 - h0 }, (_, i) => h0 + i);
  const toque = useDeslizar((p) => setData(somaDias(data, p * n)));

  return (
    <div {...toque}>
      <div class="nav-dia">
        <button class="btn-icone" aria-label="Dias anteriores" onClick={() => setData(somaDias(data, -n))}>‹</button>
        <div class="nav-dia-meio"><b>{dataCurta(dias[0])} – {dataCurta(dias[n - 1])}</b>
          {!dias.includes(hoje) && <button class="link-hoje" onClick={() => setData(hoje)}>ir para hoje</button>}</div>
        <button class="btn-icone" aria-label="Próximos dias" onClick={() => setData(somaDias(data, n))}>›</button>
      </div>
      <div class="sem" style={`--n:${n}`}>
        <div class="sem-topo">
          <div />
          {dias.map((d) => (
            <button class={`sem-cab ${d === hoje ? "hoje" : ""}`} onClick={() => setData(d)}>
              <span>{diaSemana(d)}</span><b>{+d.slice(8)}</b><small>{cidade(d)}</small>
            </button>))}
        </div>
        {temTodoDia && (
          <div class="sem-todo">
            <div class="sem-hora">dia todo</div>
            {todoDia.map((l) => <div>{l.map((e) => (
              <button class={`sem-chip t-${e.tipo}`} onClick={() => abrir(e)}>{TIPOS[e.tipo]?.emo} {e.titulo}</button>))}</div>)}
          </div>)}
        <div class="sem-corpo" style={`height:${horas.length * PX_HORA}px`}>
          <div class="sem-horas">{horas.map((h) => <div class="sem-hora" style={`top:${(h - h0) * PX_HORA}px`}>{h}h</div>)}</div>
          {dias.map((d, i) => {
            const choque = conflitos(porDia[i]);
            return (
              <div class={`sem-col ${d === hoje ? "hoje" : ""}`}
                onClick={(ev) => {
                  if (ev.target !== ev.currentTarget) return;
                  const y = ev.offsetY, h = Math.min(23, h0 + Math.floor(y / PX_HORA));
                  novo(d, `${String(h).padStart(2, "0")}:00`);
                }}>
                {horas.map((h) => <div class="sem-linha" style={`top:${(h - h0) * PX_HORA}px`} />)}
                {blocos[i].map((b) => (
                  <button class={`sem-ev t-${b.e.tipo} ${choque.has(b.e.id) ? "choque" : ""}`} onClick={() => abrir(b.e)}
                    style={`top:${((b.ini - h0 * 60) / 60) * PX_HORA}px;height:${((b.fim - b.ini) / 60) * PX_HORA - 2}px;` +
                      `left:calc(${(b.col / b.cols) * 100}% + 1px);width:calc(${100 / b.cols}% - 3px)`}>
                    <b>{b.e.horaInicio}</b> {b.e.titulo}
                  </button>))}
              </div>);
          })}
        </div>
      </div>
      <p class="muted pequeno" style="margin:10px 4px 90px">Deslize para os lados para ver outros dias. Toque num horário vazio para criar um evento ali.</p>
    </div>
  );
}

/* ---------- month ---------- */
export function VistaMes({ datas, inicio, fim, hoje, cidade, doDia, irPara }: {
  datas: string[]; inicio: string; fim: string; hoje: string; cidade: (d: string) => string;
  doDia: DoDia; irPara: (d: string) => void;
}) {
  // every month that has a trip day or an event
  const meses = [...new Set(datas.map((d) => d.slice(0, 7)))].sort();
  return (<>{meses.map((m) => {
    const [y, mm] = m.split("-").map(Number);
    const primeiro = `${m}-01`;
    const ultimo = somaDias(`${mm === 12 ? y + 1 : y}-${String(mm === 12 ? 1 : mm + 1).padStart(2, "0")}-01`, -1);
    const vazio = new Date(Date.UTC(y, mm - 1, 1)).getUTCDay();
    const dias = listaDias(primeiro, ultimo);
    return (
      <div class="mes">
        <h3 class="secao">{MESES[mm - 1]} {y}</h3>
        <div class="mes-grade">
          {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((s) => <div class="mes-sem">{s}</div>)}
          {Array.from({ length: vazio }, () => <div />)}
          {dias.map((d) => {
            const naViagem = d >= inicio && d <= fim, evs = doDia(d);
            const c = cidade(d);
            return (
              <button class={`mes-dia ${naViagem ? "viagem" : ""} ${d === hoje ? "hoje" : ""}`} onClick={() => irPara(d)}
                aria-label={`${dataCurta(d)}${c ? ", " + c : ""}, ${evs.length} eventos`}>
                <span class="mes-num">{+d.slice(8)}</span>
                {naViagem && c && <span class="mes-cid">{c}</span>}
                {evs.slice(0, 3).map((e) => (
                  <span class={`mes-ev t-${e.tipo}`}>{e.horaInicio && <b>{e.horaInicio.replace(/:00$/, "h")} </b>}{e.titulo}</span>))}
                {evs.length > 3 && <span class="mes-mais">+{evs.length - 3}</span>}
              </button>);
          })}
        </div>
      </div>);
  })}
  <p class="muted pequeno" style="margin:10px 4px 90px">Toque num dia para ver a programação. {diferencaDias(inicio, fim) + 1} dias de viagem destacados.</p>
  </>);
}
