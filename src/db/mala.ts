import { useEffect, useState } from "preact/hooks";
import { abrirBanco } from "./banco";
import type { Item, Mala, StatusItem, OrigemItem } from "./tipos";
import { avisarMudanca, useVersaoDados } from "./mudancas";
import { uuid, agoraISO } from "../lib/uuid";
import { ITENS_SUGERIDOS } from "./sugestoes";

export const NAO_VOLTA = "nao-volta";

export const CATEGORIAS: Record<string, { rot: string; emo: string }> = {
  roupa:      { rot: "Roupa",      emo: "👕" },
  calcado:    { rot: "Calçado",    emo: "👞" },
  eletronico: { rot: "Eletrônico", emo: "🔌" },
  documento:  { rot: "Documento",  emo: "🛂" },
  higiene:    { rot: "Higiene",    emo: "🧴" },
  trabalho:   { rot: "Trabalho",   emo: "💼" },
  outros:     { rot: "Outros",     emo: "📦" },
};
/* suggestions only — the field is free text */
export const SUBCATEGORIAS = ["camisa", "camiseta", "calça", "saia / vestido", "blazer", "agasalho",
  "roupa íntima", "meias", "pijama", "acessório", "sapato", "tênis"];
export const ESTILOS = ["social", "casual", "esporte"];
export const STATUS: StatusItem[] = ["a separar", "separado", "na mala"];
export const ORIGENS_VOLTA: Record<Exclude<OrigemItem, "levar">, { rot: string; emo: string }> = {
  compra:   { rot: "Compra",   emo: "🛍️" },
  amostra:  { rot: "Amostra",  emo: "🧪" },
  catalogo: { rot: "Catálogo", emo: "📚" },
};

export function novoItem(origem: OrigemItem = "levar", malaId: string | null = null): Item {
  const t = agoraISO();
  return { id: uuid(), nome: "", categoria: origem === "levar" ? "roupa" : "outros", subcategoria: "",
    quantidade: 1, pesoG: null, malaId: origem === "levar" ? malaId : null,
    malaVoltaId: origem === "levar" ? null : malaId, estilo: "", cor: "",
    status: "a separar", fotoId: null, origem, obs: "", soMao: false, criadoEm: t, atualizadoEm: t };
}

export async function salvarItem(i: Item) {
  const db = await abrirBanco(); await db.put("itens", { ...i, atualizadoEm: agoraISO() }); avisarMudanca();
}
export async function excluirItem(id: string) {
  const db = await abrirBanco(); await db.delete("itens", id); avisarMudanca();
}
export async function salvarMala(m: Mala) {
  const db = await abrirBanco(); await db.put("malas", m); avisarMudanca();
}
/* the bag goes; its items stay, without a bag */
export async function excluirMala(id: string) {
  const db = await abrirBanco();
  const tx = db.transaction(["malas", "itens"], "readwrite");
  await tx.objectStore("malas").delete(id);
  for (const i of await tx.objectStore("itens").getAll()) {
    if (i.malaId === id || i.malaVoltaId === id)
      await tx.objectStore("itens").put({ ...i, malaId: i.malaId === id ? null : i.malaId,
        malaVoltaId: i.malaVoltaId === id ? null : i.malaVoltaId });
  }
  await tx.done; avisarMudanca();
}
/* puts back the suggested items whose name is not on the list any more */
export async function adicionarSugestoesQueFaltam(malas: Mala[]): Promise<number> {
  const db = await abrirBanco();
  const nomes = new Set((await db.getAll("itens")).map((i) => i.nome.trim().toLowerCase()));
  const porTipo = (t: string) => malas.find((m) => (m.tipo ?? "") === t)?.id ?? malas[0]?.id ?? null;
  let n = 0;
  for (const [nome, categoria, subcategoria, quantidade, pesoG, mala, obs, soMao, estilo] of ITENS_SUGERIDOS) {
    if (nomes.has(nome.toLowerCase())) continue;
    await db.put("itens", { ...novoItem("levar", porTipo(mala)), nome, categoria, subcategoria, quantidade,
      pesoG, obs, soMao: !!soMao, estilo: estilo ?? "" });
    n++;
  }
  if (n) avisarMudanca();
  return n;
}

export function useMala() {
  const versao = useVersaoDados();
  const [malas, setMalas] = useState<Mala[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    let vivo = true;
    abrirBanco().then(async (db) => {
      const [m, i] = await Promise.all([db.getAll("malas"), db.getAll("itens")]);
      if (vivo) { setMalas(m.sort((a, b) => a.ordem - b.ordem)); setItens(i); setPronto(true); }
    });
    return () => { vivo = false; };
  }, [versao]);
  return { malas, itens, pronto };
}

/* ---------- weights (grams; the total is unit weight × quantity) ---------- */
export const pesoTotal = (i: Item) => (i.pesoG ?? 0) * (i.quantidade || 1);
export const kg = (g: number) => (g / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/* bag of each item on the way back */
export function malaNaVolta(i: Item): string | null {
  if (i.origem !== "levar") return i.malaVoltaId;
  if (i.malaVoltaId === NAO_VOLTA) return null;
  return i.malaVoltaId ?? i.malaId;
}

export function pesosPorMala(malas: Mala[], itens: Item[], trecho: "ida" | "volta") {
  return malas.map((m) => {
    const dentro = itens.filter((i) => trecho === "ida" ? i.origem === "levar" && i.malaId === m.id : malaNaVolta(i) === m.id);
    const g = dentro.reduce((s, i) => s + pesoTotal(i), 0);
    const semPeso = dentro.filter((i) => i.pesoG == null).length;
    const limiteG = m.limiteKg != null ? m.limiteKg * 1000 : null;
    return { mala: m, g, semPeso, n: dentro.length, limiteG, passou: limiteG != null && g > limiteG };
  });
}
