import { useEffect, useRef, useState } from "preact/hooks";
import { gerarBackup, entregarArquivo, marcarBackupFeito, ultimoBackup, lerBackup, restaurarBackup, apagarTudo, type BackupLido } from "../lib/backup";
import { useVersaoDados } from "../db/mudancas";
import { abrirBanco } from "../db/banco";
import { tamanho } from "../lib/imagem";
import { Folha } from "./Folha";
import { t, tn, LOCALE } from "../lib/i18n";

const DIAS_LEMBRETE = 7;
const diasDesde = (iso: string) => Math.floor((Date.now() - Date.parse(iso)) / 86400000);
const quando = (iso: string) => new Date(iso).toLocaleString(LOCALE, { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
function haQuanto(iso: string) {
  const d = diasDesde(iso);
  return d <= 0 ? t("hoje") : d === 1 ? t("ontem") : t("há {n} dias", { n: d });
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
      💾 {u ? t("Último backup {quando}.", { quando: haQuanto(u) }) : t("Você ainda não fez nenhum backup.")} {t("Seus dados e fotos só existem neste celular.")} <u>{t("Fazer backup")}</u>
    </a>
  );
}

const ROT: Record<string, (n: number) => string> = {
  eventos: (n) => tn(n, "{n} evento", "{n} eventos"), dias: (n) => tn(n, "{n} dia", "{n} dias"), malas: (n) => tn(n, "{n} mala", "{n} malas"),
  itens: (n) => tn(n, "{n} item", "{n} itens"), looks: (n) => tn(n, "{n} look", "{n} looks"), fotos: (n) => tn(n, "{n} foto", "{n} fotos") };

export function CartaoBackup() {
  const u = useUltimoBackup();
  const arq = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState("");
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [lido, setLido] = useState<BackupLido | null>(null);

  async function fazer() {
    setErro(""); setMsg(""); setOcupado(t("Gerando o backup…"));
    try {
      const { blob, nome } = await gerarBackup();
      const r = await entregarArquivo(blob, nome);
      if (r !== "cancelado") { await marcarBackupFeito(); setMsg(t("✓ Backup gerado ({tam}). Guarde o arquivo fora do celular também: e-mail, Drive, computador.", { tam: tamanho(blob.size) })); }
    } catch (e) { setErro(t("Não consegui gerar o backup: {erro}", { erro: (e as Error).message })); }
    finally { setOcupado(""); }
  }
  async function escolher(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0]; (ev.target as HTMLInputElement).value = "";
    if (!f) return;
    setErro(""); setMsg(""); setOcupado(t("Lendo o backup…"));
    try { setLido(await lerBackup(f)); } catch (e) { setErro((e as Error).message); }
    finally { setOcupado(""); }
  }
  async function restaurar() {
    if (!lido) return;
    setOcupado(t("Restaurando…"));
    try { await restaurarBackup(lido); location.reload(); }
    catch (e) { setOcupado(""); setErro(t("Não consegui restaurar; seus dados atuais não foram alterados. {erro}", { erro: (e as Error).message })); setLido(null); }
  }
  async function apagar() {
    const r = prompt(t("Isto apaga TODOS os dados deste aparelho (agenda, mala, fotos e looks). Para confirmar, digite {palavra}:", { palavra: t("APAGAR") }));
    if (r?.trim().toUpperCase() !== t("APAGAR").toUpperCase() && r?.trim().toUpperCase() !== "APAGAR") return;
    await apagarTudo(); location.reload();
  }

  return (
    <div class="cartao">
      <h2>{t("Backup")}</h2>
      <p class="pequeno" style="margin:-4px 0 10px">
        {u === undefined ? "…" : u ? <>{t("Último backup:")} <b>{haQuanto(u)}</b> <span class="muted">({quando(u)})</span></> : <b>{t("Nenhum backup feito ainda.")}</b>}
        {u && diasDesde(u) >= DIAS_LEMBRETE && <span style="color:var(--aviso)"> — {t("faça um novo.")}</span>}
      </p>
      <p class="muted pequeno" style="margin:0 0 10px">{t("Um único arquivo .zip com tudo: viagem, agenda, mala, fotos e looks.")}</p>
      <button class="btn primario" style="width:100%" disabled={!!ocupado} onClick={fazer}>{t("💾 Fazer backup agora")}</button>
      <button class="btn" style="width:100%;margin-top:8px" disabled={!!ocupado} onClick={() => arq.current?.click()}>{t("Restaurar de um backup…")}</button>
      <input ref={arq} type="file" accept=".zip,application/zip" hidden onChange={escolher} />
      {ocupado && <p class="pequeno muted"><span class="giro giro-peq" /> {ocupado}</p>}
      {msg && <p class="pequeno" style="color:var(--ok);font-weight:600">{msg}</p>}
      {erro && <p class="pequeno" style="color:var(--aviso)">{erro}</p>}
      <details class="perigo">
        <summary>{t("Apagar dados deste aparelho")}</summary>
        <p class="pequeno muted">{t("Use só para testar a restauração, ou antes de passar o celular adiante. Faça um backup antes.")}</p>
        <button class="btn" onClick={apagar}>{t("Apagar todos os dados…")}</button>
      </details>

      {lido && (
        <Folha titulo={t("Restaurar backup")} aoFechar={() => setLido(null)} rodape={<>
          <button class="btn" onClick={() => setLido(null)}>{t("Cancelar")}</button>
          <button class="btn primario" disabled={!!ocupado} onClick={restaurar}>{t("Substituir tudo")}</button>
        </>}>
          <p>{t("Backup de {quando}, com:", { quando: quando(lido.manifesto.criadoEm) })}</p>
          <ul class="contagens">{Object.entries(ROT).map(([k, rot]) => {
            const n = lido.manifesto.contagens[k as keyof typeof lido.manifesto.contagens] ?? 0;
            return <li>{rot(n)}</li>; })}</ul>
          <div class="faixa-aviso">⚠️ {t("Os dados atuais deste aparelho serão substituídos pelos do backup. Se quiser guardar os atuais, faça um backup deles antes.")}</div>
          <button class="btn" style="width:100%" disabled={!!ocupado} onClick={fazer}>{t("💾 Fazer backup dos dados atuais antes")}</button>
        </Folha>)}
    </div>
  );
}
