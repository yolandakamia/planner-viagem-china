/* Backup: everything on this device in ONE .zip, and back.

   backup.zip
   ├── manifesto.json   app, format, schema version, date, counts
   ├── dados.json       viagem, dias, eventos, malas, itens, looks, fotos (metadata)
   └── fotos/<id>.webp, fotos/<id>-mini.webp   (or .png)

   Import REPLACES all data, in a single transaction: if anything fails,
   nothing changes. A backup made by a newer version of the app (higher
   schema) is refused; an older one is accepted, since every field added
   since v1 is optional. */
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { abrirBanco, DB_VERSION } from "../db/banco";
import type { Viagem, Dia, Evento, Mala, Item, Look, Foto, Meta } from "../db/tipos";
import { avisarMudanca } from "../db/mudancas";

const APP = "viagem-china";
const FORMATO = 1;
const STORES = ["viagem", "dias", "eventos", "malas", "itens", "looks"] as const;
type Store = (typeof STORES)[number];

type FotoMeta = Omit<Foto, "blob" | "miniatura"> & { arquivo: string; arquivoMini: string; tipo: string; tipoMini: string };
interface Dados { viagem: Viagem[]; dias: Dia[]; eventos: Evento[]; malas: Mala[]; itens: Item[]; looks: Look[]; fotos: FotoMeta[] }
export interface Manifesto {
  app: string; formato: number; schemaVersion: number; criadoEm: string;
  contagens: Record<Store | "fotos", number>;
}

const ext = (tipo: string) => (tipo === "image/png" ? "png" : "webp");

/* ---------- export ---------- */
export async function gerarBackup(): Promise<{ blob: Blob; nome: string; manifesto: Manifesto }> {
  const db = await abrirBanco();
  const dados = {} as Dados;
  for (const s of STORES) (dados as unknown as Record<string, unknown[]>)[s] = await db.getAll(s);
  const arquivos: Record<string, Uint8Array> = {};
  dados.fotos = [];
  for (const f of await db.getAll("fotos")) {
    const { blob, miniatura, ...resto } = f;
    const arquivo = `fotos/${f.id}.${ext(blob.type)}`, arquivoMini = `fotos/${f.id}-mini.${ext(miniatura.type)}`;
    arquivos[arquivo] = new Uint8Array(await blob.arrayBuffer());
    arquivos[arquivoMini] = new Uint8Array(await miniatura.arrayBuffer());
    dados.fotos.push({ ...resto, arquivo, arquivoMini, tipo: blob.type, tipoMini: miniatura.type });
  }
  const agora = new Date();
  const manifesto: Manifesto = {
    app: APP, formato: FORMATO, schemaVersion: DB_VERSION, criadoEm: agora.toISOString(),
    contagens: Object.fromEntries([...STORES, "fotos"].map((s) => [s, (dados as unknown as Record<string, unknown[]>)[s].length])) as Manifesto["contagens"],
  };
  const zip = zipSync({
    "manifesto.json": strToU8(JSON.stringify(manifesto, null, 2)),
    "dados.json": strToU8(JSON.stringify(dados)),
    // photos are already compressed: store them as they are
    ...Object.fromEntries(Object.entries(arquivos).map(([k, v]) => [k, [v, { level: 0 }] as [Uint8Array, { level: 0 }]])),
  }, { level: 6 });
  const p = (n: number) => String(n).padStart(2, "0");
  const nome = `viagem-china-backup-${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}-${p(agora.getHours())}${p(agora.getMinutes())}.zip`;
  return { blob: new Blob([zip], { type: "application/zip" }), nome, manifesto };
}

/* hands the file to the user: share sheet (iPhone/Android → Arquivos, Drive,
   WhatsApp…) when available, plain download otherwise */
export async function entregarArquivo(blob: Blob, nome: string): Promise<"compartilhado" | "baixado" | "cancelado"> {
  const arq = new File([blob], nome, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [arq] }) && matchMedia("(pointer: coarse)").matches) {
    try { await nav.share({ files: [arq], title: nome }); return "compartilhado"; }
    catch (e) { if ((e as Error).name === "AbortError") return "cancelado"; }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: nome });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return "baixado";
}

