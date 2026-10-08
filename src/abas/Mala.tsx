import { useEffect, useState } from "preact/hooks";
import type { Item, StatusItem } from "../db/tipos";
import { useMala, novoItem, pesosPorMala, kg, CATEGORIAS, STATUS, ROT_STATUS, NAO_VOLTA, nomeMala, excluirItens, alterarItens } from "../db/mala";
import type { Mala } from "../db/tipos";
import { t, tn } from "../lib/i18n";
import { LinhaItem, EditorItem, GerenciarMalas, foraDaMao } from "../comp/Itens";
import { VariasFotos } from "../comp/VariasFotos";

type Filtros = { mala: string; categoria: string; status: string; completar?: boolean };
/* view and filters survive switching tabs */
let memoria: { trecho: "ida" | "volta"; f: Filtros } = { trecho: "ida", f: { mala: "", categoria: "", status: "" } };

export function MalaAba() {
  const { malas, itens, pronto } = useMala();
  const [trecho, setTrecho] = useState(memoria.trecho);
  const [f, setF] = useState<Filtros>(memoria.f);
  const [aberto, setAberto] = useState<{ i: Item; novo: boolean } | null>(null);
  const [gerir, setGerir] = useState(false);
  const [varias, setVarias] = useState(false);
  /* selection mode: null = off */
  const [sel, setSel] = useState<Set<string> | null>(null);
  useEffect(() => setSel(null), [trecho]);
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
    (!f.status || i.status === f.status) &&
    (!f.completar || !!i.completar));
  const aCompletar = levar.filter((i) => i.completar).length;
  const grupos = Object.keys(CATEGORIAS).concat([...new Set(filtrados.map((i) => i.categoria))].filter((c) => !CATEGORIAS[c]))
    .map((c) => ({ c, itens: filtrados.filter((i) => i.categoria === c).sort((a, b) => a.nome.localeCompare(b.nome)) }))
    .filter((g) => g.itens.length);
  const temFiltro = !!(f.mala || f.categoria || f.status || f.completar);
  const visiveis = trecho === "ida" ? filtrados : trazer;
  const marcar = (id: string) => setSel((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selDe = (i: Item) => (sel ? { marcado: sel.has(i.id), alternar: () => marcar(i.id) } : undefined);
  const botaoSel = <div class="sel-linha"><button class={`btn btn-peq ${sel ? "primario" : ""}`} onClick={() => setSel(sel ? null : new Set())}>{sel ? t("✕ Sair da seleção") : t("☑️ Selecionar")}</button></div>;

  return (
    <>
      <div class="seg" role="tablist">
        <button role="tab" aria-selected={trecho === "ida"} class={trecho === "ida" ? "on" : ""} onClick={() => setTrecho("ida")}>{t("🛫 Ida")}</button>
        <button role="tab" aria-selected={trecho === "volta"} class={trecho === "volta" ? "on" : ""} onClick={() => setTrecho("volta")}>{t("🛬 Volta")}</button>
      </div>

      {trecho === "ida" && (
        <div class="cartao progresso">
          <div class="prog-txt">{tn(levar.length, "{feito} de {n} item na mala", "{feito} de {n} itens na mala", { feito: naMala })}
            {separados > 0 && <span class="muted"> · {tn(separados, "{n} separado", "{n} separados")}</span>}</div>
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
            <div class="mc-nome">{nomeMala(mala)}</div>
            <div class="mc-peso"><b>{kg(g)}</b>{limiteG != null ? ` / ${kg(limiteG)}` : ""} kg</div>
            {limiteG != null && <div class="barra fina"><span class={passou ? "barra-mal" : "barra-ok"} style={{ width: `${Math.min(100, (g / limiteG) * 100)}%` }} /></div>}
            <div class="mc-info">{passou ? t("⚠️ passou {kg} kg", { kg: kg(g - limiteG!) }) : tn(n, "{n} item", "{n} itens") + (semPeso ? " · " + t("{n} sem peso", { n: semPeso }) : "")}</div>
          </button>))}
        <button class="mala-card mala-gerir" onClick={() => setGerir(true)}>⚙️<br />{t("Malas")}</button>
      </div>

      {trecho === "ida" ? (<>
        {alertaMao.length > 0 && <div class="faixa-aviso">⚠️ {tn(alertaMao.length, "1 item que só pode ir na bagagem de mão está numa mala despachada: {nomes}.", "{n} itens que só podem ir na bagagem de mão estão numa mala despachada: {nomes}.", { nomes: alertaMao.map((i) => i.nome).join(", ") })}</div>}
        <button class="btn varias-fotos" onClick={() => setVarias(true)}>{t("📷 Adicionar várias fotos de uma vez")}</button>
        {aCompletar > 0 && (
          <div class="faixa-aviso faixa-completar">
            <span>✏️ {tn(aCompletar, "{n} peça para completar.", "{n} peças para completar.")} {t("Toque em cada uma para pôr as informações.")}</span>
            <button class="btn btn-peq" onClick={() => setF({ ...f, completar: !f.completar })}>{f.completar ? t("Ver todas") : t("Ver só essas")}</button>
          </div>)}
        <div class="filtros">
          <select aria-label={t("Filtrar por mala")} value={f.mala} onChange={(e) => setF({ ...f, mala: (e.target as HTMLSelectElement).value })}>
            <option value="">{t("Todas as malas")}</option>
            {malas.map((m) => <option value={m.id}>{nomeMala(m)}</option>)}
            <option value="-">{t("Sem mala")}</option>
          </select>
          <select aria-label={t("Filtrar por categoria")} value={f.categoria} onChange={(e) => setF({ ...f, categoria: (e.target as HTMLSelectElement).value })}>
            <option value="">{t("Categorias")}</option>
            {Object.entries(CATEGORIAS).map(([k, c]) => <option value={k}>{c.emo} {c.rot}</option>)}
          </select>
          <select aria-label={t("Filtrar por status")} value={f.status} onChange={(e) => setF({ ...f, status: (e.target as HTMLSelectElement).value as StatusItem | "" })}>
            <option value="">{t("Status")}</option>
            {STATUS.map((s) => <option value={s}>{ROT_STATUS[s]}</option>)}
          </select>
        </div>
        {temFiltro && <button class="limpar" onClick={() => setF({ mala: "", categoria: "", status: "", completar: false })}>{t("✕ limpar filtros ({n} de {total})", { n: filtrados.length, total: levar.length })}</button>}
        {botaoSel}
        {grupos.map((g) => (
          <section>
            <h3 class="secao">{CATEGORIAS[g.c]?.emo} {CATEGORIAS[g.c]?.rot ?? g.c} <span class="muted">({g.itens.length})</span></h3>
            <div class="lista-itens">{g.itens.map((i) => <LinhaItem i={i} malas={malas} sel={selDe(i)} aoAbrir={(x) => setAberto({ i: x, novo: false })} />)}</div>
          </section>))}
        {!filtrados.length && <div class="vazio"><div class="emo">🧳</div>{levar.length ? t("Nenhum item com esses filtros.") : t("A lista está vazia. Toque em ＋ para adicionar.")}</div>}
        {!sel && <button class="fab" aria-label={t("Novo item")} onClick={() => setAberto({ i: novoItem("levar", f.mala && f.mala !== "-" ? f.mala : malas[0]?.id ?? null), novo: true })}>＋</button>}
      </>) : (<>
        <p class="muted pequeno" style="margin:4px 4px 10px">
          {t("O peso da volta soma o que você levou (na mesma mala, a não ser que tenha marcado outra ou \"não volta\") com as compras, amostras e catálogos abaixo.")}
          {levar.some((i) => i.malaVoltaId === NAO_VOLTA) && " " + tn(levar.filter((i) => i.malaVoltaId === NAO_VOLTA).length, "{n} item marcado como \"não volta\".", "{n} itens marcados como \"não volta\".")}
        </p>
        {trazer.length > 0 && botaoSel}
        <h3 class="secao">{t("Trazendo de volta")} <span class="muted">({trazer.length})</span></h3>
        {trazer.length
          ? <div class="lista-itens">{trazer.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).map((i) =>
              <LinhaItem i={i} malas={malas} volta sel={selDe(i)} aoAbrir={(x) => setAberto({ i: x, novo: false })} />)}</div>
          : <div class="vazio"><div class="emo">🛍️</div>{t("Nenhuma compra, amostra ou catálogo ainda.")}<br /><span class="pequeno">{t("Toque em ＋ para registrar.")}</span></div>}
        {!sel && <button class="fab" aria-label={t("Registrar compra, amostra ou catálogo")} onClick={() => setAberto({ i: novoItem("compra", malas[0]?.id ?? null), novo: true })}>＋</button>}
      </>)}

      {aberto && <EditorItem inicial={aberto.i} novo={aberto.novo} malas={malas} aoFechar={() => setAberto(null)} />}
      {sel && <div class="sel-espaco" aria-hidden="true" />}
      {sel && <BarraSelecao ids={[...sel]} total={visiveis.length} volta={trecho === "volta"} malas={malas}
        todos={() => setSel(new Set(visiveis.map((i) => i.id)))} nenhum={() => setSel(new Set())} sair={() => setSel(null)} />}
      {varias && <VariasFotos malas={malas} aoFechar={() => setVarias(false)} />}
      {gerir && <GerenciarMalas malas={malas} aoFechar={() => setGerir(false)} />}
    </>
  );
}

