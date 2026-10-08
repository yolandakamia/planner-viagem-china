import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Look, PecaLook, Item, Dia, Evento } from "../db/tipos";
import { salvarLook, definirLookDoDia } from "../db/looks";
import { abrirBanco } from "../db/banco";
import { useFotoUrl } from "../db/fotos";
import { codificar, reduzir } from "../lib/imagem";
import { dataCurta } from "../lib/datas";
import { uuid } from "../lib/uuid";

/* Fitting room. Konva is loaded only here (dynamic import), bundled with
   the app — nothing comes from a CDN.
   Model: pieces with x/y = centre as a fraction of the stage, escala =
   width as a fraction of the stage width, rotacao in degrees, and the
   array order = layer order (last = front). The model is the truth; the
   Konva nodes are rebuilt from it after add / remove / reorder / undo. */

type Peca = PecaLook & { k: string };
type KonvaMods = {
  Stage: typeof import("konva/lib/Stage").Stage;
  Layer: typeof import("konva/lib/Layer").Layer;
  Img: typeof import("konva/lib/shapes/Image").Image;
  Transformer: typeof import("konva/lib/shapes/Transformer").Transformer;
  Konva: typeof import("konva/lib/Core").default;
};
let konvaPromessa: Promise<KonvaMods> | null = null;
function carregarKonva() {
  konvaPromessa ??= Promise.all([
    import("konva/lib/Core"), import("konva/lib/Stage"), import("konva/lib/Layer"),
    import("konva/lib/shapes/Image"), import("konva/lib/shapes/Transformer"),
  ]).then(([c, s, l, i, t]) => {
    c.default.hitOnDragEnabled = true;   // a second finger can start a pinch mid-drag
    return { Konva: c.default, Stage: s.Stage, Layer: l.Layer, Img: i.Image, Transformer: t.Transformer };
  });
  return konvaPromessa;
}

const ordenar = (p: Peca[]) => p.map((x, i) => ({ ...x, z: i }));
const COR_FUNDO = "#f6f2ef";

