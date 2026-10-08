/* Photo processing, entirely on the device (nothing is uploaded):
   decode → trim empty (transparent) borders → max 800 px → WebP with
   transparency, plus a thumbnail. Background removal is NOT done here:
   photos arrive already cut out (iPhone / Android "copy subject"). */

export const LADO_MAX = 800;
export const LADO_MINI = 240;
const LADO_TRABALHO = 1600;      // decode big photos down to this first (memory on phones)
const ALFA_MIN = 10;             // pixels more transparent than this count as empty

export interface ImagemPronta { blob: Blob; miniatura: Blob; largura: number; altura: number; bytes: number }

async function decodificar(arq: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  try {
    // honours EXIF rotation from phone cameras
    return await createImageBitmap(arq, { imageOrientation: "from-image" } as ImageBitmapOptions);
  } catch {
    const url = URL.createObjectURL(arq);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight });
    } finally { URL.revokeObjectURL(url); }
  }
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return { c, g: c.getContext("2d", { willReadFrequently: true })! };
}

/* bounding box of the non-transparent pixels; null if the image is empty */
function caixaVisivel(g: CanvasRenderingContext2D, w: number, h: number) {
  const d = g.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    const linha = y * w * 4;
    for (let x = 0; x < w; x++) {
      if (d[linha + x * 4 + 3] > ALFA_MIN) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/* WebP when the browser can encode it (Safari only recently can);
   otherwise PNG, which also keeps transparency */
export function codificar(c: HTMLCanvasElement, qualidade: number): Promise<Blob> {
  return new Promise((ok, erro) => c.toBlob((b) => {
    if (b && b.type === "image/webp") return ok(b);
    c.toBlob((p) => (p ? ok(p) : erro(new Error("Não consegui gerar a imagem."))), "image/png");
  }, "image/webp", qualidade));
}

export function reduzir(origem: HTMLCanvasElement, lado: number) {
  const k = Math.min(1, lado / Math.max(origem.width, origem.height));
  const { c, g } = canvas(Math.max(1, Math.round(origem.width * k)), Math.max(1, Math.round(origem.height * k)));
  g.imageSmoothingQuality = "high";
  g.drawImage(origem, 0, 0, c.width, c.height);
  return c;
}

export async function processarImagem(arq: Blob): Promise<ImagemPronta> {
  if (!arq.type.startsWith("image/") && arq.type !== "") throw new Error("Esse arquivo não é uma imagem.");
  const img = await decodificar(arq);
  // 1. find the visible area on a small copy (fast, light on memory)…
  const k = Math.min(1, LADO_TRABALHO / Math.max(img.width, img.height));
  const W = Math.max(1, Math.round(img.width * k)), H = Math.max(1, Math.round(img.height * k));
  const t = canvas(W, H);
  t.g.drawImage(img, 0, 0, W, H);
  const caixa = caixaVisivel(t.g, W, H);
  t.c.width = t.c.height = 0;
  if (!caixa) throw new Error("A imagem está toda transparente.");
  // 2. …then cut it from the ORIGINAL, so trimming never costs resolution
  //    (an opaque photo has no empty border and keeps its frame)
  const margem = Math.max(caixa.w, caixa.h) * 0.02;
  const x0 = Math.max(0, (caixa.x - margem) / k), y0 = Math.max(0, (caixa.y - margem) / k);
  const x1 = Math.min(img.width, (caixa.x + caixa.w + margem) / k), y1 = Math.min(img.height, (caixa.y + caixa.h + margem) / k);
  const s = Math.min(1, LADO_MAX / Math.max(x1 - x0, y1 - y0));
  const final = canvas(Math.max(1, Math.round((x1 - x0) * s)), Math.max(1, Math.round((y1 - y0) * s)));
  final.g.imageSmoothingQuality = "high";
  final.g.drawImage(img, x0, y0, x1 - x0, y1 - y0, 0, 0, final.c.width, final.c.height);
  if ("close" in img && typeof img.close === "function") img.close();
  // 3. thumbnail
  const mini = reduzir(final.c, LADO_MINI);
  const [blob, miniatura] = await Promise.all([codificar(final.c, 0.85), codificar(mini, 0.8)]);
  return { blob, miniatura, largura: final.c.width, altura: final.c.height, bytes: blob.size + miniatura.size };
}

/* "340 KB", "2,4 MB" */
export function tamanho(b: number): string {
  if (b < 1048576) return `${Math.max(b ? 1 : 0, Math.round(b / 1024))} KB`;
  return `${(b / 1048576).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} MB`;
}
