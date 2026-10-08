import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { t } from "../lib/i18n";

/* Bottom sheet: slides up from the bottom on a phone (thumb reach),
   centred card on a wide screen. Esc or a tap on the backdrop closes. */
export function Folha({ titulo, aoFechar, children, rodape }: {
  titulo: string; aoFechar: () => void; children: ComponentChildren; rodape?: ComponentChildren;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    addEventListener("keydown", k);
    const ov = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { removeEventListener("keydown", k); document.body.style.overflow = ov; };
  }, [aoFechar]);
  return (
    <div class="folha-fundo" onClick={(e) => e.target === e.currentTarget && aoFechar()}>
      <div class="folha" role="dialog" aria-modal="true" aria-label={titulo}>
        <div class="folha-topo">
          <h2>{titulo}</h2>
          <button class="btn-icone" aria-label={t("Fechar")} onClick={aoFechar}>✕</button>
        </div>
        <div class="folha-corpo">{children}</div>
        {rodape && <div class="folha-rodape">{rodape}</div>}
      </div>
    </div>
  );
}
