import { useEffect, useState } from "preact/hooks";
import type { Meta } from "../db/tipos";
import { useVersaoDados } from "../db/mudancas";
import { previa, importar, versaoAtual, type Previa } from "../lib/importarPlanner";
import { lerRoteiro, quandoRoteiro, temRoteiro, ehIOS, instalado, diagnostico, type RoteiroRecebido } from "../lib/roteiro";
import { Folha } from "./Folha";

export function useRoteiroAtual() {
  const versao = useVersaoDados();
  const [r, setR] = useState<Meta["roteiro"] | null | undefined>(undefined);
  useEffect(() => { versaoAtual().then(setR); }, [versao]);
  return r;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/* Opens a link or a pasted message, shows what changes and asks before
   replacing the itinerary. */
export function ReceberRoteiro({ texto, aoFechar }: { texto: string; aoFechar: () => void }) {
  const atual = useRoteiroAtual();
  const [r, setR] = useState<RoteiroRecebido | null>(null);
  const [p, setP] = useState<Previa | null>(null);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState<Previa | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    lerRoteiro(texto).then(async (x) => { setR(x); setP(await previa(x.backup, "roteiro")); }).catch((e) => setErro((e as Error).message));
  }, [texto]);

  async function atualizar() {
    if (!r) return;
    setFeito(await importar(r.backup, "roteiro", true, r.versao));
  }
  async function copiar() {
    try { await navigator.clipboard.writeText(texto); setCopiado(true); } catch { prompt("Copie o link abaixo:", texto); }
  }

  // iPhone opened the link in Safari, not in the app on the Home Screen
  const safariDoIphone = ehIOS() && !instalado();
  const mesma = !!(r && atual && atual.em === r.versao.em);
  const antiga = !!(r && atual && r.versao.em < atual.em);

  if (feito) return (
    <Folha titulo="Roteiro atualizado" aoFechar={aoFechar} rodape={<button class="btn primario" onClick={aoFechar}>OK</button>}>
      <p style="color:var(--ok);font-weight:600">✓ Roteiro de {quandoRoteiro(r!.versao.em)} no app.</p>
      <p class="pequeno">{plural(feito.novos, "evento novo", "eventos novos")}, {plural(feito.atualizados, "atualizado", "atualizados")}
        {feito.removidos > 0 && `, ${plural(feito.removidos, "removido", "removidos")}`}.</p>
      <p class="muted pequeno">Os eventos que você criou no app não foram alterados.</p>
    </Folha>);

  return (
    <Folha titulo="Roteiro da viagem" aoFechar={aoFechar} rodape={r && <>
      <button class="btn" onClick={aoFechar}>Cancelar</button>
      <button class="btn primario" disabled={!p} onClick={atualizar}>{antiga ? "Usar mesmo assim" : "Atualizar roteiro"}</button>
    </>}>
      {erro && <><p style="color:var(--aviso)">{erro}</p>
        <p class="muted pequeno" style="word-break:break-all">Detalhes (para o print): {diagnostico(texto)}</p>
        <p class="pequeno">Tente também: copie a mensagem inteira e toque em <b>📋 Colar roteiro</b>.</p></>}
      {!erro && !r && <p class="muted"><span class="giro giro-peq" /> Abrindo o roteiro…</p>}
      {r && (<>
        <p>Roteiro de <b>{quandoRoteiro(r.versao.em)}</b>{r.versao.plano && <span class="muted"> · {r.versao.plano}</span>}</p>
        {mesma && <div class="faixa-aviso faixa-ok">✓ Você já tem esta versão.</div>}
        {antiga && <div class="faixa-aviso">⚠️ Este roteiro é <b>mais antigo</b> que o que já está no app ({quandoRoteiro(atual!.em)}). Procure a mensagem mais recente.</div>}
        {p && <p class="pequeno">Vai criar <b>{p.novos}</b>, atualizar <b>{p.atualizados}</b>
          {p.removidos > 0 && <> e remover <b>{p.removidos}</b> (saíram do planejamento)</>}.</p>}
        <p class="muted pequeno">Os eventos que você criou no app não são alterados.</p>
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

/* one line on Hoje: which version of the itinerary this phone has */
export function LinhaRoteiro() {
  const atual = useRoteiroAtual();
  const { colar, elemento } = useColarRoteiro();
  if (atual === undefined) return null;
  return (
    <div class="linha-roteiro">
      <span>📌 {atual ? <>Roteiro de <b>{quandoRoteiro(atual.em)}</b></> : "Roteiro ainda não recebido"}</span>
      <button class="btn btn-peq" onClick={colar}>📋 Colar roteiro</button>
      {elemento}
    </div>
  );
}
