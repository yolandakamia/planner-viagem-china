import { useEffect, useState } from "preact/hooks";
import type { Item, StatusItem } from "../db/tipos";
import { useMala, novoItem, pesosPorMala, kg, CATEGORIAS, STATUS, NAO_VOLTA } from "../db/mala";
import { LinhaItem, EditorItem, GerenciarMalas, foraDaMao } from "../comp/Itens";

type Filtros = { mala: string; categoria: string; status: string };
/* view and filters survive switching tabs */
let memoria: { trecho: "ida" | "volta"; f: Filtros } = { trecho: "ida", f: { mala: "", categoria: "", status: "" } };

export function MalaAba() {
  const { malas, itens, pronto } = useMala();
  const [trecho, setTrecho] = useState(memoria.trecho);
  const [f, setF] = useState<Filtros>(memoria.f);
  const [aberto, setAberto] = useState<{ i: Item; novo: boolean } | null>(null);
  const [gerir, setGerir] = useState(false);
  useEffect(() => { memoria = { trecho, f }; }, [trecho, f]);
  if (!pronto) return null;

  const levar = itens.filter((i) => i.origem === "levar");
  const trazer = itens.filter((i) => i.origem !== "levar");
  const naMala = levar.filter((i) => i.status === "na mala").length;
  const separados = levar.filter((i) => i.status === "separado").length;
  const pesos = pesosPorMala(malas, itens, trecho);
  const alertaMao = levar.filter((i) => foraDaMao(i, malas));

  const filtrados = levar.filter((i) =>
    (!f.mala || (f.mala === "-" ? !i.malaId : i.malaId === f.mala)) &&
    (!f.categoria || i.categoria === f.categoria) &&
    (!f.status || i.status === f.status));
  const grupos = Object.keys(CATEGORIAS).concat([...new Set(filtrados.map((i) => i.categoria))].filter((c) => !CATEGORIAS[c]))
    .map((c) => ({ c, itens: filtrados.filter((i) => i.categoria === c).sort((a, b) => a.nome.localeCompare(b.nome)) }))
    .filter((g) => g.itens.length);
  const temFiltro = !!(f.mala || f.categoria || f.status);

  return (
    <>
      <div class="seg" role="tablist">
        <button role="tab" aria-selected={trecho === "ida"} class={trecho === "ida" ? "on" : ""} onClick={() => setTrecho("ida")}>🛫 Ida</button>
        <button role="tab" aria-selected={trecho === "volta"} class={trecho === "volta" ? "on" : ""} onClick={() => setTrecho("volta")}>🛬 Volta</button>
      </div>

      {trecho === "ida" && (
        <div class="cartao progresso">
          <div class="prog-txt"><b>{naMala} de {levar.length}</b> {levar.length === 1 ? "item" : "itens"} na mala
            {separados > 0 && <span class="muted"> · {separados} {separados === 1 ? "separado" : "separados"}</span>}</div>
          <div class="barra" role="progressbar" aria-valuemin={0} aria-valuemax={levar.length} aria-valuenow={naMala}>
            <span class="barra-sep" style={{ width: `${levar.length ? ((naMala + separados) / levar.length) * 100 : 0}%` }} />
            <span class="barra-ok" style={{ width: `${levar.length ? (naMala / levar.length) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      <div class="malas">
        {pesos.map(({ mala, g, semPeso, n, limiteG, passou }) => (
          <button class={`mala-card ${passou ? "passou" : ""} ${trecho === "ida" && f.mala === mala.id ? "on" : ""}`}
            onClick={() => trecho === "ida" && setF({ ...f, mala: f.mala === mala.id ? "" : mala.id })}>
            <div class="mc-nome">{mala.nome}</div>
            <div class="mc-peso"><b>{kg(g)}</b>{limiteG != null ? ` / ${kg(limiteG)}` : ""} kg</div>
            {limiteG != null && <div class="barra fina"><span class={passou ? "barra-mal" : "barra-ok"} style={{ width: `${Math.min(100, (g / limiteG) * 100)}%` }} /></div>}
            <div class="mc-info">{passou ? `⚠️ passou ${kg(g - limiteG!)} kg` : `${n} ${n === 1 ? "item" : "itens"}${semPeso ? ` · ${semPeso} sem peso` : ""}`}</div>
          </button>))}
        <button class="mala-card mala-gerir" onClick={() => setGerir(true)}>⚙️<br />Malas</button>
      </div>

      {trecho === "ida" ? (<>
        {alertaMao.length > 0 && <div class="faixa-aviso">⚠️ {alertaMao.length === 1 ? "1 item que só pode ir" : `${alertaMao.length} itens que só podem ir`} na bagagem de mão {alertaMao.length === 1 ? "está" : "estão"} numa mala despachada: {alertaMao.map((i) => i.nome).join(", ")}.</div>}
        <div class="filtros">
          <select aria-label="Filtrar por mala" value={f.mala} onChange={(e) => setF({ ...f, mala: (e.target as HTMLSelectElement).value })}>
            <option value="">Todas as malas</option>
            {malas.map((m) => <option value={m.id}>{m.nome}</option>)}
            <option value="-">Sem mala</option>
          </select>
          <select aria-label="Filtrar por categoria" value={f.categoria} onChange={(e) => setF({ ...f, categoria: (e.target as HTMLSelectElement).value })}>
            <option value="">Categorias</option>
            {Object.entries(CATEGORIAS).map(([k, c]) => <option value={k}>{c.emo} {c.rot}</option>)}
          </select>
          <select aria-label="Filtrar por status" value={f.status} onChange={(e) => setF({ ...f, status: (e.target as HTMLSelectElement).value as StatusItem | "" })}>
            <option value="">Status</option>
            {STATUS.map((s) => <option value={s}>{s}</option>)}
          </select>
        </div>
        {temFiltro && <button class="limpar" onClick={() => setF({ mala: "", categoria: "", status: "" })}>✕ limpar filtros ({filtrados.length} de {levar.length})</button>}
        {grupos.map((g) => (
          <section>
            <h3 class="secao">{CATEGORIAS[g.c]?.emo} {CATEGORIAS[g.c]?.rot ?? g.c} <span class="muted">({g.itens.length})</span></h3>
            <div class="lista-itens">{g.itens.map((i) => <LinhaItem i={i} malas={malas} aoAbrir={(x) => setAberto({ i: x, novo: false })} />)}</div>
          </section>))}
        {!filtrados.length && <div class="vazio"><div class="emo">🧳</div>{levar.length ? "Nenhum item com esses filtros." : "A lista está vazia. Toque em ＋ para adicionar."}</div>}
        <button class="fab" aria-label="Novo item" onClick={() => setAberto({ i: novoItem("levar", f.mala && f.mala !== "-" ? f.mala : malas[0]?.id ?? null), novo: true })}>＋</button>
      </>) : (<>
        <p class="muted pequeno" style="margin:4px 4px 10px">
          O peso da volta soma o que você levou (na mesma mala, a não ser que tenha marcado outra ou "não volta")
          com as compras, amostras e catálogos abaixo.
          {levar.some((i) => i.malaVoltaId === NAO_VOLTA) && ` ${levar.filter((i) => i.malaVoltaId === NAO_VOLTA).length} itens marcados como "não volta".`}
        </p>
        <h3 class="secao">Trazendo de volta <span class="muted">({trazer.length})</span></h3>
        {trazer.length
          ? <div class="lista-itens">{trazer.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).map((i) =>
              <LinhaItem i={i} malas={malas} volta aoAbrir={(x) => setAberto({ i: x, novo: false })} />)}</div>
          : <div class="vazio"><div class="emo">🛍️</div>Nenhuma compra, amostra ou catálogo ainda.<br /><span class="pequeno">Toque em ＋ para registrar.</span></div>}
        <button class="fab" aria-label="Registrar compra, amostra ou catálogo" onClick={() => setAberto({ i: novoItem("compra", malas[0]?.id ?? null), novo: true })}>＋</button>
      </>)}

      {aberto && <EditorItem inicial={aberto.i} novo={aberto.novo} malas={malas} aoFechar={() => setAberto(null)} />}
      {gerir && <GerenciarMalas malas={malas} aoFechar={() => setGerir(false)} />}
    </>
  );
}
