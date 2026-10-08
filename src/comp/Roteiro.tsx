import { useEffect, useState } from "preact/hooks";
import type { Meta, Evento } from "../db/tipos";
import { abrirBanco } from "../db/banco";
import { useVersaoDados } from "../db/mudancas";
import { versaoAtual } from "../lib/importarPlanner";
import { previa, receber, roteiroParaEnviar, limparPendente, type Plano, type RoteiroRecebido } from "../lib/grupo";
import { lerRoteiro, quandoRoteiro, temRoteiro, ehIOS, instalado, diagnostico, montarMensagem } from "../lib/roteiro";
import { dataCurta } from "../lib/datas";
import { Folha } from "./Folha";
import { t, tn } from "../lib/i18n";

export function useRoteiroAtual() {
  const versao = useVersaoDados();
  const [r, setR] = useState<Meta["roteiro"] | null | undefined>(undefined);
  useEffect(() => { versaoAtual().then(setR); }, [versao]);
  return r;
}
/* changes to the group itinerary made here and not sent yet */
export function usePendente() {
  const versao = useVersaoDados();
  const [p, setP] = useState<Meta["pendente"]>(null);
  useEffect(() => { abrirBanco().then((db) => db.get("meta", "meta")).then((m) => setP(m?.pendente ?? null)); }, [versao]);
  return p;
}

const linhaEv = (e: Evento) => `${e.titulo} · ${dataCurta(e.data)}${e.horaInicio ? " " + e.horaInicio : ""}`;

/* what will change, event by event */
function ListaMudancas({ p }: { p: Plano }) {
  const novos = p.gravar.filter((e) => e.criadoEm === e.atualizadoEm), mudados = p.gravar.filter((e) => e.criadoEm !== e.atualizadoEm);
  const l: [string, string, Evento][] = [...novos.map((e) => ["+", "novo", e] as [string, string, Evento]),
    ...mudados.map((e) => ["✎", "atualizado", e] as [string, string, Evento]), ...p.apagar.map((e) => ["−", "excluído", e] as [string, string, Evento])];
  if (!l.length) return null;
  return (
    <ul class="mudancas">
      {l.slice(0, 12).map(([s, rot, e]) => <li class={`mud-${rot}`}><b>{s}</b> {linhaEv(e)}</li>)}
      {l.length > 12 && <li class="muted">{t("… e mais {n}", { n: l.length - 12 })}</li>}
    </ul>);
}

