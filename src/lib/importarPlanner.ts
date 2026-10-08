/* The planner's "⬇ Backup .json" as a file: one more way for the group
   itinerary to arrive (the usual one is the message, lib/roteiro.ts).
   The backup holds S.cenarios = [{id, nome, eventos[], dias{date:{cidade}}}];
   the chosen option becomes a full snapshot of the planner, merged by the
   same rules as a message (lib/grupo.ts). */
import { abrirBanco } from "../db/banco";
import type { Meta } from "../db/tipos";
import type { EvRoteiro, RoteiroRecebido } from "./grupo";
import { t } from "./i18n";

interface OpcaoPlanner { id: string; nome: string; eventos: EvRoteiro[]; dias: Record<string, { cidade?: string }> }
export interface BackupPlanner { cenarios: OpcaoPlanner[]; cenPrincipal?: string }

/* reads and checks the file; throws a message in Portuguese when it is not a planner backup */
export function lerBackup(texto: string): BackupPlanner {
  let j: unknown;
  try { j = JSON.parse(texto); } catch { throw new Error(t("O arquivo não é um JSON válido.")); }
  const b = j as BackupPlanner;
  if (!b || !Array.isArray(b.cenarios) || !b.cenarios.length || !b.cenarios.every((c) => Array.isArray(c?.eventos)))
    throw new Error(t("Esse arquivo não parece o Backup .json do China_Trip_Planner."));
  return b;
}

export function deBackup(b: BackupPlanner, opcaoId: string, em: string): RoteiroRecebido {
  const op = b.cenarios.find((c) => c.id === opcaoId) ?? b.cenarios[0];
  return {
    em, plano: op.nome ?? "", de: "planejador",
    // events the planner got from the phones keep their own ref ("app:…")
    eventos: op.eventos.map((e) => ({ ...e, ref: e.ref || `planner:${e.id}` })),
    excluidos: [], dias: op.dias && typeof op.dias === "object" ? op.dias : null, completo: true,
  };
}

export async function versaoAtual(): Promise<Meta["roteiro"] | null> {
  const db = await abrirBanco();
  return (await db.get("meta", "meta"))?.roteiro ?? null;
}
