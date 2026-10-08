import { useEffect, useState } from "preact/hooks";
import type { Viagem, Dia } from "../db/tipos";
import { salvarViagem, diasDaViagem, salvarDia } from "../db/viagem";
import { diaSemana, diferencaDias } from "../lib/datas";
import { ImportarPlanner } from "../comp/ImportarPlanner";
import { CartaoBackup } from "../comp/Backup";
import { useVersaoDados } from "../db/mudancas";
import { useEspacoFotos } from "../db/fotos";
import { tamanho } from "../lib/imagem";
import { t, idioma, IDIOMAS, mudarIdioma } from "../lib/i18n";
import { temaAtual, mudarTema, type Tema } from "../lib/tema";

/* Trip settings. Everything saves on its own when a field is committed
   ("change": leaving the field, Enter, or picking a date). */
export function Config({ viagem, aoSalvar }: { viagem: Viagem; aoSalvar: (v: Viagem) => void }) {
  const [v, setV] = useState(viagem);
  const [dias, setDias] = useState<Dia[]>([]);
  const [msg, setMsg] = useState("");
  const fotos = useEspacoFotos();
  const [livre, setLivre] = useState<string>("");
  useEffect(() => { navigator.storage?.estimate?.().then((e) => e.quota && setLivre(tamanho(e.quota - (e.usage ?? 0))));
  }, [fotos.bytes]);

  const versao = useVersaoDados();
  useEffect(() => { diasDaViagem(viagem).then(setDias); }, [viagem, versao]);
  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(""), 1800); return () => clearTimeout(t); } }, [msg]);

  const datasOk = !!v.inicio && !!v.fim && v.fim >= v.inicio && diferencaDias(v.inicio, v.fim) <= 120;

  async function gravar(nova: Viagem) {
    if (!(nova.inicio && nova.fim && nova.fim >= nova.inicio)) return;
    await salvarViagem(nova);
    aoSalvar({ ...nova });
    setMsg("✓ Salvo");
  }
  const campo = (k: keyof Viagem) => ({
    value: v[k] as string,
    onInput: (e: Event) => setV({ ...v, [k]: (e.target as HTMLInputElement).value }),
    onChange: (e: Event) => gravar({ ...v, [k]: (e.target as HTMLInputElement).value }),
  });

  async function cidade(d: Dia, valor: string) {
    if (valor === d.cidade) return;
    const novo = { ...d, cidade: valor.trim() };
    await salvarDia(novo);
    setDias((l) => l.map((x) => (x.id === d.id ? novo : x)));
    setMsg("✓ Salvo");
  }

  return (
    <>
      <CartaoAparencia />
      <CartaoBackup />

      <div class="cartao">
        <h2>Viagem</h2>
        <div class="campo"><label for="c-nome">Nome da viagem</label><input id="c-nome" {...campo("nome")} /></div>
        <div class="campo"><label for="c-viaj">Viajante</label><input id="c-viaj" placeholder="Seu nome" {...campo("viajante")} /></div>
        <div class="linha2">
          <div class="campo"><label for="c-ini">Início</label><input id="c-ini" type="date" {...campo("inicio")} /></div>
          <div class="campo"><label for="c-fim">Fim</label><input id="c-fim" type="date" {...campo("fim")} /></div>
        </div>
        {!datasOk && <p class="pequeno" style="color:var(--aviso);margin:0">O fim precisa ser no mesmo dia ou depois do início.</p>}
      </div>

      <div class="cartao">
        <h2>Cidade de cada dia</h2>
        <p class="muted pequeno" style="margin:-4px 0 8px">Serve para planejar as roupas de acordo com o lugar.</p>
        {dias.map((d) => {
          const [, m, dd] = d.data.split("-");
          return (
            <div class="dia" key={d.id}>
              <div class="quando"><b>{+dd}/{m}</b><span class="muted">{diaSemana(d.data)}</span></div>
              <input aria-label={`Cidade em ${dd}/${m}`} value={d.cidade} placeholder="Cidade"
                onChange={(e) => cidade(d, (e.target as HTMLInputElement).value)}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
            </div>
          );
        })}
      </div>

      <ImportarPlanner />

      <div class="cartao">
        <h2>Seus dados</h2>
        <p class="pequeno muted" style="margin:0">
          Tudo fica guardado <b>só neste aparelho</b>, ligado ao endereço do site. Use sempre o mesmo link
          publicado (o do GitHub Pages) — o que você digitar em outro endereço fica em outro lugar.
          As fotos nunca saem do celular.
        </p>
        <p class="pequeno muted" style="margin:10px 0 0">Versão do app: <b>{__VERSAO__}</b></p>
        <p class="pequeno" style="margin:10px 0 0">📷 <b>{fotos.n}</b> {fotos.n === 1 ? "foto" : "fotos"} · <b>{tamanho(fotos.bytes)}</b>
          {livre && <span class="muted"> · {livre} livres para o app</span>}</p>
      </div>
      {msg && <div class="toast">{msg}</div>}
    </>
  );
}

/* theme and language: per phone, saved in this browser */
function CartaoAparencia() {
  const [tema, setTema] = useState<Tema>(temaAtual());
  const TEMAS: [Tema, string][] = [["auto", t("Automático")], ["claro", t("☀️ Claro")], ["escuro", t("🌙 Escuro")]];
  return (
    <div class="cartao">
      <h2>{t("Aparência e idioma")}</h2>
      <div class="campo"><label>{t("Tema")}</label>
        <div class="seg" role="radiogroup">
          {TEMAS.map(([id, rot]) => (
            <button role="radio" aria-checked={tema === id} class={tema === id ? "on" : ""}
              onClick={() => { mudarTema(id); setTema(id); }}>{rot}</button>))}
        </div>
        {tema === "auto" && <span class="muted pequeno">{t("Segue o modo claro/escuro do celular.")}</span>}
      </div>
      <div class="campo"><label>{t("Idioma")} · Language · 语言</label>
        <div class="seg" role="radiogroup">
          {IDIOMAS.map((i) => (
            <button role="radio" lang={i.id} aria-checked={idioma === i.id} class={idioma === i.id ? "on" : ""}
              onClick={() => idioma !== i.id && mudarIdioma(i.id)}>{i.rot}</button>))}
        </div>
        <span class="muted pequeno">{t("Muda os textos do app. O que vocês digitaram (eventos, itens) fica como está.")}</span>
      </div>
    </div>
  );
}