/* Opens a link or a pasted message, shows what changes and asks before merging. */
export function ReceberRoteiro({ texto = "", recebido, aoFechar }: { texto?: string; recebido?: RoteiroRecebido; aoFechar: () => void }) {
  const [r, setR] = useState<RoteiroRecebido | null>(null);
  const [p, setP] = useState<Plano | null>(null);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState<Plano | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    (recebido ? Promise.resolve(recebido) : lerRoteiro(texto))
      .then(async (x) => { setR(x); setP(await previa(x)); }).catch((e) => setErro((e as Error).message));
  }, [texto, recebido]);

  async function atualizar() { if (r) setFeito(await receber(r)); }
  async function copiar() {
    try { await navigator.clipboard.writeText(texto); setCopiado(true); } catch { prompt(t("Copie o link abaixo:"), texto); }
  }

  // iPhone opened the link in Safari, not in the app on the Home Screen
  const safariDoIphone = ehIOS() && !instalado();
  const nada = !!p && p.gravar.length + p.apagar.length + p.cidades.length === 0;
  const de = r && (r.de === "planejador" ? t("do planejador") : t("enviado por {nome}", { nome: r.de }));

  if (feito) return (
    <Folha titulo={t("Roteiro atualizado")} aoFechar={aoFechar} rodape={<button class="btn primario" onClick={aoFechar}>OK</button>}>
      <p style="color:var(--ok);font-weight:600">{t("✓ Roteiro do grupo atualizado.")}</p>
      <p class="pequeno">{tn(feito.novos, "{n} evento novo", "{n} eventos novos")}, {tn(feito.atualizados, "{n} atualizado", "{n} atualizados")}
        {feito.removidos > 0 && `, ${tn(feito.removidos, "{n} excluído", "{n} excluídos")}`}.</p>
      <p class="muted pequeno">{t("Seus eventos pessoais (👤) não foram alterados.")}</p>
    </Folha>);

  return (
    <Folha titulo={t("Roteiro do grupo")} aoFechar={aoFechar} rodape={r && <>
      <button class="btn" onClick={aoFechar}>{nada ? t("Fechar") : t("Cancelar")}</button>
      {!nada && <button class="btn primario" disabled={!p} onClick={atualizar}>{t("Atualizar roteiro")}</button>}
    </>}>
      {erro && <><p style="color:var(--aviso)">{erro}</p>
        <p class="muted pequeno" style="word-break:break-all">{t("Detalhes (para o print):")} {diagnostico(texto)}</p>
        <p class="pequeno">{t("Tente também: copie a mensagem inteira e toque em 📋 Colar roteiro.")}</p></>}
      {!erro && !r && <p class="muted"><span class="giro giro-peq" /> {t("Abrindo o roteiro…")}</p>}
      {r && (<>
        <p>{t("Roteiro de")} <b>{quandoRoteiro(r.em)}</b> <span class="muted">· {de}</span></p>
        {nada && <div class="faixa-aviso faixa-ok">{t("✓ Nada novo: você já tem tudo o que está neste roteiro.")}</div>}
        {p && !nada && <p class="pequeno">{p.removidos > 0
          ? t("Vai criar {a}, atualizar {b} e excluir {c}", { a: p.novos, b: p.atualizados, c: p.removidos })
          : t("Vai criar {a}, atualizar {b}", { a: p.novos, b: p.atualizados })}{p.cidades.length > 0 && <> · {tn(p.cidades.length, "{n} cidade", "{n} cidades")}</>}.</p>}
        {p && <ListaMudancas p={p} />}
        {p && p.maisAntigos > 0 && <p class="muted pequeno">{tn(p.maisAntigos, "{n} evento ficou de fora: você tem uma versão mais nova.", "{n} eventos ficaram de fora: você tem uma versão mais nova.")}</p>}
        <p class="muted pequeno">{t("Só os eventos do grupo (👥) mudam. Seus eventos pessoais (👤) não são alterados.")}</p>
        {safariDoIphone && (
          <div class="faixa-aviso">
            📱 <b>{t("Usa o app pela Tela de Início?")}</b> {t("O iPhone abriu este link no Safari, que guarda os dados separado do app. Toque em Copiar roteiro, abra o app e toque em 📋 Colar roteiro (na página Hoje).")}
            <button class="btn btn-peq" style="display:block;margin-top:8px" onClick={copiar}>{copiado ? t("✓ Copiado") : t("Copiar roteiro")}</button>
          </div>)}
      </>)}
    </Folha>
  );
}

/* "📋 Colar roteiro": reads the clipboard; when the browser does not allow
   it (or there is no itinerary there), a box to paste into. */
export function useColarRoteiro() {
  const [texto, setTexto] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [rascunho, setRascunho] = useState("");

  async function colar() {
    try {
      const c = await navigator.clipboard.readText();
      if (temRoteiro(c)) { setTexto(c); return; }
    } catch { /* not allowed: fall back to the box */ }
    setRascunho(""); setManual(true);
  }
  const elemento = <>
    {manual && (
      <Folha titulo={t("Colar roteiro")} aoFechar={() => setManual(false)} rodape={<>
        <button class="btn" onClick={() => setManual(false)}>{t("Cancelar")}</button>
        <button class="btn primario" disabled={!temRoteiro(rascunho)} onClick={() => { setManual(false); setTexto(rascunho); }}>{t("Abrir")}</button>
      </>}>
        <p class="pequeno">{t("No WhatsApp ou no WeChat, toque e segure a mensagem do roteiro, escolha Copiar e cole aqui.")}</p>
        <textarea class="caixa-colar" rows={5} placeholder={t("Cole a mensagem aqui")} value={rascunho}
          onInput={(e) => setRascunho((e.target as HTMLTextAreaElement).value)} />
        {rascunho && !temRoteiro(rascunho) && <p class="pequeno" style="color:var(--aviso)">{t("Não achei o link do roteiro nesse texto.")}</p>}
      </Folha>)}
    {texto && <ReceberRoteiro key={texto} texto={texto} aoFechar={() => setTexto(null)} />}
  </>;
  return { colar, elemento };
}

