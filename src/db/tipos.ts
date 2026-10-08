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
  /* the trip itinerary last received from the planner (link, pasted text or file) */
  roteiro?: { em: string; recebidoEm: string; plano: string; de?: string };
  /* group events deleted here or received as deleted: they travel in every
     itinerary this phone sends, so the deletion reaches everyone */
  excluidos?: { ref: string; em: string }[];
  /* changes to the group itinerary not sent yet (the "send it to everyone" alert) */
  pendente?: { desde: string; n: number } | null;
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
  /* "coletivo" = the shared itinerary sent from the planner, matched by ref;
     receiving a new itinerary only touches coletivo records, never pessoal. */
  camada: Camada;
  origemId: string | null;
  /* planner event it came from ("planner:<id>[:date]"), so a new version of
     the itinerary updates it instead of duplicating; null for events typed here */
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
  /* group events only: version for merging (last edit, ISO) and who made it */
  editadoEm?: string;
  autor?: string;
  /* planner fields kept as they came, so sending the event back loses nothing */
  tipoOrig?: string;
  empresa?: string;
  status?: string;
  cidade?: string;
  endereco?: string;
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
  /* added in bulk from photos ("Várias fotos"): shown as "✏️ completar" until saved in the editor */
  completar?: boolean;
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
