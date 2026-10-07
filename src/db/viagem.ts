import { abrirBanco } from "./banco";
import type { Viagem, Dia } from "./tipos";
import { listaDias } from "../lib/datas";
import { uuid, agoraISO } from "../lib/uuid";
import { avisarMudanca } from "./mudancas";

/* First run: the trip as it stands in China_Trip_Planner.html (07/10/2026).
   Everything here is editable in Configurações. */
const VIAGEM_INICIAL = { nome: "China — outubro 2026", inicio: "2026-10-08", fim: "2026-10-24" };
const CIDADES_INICIAIS: Record<string, string> = {
  "2026-10-08": "São Paulo",
  "2026-10-09": "São Paulo → em trânsito",
  "2026-10-10": "Em trânsito → Shanghai",
  "2026-10-11": "Shanghai", "2026-10-12": "Shanghai", "2026-10-13": "Shanghai",
  "2026-10-14": "Shanghai", "2026-10-15": "Shanghai", "2026-10-16": "Shanghai → Shenzhen",
  "2026-10-17": "Dongguan / Shenzhen", "2026-10-18": "Dongguan / Shenzhen",
  "2026-10-19": "Shenzhen", "2026-10-20": "Shenzhen", "2026-10-21": "Shenzhen",
  "2026-10-22": "Shenzhen", "2026-10-23": "Shenzhen → Brasil", "2026-10-24": "Brasil",
};

export async function carregarViagem(): Promise<Viagem> {
  const db = await abrirBanco();
  const todas = await db.getAll("viagem");
  if (todas.length) return todas[0];
  const v: Viagem = { id: uuid(), viajante: "", atualizadoEm: agoraISO(), ...VIAGEM_INICIAL };
  const tx = db.transaction(["viagem", "dias"], "readwrite");
  await tx.objectStore("viagem").put(v);
  for (const data of listaDias(v.inicio, v.fim)) {
    await tx.objectStore("dias").put(novoDia(data, CIDADES_INICIAIS[data] ?? ""));
  }
  await tx.done;
  return v;
}

function novoDia(data: string, cidade = ""): Dia {
  return { id: uuid(), data, cidade, lavanderia: false, lookIds: [], notas: "" };
}

/* Saves the trip and makes sure every date in the range has a day record.
   Days that fall outside a shorter range are KEPT (only hidden), so widening
   the range again brings their city, looks and notes back. */
export async function salvarViagem(v: Viagem): Promise<void> {
  const db = await abrirBanco();
  const tx = db.transaction(["viagem", "dias"], "readwrite");
  await tx.objectStore("viagem").put({ ...v, atualizadoEm: agoraISO() });
  const idx = tx.objectStore("dias").index("porData");
  for (const data of listaDias(v.inicio, v.fim)) {
    if (!(await idx.getKey(data))) await tx.objectStore("dias").put(novoDia(data));
  }
  await tx.done;
  avisarMudanca();
}

/* the days of the trip, in order (records outside the range are left out) */
export async function diasDaViagem(v: Viagem): Promise<Dia[]> {
  const db = await abrirBanco();
  const todos = await db.getAllFromIndex("dias", "porData");
  return todos.filter((d) => d.data >= v.inicio && d.data <= v.fim);
}

export async function salvarDia(d: Dia): Promise<void> {
  const db = await abrirBanco();
  await db.put("dias", d);
  avisarMudanca();
}
