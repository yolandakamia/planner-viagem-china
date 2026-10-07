import { useState } from "preact/hooks";
import type { Item, Mala, StatusItem, OrigemItem } from "../db/tipos";
import {
  CATEGORIAS, SUBCATEGORIAS, ESTILOS, STATUS, ORIGENS_VOLTA, NAO_VOLTA, kg, pesoTotal,
  salvarItem, excluirItem, salvarMala, excluirMala, adicionarSugestoesQueFaltam,
} from "../db/mala";
import { uuid } from "../lib/uuid";
import { Folha } from "./Folha";

const ICONE_STATUS: Record<StatusItem, string> = { "a separar": "○", "separado": "◐", "na mala": "●" };
export const proximoStatus = (s: StatusItem): StatusItem => STATUS[(STATUS.indexOf(s) + 1) % STATUS.length];

/* checked bags may not carry cabin-only items (power bank, documents…) */
export const foraDaMao = (i: Item, malas: Mala[]) =>
  !!i.soMao && malas.find((m) => m.id === i.malaId)?.tipo === "despachada";

/* ---------- one row of the list ---------- */
export function LinhaItem({ i, malas, volta = false, aoAbrir }: { i: Item; malas: Mala[]; volta?: boolean; aoAbrir: (i: Item) => void }) {
  const mala = malas.find((m) => m.id === (volta ? i.malaVoltaId : i.malaId));
  const g = pesoTotal(i);
  return (
    <div class={`item st-${i.status.replace(" ", "-")}`}>
      {!volta && (
        <button class="item-st" aria-label={`Status: ${i.status}. Tocar para mudar`}
          onClick={() => salvarItem({ ...i, status: proximoStatus(i.status) })}>
          <span class="item-st-ic">{ICONE_STATUS[i.status]}</span>
          <span class="item-st-rot">{i.status}</span>
        </button>)}
      {volta && <div class="item-st item-st-volta">{ORIGENS_VOLTA[i.origem as keyof typeof ORIGENS_VOLTA]?.emo ?? "📦"}</div>}
      <button class="item-corpo" onClick={() => aoAbrir(i)}>
        <div class="item-nome">{i.nome || "(sem nome)"}{i.quantidade > 1 && <span class="item-qtd"> ×{i.quantidade}</span>}</div>
        <div class="item-info">
          <span>{mala?.nome ?? (volta ? "sem mala de destino" : "sem mala")}</span>
          {i.pesoG != null && <span>{g >= 1000 ? `${kg(g)} kg` : `${g} g`}</span>}
          {i.subcategoria && <span>{i.subcategoria}</span>}
          {foraDaMao(i, malas) && <span class="tag tag-aviso">⚠️ só na bagagem de mão</span>}
          {!volta && i.malaVoltaId === NAO_VOLTA && <span class="tag">não volta</span>}
        </div>
      </button>
    </div>
  );
}

