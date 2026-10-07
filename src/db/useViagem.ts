import { useEffect, useState } from "preact/hooks";
import type { Viagem, Dia, Evento } from "./tipos";
import { diasDaViagem } from "./viagem";
import { todosEventos } from "./eventos";
import { useVersaoDados } from "./mudancas";

/* Days and events of the trip, re-read after every write. The whole trip is
   a few hundred records at most, so reading everything is simpler and fast. */
export function useDadosViagem(viagem: Viagem) {
  const versao = useVersaoDados();
  const [dias, setDias] = useState<Dia[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    let vivo = true;
    Promise.all([diasDaViagem(viagem), todosEventos()]).then(([d, e]) => {
      if (vivo) { setDias(d); setEventos(e); setPronto(true); }
    });
    return () => { vivo = false; };
  }, [viagem, versao]);
  const cidade = (data: string) => dias.find((d) => d.data === data)?.cidade ?? "";
  const doDia = (data: string) => eventos.filter((e) => e.data === data);
  return { dias, eventos, pronto, cidade, doDia };
}
