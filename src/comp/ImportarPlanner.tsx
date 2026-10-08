import { useRef, useState } from "preact/hooks";
import { lerBackup, deBackup } from "../lib/importarPlanner";
import type { RoteiroRecebido } from "../lib/grupo";
import { quandoRoteiro } from "../lib/roteiro";
import { useRoteiroAtual, useColarRoteiro, useCompartilharRoteiro, ReceberRoteiro } from "./Roteiro";

/* Card in Ajustes: the group itinerary on this phone — paste one, send one,
   or read the planner's "Backup .json" as a file. */
export function ImportarPlanner() {
  const atual = useRoteiroAtual();
  const { colar, elemento } = useColarRoteiro();
  const env = useCompartilharRoteiro();
  const arq = useRef<HTMLInputElement>(null);
  const [r, setR] = useState<RoteiroRecebido | null>(null);
  const [erro, setErro] = useState("");

  async function escolher(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0];
    (ev.target as HTMLInputElement).value = "";
    if (!f) return;
    setErro("");
    try {
      const b = lerBackup(await f.text());
      setR(deBackup(b, b.cenPrincipal ?? b.cenarios[0].id, new Date(f.lastModified || Date.now()).toISOString()));
    } catch (e) { setErro((e as Error).message); }
  }

  return (
    <div class="cartao">
      <h2>Roteiro do grupo</h2>
      <p class="pequeno" style="margin:-4px 0 8px">
        {atual === undefined ? "…" : atual ? <>📌 Último recebido: <b>{quandoRoteiro(atual.em)}</b>
          <span class="muted"> · {atual.de && atual.de !== "planejador" ? `enviado por ${atual.de}` : "do planejador"}</span></> : <b>Nenhum roteiro recebido ainda.</b>}
      </p>
      <p class="muted pequeno" style="margin:0 0 10px">
        O roteiro do grupo (👥) vai e vem por mensagem (WhatsApp ou WeChat). Toque no link, ou copie a mensagem e use <b>Colar roteiro</b>.
        Cada roteiro recebido se junta ao seu, evento por evento. Seus eventos pessoais (👤) nunca vão nem mudam.
      </p>
      <div class="linha2">
        <button class="btn primario" onClick={colar}>📋 Colar roteiro</button>
        <button class="btn" onClick={env.abrir}>📤 Enviar roteiro</button>
      </div>
      {elemento}{env.elemento}
      <input ref={arq} type="file" accept=".json,application/json" hidden onChange={escolher} />
      <button class="btn" style="width:100%;margin-top:8px" onClick={() => arq.current?.click()}>Importar o Backup .json do planejador…</button>
      {erro && <p class="pequeno" style="color:var(--aviso)">{erro}</p>}
      {r && <ReceberRoteiro recebido={r} aoFechar={() => setR(null)} />}
    </div>
  );
}
