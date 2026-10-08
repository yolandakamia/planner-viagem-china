import { useEffect, useState } from "preact/hooks";
import { abrirBanco } from "./banco";
import type { Foto } from "./tipos";
import type { ImagemPronta } from "../lib/imagem";
import { uuid, agoraISO } from "../lib/uuid";
import { useVersaoDados } from "./mudancas";

/* Photos live only in this device's IndexedDB. Nothing here talks to the
   network; the only way out is the user's own backup file (phase 6). */

export async function gravarFoto(img: ImagemPronta): Promise<string> {
  const db = await abrirBanco();
  const f: Foto = { id: uuid(), blob: img.blob, miniatura: img.miniatura, largura: img.largura,
    altura: img.altura, bytes: img.bytes, criadoEm: agoraISO() };
  await db.put("fotos", f);
  return f.id;
}
export async function apagarFoto(id: string | null | undefined) {
  if (!id) return;
  const db = await abrirBanco();
  await db.delete("fotos", id);
}

/* object URL of a stored photo (thumbnail or full), revoked on unmount */
export function useFotoUrl(id: string | null | undefined, tamanho: "mini" | "cheia" = "mini"): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!id) { setUrl(null); return; }
    let u: string | null = null, vivo = true;
    abrirBanco().then((db) => db.get("fotos", id)).then((f) => {
      if (!vivo || !f) return;
      u = URL.createObjectURL(tamanho === "mini" ? f.miniatura : f.blob);
      setUrl(u);
    });
    return () => { vivo = false; if (u) URL.revokeObjectURL(u); };
  }, [id, tamanho]);
  return url;
}

/* total space taken by photos, for Ajustes */
export function useEspacoFotos() {
  const versao = useVersaoDados();
  const [r, setR] = useState({ n: 0, bytes: 0 });
  useEffect(() => {
    abrirBanco().then(async (db) => {
      let n = 0, bytes = 0;
      let c = await db.transaction("fotos").store.openCursor();
      while (c) { n++; bytes += c.value.bytes || (c.value.blob.size + c.value.miniatura.size); c = await c.continue(); }
      setR({ n, bytes });
    });
  }, [versao]);
  return r;
}
