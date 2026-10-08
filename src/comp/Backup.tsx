import { useEffect, useRef, useState } from "preact/hooks";
import { gerarBackup, entregarArquivo, marcarBackupFeito, ultimoBackup, lerBackup, restaurarBackup, apagarTudo, type BackupLido } from "../lib/backup";
import { useVersaoDados } from "../db/mudancas";
import { abrirBanco } from "../db/banco";
import { tamanho } from "../lib/imagem";
import { Folha } from "./Folha";

const DIAS_LEMBRETE = 7;
const diasDesde = (iso: string) => Math.floor((Date.now() - Date.parse(iso)) / 86400000);
const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
function haQuanto(iso: string) {
  const d = diasDesde(iso);
  return d <= 0 ? "hoje" : d === 1 ? "ontem" : `há ${d} dias`;
}

export function useUltimoBackup() {
  const versao = useVersaoDados();
  const [u, setU] = useState<string | null | undefined>(undefined);
  useEffect(() => { ultimoBackup().then(setU); }, [versao]);
  return u;
}

/* reminder on Hoje: there is something to lose and no backup for 7+ days */
export function LembreteBackup() {
  const u = useUltimoBackup();
  const [temDados, setTemDados] = useState(false);
  useEffect(() => {
    abrirBanco().then(async (db) => setTemDados((await db.count("eventos")) + (await db.count("fotos")) + (await db.count("looks")) > 0));
  }, []);
  if (u === undefined || !temDados || (u && diasDesde(u) < DIAS_LEMBRETE)) return null;
  return (
    <a class="faixa-aviso lembrete-backup" href="#/config">
      💾 {u ? `Último backup ${haQuanto(u)}.` : "Você ainda não fez nenhum backup."} Seus dados e fotos só existem neste celular. <u>Fazer backup</u>
    </a>
  );
}

const ROT: Record<string, [string, string]> = { eventos: ["evento", "eventos"], dias: ["dia", "dias"], malas: ["mala", "malas"],
  itens: ["item", "itens"], looks: ["look", "looks"], fotos: ["foto", "fotos"] };

export function CartaoBackup() {
  const u = useUltimoBackup();
  const arq = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState("");
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [lido, setLido] = useState<BackupLido | null>(null);

  async function fazer() {
    setErro(""); setMsg(""); setOcupado("Gerando o backup…");
    try {
      const { blob, nome } = await gerarBackup();
      const r = await entregarArquivo(blob, nome);
      if (r !== "cancelado") { await marcarBackupFeito(); setMsg(`✓ Backup gerado (${tamanho(blob.size)}). Guarde o arquivo fora do celular também: e-mail, Drive, computador.`); }
    } catch (e) { setErro("Não consegui gerar o backup: " + (e as Error).message); }
    finally { setOcupado(""); }
  }
  async function escolher(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0]; (ev.target as HTMLInputElement).value = "";
    if (!f) return;
    setErro(""); setMsg(""); setOcupado("Lendo o backup…");
    try { setLido(await lerBackup(f)); } catch (e) { setErro((e as Error).message); }
    finally { setOcupado(""); }
  }
  async function restaurar() {
    if (!lido) return;
    setOcupado("Restaurando…");
    try { await restaurarBackup(lido); location.reload(); }
    catch (e) { setOcupado(""); setErro("Não consegui restaurar; seus dados atuais não foram alterados. " + (e as Error).message); setLido(null); }
  }
  async function apagar() {
    const r = prompt("Isto apaga TODOS os dados deste aparelho (agenda, mala, fotos e looks). Para confirmar, digite APAGAR:");
    if (r?.trim().toUpperCase() !== "APAGAR") return;
    await apagarTudo(); location.reload();
  }

  return (
    <div class="cartao">
      <h2>Backup</h2>
      <p class="pequeno" style="margin:-4px 0 10px">
        {u === undefined ? "…" : u ? <>Último backup: <b>{haQuanto(u)}</b> <span class="muted">({quando(u)})</span></> : <b>Nenhum backup feito ainda.</b>}
        {u && diasDesde(u) >= DIAS_LEMBRETE && <span style="color:var(--aviso)"> — faça um novo.</span>}
      </p>
      <p class="muted pequeno" style="margin:0 0 10px">Um único arquivo .zip com tudo: viagem, agenda, mala, fotos e looks.</p>
      <button class="btn primario" style="width:100%" disabled={!!ocupado} onClick={fazer}>💾 Fazer backup agora</button>
      <button class="btn" style="width:100%;margin-top:8px" disabled={!!ocupado} onClick={() => arq.current?.click()}>Restaurar de um backup…</button>
      <input ref={arq} type="file" accept=".zip,application/zip" hidden onChange={escolher} />
      {ocupado && <p class="pequeno muted"><span class="giro giro-peq" /> {ocupado}</p>}
      {msg && <p class="pequeno" style="color:var(--ok);font-weight:600">{msg}</p>}
      {erro && <p class="pequeno" style="color:var(--aviso)">{erro}</p>}
      <details class="perigo">
        <summary>Apagar dados deste aparelho</summary>
        <p class="pequeno muted">Use só para testar a restauração, ou antes de passar o celular adiante. Faça um backup antes.</p>
        <button class="btn" onClick={apagar}>Apagar todos os dados…</button>
      </details>

      {lido && (
        <Folha titulo="Restaurar backup" aoFechar={() => setLido(null)} rodape={<>
          <button class="btn" onClick={() => setLido(null)}>Cancelar</button>
          <button class="btn primario" disabled={!!ocupado} onClick={restaurar}>Substituir tudo</button>
        </>}>
          <p>Backup de <b>{quando(lido.manifesto.criadoEm)}</b>, com:</p>
          <ul class="contagens">{Object.entries(ROT).map(([k, [um, varios]]) => {
            const n = lido.manifesto.contagens[k as keyof typeof lido.manifesto.contagens] ?? 0;
            return <li><b>{n}</b> {n === 1 ? um : varios}</li>; })}</ul>
          <div class="faixa-aviso">⚠️ Os dados atuais deste aparelho serão <b>substituídos</b> pelos do backup. Se quiser guardar os atuais, faça um backup deles antes.</div>
          <button class="btn" style="width:100%" disabled={!!ocupado} onClick={fazer}>💾 Fazer backup dos dados atuais antes</button>
        </Folha>)}
    </div>
  );
}
