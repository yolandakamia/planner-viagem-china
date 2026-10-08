import { useEffect, useRef, useState } from "preact/hooks";
import { processarImagem, type ImagemPronta } from "../lib/imagem";
import { useFotoUrl } from "../db/fotos";
import { t } from "../lib/i18n";

/* What the photo field of an item will do on save */
export type MudancaFoto = { tipo: "nada" } | { tipo: "nova"; img: ImagemPronta } | { tipo: "remover" };

/* Photo field of the item editor. Nothing is written until the item is
   saved, so cancelling the editor leaves no orphan photo behind. */
export function CampoFoto({ fotoId, mudanca, aoMudar }: {
  fotoId: string | null; mudanca: MudancaFoto; aoMudar: (m: MudancaFoto) => void;
}) {
  const galeria = useRef<HTMLInputElement>(null), camera = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [ampliar, setAmpliar] = useState(false);
  const salva = useFotoUrl(mudanca.tipo === "nada" ? fotoId : null, "cheia");
  const [novaUrl, setNovaUrl] = useState<string | null>(null);
  useEffect(() => {
    if (mudanca.tipo !== "nova") { setNovaUrl(null); return; }
    const u = URL.createObjectURL(mudanca.img.blob); setNovaUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [mudanca]);
  const url = mudanca.tipo === "nova" ? novaUrl : mudanca.tipo === "remover" ? null : salva;

  async function escolher(e: Event) {
    const inp = e.target as HTMLInputElement, f = inp.files?.[0];
    inp.value = "";
    if (!f) return;
    setErro(""); setOcupado(true);
    try { aoMudar({ tipo: "nova", img: await processarImagem(f) }); }
    catch (x) { setErro((x as Error).message || t("Não consegui abrir essa imagem.")); }
    finally { setOcupado(false); }
  }

  return (
    <div class="campo">
      <label>{t("Foto")}</label>
      <div class="foto-campo">
        <button type="button" class="foto-prev xadrez" disabled={!url} onClick={() => setAmpliar(true)} aria-label={t("Ver foto grande")}>
          {ocupado ? <span class="giro" aria-label={t("Processando")} /> : url ? <img src={url} alt="" /> : <span class="foto-vazia">📷</span>}
        </button>
        <div class="foto-acoes">
          <button type="button" class="btn btn-peq" disabled={ocupado} onClick={() => galeria.current?.click()}>{t("🖼️ Galeria")}</button>
          <button type="button" class="btn btn-peq" disabled={ocupado} onClick={() => camera.current?.click()}>{t("📸 Tirar foto")}</button>
          {url && <button type="button" class="btn btn-peq" disabled={ocupado} onClick={() => aoMudar({ tipo: "remover" })}>{t("Remover")}</button>}
        </div>
      </div>
      {ocupado && <p class="muted pequeno" style="margin:0">{t("Processando a foto…")}</p>}
      {erro && <p class="pequeno" style="color:var(--aviso);margin:0">{erro}</p>}
      {mudanca.tipo === "nova" && <p class="muted pequeno" style="margin:0">
        {mudanca.img.largura}×{mudanca.img.altura} px · {Math.round(mudanca.img.bytes / 1024)} KB{mudanca.img.blob.type !== "image/webp" ? " (PNG)" : ""}</p>}
      {!url && !ocupado && <p class="dica-foto">{t("Dica: roupa esticada, fundo liso e contrastante, boa luz. Fotos já recortadas (PNG sem fundo, pelo recurso do iPhone ou do Android) ficam melhores nos looks.")}</p>}
      <input ref={galeria} type="file" accept="image/*" hidden onChange={escolher} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={escolher} />
      {ampliar && url && (
        <div class="foto-cheia xadrez" role="dialog" aria-label={t("Foto")} onClick={() => setAmpliar(false)}>
          <img src={url} alt="" />
        </div>)}
    </div>
  );
}

/* thumbnail for lists */
export function Miniatura({ fotoId, class: cls = "" }: { fotoId: string | null; class?: string }) {
  const url = useFotoUrl(fotoId, "mini");
  if (!fotoId) return null;
  return <span class={`mini xadrez ${cls}`}>{url && <img src={url} alt="" loading="lazy" />}</span>;
}
