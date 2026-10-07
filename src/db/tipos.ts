/* Shapes of what is stored. Every record has a stable UUID `id`.
   Dates are "YYYY-MM-DD" and times "HH:MM", stored exactly as typed:
   the screen never converts them. A time zone only serves to work out
   "now" / "next" and to show the Brazil clock as extra information. */

export type ISODate = string;
export type HHMM = string;

export interface Meta {
  chave: "meta";
  schemaVersion: number;
  instaladoEm: string;          // ISO timestamp
  ultimoBackup: string | null;  // ISO timestamp
}

export interface Viagem {
  id: string;
  nome: string;
  viajante: string;
  inicio: ISODate;
  fim: ISODate;
  atualizadoEm: string;
}

export interface Dia {
  id: string;
  data: ISODate;                // unique
  cidade: string;
  lavanderia: boolean;          // frees the clothes for reuse (looks phase)
  lookIds: string[];
  notas: string;
}

export type Camada = "pessoal" | "coletivo";
export type TipoEvento = "feira" | "reuniao" | "deslocamento" | "refeicao" | "livre" | "outro";

export interface Evento {
  id: string;
  /* "coletivo" records will come from dados.json and be matched by origemId;
     the sync may only touch coletivo records, never pessoal ones. */
  camada: Camada;
  origemId: string | null;
  /* where a personal event was imported from ("planner:<id>"), so importing
     again updates it instead of duplicating; null for events typed here */
  ref?: string | null;
  data: ISODate;
  horaInicio: HHMM | "";
  horaFim: HHMM | "";
  fuso: string;                 // IANA, default "Asia/Shanghai"
  titulo: string;
  tipo: TipoEvento;
  local: string;
  enderecoCn: string;
  obs: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Mala {
  id: string;
  nome: string;
  /* "despachada" bags get the cabin-only warning */
  tipo?: "despachada" | "mao" | "mochila" | "outra";
  limiteKg: number | null;
  ordem: number;
  trecho: "ida" | "volta" | "ambos";
}

export type StatusItem = "a separar" | "separado" | "na mala";
export type OrigemItem = "levar" | "compra" | "amostra" | "catalogo";

export interface Item {
  id: string;
  nome: string;
  categoria: string;
  subcategoria: string;
  quantidade: number;
  pesoG: number | null;         // grams, integer
  malaId: string | null;
  /* bag on the way back: null = same bag as the way out,
     NAO_VOLTA = does not come back (given away, used up) */
  malaVoltaId: string | null;
  estilo: string;
  cor: string;
  status: StatusItem;
  fotoId: string | null;
  origem: OrigemItem;
  obs?: string;
  /* must travel in the cabin (power bank, documents): warns if it is put
     in a checked bag */
  soMao?: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Foto {
  id: string;
  blob: Blob;
  miniatura: Blob;
  largura: number;
  altura: number;
  bytes: number;
  criadoEm: string;
}

export interface PecaLook {
  itemId: string;
  x: number; y: number;
  escala: number; rotacao: number; z: number;
}

export interface Look {
  id: string;
  nome: string;
  favorito: boolean;
  pecas: PecaLook[];
  imagemFotoId: string | null;
  criadoEm: string;
  atualizadoEm: string;
}
