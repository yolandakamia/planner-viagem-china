import { useState } from "preact/hooks";
import type { Evento, TipoEvento } from "../db/tipos";
import { TIPOS, novoEvento, salvarEvento, excluirEvento, copiaDeEvento } from "../db/eventos";
import { FUSO_CHINA, FUSO_BRASIL, dataLonga, cidadeNoBrasil } from "../lib/datas";
import { FUSOS, rotuloFuso, outroRelogio } from "../lib/tempo";
import { Folha } from "./Folha";
import { t } from "../lib/i18n";
import { ondeEvento } from "../lib/grupo";
import { quandoRoteiro } from "../lib/roteiro";

/* 👥 group / 👤 personal: shown on every card, block and chip */
export const ehDoGrupo = (e: Evento) => e.camada === "coletivo";
export function SeloCamada({ e }: { e: Evento }) {
  return ehDoGrupo(e)
    ? <span class="tag tag-grupo" title={t("Evento do grupo")}>👥 {t("Grupo")}</span>
    : <span class="tag tag-pessoal" title={t("Evento só seu")}>👤 {t("Pessoal")}</span>;
}

export type Situacao = "agora" | "seguir" | "passado" | "";

/* ---------- one event in a list ---------- */
export function CartaoEvento({ e, situacao = "", conflito = false, resto = "", aoAbrir }: {
  e: Evento; situacao?: Situacao; conflito?: boolean; resto?: string; aoAbrir: (e: Evento) => void;
}) {
  const tp = TIPOS[e.tipo] ?? TIPOS.outro;
  const hora = e.horaInicio ? e.horaInicio + (e.horaFim ? `–${e.horaFim}` : "") : t("dia todo");
  return (
    <button class={`ev ev-${e.tipo} ${situacao}`} onClick={() => aoAbrir(e)}>
      <div class="ev-hora">{hora}</div>
      <div class="ev-corpo">
        {situacao === "agora" && <span class="selo selo-agora">{t("Agora")}</span>}
        {situacao === "seguir" && <span class="selo selo-seguir">{t("A seguir")}{resto && " · " + t("em {tempo}", { tempo: resto })}</span>}
        <div class="ev-tit"><span aria-hidden="true">{tp.emo}</span> {e.titulo || t("(sem título)")}</div>
        <div class="ev-info">
          {e.fuso !== FUSO_CHINA && e.horaInicio && <span class="tag">🕒 {rotuloFuso(e.fuso)}</span>}
          {conflito && <span class="tag tag-aviso">⚠️ {t("conflito de horário")}</span>}
          <SeloCamada e={e} />
          {ondeEvento(e) && <span class="ev-local">{ondeEvento(e)}</span>}
        </div>
      </div>
    </button>
  );
}

/* ---------- Chinese address, full screen, for the taxi driver ---------- */
export function EnderecoCheio({ e, aoFechar }: { e: Evento; aoFechar: () => void }) {
  return (
    <div class="endereco-cheio" role="dialog" aria-label={t("Endereço em chinês")} onClick={aoFechar}>
      <div class="ec-cn" lang="zh-CN">{e.enderecoCn}</div>
      {ondeEvento(e) && <div class="ec-local">{ondeEvento(e)}</div>}
      <div class="ec-dica">请带我去这个地址 · {t("Toque para fechar")}</div>
    </div>
  );
}

