import { useRef, useState } from "preact/hooks";
import type { Mala } from "../db/tipos";
import { CATEGORIAS, novoItem, salvarItem, nomeMala } from "../db/mala";
import { gravarFoto } from "../db/fotos";
import { processarImagem } from "../lib/imagem";
import { t, tn } from "../lib/i18n";
import { Folha } from "./Folha";

/* Many clothes at once: several photos (or a whole folder, on a computer)
   become one item each, marked "completar" until opened and saved in the
   item editor. Photos are processed one by one (memory on the phone) and
   stay on this phone, like every other photo. */

const ehImagem = (f: File) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i.test(f.name);
/* "camisa-azul.png" → "Camisa azul"; camera names (IMG_1234, PXL_…, 2026…) → "" */
function nomeDoArquivo(nome: string): string {
  const base = nome.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!base || /^(img|dsc|dscn|pxl|photo|foto|image|imagem|screenshot|whatsapp|wa|mvimg)\b/i.test(base) || /^\d/.test(base)) return "";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function VariasFotos({ malas, aoFechar }: { malas: Mala[]; aoFechar: () => void }) {
  const fotos = useRef<HTMLInputElement>(null), pasta = useRef<HTMLInputElement>(null);
  const [categoria, setCategoria] = useState("roupa");
  const [malaId, setMalaId] = useState(malas.find((m) => m.tipo === "despachada")?.id ?? malas[0]?.id ?? "");
  const [prog, setProg] = useState<{ feito: number; total: number; erros: string[] } | null>(null);
  const [fim, setFim] = useState(false);
  const computador = !matchMedia("(pointer: coarse)").matches;

  async function escolher(e: Event) {
    const inp = e.target as HTMLInputElement;
    const lista = [...(inp.files ?? [])].filter(ehImagem).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    inp.value = "";
    if (!lista.length) { setProg({ feito: 0, total: 0, erros: [t("Nenhuma imagem encontrada.")] }); return; }
    const p = { feito: 0, total: lista.length, erros: [] as string[] };
    setProg({ ...p }); setFim(false);
    let semNome = 0;
    for (const f of lista) {
      try {
        const img = await processarImagem(f);
        const fotoId = await gravarFoto(img);
        const nome = nomeDoArquivo(f.name) || t("Peça {n}", { n: ++semNome });
        await salvarItem({ ...novoItem("levar", malaId || null), nome, categoria, fotoId, completar: true });
      } catch { p.erros.push(f.name); }
      p.feito++; setProg({ ...p });
    }
    setFim(true);
  }

  const ocupado = !!prog && !fim && prog.total > 0;
  return (
    <Folha titulo={t("Adicionar várias peças")} aoFechar={() => !ocupado && aoFechar()} rodape={
      <button class="btn primario" disabled={ocupado} onClick={aoFechar}>{fim ? t("Pronto") : t("Fechar")}</button>}>
      <p class="pequeno">{t("Cada foto vira uma peça na lista, marcada ✏️ para completar. Depois toque em cada uma para pôr nome, peso, cor e o resto.")}</p>
      <div class="linha2">
        <div class="campo"><label for="vf-cat">{t("Categoria")}</label>
          <select id="vf-cat" value={categoria} disabled={ocupado} onChange={(e) => setCategoria((e.target as HTMLSelectElement).value)}>
            {Object.entries(CATEGORIAS).map(([k, c]) => <option value={k}>{c.emo} {c.rot}</option>)}
          </select></div>
        <div class="campo"><label for="vf-mala">{t("Mala")}</label>
          <select id="vf-mala" value={malaId} disabled={ocupado} onChange={(e) => setMalaId((e.target as HTMLSelectElement).value)}>
            {malas.map((m) => <option value={m.id}>{nomeMala(m)}</option>)}
            <option value="">{t("Sem mala")}</option>
          </select></div>
      </div>
      <div class="botoes-envio">
        <button class="btn primario" disabled={ocupado} onClick={() => fotos.current?.click()}>{t("🖼️ Escolher fotos…")}</button>
        {computador && <button class="btn" disabled={ocupado} onClick={() => pasta.current?.click()}>{t("📁 Escolher uma pasta…")}</button>}
      </div>
      {!computador && <p class="muted pequeno" style="margin-top:0">{t("Na galeria, toque e segure uma foto e depois marque as outras para escolher várias.")}</p>}
      <input ref={fotos} type="file" accept="image/*" multiple hidden onChange={escolher} />
      {/* folder picker: the attribute must be set on the element (as a property, "" would turn it off) */}
      <input ref={(el) => { el?.setAttribute("webkitdirectory", ""); pasta.current = el; }} type="file" multiple hidden onChange={escolher} />

      {prog && prog.total > 0 && (<>
        <div class="barra" role="progressbar" aria-valuemin={0} aria-valuemax={prog.total} aria-valuenow={prog.feito} style="margin:10px 0 6px">
          <span class="barra-ok" style={{ width: `${(prog.feito / prog.total) * 100}%` }} />
        </div>
        <p class="pequeno" style={fim ? "color:var(--ok);font-weight:600" : ""}>{fim
          ? "✓ " + tn(prog.total - prog.erros.length, "{n} peça adicionada.", "{n} peças adicionadas.")
          : <><span class="giro giro-peq" /> {t("Processando {feito} de {total}…", { feito: prog.feito + 1, total: prog.total })}</>}</p>
      </>)}
      {prog && prog.erros.length > 0 && <p class="pequeno" style="color:var(--aviso)">{prog.total
        ? tn(prog.erros.length, "Não consegui abrir {n} imagem: {nomes}", "Não consegui abrir {n} imagens: {nomes}", { nomes: prog.erros.join(", ") })
        : prog.erros[0]}</p>}
      {ocupado && <p class="muted pequeno">{t("Deixe esta tela aberta até terminar.")}</p>}
    </Folha>
  );
}