/* ---------- item editor ---------- */
export function EditorItem({ inicial, novo, malas, aoFechar }: { inicial: Item; novo: boolean; malas: Mala[]; aoFechar: () => void }) {
  const [i, setI] = useState(inicial);
  const set = <K extends keyof Item>(k: K, v: Item[K]) => setI((x) => ({ ...x, [k]: v }));
  const val = (e: Event) => (e.target as HTMLInputElement).value;
  const ehVolta = i.origem !== "levar";
  const ok = !!i.nome.trim();
  const g = pesoTotal(i);

  async function salvar() {
    if (!ok) return;
    await salvarItem({ ...i, nome: i.nome.trim(), quantidade: Math.max(1, Math.round(i.quantidade || 1)) });
    aoFechar();
  }
  async function excluir() {
    if (!confirm(`Excluir "${i.nome || "item"}"?`)) return;
    await excluirItem(i.id); aoFechar();
  }
  return (
    <Folha titulo={novo ? (ehVolta ? "Trazer de volta" : "Novo item") : "Editar item"} aoFechar={aoFechar} rodape={<>
      {!novo && <button class="btn" onClick={excluir}>Excluir</button>}
      <button class="btn" onClick={aoFechar}>Cancelar</button>
      <button class="btn primario" disabled={!ok} onClick={salvar}>Salvar</button>
    </>}>
      <div class="campo"><label for="i-nome">Nome</label>
        <input id="i-nome" value={i.nome} onInput={(e) => set("nome", val(e))} placeholder={ehVolta ? "Ex.: amostras de HPL" : "Ex.: camisa social branca"} /></div>

      {ehVolta ? (
        <div class="campo"><label>O que é</label><div class="chips">
          {(Object.keys(ORIGENS_VOLTA) as Exclude<OrigemItem, "levar">[]).map((o) => (
            <button type="button" class={`chip ${i.origem === o ? "on" : ""}`} aria-pressed={i.origem === o} onClick={() => set("origem", o)}>
              {ORIGENS_VOLTA[o].emo} {ORIGENS_VOLTA[o].rot}</button>))}
        </div></div>
      ) : (
        <div class="campo"><label>Categoria</label><div class="chips">
          {Object.entries(CATEGORIAS).map(([k, c]) => (
            <button type="button" class={`chip ${i.categoria === k ? "on" : ""}`} aria-pressed={i.categoria === k} onClick={() => set("categoria", k)}>
              {c.emo} {c.rot}</button>))}
        </div></div>
      )}

      {!ehVolta && (i.categoria === "roupa" || i.categoria === "calcado") && (
        <div class="campo"><label for="i-sub">Tipo de peça</label>
          <input id="i-sub" list="lista-sub" value={i.subcategoria} onInput={(e) => set("subcategoria", val(e))} placeholder="camisa, calça, blazer, sapato…" />
          <datalist id="lista-sub">{SUBCATEGORIAS.map((s) => <option value={s} />)}</datalist></div>)}

      <div class="linha2">
        <div class="campo"><label for="i-qtd">Quantidade</label>
          <div class="stepper">
            <button type="button" aria-label="Menos" onClick={() => set("quantidade", Math.max(1, (i.quantidade || 1) - 1))}>−</button>
            <input id="i-qtd" type="number" inputMode="numeric" min={1} value={i.quantidade} onInput={(e) => set("quantidade", Number(val(e)) || 1)} />
            <button type="button" aria-label="Mais" onClick={() => set("quantidade", (i.quantidade || 1) + 1)}>+</button>
          </div></div>
        <div class="campo"><label for="i-peso">Peso por unidade (g)</label>
          <input id="i-peso" type="number" inputMode="numeric" min={0} value={i.pesoG ?? ""} placeholder="opcional"
            onInput={(e) => set("pesoG", val(e) === "" ? null : Math.max(0, Math.round(Number(val(e)))))} /></div>
      </div>
      {i.pesoG != null && i.quantidade > 1 && <p class="muted pequeno" style="margin:-6px 0 12px">Total: {kg(g)} kg</p>}

      <div class="campo"><label for="i-mala">{ehVolta ? "Mala de destino (volta)" : "Mala"}</label>
        <select id="i-mala" value={(ehVolta ? i.malaVoltaId : i.malaId) ?? ""}
          onChange={(e) => set(ehVolta ? "malaVoltaId" : "malaId", val(e) || null)}>
          <option value="">— sem mala —</option>
          {malas.map((m) => <option value={m.id}>{m.nome}</option>)}
        </select></div>

      {!ehVolta && (<>
        <div class="campo"><label>Status</label>
          <div class="seg">{STATUS.map((s) => (
            <button type="button" class={i.status === s ? "on" : ""} aria-pressed={i.status === s} onClick={() => set("status", s)}>{ICONE_STATUS[s]} {s}</button>))}
          </div></div>
        {(i.categoria === "roupa" || i.categoria === "calcado") && (<>
          <div class="campo"><label>Estilo</label><div class="chips">
            {ESTILOS.map((s) => (
              <button type="button" class={`chip ${i.estilo === s ? "on" : ""}`} aria-pressed={i.estilo === s}
                onClick={() => set("estilo", i.estilo === s ? "" : s)}>{s}</button>))}
          </div></div>
          <div class="campo"><label for="i-cor">Cor</label>
            <input id="i-cor" value={i.cor} onInput={(e) => set("cor", val(e))} placeholder="opcional" /></div>
        </>)}
        <label class="check"><input type="checkbox" checked={!!i.soMao} onChange={(e) => set("soMao", (e.target as HTMLInputElement).checked)} />
          Só pode ir na bagagem de mão</label>
        {foraDaMao(i, malas) && <div class="faixa-aviso">⚠️ Este item está numa mala despachada.</div>}
        <div class="campo"><label for="i-volta">Na volta</label>
          <select id="i-volta" value={i.malaVoltaId ?? ""} onChange={(e) => set("malaVoltaId", val(e) || null)}>
            <option value="">volta na mesma mala</option>
            {malas.filter((m) => m.id !== i.malaId).map((m) => <option value={m.id}>volta na {m.nome}</option>)}
            <option value={NAO_VOLTA}>não volta (vai ser usado ou entregue)</option>
          </select></div>
      </>)}

      <div class="campo"><label for="i-obs">Observações</label>
        <textarea id="i-obs" rows={3} value={i.obs ?? ""} onInput={(e) => set("obs", val(e))} /></div>
    </Folha>
  );
}

