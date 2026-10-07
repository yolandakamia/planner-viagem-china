import type { Evento } from "../db/tipos";
import type { Situacao } from "../comp/Eventos";
import { intervalo, duracao } from "./tempo";

const UMA_HORA = 3600000;

/* Status of each timed event at instant `agora`:
   - "agora": started and not finished. An event without an end lasts until
     the next event starts, at most 1 hour.
   - "seguir": the first one still to start (with the time left).
   - "passado": finished. */
export function situacoes(eventos: Evento[], agora: number) {
  const iv = eventos.map((e) => ({ e, i: intervalo(e)! })).filter((x) => x.i).sort((a, b) => a.i.ini - b.i.ini);
  const sit = new Map<string, Situacao>();
  let resto = "", idSeguir: string | null = null;
  iv.forEach(({ e, i }, k) => {
    let fim = i.fim;
    if (!i.temFim) {
      const prox = iv.slice(k + 1).find((x) => x.i.ini > i.ini);
      fim = Math.min(i.ini + UMA_HORA, prox ? prox.i.ini : Infinity);
    }
    if (agora >= fim) sit.set(e.id, "passado");
    else if (agora >= i.ini) sit.set(e.id, "agora");
    else if (!idSeguir) { idSeguir = e.id; sit.set(e.id, "seguir"); resto = duracao(i.ini - agora); }
  });
  return { sit, resto, idSeguir };
}