export function Provador({ inicial, itens, dia, eventos, aoFechar }: {
  inicial: Look; itens: Item[]; dia?: Dia | null; eventos?: Evento[]; aoFechar: () => void;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const k = useRef<{ mods: KonvaMods; stage: InstanceType<KonvaMods["Stage"]>; layer: InstanceType<KonvaMods["Layer"]>;
    tr: InstanceType<KonvaMods["Transformer"]>; W: number; H: number } | null>(null);
  const imagens = useRef(new Map<string, HTMLImageElement>());
  const [pecas, setPecas] = useState<Peca[]>(() => [...inicial.pecas].sort((a, b) => a.z - b.z).map((p) => ({ ...p, k: uuid() })));
  const modelo = useRef(pecas); modelo.current = pecas;
  const [hist, setHist] = useState<Peca[][]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [nome, setNome] = useState(inicial.nome || (dia ? `Look de ${dataCurta(dia.data)}` : ""));
  const [fav, setFav] = useState(inicial.favorito);
  const [filtro, setFiltro] = useState("");
  const [mexeu, setMexeu] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [verAgenda, setVerAgenda] = useState(true);

  const comFoto = useMemo(() => itens.filter((i) => i.fotoId && i.origem === "levar"), [itens]);
  const subcats = useMemo(() => [...new Set(comFoto.map((i) => i.subcategoria || "outros"))].sort(), [comFoto]);
  const naBarra = comFoto.filter((i) => !filtro || (i.subcategoria || "outros") === filtro);
  const itemDe = (id: string) => itens.find((i) => i.id === id);

  /* every change goes through here: snapshot for undo, then the new model */
  function mudar(nova: Peca[]) {
    setHist((h) => [...h.slice(-49), modelo.current]);
    setPecas(ordenar(nova)); setMexeu(true);
  }
  function desfazer() {
    if (!hist.length) return;
    setPecas(hist[hist.length - 1]); setHist(hist.slice(0, -1)); setSel(null); setMexeu(true);
  }

  /* ---- Konva stage ---- */
  useEffect(() => {
    let vivo = true;
    carregarKonva().then((mods) => {
      if (!vivo || !caixa.current) return;
      const W = caixa.current.clientWidth, H = Math.round(W * 1.25);
      const stage = new mods.Stage({ container: caixa.current, width: W, height: H });
      const layer = new mods.Layer(); stage.add(layer);
      const tr = new mods.Transformer({
        keepRatio: true, rotateEnabled: true, rotationSnaps: [0, 90, 180, 270], rotationSnapTolerance: 6,
        enabledAnchors: ["top-left", "top-right", "bottom-left", "bottom-right"], anchorSize: 18, anchorCornerRadius: 9,
        borderStroke: "#b3261e", anchorStroke: "#b3261e", rotateAnchorOffset: 32, ignoreStroke: true,
        boundBoxFunc: (velho, novo) => (Math.abs(novo.width) < 24 ? velho : novo),
      });
      layer.add(tr);
      stage.on("click tap", (e) => { if (e.target === stage) setSel(null); });
      k.current = { mods, stage, layer, tr, W, H };
      setPronto(true);
    });
    return () => { vivo = false; k.current?.stage.destroy(); k.current = null; };
  }, []);

  /* load the full-size images of the pieces in use */
  async function imagemDe(itemId: string): Promise<HTMLImageElement | null> {
    const c = imagens.current.get(itemId); if (c) return c;
    const it = itemDe(itemId); if (!it?.fotoId) return null;
    const f = await (await abrirBanco()).get("fotos", it.fotoId); if (!f) return null;
    const img = new Image(); img.src = URL.createObjectURL(f.blob); await img.decode().catch(() => {});
    imagens.current.set(itemId, img); return img;
  }
  useEffect(() => () => { imagens.current.forEach((i) => URL.revokeObjectURL(i.src)); }, []);

  /* rebuild the nodes from the model */
  useEffect(() => {
    if (!pronto || !k.current) return;
    let vivo = true;
    (async () => {
      const { mods, layer, tr, W, H } = k.current!;
      const imgs = await Promise.all(pecas.map((p) => imagemDe(p.itemId)));
      if (!vivo || !k.current) return;
      layer.find(".peca").forEach((n) => n.destroy());
      pecas.forEach((p, idx) => {
        const img = imgs[idx]; if (!img) return;
        const w = p.escala * W, h = w * (img.naturalHeight / img.naturalWidth || 1);
        const n = new mods.Img({ name: "peca", id: p.k, image: img, x: p.x * W, y: p.y * H, width: w, height: h,
          offsetX: w / 2, offsetY: h / 2, rotation: p.rotacao, draggable: true });
        n.on("mousedown touchstart", () => { setSel(p.k); tr.nodes([n]); });
        n.on("dragend transformend", () => lerNo(p.k));
        layer.add(n);
      });
      tr.moveToTop();
      const no = sel ? layer.findOne("#" + sel) : null;
      tr.nodes(no ? [no] : []);
      layer.batchDraw();
    })();
    return () => { vivo = false; };
  }, [pecas, pronto]);

  useEffect(() => {
    if (!k.current) return;
    const no = sel ? k.current.layer.findOne("#" + sel) : null;
    k.current.tr.nodes(no ? [no] : []); k.current.layer.batchDraw();
  }, [sel]);

  /* node → model after a drag or a handle transform */
  function lerNo(chave: string) {
    if (!k.current) return;
    const { layer, W, H } = k.current;
    const n = layer.findOne("#" + chave) as InstanceType<KonvaMods["Img"]> | undefined; if (!n) return;
    const w = n.width() * n.scaleX();
    mudar(modelo.current.map((p) => p.k !== chave ? p : {
      ...p, x: n.x() / W, y: n.y() / H, escala: w / W, rotacao: ((n.rotation() % 360) + 360) % 360,
    }));
  }

  /* two-finger pinch on the selected piece: scale + rotate + move */
  useEffect(() => {
    if (!pronto || !k.current) return;
    const { stage } = k.current;
    let ini: { d: number; a: number; mx: number; my: number; x: number; y: number; sx: number; r: number } | null = null;
    const pontos = (e: TouchEvent) => {
      const r = stage.container().getBoundingClientRect();
      const [a, b] = [e.touches[0], e.touches[1]];
      return { ax: a.clientX - r.left, ay: a.clientY - r.top, bx: b.clientX - r.left, by: b.clientY - r.top };
    };
    const geometria = (e: TouchEvent) => {
      const p = pontos(e);
      return { d: Math.hypot(p.bx - p.ax, p.by - p.ay), a: Math.atan2(p.by - p.ay, p.bx - p.ax) * 180 / Math.PI,
        mx: (p.ax + p.bx) / 2, my: (p.ay + p.by) / 2 };
    };
    /* the pinch starts as soon as the second finger lands; one-finger
       dragging is switched off meanwhile so it cannot pull the piece */
    const comecar = (e: TouchEvent) => {
      const alvo = k.current?.tr.nodes()[0]; if (!alvo || e.touches.length !== 2) return false;
      if (alvo.isDragging()) alvo.stopDrag();
      alvo.draggable(false);
      ini = { ...geometria(e), x: alvo.x(), y: alvo.y(), sx: alvo.scaleX(), r: alvo.rotation() };
      return true;
    };
    stage.on("touchstart", (ev) => { const e = ev.evt as TouchEvent; if (e.touches.length === 2 && comecar(e)) e.preventDefault(); });
    stage.on("touchmove", (ev) => {
      const e = ev.evt as TouchEvent;
      if (e.touches.length !== 2) return;
      const alvo = k.current?.tr.nodes()[0]; if (!alvo) return;
      e.preventDefault();
      if (!ini && !comecar(e)) return;
      if (alvo.isDragging()) alvo.stopDrag();
      const g = geometria(e), i0 = ini!;
      const s = Math.max(0.1, i0.sx * g.d / i0.d);
      alvo.scale({ x: s, y: s }); alvo.rotation(i0.r + g.a - i0.a);
      alvo.position({ x: i0.x + g.mx - i0.mx, y: i0.y + g.my - i0.my });
      k.current!.layer.batchDraw();
    });
    stage.on("touchend touchcancel", (ev) => {
      if (!ini || (ev.evt as TouchEvent).touches.length >= 2) return;
      ini = null;
      const alvo = k.current?.tr.nodes()[0];
      if (alvo) { alvo.draggable(true); lerNo(alvo.id()); }
    });
    return () => { stage.off("touchstart"); stage.off("touchmove"); stage.off("touchend touchcancel"); };
  }, [pronto]);

  /* ---- adding pieces: tap = centre, drag up from the bar = where dropped ---- */
  function adicionar(it: Item, x = 0.5, y = 0.5) {
    const img = imagens.current.get(it.id);
    const deitada = img ? img.naturalWidth > img.naturalHeight : false;
    const escala = it.categoria === "calcado" ? 0.3 : it.subcategoria === "acessório" ? 0.25 : deitada ? 0.6 : 0.45;
    const nk = uuid();
    mudar([...modelo.current, { k: nk, itemId: it.id, x, y, escala, rotacao: 0, z: modelo.current.length }]);
    setSel(nk);
  }
  const arrasto = useRef<{ it: Item; x0: number; y0: number; ativo: boolean; fant: HTMLImageElement | null } | null>(null);
  function inicioArrasto(e: PointerEvent, it: Item) {
    arrasto.current = { it, x0: e.clientX, y0: e.clientY, ativo: false, fant: null };
    imagemDe(it.id);
  }
  function moveArrasto(e: PointerEvent) {
    const a = arrasto.current; if (!a) return;
    const dx = e.clientX - a.x0, dy = e.clientY - a.y0;
    if (!a.ativo && dy < -12 && Math.abs(dy) > Math.abs(dx)) {
      a.ativo = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const f = document.createElement("img"); f.className = "fantasma";
      f.src = (e.currentTarget as HTMLElement).querySelector("img")?.src ?? ""; document.body.appendChild(f); a.fant = f;
    }
    if (a.ativo && a.fant) { a.fant.style.left = e.clientX + "px"; a.fant.style.top = e.clientY + "px"; }
  }
  function fimArrasto(e: PointerEvent) {
    const a = arrasto.current; arrasto.current = null; if (!a) return;
    a.fant?.remove();
    if (!a.ativo) return adicionar(a.it);
    const r = caixa.current?.getBoundingClientRect();
    if (r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom)
      adicionar(a.it, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  }

  /* ---- selected piece actions ---- */
  const idx = pecas.findIndex((p) => p.k === sel);
  const frente = () => { if (idx < 0) return; const n = [...pecas]; const [p] = n.splice(idx, 1); n.push(p); mudar(n); };
  const tras = () => { if (idx < 0) return; const n = [...pecas]; const [p] = n.splice(idx, 1); n.unshift(p); mudar(n); };
  const remover = () => { if (idx < 0) return; mudar(pecas.filter((p) => p.k !== sel)); setSel(null); };

  /* ---- save: model + rendered image (~600 px on a soft background) ---- */
  async function salvar() {
    if (!k.current || !pecas.length || salvando) return;
    setSalvando(true);
    const { stage, tr, layer, W, H } = k.current;
    tr.nodes([]); layer.draw();
    const lado = 600 / W;
    const cena = stage.toCanvas({ pixelRatio: lado });
    const c = document.createElement("canvas"); c.width = cena.width; c.height = cena.height;
    const g = c.getContext("2d")!; g.fillStyle = COR_FUNDO; g.fillRect(0, 0, c.width, c.height); g.drawImage(cena, 0, 0);
    const [blob, miniatura] = await Promise.all([codificar(c, 0.85), codificar(reduzir(c, 240), 0.8)]);
    const look = await salvarLook({ ...inicial, nome: nome.trim() || "Look sem nome", favorito: fav,
      pecas: pecas.map(({ k: _k, ...p }) => p) }, { blob, miniatura, largura: c.width, altura: c.height });
    if (dia) await definirLookDoDia(dia, look.id);
    void H;
    aoFechar();
  }
  function fechar() {
    if (mexeu && !confirm("Sair sem salvar o look?")) return;
    aoFechar();
  }

  return (
    <div class="provador" role="dialog" aria-label="Montar look">
      <div class="pv-topo">
        <button class="btn-icone" aria-label="Fechar" onClick={fechar}>✕</button>
        <input class="pv-nome" value={nome} placeholder="Nome do look" aria-label="Nome do look" onInput={(e) => { setNome((e.target as HTMLInputElement).value); setMexeu(true); }} />
        <button class={`btn-icone ${fav ? "fav-on" : ""}`} aria-label={fav ? "Tirar dos favoritos" : "Favoritar"} aria-pressed={fav} onClick={() => { setFav(!fav); setMexeu(true); }}>{fav ? "★" : "☆"}</button>
        <button class="btn primario" disabled={!pecas.length || salvando} onClick={salvar}>{salvando ? "…" : "Salvar"}</button>
      </div>

      <div class="pv-meio">
        {dia && (
          <aside class={`pv-agenda ${verAgenda ? "" : "fechada"}`}>
            <button class="pv-agenda-tit" onClick={() => setVerAgenda(!verAgenda)} aria-expanded={verAgenda}>
              <b>{dataCurta(dia.data)}</b> · {dia.cidade || "cidade não definida"} <span class="muted">{verAgenda ? "▴" : "▾"}</span>
            </button>
            {verAgenda && (eventos?.length
              ? <ul>{eventos.map((e) => <li><span class="pv-h">{e.horaInicio || "dia"}</span> {e.titulo}</li>)}</ul>
              : <p class="muted pequeno" style="margin:4px 0 0">Nada na agenda.</p>)}
          </aside>)}

        <div class="pv-palco-env">
          <div class="pv-palco" ref={caixa} />
          {!pronto && <div class="pv-carregando"><span class="giro" /></div>}
          {pronto && !pecas.length && <div class="pv-vazio">Toque numa peça abaixo, ou arraste para cá.</div>}
        </div>
      </div>

      <div class="pv-acoes">
        <button class="btn btn-peq" disabled={!hist.length} onClick={desfazer}>↶ Desfazer</button>
        <button class="btn btn-peq" disabled={idx < 0} onClick={frente}>Frente</button>
        <button class="btn btn-peq" disabled={idx < 0} onClick={tras}>Trás</button>
        <button class="btn btn-peq" disabled={idx < 0} onClick={remover}>Remover</button>
      </div>

      <div class="pv-barra">
        {subcats.length > 1 && (
          <div class="pv-filtros">
            <button class={`chip ${!filtro ? "on" : ""}`} onClick={() => setFiltro("")}>Todas</button>
            {subcats.map((s) => <button class={`chip ${filtro === s ? "on" : ""}`} onClick={() => setFiltro(s)}>{s}</button>)}
          </div>)}
        <div class="pv-pecas">
          {naBarra.map((it) => (
            <button class="pv-peca xadrez" title={it.nome} aria-label={`Adicionar ${it.nome}`}
              onPointerDown={(e) => inicioArrasto(e, it)} onPointerMove={moveArrasto} onPointerUp={fimArrasto}
              onPointerCancel={() => { arrasto.current?.fant?.remove(); arrasto.current = null; }}>
              <MiniPeca fotoId={it.fotoId} />
            </button>))}
          {!comFoto.length && <p class="muted pequeno" style="padding:8px">Nenhuma peça com foto ainda. Na aba Mala, abra uma roupa e adicione a foto.</p>}
        </div>
      </div>
    </div>
  );
}

function MiniPeca({ fotoId }: { fotoId: string | null }) {
  const url = useFotoUrl(fotoId, "mini");
  return url ? <img src={url} alt="" draggable={false} /> : null;
}