/* "📤 Compartilhar roteiro": the group events of this phone, as the same
   message the planner makes. Personal events never go. */
export function useCompartilharRoteiro() {
  const [aberto, setAberto] = useState(false);
  const [msg, setMsg] = useState("");
  const [n, setN] = useState(0);
  const [status, setStatus] = useState("");

  async function abrir() {
    const r = await roteiroParaEnviar();
    setMsg(montarMensagem(r)); setN(r.eventos.length); setStatus(""); setAberto(true);
  }
  const enviado = async (m: string) => { await limparPendente(); setStatus(m); };
  async function compartilhar() {
    try { await navigator.share({ text: msg }); await enviado(t("✓ Enviado. Quem receber toca no link para atualizar.")); }
    catch (e) { if ((e as Error).name !== "AbortError") setStatus(t("Não consegui abrir o compartilhamento. Use Copiar.")); }
  }
  async function copiar() {
    try { await navigator.clipboard.writeText(msg); await enviado(t("✓ Mensagem copiada. Cole no WeChat ou onde quiser enviar.")); }
    catch { setStatus(t("Não consegui copiar.")); }
  }
  const podeCompartilhar = typeof navigator.share === "function";

  const elemento = aberto && (
    <Folha titulo={t("Compartilhar roteiro do grupo")} aoFechar={() => setAberto(false)} rodape={<button class="btn" onClick={() => setAberto(false)}>{t("Fechar")}</button>}>
      <p class="pequeno">{tn(n, "Vai {n} evento do grupo (👥) e as exclusões.", "Vão {n} eventos do grupo (👥) e as exclusões.")} <b>{t("Seus eventos pessoais (👤) não vão.")}</b></p>
      <div class="botoes-envio">
        {podeCompartilhar && <button class="btn primario" onClick={compartilhar}>{t("📤 Compartilhar…")} <span class="pequeno">(WhatsApp, WeChat…)</span></button>}
        <a class={`btn ${podeCompartilhar ? "" : "primario"}`} href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener"
          onClick={() => enviado(t("✓ WhatsApp aberto: escolha o grupo e envie."))}>🟢 WhatsApp</a>
        <button class="btn" onClick={copiar}>{t("📋 Copiar mensagem")} <span class="pequeno">(WeChat)</span></button>
      </div>
      {status && <p class="pequeno" style="color:var(--ok);font-weight:600">{status}</p>}
      <p class="muted pequeno">{t("Quem receber toca no link (ou cola a mensagem no app) e o roteiro do grupo se junta ao que a pessoa já tem, evento por evento.")}
        {" "}{t("O planejador do computador também recebe:")} <b>{t("📤 Share itinerary → colar a mensagem")}</b>.</p>
    </Folha>);
  return { abrir, elemento };
}

/* the alert: this phone changed the group itinerary and did not send it yet */
export function AvisoEnviar() {
  const p = usePendente();
  const { abrir, elemento } = useCompartilharRoteiro();
  return (<>
    {p && p.n > 0 && (
      <div class="aviso-enviar" role="alert">
        <span>{p.n > 1 ? t("📤 Você mudou o roteiro do grupo ({n} mudanças). Mande a versão atualizada para todos.", { n: p.n }) : t("📤 Você mudou o roteiro do grupo. Mande a versão atualizada para todos.")}</span>
        <button class="btn btn-peq primario" onClick={abrir}>{t("Enviar")}</button>
      </div>)}
    {elemento}
  </>);
}

/* one line on Hoje: when the last itinerary arrived, paste one, send one */
export function LinhaRoteiro() {
  const atual = useRoteiroAtual();
  const { colar, elemento } = useColarRoteiro();
  const env = useCompartilharRoteiro();
  if (atual === undefined) return null;
  return (
    <div class="linha-roteiro">
      <span>📌 {atual ? <>{t("Roteiro de")} <b>{quandoRoteiro(atual.em)}</b></> : t("Roteiro ainda não recebido")}</span>
      <div class="lr-botoes">
        <button class="btn btn-peq" onClick={colar}>{t("📋 Colar")}</button>
        <button class="btn btn-peq" onClick={env.abrir}>{t("📤 Enviar")}</button>
      </div>
      {elemento}{env.elemento}
    </div>
  );
}