export async function marcarBackupFeito() {
  const db = await abrirBanco();
  const m = await db.get("meta", "meta");
  await db.put("meta", { ...(m as Meta), chave: "meta", ultimoBackup: new Date().toISOString() });
  avisarMudanca();
}
export async function ultimoBackup(): Promise<string | null> {
  const db = await abrirBanco();
  return (await db.get("meta", "meta"))?.ultimoBackup ?? null;
}

/* ---------- import ---------- */
export interface BackupLido { manifesto: Manifesto; dados: Dados; arquivos: Record<string, Uint8Array> }

const erro = (m: string) => { throw new Error(m); };
const ehLista = (x: unknown): x is { id: string }[] => Array.isArray(x) && x.every((r) => r && typeof r === "object" && typeof (r as { id?: unknown }).id === "string");

export async function lerBackup(arq: Blob): Promise<BackupLido> {
  let arquivos: Record<string, Uint8Array>;
  try { arquivos = unzipSync(new Uint8Array(await arq.arrayBuffer())); }
  catch { return erro("Esse arquivo não é um .zip válido."); }
  if (!arquivos["manifesto.json"] || !arquivos["dados.json"]) erro("Esse .zip não é um backup do app da viagem.");
  let manifesto: Manifesto, dados: Dados;
  try { manifesto = JSON.parse(strFromU8(arquivos["manifesto.json"])); dados = JSON.parse(strFromU8(arquivos["dados.json"])); }
  catch { return erro("O backup está corrompido (não consegui ler os dados)."); }
  if (manifesto.app !== APP || manifesto.formato !== FORMATO) erro("Esse .zip não é um backup do app da viagem.");
  if (manifesto.schemaVersion > DB_VERSION) erro("Esse backup foi feito por uma versão mais nova do app. Atualize o app e tente de novo.");
  for (const s of [...STORES, "fotos"] as const)
    if (!ehLista((dados as unknown as Record<string, unknown>)[s])) erro(`O backup está incompleto ou corrompido (${s}).`);
  if (dados.dias.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d.data)) || dados.eventos.some((e) => !/^\d{4}-\d{2}-\d{2}$/.test(e.data)))
    erro("O backup tem datas inválidas.");
  const faltam = dados.fotos.filter((f) => !arquivos[f.arquivo] || !arquivos[f.arquivoMini]);
  if (faltam.length) erro(`Faltam ${faltam.length} fotos dentro do .zip.`);
  return { manifesto, dados, arquivos };
}

export async function restaurarBackup(b: BackupLido): Promise<void> {
  // build every Blob before opening the transaction (it must not wait on anything else)
  const fotos: Foto[] = b.dados.fotos.map(({ arquivo, arquivoMini, tipo, tipoMini, ...f }) => ({
    ...f,
    blob: new Blob([b.arquivos[arquivo] as Uint8Array<ArrayBuffer>], { type: tipo || "image/webp" }),
    miniatura: new Blob([b.arquivos[arquivoMini] as Uint8Array<ArrayBuffer>], { type: tipoMini || "image/webp" }),
  }));
  const db = await abrirBanco();
  const tx = db.transaction([...STORES, "fotos", "meta"] as (Store | "fotos" | "meta")[], "readwrite");
  for (const s of [...STORES, "fotos"] as const) await tx.objectStore(s as "dias").clear();
  for (const s of STORES) for (const r of (b.dados as unknown as Record<string, unknown[]>)[s])
    await (tx.objectStore(s) as unknown as { put: (v: unknown) => Promise<unknown> }).put(r);
  for (const f of fotos) await tx.objectStore("fotos").put(f);
  const m = await tx.objectStore("meta").get("meta");
  await tx.objectStore("meta").put({ ...(m as Meta), chave: "meta", ultimoBackup: b.manifesto.criadoEm });
  await tx.done;
}

/* wipes this device's data (for the backup test); the database itself and
   its schema version stay, so no migration runs again */
export async function apagarTudo(): Promise<void> {
  const db = await abrirBanco();
  const tx = db.transaction([...STORES, "fotos"] as (Store | "fotos")[], "readwrite");
  for (const s of [...STORES, "fotos"] as const) await tx.objectStore(s as "dias").clear();
  await tx.done;
}
