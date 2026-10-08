import { useEffect, useState } from "preact/hooks";
import { useRegisterSW } from "virtual:pwa-register/preact";
import { carregarViagem } from "./db/viagem";
import { pedirArmazenamentoPersistente } from "./db/banco";
import type { Viagem } from "./db/tipos";
import { IconeHoje, IconeCalendario, IconeMala, IconeLooks, IconeConfig } from "./icones";
import { Hoje } from "./abas/Hoje";
import { Config } from "./abas/Config";
import { Calendario } from "./abas/Calendario";
import { MalaAba } from "./abas/Mala";
import { LooksAba } from "./abas/Looks";
import { ReceberRoteiro } from "./comp/Roteiro";
import { temRoteiro } from "./lib/roteiro";

/* Tabs live in the hash (#/hoje …): no server routing needed on GitHub Pages,
   and the Android back button moves between tabs. */
const ABAS = [
  { id: "hoje", rot: "Hoje", Icone: IconeHoje },
  { id: "calendario", rot: "Calendário", Icone: IconeCalendario },
  { id: "mala", rot: "Mala", Icone: IconeMala },
  { id: "looks", rot: "Looks", Icone: IconeLooks },
  { id: "config", rot: "Ajustes", Icone: IconeConfig },
] as const;
type IdAba = (typeof ABAS)[number]["id"];

const abaDoHash = (): IdAba => {
  const h = location.hash.replace(/^#\/?/, "");
  return (ABAS.find((a) => a.id === h)?.id ?? "hoje") as IdAba;
};

export function App() {
  const [aba, setAba] = useState<IdAba>(abaDoHash);
  const [viagem, setViagem] = useState<Viagem | null>(null);
  const [erro, setErro] = useState("");
  /* an itinerary link (#roteiro=…): keep it, and clean the address so a
     reload or a bookmark does not offer it again */
  const [roteiro, setRoteiro] = useState<string | null>(null);

  useEffect(() => {
    const f = () => {
      if (temRoteiro(location.hash)) { setRoteiro(location.href); history.replaceState(null, "", "#/hoje"); }
      setAba(abaDoHash());
    };
    f();
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);

  useEffect(() => {
    carregarViagem().then(setViagem).catch((e) => setErro(String(e?.message ?? e)));
    pedirArmazenamentoPersistente();
  }, []);

  if (erro) return <div class="conteudo"><div class="cartao"><h2>Não consegui abrir os dados</h2><p>{erro}</p></div></div>;
  if (!viagem) return null;

  const tit = ABAS.find((a) => a.id === aba)!.rot;
  return (
    <div class="app">
      <header class="topo">
        <h1>{aba === "hoje" ? viagem.nome : tit}</h1>
      </header>
      <main class="conteudo">
        {aba === "hoje" && <Hoje viagem={viagem} />}
        {aba === "calendario" && <Calendario viagem={viagem} />}
        {aba === "mala" && <MalaAba />}
        {aba === "looks" && <LooksAba viagem={viagem} />}
        {aba === "config" && <Config viagem={viagem} aoSalvar={setViagem} />}
      </main>
      <div class="abas">
        <nav>
          {ABAS.map(({ id, rot, Icone }) => (
            <a href={`#/${id}`} class={aba === id ? "ativa" : ""} aria-current={aba === id ? "page" : undefined}>
              <Icone />{rot}
            </a>
          ))}
        </nav>
      </div>
      <AvisoAtualizacao />
      {roteiro && <ReceberRoteiro key={roteiro} texto={roteiro} aoFechar={() => setRoteiro(null)} />}
    </div>
  );
}

/* "Nova versão disponível – toque para atualizar". The new service worker
   waits until the tap, so nothing reloads in the middle of an edit.
   Data lives in IndexedDB and is untouched by the update. */
function AvisoAtualizacao() {
  const { needRefresh: [precisa], offlineReady: [pronto, setPronto], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      // look for a new version whenever the app comes back to the foreground
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && navigator.onLine) reg.update().catch(() => {});
      });
    },
  });
  useEffect(() => {
    if (pronto) { const t = setTimeout(() => setPronto(false), 4000); return () => clearTimeout(t); }
  }, [pronto]);

  if (precisa) {
    return (
      <button class="aviso-versao" onClick={() => updateServiceWorker(true)}>
        <span style="font-size:20px">⬆️</span>
        <span>Nova versão disponível – toque para atualizar</span>
      </button>
    );
  }
  if (pronto) return <div class="toast">✓ Pronto para usar offline</div>;
  return null;
}
