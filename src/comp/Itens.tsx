import { useState } from "preact/hooks";
import type { Item, Mala, StatusItem, OrigemItem } from "../db/tipos";
import {
  CATEGORIAS, SUBCATEGORIAS, ESTILOS, STATUS, ROT_STATUS, ORIGENS_VOLTA, NAO_VOLTA, kg, pesoTotal,
  salvarItem, excluirItem, salvarMala, excluirMala, adicionarSugestoesQueFaltam,
  nomeMala,
} from "../db/mala";
import { uuid } from "../lib/uuid";
import { Folha } from "./Folha";
import { CampoFoto, Miniatura, type MudancaFoto } from "./Foto";
import { gravarFoto, apagarFoto } from "../db/fotos";
import { t, tn } from "../lib/i18n";

/* display labels of the stored style values */
const ROT_ESTILO: Record<string, string> = { social: t("social"), casual: t("casual"), esporte: t("esporte") };

const ICONE_STATUS: Record<StatusItem, string> = { "a separar": "○", "separado": "◐", "na mala": "●" };
export const proximoStatus = (s: StatusItem): StatusItem => STATUS[(STATUS.indexOf(s) + 1) % STATUS.length];

/* checked bags may not carry cabin-only items (power bank, documents…) */
export const foraDaMao = (i: Item, malas: Mala[]) =>
  !!i.soMao && malas.find((m) => m.id === i.malaId)?.tipo === "despachada";

/* ---------- one row of the list ---------- */
/* sel: selection mode — the left button becomes a checkbox and tapping the row marks it */
export function LinhaItem({ i, malas, volta = false, aoAbrir, sel }: {
  i: Item; malas: Mala[]; volta?: boolean; aoAbrir: (i: Item) => void; sel?: { marcado: boolean; alternar: () => void };
}) {
  const mala = malas.find((m) => m.id === (volta ? i.malaVoltaId : i.malaId));
  const g = pesoTotal(i);
  return (
    <div class={`item st-${i.status.replace(" ", "-")} ${sel?.marcado ? "marcado" : ""}`}>
      {sel && (
        <button class="item-st item-check" role="checkbox" aria-checked={sel.marcado} aria-label={t("Selecionar {nome}", { nome: i.nome })} onClick={sel.alternar}>
          <span class="item-check-ic">{sel.marcado ? "☑" : "☐"}</span>
        </button>)}
      {!sel && !volta && (
        <button class="item-st" aria-label={t("Status: {s}. Tocar para mudar", { s: ROT_STATUS[i.status] ?? i.status })}
          onClick={() => salvarItem({ ...i, status: proximoStatus(i.status) })}>
          <span class="item-st-ic">{ICONE_STATUS[i.status]}</span>
          <span class="item-st-rot">{ROT_STATUS[i.status] ?? i.status}</span>
        </button>)}
      {!sel && volta && <div class="item-st item-st-volta">{ORIGENS_VOLTA[i.origem as keyof typeof ORIGENS_VOLTA]?.emo ?? "📦"}</div>}
      <button class="item-corpo" onClick={() => (sel ? sel.alternar() : aoAbrir(i))}>
        <Miniatura fotoId={i.fotoId} class="item-mini" />
        <div class="item-txt">
        <div class="item-nome">{i.nome || t("(sem nome)")}{i.quantidade > 1 && <span class="item-qtd"> ×{i.quantidade}</span>}</div>
        <div class="item-info">
          <span>{(mala && nomeMala(mala)) ?? (volta ? t("sem mala de destino") : t("sem mala"))}</span>
          {i.pesoG != null && <span>{g >= 1000 ? `${kg(g)} kg` : `${g} g`}</span>}
          {i.subcategoria && <span>{i.subcategoria}</span>}
          {i.completar && <span class="tag tag-completar">{t("✏️ completar")}</span>}
          {foraDaMao(i, malas) && <span class="tag tag-aviso">{t("⚠️ só na bagagem de mão")}</span>}
          {!volta && i.malaVoltaId === NAO_VOLTA && <span class="tag">{t("não volta")}</span>}
        </div>
        </div>
      </button>
    </div>
  );
}

