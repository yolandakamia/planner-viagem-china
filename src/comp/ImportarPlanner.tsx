import { useEffect, useRef, useState } from "preact/hooks";
import { lerBackup, previa, importar, type BackupPlanner, type Previa } from "../lib/importarPlanner";

/* Card in Ajustes: pick the planner's "Backup .json", choose the option,
   see what will happen, confirm. */
export function ImportarPlanner() {
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
      setB(nb);
      setOp(nb.cenarios.find((c) => c.id === nb.cenPrincipal)?.id ?? nb.cenarios[0].id);
    } catch (e) { setB(null); setErro((e as Error).message); }
  }
  async function confirmar() {
    if (!b) return;
    const r = await importar(b, op, comCidades);
    setB(null); setP(null);
    setMsg(`✓ ${r.novos} eventos novos, ${r.atualizados} atualizados` + (comCidades ? `, ${r.cidades} cidades` : "") + ".");
  }

  return (
    <div class="cartao">
      <h2>Importar do planejador</h2>
      <p class="muted pequeno" style="margin:-4px 0 10px">
        No <b>China_Trip_Planner.html</b>, clique em <b>⬇ Backup .json</b> e escolha esse arquivo aqui.
        Importar de novo atualiza os eventos já importados, sem duplicar, e não mexe nos que você criou no app.
      </p>
      <input ref={arq} type="file" accept=".json,application/json" hidden onChange={escolher} />
      {!b && <button class="btn" onClick={() => arq.current?.click()}>Escolher arquivo…</button>}
      {erro && <p class="pequeno" style="color:var(--aviso)">{erro}</p>}
      {msg && <p class="pequeno" style="color:var(--ok);font-weight:600">{msg}</p>}
      {b && (<>
        {b.cenarios.length > 1 && (
          <div class="campo"><label for="i-op">Opção do planejador</label>
            <select id="i-op" value={op} onChange={(e) => setOp((e.target as HTMLSelectElement).value)}>
              {b.cenarios.map((c) => <option value={c.id}>{c.nome}{c.id === b.cenPrincipal ? " (principal)" : ""}</option>)}
            </select></div>)}
        {p && <p class="pequeno">Vai criar <b>{p.novos}</b> {p.novos === 1 ? "evento" : "eventos"} e atualizar <b>{p.atualizados}</b>.
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