/* ---------- details + actions ---------- */
function Detalhe({ e, aoEditar, aoFechar, aoDuplicar }: {
  e: Evento; aoEditar: () => void; aoFechar: () => void; aoDuplicar: (c: Evento) => void;
}) {
  const [cheio, setCheio] = useState(false);
  const tp = TIPOS[e.tipo] ?? TIPOS.outro;
  const outro = outroRelogio(e);
  const hora = e.horaInicio ? e.horaInicio + (e.horaFim ? `–${e.horaFim}` : "") : t("Dia todo");
  async function excluir() {
    const titulo = e.titulo || t("evento");
    if (!confirm(ehDoGrupo(e)
      ? t("Excluir \"{titulo}\" do roteiro do GRUPO?\n\nEle some do celular de todos quando você compartilhar o roteiro atualizado.", { titulo })
      : t("Excluir \"{titulo}\"?", { titulo }))) return;
    await excluirEvento(e.id); aoFechar();
  }
  return (
    <Folha titulo={`${tp.emo} ${tp.rot}`} aoFechar={aoFechar} rodape={<>
      <button class="btn" onClick={excluir}>{t("Excluir")}</button>
      <button class="btn" onClick={() => aoDuplicar(copiaDeEvento(e))}>{t("Duplicar")}</button>
      <button class="btn primario" onClick={aoEditar}>{t("Editar")}</button>
    </>}>
      <h3 class="det-tit">{e.titulo || t("(sem título)")}</h3>
      <p class="det-quando">{dataLonga(e.data)} · <b>{hora}</b>
        {e.horaInicio && <span class="muted"> ({rotuloFuso(e.fuso)})</span>}</p>
      {outro && <p class="det-outro">{outro.rot}: {outro.texto}</p>}
      <p class={`det-camada ${ehDoGrupo(e) ? "grupo" : "pessoal"}`}>{ehDoGrupo(e)
        ? <>👥 <b>{t("Evento do grupo")}</b> · {e.autor && e.autor !== "planejador" ? t("criado por {nome}", { nome: e.autor }) : e.ref?.startsWith("planner:") ? t("do planejador") : t("criado no app")}
            {e.editadoEm && <span class="muted"> · {t("versão de {quando}", { quando: quandoRoteiro(e.editadoEm) })}</span>}</>
        : <>👤 <b>{t("Evento pessoal")}</b> · {t("só neste celular, não vai para o grupo")}</>}</p>
      {ondeEvento(e) && <p>📍 {ondeEvento(e)}</p>}
      {(e.empresa || e.status) && <p class="muted pequeno">{[e.empresa && `🏢 ${e.empresa}`, e.status && t("Status: {s}", { s: e.status })].filter(Boolean).join(" · ")}</p>}
      {e.enderecoCn && (
        <button class="endereco-cn" lang="zh-CN" onClick={() => setCheio(true)}>
          <span class="muted pequeno">{t("Endereço em chinês — toque para mostrar ao taxista")}</span>
          <span class="cn">{e.enderecoCn}</span>
        </button>
      )}
      {e.obs && <p class="det-obs">{e.obs}</p>}
      {cheio && <EnderecoCheio e={e} aoFechar={() => setCheio(false)} />}
    </Folha>
  );
}

