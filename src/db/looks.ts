import { useEffect, useState } from "preact/hooks";
import { abrirBanco } from "./banco";
import type { Look, Dia, Item } from "./tipos";
import { avisarMudanca, useVersaoDados } from "./mudancas";
import { uuid, agoraISO } from "../lib/uuid";

/* A look = pieces (item + position/scale/rotation/layer, in fractions of
   the stage so it redraws on any screen) + a rendered image stored in
   "fotos". A day points to its look through Dia.lookIds[0]. */

export function novoLook(): Look {
  const t = agoraISO();
  return { id: uuid(), nome: "", favorito: false, pecas: [], imagemFotoId: null, criadoEm: t, atualizadoEm: t };
}

/* saves the look and its new image in one go; the old image is deleted */
export async function salvarLook(l: Look, imagem: { blob: Blob; miniatura: Blob; largura: number; altura: number } | null) {
  const db = await abrirBanco();
  const tx = db.transaction(["looks", "fotos"], "readwrite");
  let imagemFotoId = l.imagemFotoId;
  if (imagem) {
    const velho = (await tx.objectStore("looks").get(l.id))?.imagemFotoId;
    if (velho) await tx.objectStore("fotos").delete(velho);
    imagemFotoId = uuid();
    await tx.objectStore("fotos").put({ id: imagemFotoId, ...imagem, bytes: imagem.blob.size + imagem.miniatura.size, criadoEm: agoraISO() });
  }
  const final = { ...l, imagemFotoId, atualizadoEm: agoraISO() };
  await tx.objectStore("looks").put(final);
  await tx.done; avisarMudanca();
  return final;
}

/* the look, its image, and its place in any day */
export async function excluirLook(id: string) {
  const db = await abrirBanco();
  const tx = db.transaction(["looks", "fotos", "dias"], "readwrite");
  const l = await tx.objectStore("looks").get(id);
  if (l?.imagemFotoId) await tx.objectStore("fotos").delete(l.imagemFotoId);
  await tx.objectStore("looks").delete(id);
  for (const d of await tx.objectStore("dias").getAll())
    if (d.lookIds.includes(id)) await tx.objectStore("dias").put({ ...d, lookIds: d.lookIds.filter((x) => x !== id) });
  await tx.done; avisarMudanca();
}

export async function favoritar(l: Look) {
  const db = await abrirBanco(); await db.put("looks", { ...l, favorito: !l.favorito }); avisarMudanca();
}

/* one look per day (kept as an array so more can come later) */
export async function definirLookDoDia(dia: Dia, lookId: string | null) {
  const db = await abrirBanco();
  await db.put("dias", { ...dia, lookIds: lookId ? [lookId] : [] }); avisarMudanca();
}
export async function alternarLavanderia(dia: Dia) {
  const db = await abrirBanco(); await db.put("dias", { ...dia, lavanderia: !dia.lavanderia }); avisarMudanca();
}

export function useLooks() {
  const versao = useVersaoDados();
  const [looks, setLooks] = useState<Look[]>([]);
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    let vivo = true;
    abrirBanco().then((db) => db.getAll("looks")).then((l) => {
      if (vivo) { setLooks(l.sort((a, b) => Number(b.favorito) - Number(a.favorito) || b.atualizadoEm.localeCompare(a.atualizadoEm))); setPronto(true); }
    });
    return () => { vivo = false; };
  }, [versao]);
  return { looks, pronto };
}

/* ---------- planning: how many days each piece is worn ----------
   Laundry splits the trip into cycles: what is worn up to a laundry day
   (inclusive) can be worn again after it. A piece is short when, in some
   cycle, it is worn on more days than the quantity packed. */
export interface UsoPeca { item: Item; dias: string[]; precisa: number; falta: boolean }

export function usoDasPecas(dias: Dia[], looks: Look[], pecas: Item[]): UsoPeca[] {
  const porId = new Map(looks.map((l) => [l.id, l]));
  const ciclos: string[][] = [[]];
  const diasDe = new Map<string, string[]>();
  for (const d of [...dias].sort((a, b) => a.data.localeCompare(b.data))) {
    const l = d.lookIds[0] ? porId.get(d.lookIds[0]) : null;
    if (l) for (const id of new Set(l.pecas.map((p) => p.itemId))) {
      diasDe.set(id, [...(diasDe.get(id) ?? []), d.data]);
      ciclos[ciclos.length - 1].push(id);
    }
    if (d.lavanderia) ciclos.push([]);
  }
  return pecas.map((item) => {
    const precisa = Math.max(0, ...ciclos.map((c) => c.filter((x) => x === item.id).length));
    return { item, dias: diasDe.get(item.id) ?? [], precisa, falta: precisa > (item.quantidade || 1) };
  });
}