/* ---------- item editor ---------- */
export function EditorItem({ inicial, novo, malas, aoFechar }: { inicial: Item; novo: boolean; malas: Mala[]; aoFechar: () => void }) {
  const [i, setI] = useState(inicial);
  const [foto, setFoto] = useState<MudancaFoto>({ tipo: "nada" });
  const [salvando, setSalvando] = useState(false);
  const set = <K extends keyof Item>(k: K, v: Item[K]) => setI((x) => ({ ...x, [k]: v }));
  const val = (e: Event) => (e.target as HTMLInputElement).value;
  const ehVolta = i.origem !== "levar";
  const ok = !!i.nome.trim();
  const g = pesoTotal(i);

  async function salvar() {
    if (!ok || salvando) return;
    setSalvando(true);
    let fotoId = i.fotoId;
    if (foto.tipo === "nova") { fotoId = await gravarFoto(foto.img); await apagarFoto(i.fotoId); }
    if (foto.tipo === "remover") { await apagarFoto(i.fotoId); fotoId = null; }
    await salvarItem({ ...i, fotoId, nome: i.nome.trim(), quantidade: Math.max(1, Math.round(i.quantidade || 1)), completar: undefined });
    aoFechar();
  }
  async function excluir() {
    if (!confirm(t("Excluir \"{nome}\"?", { nome: i.nome || t("item") }))) return;
    await excluirItem(i.id); aoFechar();
  }
  return (
    <Folha titulo={novo ? (ehVolta ? t("Trazer de volta") : t("Novo item")) : t("Editar item")} aoFechar={aoFechar} rodape={<>
      {!novo && <button class="btn" onClick={excluir}>{t("Excluir")}</button>}
      <button class="btn" onClick={aoFechar}>{t("Cancelar")}</button>
      <button class="btn primario" disabled={!ok || salvando} onClick={salvar}>{t("Salvar")}</button>
    </>}>
      {!ehVolta && <CampoFoto fotoId={i.fotoId} mudanca={foto} aoMudar={setFoto} />}
      <div class="campo"><label for="i-nome">{t("Nome")}</label>
        <input id="i-nome" value={i.nome} onInput={(e) => set("nome", val(e))} placeholder={ehVolta ? t("Ex.: amostras de HPL") : t("Ex.: camisa social branca")} /></div>

      {ehVolta ? (
        <div class="campo"><label>{t("O que é")}</label><div class="chips">
          {(Object.keys(ORIGENS_VOLTA) as Exclude<OrigemItem, "levar">[]).map((o) => (
            <button type="button" class={`chip ${i.origem === o ? "on" : ""}`} aria-pressed={i.origem === o} onClick={() => set("origem", o)}>
              {ORIGENS_VOLTA[o].emo} {ORIGENS_VOLTA[o].rot}</button>))}
        </div></div>
      ) : (
        <div class="campo"><label>{t("Categoria")}</label><div class="chips">
          {Object.entries(CATEGORIAS).map(([k, c]) => (
            <button type="button" class={`chip ${i.categoria === k ? "on" : ""}`} aria-pressed={i.categoria === k} onClick={() => set("categoria", k)}>
              {c.emo} {c.rot}</button>))}
        </div></div>
      )}

      {!ehVolta && (i.categoria === "roupa" || i.categoria === "calcado") && (
        <div class="campo"><label for="i-sub">{t("Tipo de peça")}</label>
          <input id="i-sub" list="lista-sub" value={i.subcategoria} onInput={(e) => set("subcategoria", val(e))} placeholder={t("camisa, calça, blazer, sapato…")} />
          <datalist id="lista-sub">{SUBCATEGORIAS.map((s) => <option value={s} />)}</datalist></div>)}

      <div class="linha2">
        <div class="campo"><label for="i-qtd">{t("Quantidade")}</label>
          <div class="stepper">
            <button type="button" aria-label={t("Menos")} onClick={() => set("quantidade", Math.max(1, (i.quantidade || 1) - 1))}>−</button>
            <input id="i-qtd" type="number" inputMode="numeric" min={1} value={i.quantidade} onInput={(e) => set("quantidade", Number(val(e)) || 1)} />
            <button type="button" aria-label={t("Mais")} onClick={() => set("quantidade", (i.quantidade || 1) + 1)}>+</button>
          </div></div>
        <div class="campo"><label for="i-peso">{t("Peso por unidade (g)")}</label>
          <input id="i-peso" type="number" inputMode="numeric" min={0} value={i.pesoG ?? ""} placeholder={t("opcional")}
            onInput={(e) => set("pesoG", val(e) === "" ? null : Math.max(0, Math.round(Number(val(e)))))} /></div>
      </div>
      {i.pesoG != null && i.quantidade > 1 && <p class="muted pequeno" style="margin:-6px 0 12px">{t("Total: {kg} kg", { kg: kg(g) })}</p>}

      <div class="campo"><label for="i-mala">{ehVolta ? t("Mala de destino (volta)") : t("Mala")}</label>
        <select id="i-mala" value={(ehVolta ? i.malaVoltaId : i.malaId) ?? ""}
          onChange={(e) => set(ehVolta ? "malaVoltaId" : "malaId", val(e) || null)}>
          <option value="">{t("— sem mala —")}</option>
          {malas.map((m) => <option value={m.id}>{nomeMala(m)}</option>)}
        </select></div>

      {!ehVolta && (<>
        <div class="campo"><label>{t("Status")}</label>
          <div class="seg">{STATUS.map((s) => (
            <button type="button" class={i.status === s ? "on" : ""} aria-pressed={i.status === s} onClick={() => set("status", s)}>{ICONE_STATUS[s]} {ROT_STATUS[s]}</button>))}
          </div></div>
        {(i.categoria === "roupa" || i.categoria === "calcado") && (<>
          <div class="campo"><label>{t("Estilo")}</label><div class="chips">
            {ESTILOS.map((s) => (
              <button type="button" class={`chip ${i.estilo === s ? "on" : ""}`} aria-pressed={i.estilo === s}
                onClick={() => set("estilo", i.estilo === s ? "" : s)}>{ROT_ESTILO[s] ?? s}</button>))}
          </div></div>
          <div class="campo"><label for="i-cor">{t("Cor")}</label>
            <input id="i-cor" value={i.cor} onInput={(e) => set("cor", val(e))} placeholder={t("opcional")} /></div>
        </>)}
        <label class="check"><input type="checkbox" checked={!!i.soMao} onChange={(e) => set("soMao", (e.target as HTMLInputElement).checked)} />
          {t("Só pode ir na bagagem de mão")}</label>
        {foraDaMao(i, malas) && <div class="faixa-aviso">{t("⚠️ Este item está numa mala despachada.")}</div>}
        <div class="campo"><label for="i-volta">{t("Na volta")}</label>
          <select id="i-volta" value={i.malaVoltaId ?? ""} onChange={(e) => set("malaVoltaId", val(e) || null)}>
            <option value="">{t("volta na mesma mala")}</option>
            {malas.filter((m) => m.id !== i.malaId).map((m) => <option value={m.id}>{t("volta na {mala}", { mala: nomeMala(m) })}</option>)}
            <option value={NAO_VOLTA}>{t("não volta (vai ser usado ou entregue)")}</option>
          </select></div>
      </>)}

      <div class="campo"><label for="i-obs">{t("Observações")}</label>
        <textarea id="i-obs" rows={3} value={i.obs ?? ""} onInput={(e) => set("obs", val(e))} /></div>
    </Folha>
  );
}

