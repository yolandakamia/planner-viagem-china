import { useEffect, useRef, useState } from "preact/hooks";
import { lerBackup, previa, importar, type BackupPlanner, type Previa } from "../lib/importarPlanner";
import { quandoRoteiro } from "../lib/roteiro";
import { useRoteiroAtual, useColarRoteiro } from "./Roteiro";

/* Card in Ajustes: the itinerary on this phone, "Colar roteiro", and the
   planner's "Backup .json" as a file (choose the option, see, confirm). */
export function ImportarPlanner() {
  const atual = useRoteiroAtual();
  const { colar, elemento } = useColarRoteiro();
  const [quandoArq, setQuandoArq] = useState("");
  const arq = useRef<HTMLInputElement>(null);
  const [b, setB] = useState<BackupPlanner | null>(null);
  const [op, setOp] = useState("");
  const [p, setP] = useState<Previa | null>(null);
  const [comCidades, setComCidades] = useState(true);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => { if (b && op) previa(b, op).then(setP); }, [b, op]);

  async function escolher(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0];
    (ev.target as HTMLInputElement).value = "";
    if (!f) return;
    setErro(""); setMsg(""); setP(null);
    try {
      const nb = lerBackup(await f.text());
      setQuandoArq(new Date(f.lastModified || Date.now()).toISOString());
      setB(nb);
      setOp(nb.cenarios.find((c) => c.id === nb.cenPrincipal)?.id ?? nb.cenarios[0].id);
    } catch (e) { setB(null); setErro((e as Error).message); }
  }
  async function confirmar() {
    if (!b) return;
    const r = await importar(b, op, comCidades, { em: quandoArq, plano: b.cenarios.find((c) => c.id === op)?.nome ?? "" });
    setB(null); setP(null);
    setMsg(`✓ ${r.novos} eventos novos, ${r.atualizados} atualizados` + (r.removidos ? `, ${r.removidos} removidos` : "") + (comCidades ? `, ${r.cidades} cidades` : "") + ".");
  }

  return (
    <div class="cartao">
      <h2>Roteiro da viagem</h2>
      <p class="pequeno" style="margin:-4px 0 8px">
        {atual === undefined ? "…" : atual ? <>📌 Neste celular: roteiro de <b>{quandoRoteiro(atual.em)}</b>{atual.plano && <span class="muted"> · {atual.plano}</span>}</> : <b>Nenhum roteiro recebido ainda.</b>}
      </p>
      <p class="muted pequeno" style="margin:0 0 10px">
        O roteiro chega por mensagem (WhatsApp ou WeChat). Toque no link, ou copie a mensagem e use <b>Colar roteiro</b>.
        Cada versão nova substitui a anterior e não mexe nos eventos que você criou no app.
      </p>
      <button class="btn primario" style="width:100%" onClick={colar}>📋 Colar roteiro</button>
      {elemento}
      <input ref={arq} type="file" accept=".json,application/json" hidden onChange={escolher} />
      {!b && <button class="btn" style="width:100%;margin-top:8px" onClick={() => arq.current?.click()}>Importar o Backup .json do planejador…</button>}
      {erro && <p class="pequeno" style="color:var(--aviso)">{erro}</p>}
      {msg && <p class="pequeno" style="color:var(--ok);font-weight:600">{msg}</p>}
      {b && (<>
        {b.cenarios.length > 1 && (
          <div class="campo"><label for="i-op">Opção do planejador</label>
            <select id="i-op" value={op} onChange={(e) => setOp((e.target as HTMLSelectElement).value)}>
              {b.cenarios.map((c) => <option value={c.id}>{c.nome}{c.id === b.cenPrincipal ? " (principal)" : ""}</option>)}
            </select></div>)}
        {p && <p class="pequeno">Vai criar <b>{p.novos}</b> {p.novos === 1 ? "evento" : "eventos"}, atualizar <b>{p.atualizados}</b>{p.removidos > 0 && <> e remover <b>{p.removidos}</b></>}.
          {p.ignorados > 0 && <><br />{p.ignorados === 1 ? "1 evento cancelado ou sem data fica de fora." : `${p.ignorados} eventos cancelados ou sem data ficam de fora.`}</>}</p>}
        <label class="check"><input type="checkbox" checked={comCidades} onChange={(e) => setComCidades((e.target as HTMLInputElement).checked)} />
          Usar também as cidades de cada dia do planejador{p ? ` (${p.cidades})` : ""}</label>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn" onClick={() => { setB(null); setP(null); }}>Cancelar</button>
          <button class="btn primario" disabled={!p} onClick={confirmar}>Importar</button>
        </div>
      </>)}
    </div>
  );
}
