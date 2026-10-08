import { useEffect, useState } from "preact/hooks";
import { lazy, Suspense } from "preact/compat";
import type { Viagem, Look, Dia } from "../db/tipos";
import { useLooks, novoLook, excluirLook, favoritar, definirLookDoDia, alternarLavanderia, usoDasPecas } from "../db/looks";
import { useMala, CATEGORIAS } from "../db/mala";
import { useDadosViagem } from "../db/useViagem";
import { useFotoUrl } from "../db/fotos";
import { Folha } from "../comp/Folha";
import { Miniatura } from "../comp/Foto";
import { dataCurta, diaSemana } from "../lib/datas";
import { t, tn } from "../lib/i18n";

/* the fitting room (and Konva with it) loads only when opened */
const Provador = lazy(() => import("../comp/Provador").then((m) => ({ default: m.Provador })));

type Vista = "looks" | "dias" | "pecas";
let memoria: Vista = "looks";

export function LooksAba({ viagem }: { viagem: Viagem }) {
  const { looks, pronto } = useLooks();
  const { itens } = useMala();
  const { dias, doDia } = useDadosViagem(viagem);
  const [vista, setVista] = useState<Vista>(memoria);
  useEffect(() => { memoria = vista; }, [vista]);
  const [provador, setProvador] = useState<{ look: Look; dia: Dia | null } | null>(null);
  const [escolherPara, setEscolherPara] = useState<Dia | null>(null);
  const [aberto, setAberto] = useState<Look | null>(null);
  if (!pronto) return null;

  const roupas = itens.filter((i) => i.origem === "levar" && (i.categoria === "roupa" || i.categoria === "calcado"));
  const uso = usoDasPecas(dias, looks, roupas);
  const semLook = dias.filter((d) => !d.lookIds[0] || !looks.some((l) => l.id === d.lookIds[0]));
  const diasDoLook = (id: string) => dias.filter((d) => d.lookIds[0] === id).map((d) => d.data);
  const montar = (look: Look, dia: Dia | null = null) => setProvador({ look, dia });

  return (
    <>
      <div class="seg" role="tablist">
        {([["looks", t("Looks")], ["dias", t("Por dia")], ["pecas", t("Peças")]] as [Vista, string][]).map(([v, r]) => (
          <button role="tab" aria-selected={vista === v} class={vista === v ? "on" : ""} onClick={() => setVista(v)}>{r}</button>))}
      </div>

      {vista === "looks" && (<>
        {looks.length
          ? <div class="grade-looks">{looks.map((l) => (
              <button class="look-card" onClick={() => setAberto(l)}>
                <ImagemLook fotoId={l.imagemFotoId} />
                <div class="lc-nome">{l.favorito && <span class="estrela">★</span>} {l.nome}</div>
                <div class="lc-dias muted">{diasDoLook(l.id).map(dataCurta).join(", ") || t("sem dia")}</div>
              </button>))}</div>
          : <div class="vazio"><div class="emo">👔</div>{t("Nenhum look ainda.")}<br /><span class="pequeno">{t("Toque em ＋ para montar o primeiro.")}</span></div>}
        <button class="fab" aria-label={t("Montar look")} onClick={() => montar(novoLook())}>＋</button>
      </>)}

      {vista === "dias" && (<>
        {semLook.length > 0 && <div class="faixa-aviso">👔 {tn(semLook.length, "1 dia está sem look.", "{n} dias estão sem look.")}</div>}
        <div class="lista-dias">{dias.map((d) => {
          const l = looks.find((x) => x.id === d.lookIds[0]);
          const evs = doDia(d.data);
          return (
            <div class={`dia-look ${d.lavanderia ? "lav" : ""}`}>
              <div class="rd-data"><span>{diaSemana(d.data)}</span><b>{+d.data.slice(8)}</b><span>{d.data.slice(5, 7)}/{d.data.slice(2, 4)}</span></div>
              <div class="dl-corpo">
                <div class="rd-cidade">{d.cidade || <span class="muted">—</span>}</div>
                <div class="muted pequeno">{evs.length ? evs.slice(0, 2).map((e) => e.titulo).join(" · ") + (evs.length > 2 ? ` +${evs.length - 2}` : "") : t("sem eventos")}</div>
                <div class="dl-botoes">
                  <button class="btn btn-peq" onClick={() => setEscolherPara(d)}>{l ? t("Trocar") : t("Escolher")}</button>
                  <button class={`btn btn-peq btn-lav ${d.lavanderia ? "on-lav" : ""}`} aria-pressed={d.lavanderia}
                    aria-label={d.lavanderia ? t("Dia de lavanderia (tocar para desmarcar)") : t("Marcar como dia de lavanderia")} title={t("Dia de lavanderia")}
                    onClick={() => alternarLavanderia(d)}>🧺{d.lavanderia ? " " + t("lavanderia") : ""}</button>
                </div>
              </div>
              <button class="dl-look" aria-label={l ? t("Look: {nome}", { nome: l.nome }) : t("Montar look para este dia")} onClick={() => l ? setAberto(l) : montar(novoLook(), d)}>
                {l ? <ImagemLook fotoId={l.imagemFotoId} /> : <span class="dl-mais">＋<br /><span class="pequeno">{t("montar")}</span></span>}
              </button>
            </div>);
        })}</div>
        <p class="muted pequeno" style="margin:12px 4px">{t("🧺 Num dia de lavanderia, as roupas usadas até aquele dia ficam livres para usar de novo.")}</p>
      </>)}

      {vista === "pecas" && (<>
        {uso.some((u) => u.falta) && <div class="faixa-aviso">{t("⚠️ Algumas peças aparecem em mais dias do que a quantidade que você vai levar (entre uma lavanderia e outra).")}</div>}
        <div class="lista-itens">{[...uso].sort((a, b) => Number(b.falta) - Number(a.falta) || a.dias.length - b.dias.length).map((u) => (
          <div class="item">
            <div class="item-corpo" style="cursor:default">
              <Miniatura fotoId={u.item.fotoId} class="item-mini" />
              <div class="item-txt">
                <div class="item-nome">{u.item.nome}{u.item.quantidade > 1 && <span class="item-qtd"> ×{u.item.quantidade}</span>}</div>
                <div class="item-info">
                  <span>{CATEGORIAS[u.item.categoria]?.emo} {u.dias.length ? tn(u.dias.length, "{n} dia", "{n} dias") : ""}</span>
                  {!u.dias.length && <span class="tag">{t("em nenhum look — talvez não precise levar")}</span>}
                  {u.falta && <span class="tag tag-aviso">{t("⚠️ precisa de {precisa}, vai levar {leva}", { precisa: u.precisa, leva: u.item.quantidade })}</span>}
                  {!u.item.fotoId && <span class="tag">{t("sem foto")}</span>}
                </div>
              </div>
            </div>
          </div>))}</div>
        {!uso.length && <div class="vazio"><div class="emo">👕</div>{t("Nenhuma roupa ou calçado na lista da mala.")}</div>}
      </>)}

      {aberto && (
        <Folha titulo={aberto.nome} aoFechar={() => setAberto(null)} rodape={<>
          <button class="btn" onClick={async () => { if (confirm(t("Excluir o look \"{nome}\"?", { nome: aberto.nome }))) { await excluirLook(aberto.id); setAberto(null); } }}>{t("Excluir")}</button>
          <button class="btn" onClick={async () => { await favoritar(aberto); setAberto({ ...aberto, favorito: !aberto.favorito }); }}>{aberto.favorito ? t("★ Favorito") : t("☆ Favoritar")}</button>
          <button class="btn primario" onClick={() => { const l = aberto; setAberto(null); montar(l); }}>{t("Editar")}</button>
        </>}>
          <div class="look-grande"><ImagemLook fotoId={aberto.imagemFotoId} cheia /></div>
          <p class="muted pequeno">{diasDoLook(aberto.id).length ? t("Dias: {dias}", { dias: diasDoLook(aberto.id).map(dataCurta).join(", ") }) : t("Ainda não está em nenhum dia.")}</p>
          <p class="pequeno">{aberto.pecas.map((p) => itens.find((i) => i.id === p.itemId)?.nome).filter(Boolean).join(" · ")}</p>
        </Folha>)}

      {escolherPara && (
        <Folha titulo={t("Look de {dia}", { dia: dataCurta(escolherPara.data) })} aoFechar={() => setEscolherPara(null)}>
          <button class="btn primario" style="width:100%;margin-bottom:12px" onClick={() => { const d = escolherPara; setEscolherPara(null); montar(novoLook(), d); }}>{t("＋ Montar um look novo para este dia")}</button>
          <div class="grade-looks">{looks.map((l) => (
            <button class={`look-card ${escolherPara.lookIds[0] === l.id ? "on" : ""}`}
              onClick={async () => { await definirLookDoDia(escolherPara, l.id); setEscolherPara(null); }}>
              <ImagemLook fotoId={l.imagemFotoId} />
              <div class="lc-nome">{l.favorito && <span class="estrela">★</span>} {l.nome}</div>
            </button>))}</div>
          {escolherPara.lookIds[0] && <button class="btn" style="width:100%;margin-top:12px" onClick={async () => { await definirLookDoDia(escolherPara, null); setEscolherPara(null); }}>{t("Tirar o look deste dia")}</button>}
        </Folha>)}

      {provador && (
        <Suspense fallback={<div class="provador"><div class="pv-carregando"><span class="giro" /></div></div>}>
          <Provador inicial={provador.look} itens={itens} dia={provador.dia}
            eventos={provador.dia ? doDia(provador.dia.data) : undefined} aoFechar={() => setProvador(null)} />
        </Suspense>)}
    </>
  );
}

export function ImagemLook({ fotoId, cheia = false }: { fotoId: string | null; cheia?: boolean }) {
  const url = useFotoUrl(fotoId, cheia ? "cheia" : "mini");
  return <span class="img-look">{url ? <img src={url} alt="" /> : <span class="muted">👔</span>}</span>;
}