/* ---------- create / edit ---------- */
function Editor({ inicial, novo, aoFechar }: { inicial: Evento; novo: boolean; aoFechar: () => void }) {
  const [e, setE] = useState(inicial);
  const set = <K extends keyof Evento>(k: K, v: Evento[K]) => setE((x) => ({ ...x, [k]: v }));
  const val = (ev: Event) => (ev.target as HTMLInputElement).value;
  const ok = !!e.data && (!!e.titulo.trim());
  async function salvar() {
    if (!ok) return;
    await salvarEvento({ ...e, titulo: e.titulo.trim(), horaFim: e.horaInicio ? e.horaFim : "" });
    aoFechar();
  }
  return (
    <Folha titulo={novo ? t("Novo evento") : t("Editar evento")}
      aoFechar={aoFechar} rodape={<>
        <button class="btn" onClick={aoFechar}>{t("Cancelar")}</button>
        <button class="btn primario" disabled={!ok} onClick={salvar}>{t("Salvar")}</button>
      </>}>
      <div class="campo"><label>{t("Para quem?")}</label>
        <div class="seg seg-camada" role="radiogroup">
          <button type="button" role="radio" aria-checked={e.camada === "pessoal"} class={e.camada === "pessoal" ? "on" : ""} onClick={() => set("camada", "pessoal")}>👤 {t("Só eu")}</button>
          <button type="button" role="radio" aria-checked={e.camada === "coletivo"} class={e.camada === "coletivo" ? "on" : ""} onClick={() => set("camada", "coletivo")}>👥 {t("Grupo")}</button>
        </div>
        <span class="muted pequeno">{e.camada === "coletivo"
          ? (inicial.camada === "coletivo" ? t("Evento do grupo: a mudança vai para todos quando você compartilhar o roteiro.") : t("Vai para o roteiro do grupo quando você compartilhar o roteiro."))
          : (inicial.camada === "coletivo" ? t("Deixa de ser do grupo: some do celular dos outros quando você compartilhar o roteiro.") : t("Fica só neste celular."))}</span>
      </div>
      <div class="campo"><label for="e-tit">{t("Título")}</label>
        <input id="e-tit" value={e.titulo} onInput={(x) => set("titulo", val(x))} placeholder={t("Ex.: Visita à Chainway")} /></div>
      <div class="campo"><label>{t("Tipo")}</label>
        <div class="chips">
          {(Object.keys(TIPOS) as TipoEvento[]).map((k) => (
            <button type="button" class={`chip ${e.tipo === k ? "on" : ""}`} aria-pressed={e.tipo === k} onClick={() => set("tipo", k)}>
              {TIPOS[k].emo} {TIPOS[k].rot}
            </button>))}
        </div></div>
      <div class="campo"><label for="e-data">{t("Data")}</label>
        <input id="e-data" type="date" value={e.data} onInput={(x) => set("data", val(x))} /></div>
      <div class="linha2">
        <div class="campo"><label for="e-ini">{t("Início")}</label>
          <input id="e-ini" type="time" value={e.horaInicio} onInput={(x) => set("horaInicio", val(x))} /></div>
        <div class="campo"><label for="e-fim">{t("Fim (opcional)")}</label>
          <input id="e-fim" type="time" value={e.horaFim} disabled={!e.horaInicio} onInput={(x) => set("horaFim", val(x))} /></div>
      </div>
      {!e.horaInicio && <p class="muted pequeno" style="margin:-6px 0 12px">{t("Sem horário, o evento aparece como \"dia todo\".")}</p>}
      <div class="campo"><label for="e-fuso">{t("Fuso do horário")}</label>
        <select id="e-fuso" value={e.fuso} onChange={(x) => set("fuso", val(x))}>
          {FUSOS.map((f) => <option value={f.id}>{f.rot}</option>)}
          {!FUSOS.some((f) => f.id === e.fuso) && <option value={e.fuso}>{e.fuso}</option>}
        </select>
        <span class="muted pequeno">{t("O horário aparece sempre como você digitou. O fuso só serve para \"Agora\", \"A seguir\" e para mostrar o horário do outro país. Mude só em dias de voo.")}</span>
      </div>
      <div class="campo"><label for="e-local">{t("Local / endereço")}</label>
        <input id="e-local" value={e.local} onInput={(x) => set("local", val(x))} placeholder="Ex.: NECC, Hall 5.1" /></div>
      <div class="campo"><label for="e-cn">{t("Endereço em chinês (para o taxista)")}</label>
        <textarea id="e-cn" lang="zh-CN" rows={2} value={e.enderecoCn} onInput={(x) => set("enderecoCn", val(x))} placeholder="上海市青浦区崧泽大道333号" /></div>
      <div class="campo"><label for="e-obs">{t("Observações")}</label>
        <textarea id="e-obs" rows={3} value={e.obs} onInput={(x) => set("obs", val(x))} /></div>
    </Folha>
  );
}

/* ---------- one hook per screen: open details / editor ---------- */
type Aberto = { modo: "ver" | "editar"; e: Evento; novo?: boolean } | null;
export function useEventosFolha(cidadeDoDia: (data: string) => string) {
  const [aberto, setAberto] = useState<Aberto>(null);
  const fechar = () => setAberto(null);
  return {
    abrir: (e: Evento) => setAberto({ modo: "ver", e }),
    novo: (data: string, hora = "") => setAberto({ modo: "editar",
      novo: true, e: { ...novoEvento(data, cidadeNoBrasil(cidadeDoDia(data)) ? FUSO_BRASIL : FUSO_CHINA), horaInicio: hora } }),
    elemento: aberto?.modo === "ver"
      ? <Detalhe e={aberto.e} aoFechar={fechar} aoEditar={() => setAberto({ modo: "editar", e: aberto.e })}
          aoDuplicar={(c) => setAberto({ modo: "editar", e: c, novo: true })} />
      : aberto?.modo === "editar" ? <Editor inicial={aberto.e} novo={!!aberto.novo} aoFechar={fechar} /> : null,
  };
}