/* the bar of the selection mode: what to do with the marked items */
function BarraSelecao({ ids, total, volta, malas, todos, nenhum, sair }: {
  ids: string[]; total: number; volta: boolean; malas: Mala[]; todos: () => void; nenhum: () => void; sair: () => void;
}) {
  const n = ids.length;
  async function excluir() {
    if (!n || !confirm(tn(n, "Excluir {n} item? A foto dele também é apagada.", "Excluir {n} itens? As fotos deles também são apagadas."))) return;
    await excluirItens(ids); sair();
  }
  async function mover(e: Event) {
    const el = e.target as HTMLSelectElement, v = el.value; el.value = "";
    if (!v || !n) return;
    const destino = v === "-" ? null : v;
    await alterarItens(ids, volta ? { malaVoltaId: destino } : { malaId: destino });
  }
  async function status(e: Event) {
    const el = e.target as HTMLSelectElement, v = el.value as StatusItem; el.value = "";
    if (v && n) await alterarItens(ids, { status: v });
  }
  return (
    <div class="barra-sel" role="toolbar" aria-label={t("Itens selecionados")}>
      <div class="bs-topo">
        <b>{tn(n, "{n} selecionado", "{n} selecionados")}</b>
        <button class="link-hoje" onClick={n === total ? nenhum : todos}>{n === total && total ? t("Desmarcar todos") : t("Marcar todos ({n})", { n: total })}</button>
      </div>
      <div class="bs-acoes">
        {!volta && <select aria-label={t("Mudar status")} disabled={!n} onChange={status}>
          <option value="">{t("Status…")}</option>
          {STATUS.map((x) => <option value={x}>{ROT_STATUS[x]}</option>)}
        </select>}
        <select aria-label={t("Mover para a mala")} disabled={!n} onChange={mover}>
          <option value="">{t("Mover para…")}</option>
          {malas.map((m) => <option value={m.id}>{nomeMala(m)}</option>)}
          <option value="-">{t("Sem mala")}</option>
        </select>
        <button class="btn btn-peq bs-excluir" disabled={!n} onClick={excluir}>{t("🗑️ Excluir")}</button>
      </div>
    </div>
  );
}
