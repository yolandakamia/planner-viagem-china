import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames } from "idb";
import type { Meta, Viagem, Dia, Evento, Mala, Item, Foto, Look } from "./tipos";
import { MALAS_PADRAO, ITENS_SUGERIDOS } from "./sugestoes";
import { uuid } from "../lib/uuid";
import { t } from "../lib/i18n";

/* ------------------------------------------------------------------
   IndexedDB "viagem-china", versioned schema.

   RULES (data is used for real while the app is being built):
   - Never delete or recreate the database or a store in an upgrade.
   - Every structural change = a new entry at the end of MIGRACOES,
     which transforms the existing records in place.
   - DB_VERSION is always MIGRACOES.length.
   ------------------------------------------------------------------ */

interface EsquemaV1 extends DBSchema {
  meta:    { key: string; value: Meta };
  viagem:  { key: string; value: Viagem };
  dias:    { key: string; value: Dia;    indexes: { porData: string } };
  eventos: { key: string; value: Evento; indexes: { porData: string; porCamada: string; porOrigem: string } };
  malas:   { key: string; value: Mala };
  itens:   { key: string; value: Item;   indexes: { porMala: string; porCategoria: string; porStatus: string } };
  fotos:   { key: string; value: Foto };
  looks:   { key: string; value: Look };
}
export type Esquema = EsquemaV1;
export type Banco = IDBPDatabase<Esquema>;
type TxUpgrade = IDBPTransaction<Esquema, StoreNames<Esquema>[], "versionchange">;

type Migracao = (db: Banco, tx: TxUpgrade) => void | Promise<void>;

const MIGRACOES: Migracao[] = [
  /* v1 — every store the plan needs, created up front */
  (db) => {
    db.createObjectStore("meta", { keyPath: "chave" });
    db.createObjectStore("viagem", { keyPath: "id" });
    const dias = db.createObjectStore("dias", { keyPath: "id" });
    dias.createIndex("porData", "data", { unique: true });
    const ev = db.createObjectStore("eventos", { keyPath: "id" });
    ev.createIndex("porData", "data");
    ev.createIndex("porCamada", "camada");
    ev.createIndex("porOrigem", "origemId");
    db.createObjectStore("malas", { keyPath: "id" });
    const it = db.createObjectStore("itens", { keyPath: "id" });
    it.createIndex("porMala", "malaId");
    it.createIndex("porCategoria", "categoria");
    it.createIndex("porStatus", "status");
    db.createObjectStore("fotos", { keyPath: "id" });
    db.createObjectStore("looks", { keyPath: "id" });
  },

  /* v2 — default bags + suggested packing list for China. Runs once per
     device; only fills stores that are still empty, so nothing the user
     created is touched and deleted suggestions never come back. */
  async (_db, tx) => {
    const malas = tx.objectStore("malas"), itens = tx.objectStore("itens");
    if ((await malas.count()) > 0 || (await itens.count()) > 0) return;
    const idDe: Record<string, string> = {};
    for (const { chave, ...m } of MALAS_PADRAO) {
      idDe[chave] = uuid();
      await malas.put({ ...m, id: idDe[chave] });
    }
    const t = new Date().toISOString();
    for (const [nome, categoria, subcategoria, quantidade, pesoG, mala, obs, soMao, estilo] of ITENS_SUGERIDOS) {
      const item: Item = {
        id: uuid(), nome, categoria, subcategoria, quantidade, pesoG,
        malaId: idDe[mala], malaVoltaId: null, estilo: estilo ?? "", cor: "",
        status: "a separar", fotoId: null, origem: "levar", obs, soMao: !!soMao,
        criadoEm: t, atualizadoEm: t,
      };
      await itens.put(item);
    }
  },
];

export const DB_NOME = "viagem-china";
export const DB_VERSION = MIGRACOES.length;

let promessa: Promise<Banco> | null = null;

export function abrirBanco(): Promise<Banco> {
  if (!promessa) {
    promessa = openDB<Esquema>(DB_NOME, DB_VERSION, {
      async upgrade(db, antiga, _nova, tx) {
        for (let v = antiga; v < DB_VERSION; v++) await MIGRACOES[v](db, tx);
        await tx.objectStore("meta").put({
          chave: "meta",
          schemaVersion: DB_VERSION,
          instaladoEm: (await tx.objectStore("meta").get("meta"))?.instaladoEm ?? new Date().toISOString(),
          ultimoBackup: (await tx.objectStore("meta").get("meta"))?.ultimoBackup ?? null,
        });
      },
      blocked() {
        // another tab still has the old version open
        alert(t("Feche as outras abas do app para concluir a atualização dos dados."));
      },
      blocking() {
        // a newer version wants to upgrade: let it
        promessa?.then((db) => db.close());
        promessa = null;
      },
    });
  }
  return promessa;
}

/* Ask the browser not to evict our data under storage pressure.
   Granted silently for installed PWAs on Android; iOS decides by itself. */
export async function pedirArmazenamentoPersistente(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
