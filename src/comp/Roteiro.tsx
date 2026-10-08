import { useEffect, useState } from "preact/hooks";
import type { Meta, Evento } from "../db/tipos";
import { abrirBanco } from "../db/banco";
import { useVersaoDados } from "../db/mudancas";
import { versaoAtual } from "../lib/importarPlanner";
import { previa, receber, roteiroParaEnviar, limparPendente, type Plano, type RoteiroRecebido } from "../lib/grupo";
import { lerRoteiro, quandoRoteiro, temRoteiro, ehIOS, instalado, diagnostico, montarMensagem } from "../lib/roteiro";
import { dataCurta } from "../lib/datas";
import { Folha } from "./Folha";

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

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
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
      {l.length > 12 && <li class="muted">… e mais {l.length - 12}</li>}
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
    try { await navigator.clipboard.writeText(texto); setCopiado(true); } catch { prompt("Copie o link abaixo:", texto); }
  }

  // iPhone opened the link in Safari, not in the app on the Home Screen
  const safariDoIphone = ehIOS() && !instalado();
  const nada = !!p && p.gravar.length + p.apagar.length + p.cidades.length === 0;
  const de = r && (r.de === "planejador" ? "do planejador" : `enviado por ${r.de}`);

  if (feito) return (
    <Folha titulo="Roteiro atualizado" aoFechar={aoFechar} rodape={<button class="btn primario" onClick={aoFechar}>OK</button>}>
      <p style="color:var(--ok);font-weight:600">✓ Roteiro do grupo atualizado.</p>
      <p class="pequeno">{plural(feito.novos, "evento novo", "eventos novos")}, {plural(feito.atualizados, "atualizado", "atualizados")}
        {feito.removidos > 0 && `, ${plural(feito.removidos, "excluído", "excluídos")}`}.</p>
      <p class="muted pequeno">Seus eventos pessoais (👤) não foram alterados.</p>
    </Folha>);

  return (
    <Folha titulo="Roteiro do grupo" aoFechar={aoFechar} rodape={r && <>
      <button class="btn" onClick={aoFechar}>{nada ? "Fechar" : "Cancelar"}</button>
      {!nada && <button class="btn primario" disabled={!p} onClick={atualizar}>Atualizar roteiro</button>}
    </>}>
      {erro && <><p style="color:var(--aviso)">{erro}</p>
        <p class="muted pequeno" style="word-break:break-all">Detalhes (para o print): {diagnostico(texto)}</p>
        <p class="pequeno">Tente também: copie a mensagem inteira e toque em <b>📋 Colar roteiro</b>.</p></>}
      {!erro && !r && <p class="muted"><span class="giro giro-peq" /> Abrindo o roteiro…</p>}
      {r && (<>
        <p>Roteiro de <b>{quandoRoteiro(r.em)}</b> <span class="muted">· {de}</span></p>
        {nada && <div class="faixa-aviso faixa-ok">✓ Nada novo: você já tem tudo o que está neste roteiro.</div>}
        {p && !nada && <p class="pequeno">Vai criar <b>{p.novos}</b>, atualizar <b>{p.atualizados}</b>
          {p.removidos > 0 && <> e excluir <b>{p.removidos}</b></>}{p.cidades.length > 0 && <> · {plural(p.cidades.length, "cidade", "cidades")}</>}.</p>}
        {p && <ListaMudancas p={p} />}
        {p && p.maisAntigos > 0 && <p class="muted pequeno">{plural(p.maisAntigos, "evento ficou", "eventos ficaram")} de fora: você tem uma versão mais nova.</p>}
        <p class="muted pequeno">Só os eventos do grupo (👥) mudam. Seus eventos pessoais (👤) não são alterados.</p>
        {safariDoIphone && (
          <div class="faixa-aviso">
            📱 <b>Usa o app pela Tela de Início?</b> O iPhone abriu este link no Safari, que guarda os dados separado do app.
            Toque em <b>Copiar roteiro</b>, abra o app e toque em <b>📋 Colar roteiro</b> (na página Hoje).
            <button class="btn btn-peq" style="display:block;margin-top:8px" onClick={copiar}>{copiado ? "✓ Copiado" : "Copiar roteiro"}</button>
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
      const t = await navigator.clipboard.readText();
      if (temRoteiro(t)) { setTexto(t); return; }
    } catch { /* not allowed: fall back to the box */ }
    setRascunho(""); setManual(true);
  }
  const elemento = <>
    {manual && (
      <Folha titulo="Colar roteiro" aoFechar={() => setManual(false)} rodape={<>
        <button class="btn" onClick={() => setManual(false)}>Cancelar</button>
        <button class="btn primario" disabled={!temRoteiro(rascunho)} onClick={() => { setManual(false); setTexto(rascunho); }}>Abrir</button>
      </>}>
        <p class="pequeno">No WhatsApp ou no WeChat, toque e segure a mensagem do roteiro, escolha <b>Copiar</b> e cole aqui.</p>
        <textarea class="caixa-colar" rows={5} placeholder="Cole a mensagem aqui" value={rascunho}
          onInput={(e) => setRascunho((e.target as HTMLTextAreaElement).value)} />
        {rascunho && !temRoteiro(rascunho) && <p class="pequeno" style="color:var(--aviso)">Não achei o link do roteiro nesse texto.</p>}
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
  const enviado = async (t: string) => { await limparPendente(); setStatus(t); };
  async function compartilhar() {
    try { await navigator.share({ text: msg }); await enviado("✓ Enviado. Quem receber toca no link para atualizar."); }
    catch (e) { if ((e as Error).name !== "AbortError") setStatus("Não consegui abrir o compartilhamento. Use Copiar."); }
  }
  async function copiar() {
    try { await navigator.clipboard.writeText(msg); await enviado("✓ Mensagem copiada. Cole no WeChat ou onde quiser enviar."); }
    catch { setStatus("Não consegui copiar."); }
  }
  const podeCompartilhar = typeof navigator.share === "function";

  const elemento = aberto && (
    <Folha titulo="Compartilhar roteiro do grupo" aoFechar={() => setAberto(false)} rodape={<button class="btn" onClick={() => setAberto(false)}>Fechar</button>}>
      <p class="pequeno">Vão <b>{plural(n, "evento do grupo", "eventos do grupo")}</b> (👥) e as exclusões. <b>Seus eventos pessoais (👤) não vão.</b></p>
      <div class="botoes-envio">
        {podeCompartilhar && <button class="btn primario" onClick={compartilhar}>📤 Compartilhar… <span class="pequeno">(WhatsApp, WeChat…)</span></button>}
        <a class={`btn ${podeCompartilhar ? "" : "primario"}`} href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener"
          onClick={() => enviado("✓ WhatsApp aberto: escolha o grupo e envie.")}>🟢 WhatsApp</a>
        <button class="btn" onClick={copiar}>📋 Copiar mensagem <span class="pequeno">(WeChat)</span></button>
      </div>
      {status && <p class="pequeno" style="color:var(--ok);font-weight:600">{status}</p>}
      <p class="muted pequeno">Quem receber toca no link (ou cola a mensagem no app) e o roteiro do grupo se junta ao que a pessoa já tem, evento por evento.
        O planejador do computador também recebe: <b>📤 Share itinerary → colar a mensagem</b>.</p>
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
        <span>📤 Você mudou o <b>roteiro do grupo</b>{p.n > 1 ? ` (${p.n} mudanças)` : ""}. Mande a versão atualizada para todos.</span>
        <button class="btn btn-peq primario" onClick={abrir}>Enviar</button>
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
      <span>📌 {atual ? <>Roteiro de <b>{quandoRoteiro(atual.em)}</b></> : "Roteiro ainda não recebido"}</span>
      <div class="lr-botoes">
        <button class="btn btn-peq" onClick={colar}>📋 Colar</button>
        <button class="btn btn-peq" onClick={env.abrir}>📤 Enviar</button>
      </div>
      {elemento}{env.elemento}
    </div>
  );
}