/* ---------- managing the bags ---------- */
export function GerenciarMalas({ malas, aoFechar }: { malas: Mala[]; aoFechar: () => void }) {
  const [msg, setMsg] = useState("");
  const mudar = (m: Mala, campo: Partial<Mala>) => salvarMala({ ...m, ...campo });
  async function nova() {
    await salvarMala({ id: uuid(), nome: "Nova mala", tipo: "outra", limiteKg: null, trecho: "ambos",
      ordem: Math.max(-1, ...malas.map((m) => m.ordem)) + 1 });
  }
  async function excluir(m: Mala) {
    if (!confirm(`Excluir "${m.nome}"? Os itens dela continuam na lista, sem mala.`)) return;
    await excluirMala(m.id);
  }
  async function sugestoes() {
    const n = await adicionarSugestoesQueFaltam(malas);
    setMsg(n ? `✓ ${n} itens sugeridos adicionados.` : "Todos os itens sugeridos já estão na lista.");
  }
  return (
    <Folha titulo="Malas" aoFechar={aoFechar} rodape={<button class="btn primario" onClick={aoFechar}>Pronto</button>}>
      {malas.map((m) => (
        <div class="mala-ed" key={m.id}>
          <div class="campo"><label for={`m-n-${m.id}`}>Nome</label>
            <input id={`m-n-${m.id}`} value={m.nome} onChange={(e) => mudar(m, { nome: (e.target as HTMLInputElement).value.trim() || m.nome })} /></div>
          <div class="linha2">
            <div class="campo"><label for={`m-l-${m.id}`}>Limite (kg)</label>
              <input id={`m-l-${m.id}`} type="number" inputMode="decimal" min={0} step="0.5" value={m.limiteKg ?? ""} placeholder="sem limite"
                onChange={(e) => { const v = (e.target as HTMLInputElement).value; mudar(m, { limiteKg: v === "" ? null : Math.max(0, Number(v)) }); }} /></div>
            <div class="campo"><label for={`m-t-${m.id}`}>Tipo</label>
              <select id={`m-t-${m.id}`} value={m.tipo ?? "outra"} onChange={(e) => mudar(m, { tipo: (e.target as HTMLSelectElement).value as Mala["tipo"] })}>
                <option value="despachada">despachada</option><option value="mao">de mão</option>
                <option value="mochila">mochila / bolsa</option><option value="outra">outra</option>
              </select></div>
          </div>
          <button class="btn btn-peq" onClick={() => excluir(m)}>Excluir mala</button>
        </div>))}
      <button class="btn" style="width:100%" onClick={nova}>＋ Nova mala</button>
      <hr class="sep" />
      <p class="muted pequeno">Apagou algum item da lista sugerida e quer de volta?</p>
      <button class="btn" style="width:100%" onClick={sugestoes}>Adicionar itens sugeridos que faltam</button>
      {msg && <p class="pequeno" style="color:var(--ok);font-weight:600">{msg}</p>}
    </Folha>
  );
}
