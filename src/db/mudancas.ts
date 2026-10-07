import { useEffect, useState } from "preact/hooks";

/* Change notification: every write bumps a counter and the screens that
   read the database re-read. Simple and enough for one-person data. */
let versao = 0;
const ouvintes = new Set<(v: number) => void>();
export function avisarMudanca() { versao++; ouvintes.forEach((f) => f(versao)); }
export function useVersaoDados(): number {
  const [v, setV] = useState(versao);
  useEffect(() => { ouvintes.add(setV); return () => { ouvintes.delete(setV); }; }, []);
  return v;
}