/* ---------- managing the bags ---------- */
export function GerenciarMalas({ malas, aoFechar }: { malas: Mala[]; aoFechar: () => void }) {
  const [msg, setMsg] = useState("");
  const mudar = (m: Mala, campo: Partial<Mala>) => salvarMala({ ...m, ...campo });
  async function nova() {
    await salvarMala({ id: uuid(), nome: t("Nova mala"), tipo: "outra", limiteKg: null, trecho: "ambos",
      ordem: Math.max(-1, ...malas.map((m) => m.ordem)) + 1 });
  }
  async function excluir(m: Mala) {
    if (!confirm(t("Excluir \"{nome}\"? Os itens dela continuam na lista, sem mala.", { nome: m.nome }))) return;
    await excluirMala(m.id);
  }
  async function sugestoes() {
    const n = await adicionarSugestoesQueFaltam(malas);
    setMsg(n ? tn(n, "✓ {n} item sugerido adicionado.", "✓ {n} itens sugeridos adicionados.") : t("Todos os itens sugeridos já estão na lista."));
  }
  return (
    <Folha titulo={t("Malas")} aoFechar={aoFechar} rodape={<button class="btn primario" onClick={aoFechar}>{t("Pronto")}</button>}>
      {malas.map((m) => (
        <div class="mala-ed" key={m.id}>
          <div class="campo"><label for={`m-n-${m.id}`}>{t("Nome")}</label>
            <input id={`m-n-${m.id}`} value={m.nome} onChange={(e) => mudar(m, { nome: (e.target as HTMLInputElement).value.trim() || m.nome })} /></div>
          <div class="linha2">
            <div class="campo"><label for={`m-l-${m.id}`}>{t("Limite (kg)")}</label>
              <input id={`m-l-${m.id}`} type="number" inputMode="decimal" min={0} step="0.5" value={m.limiteKg ?? ""} placeholder={t("sem limite")}
                onChange={(e) => { const v = (e.target as HTMLInputElement).value; mudar(m, { limiteKg: v === "" ? null : Math.max(0, Number(v)) }); }} /></div>
            <div class="campo"><label for={`m-t-${m.id}`}>{t("Tipo")}</label>
              <select id={`m-t-${m.id}`} value={m.tipo ?? "outra"} onChange={(e) => mudar(m, { tipo: (e.target as HTMLSelectElement).value as Mala["tipo"] })}>
                <option value="despachada">{t("despachada")}</option><option value="mao">{t("de mão")}</option>
                <option value="mochila">{t("mochila / bolsa")}</option><option value="outra">{t("outra")}</option>
              </select></div>
          </div>
          <button class="btn btn-peq" onClick={() => excluir(m)}>{t("Excluir mala")}</button>
        </div>))}
      <button class="btn" style="width:100%" onClick={nova}>{t("＋ Nova mala")}</button>
      <hr class="sep" />
      <p class="muted pequeno">{t("Apagou algum item da lista sugerida e quer de volta?")}</p>
      <button class="btn" style="width:100%" onClick={sugestoes}>{t("Adicionar itens sugeridos que faltam")}</button>
      {msg && <p class="pequeno" style="color:var(--ok);font-weight:600">{msg}</p>}
    </Folha>
  );
}
