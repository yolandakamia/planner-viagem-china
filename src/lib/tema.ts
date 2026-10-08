/* Light / dark theme: "auto" follows the phone, or forced per phone
   (localStorage). The CSS already has both palettes: :root[data-theme="dark"]
   and the prefers-color-scheme block guarded by :not([data-theme="light"]). */
export type Tema = "auto" | "claro" | "escuro";
const CHAVE = "viagem-china:tema";

export function temaAtual(): Tema {
  try { const v = localStorage.getItem(CHAVE); if (v === "claro" || v === "escuro") return v; } catch { /* private mode */ }
  return "auto";
}

export function aplicarTema(t: Tema = temaAtual()) {
  const r = document.documentElement;
  if (t === "auto") delete r.dataset.theme; else r.dataset.theme = t === "escuro" ? "dark" : "light";
  // the phone's status bar follows too
  const escuro = t === "escuro" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", escuro ? "#1c1717" : "#b3261e"));
}

export function mudarTema(t: Tema) {
  try { if (t === "auto") localStorage.removeItem(CHAVE); else localStorage.setItem(CHAVE, t); } catch { /* ignore */ }
  aplicarTema(t);
}
