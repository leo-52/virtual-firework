// Vue "Prevot FX original" — pixel-perfect via iframe + patches.
//
// Charge l'app Prevot FX d'origine (app.nw/htmlui/index.html) dans
// une iframe avec patches au runtime pour neutraliser le réseau,
// l'authentification, l'inventaire et forcer la langue française.

import { el, toast } from "../ui/kit.js";
import { buildPatchedHtml, injectPatchesAtLoad } from "../lib/prevot-patches.js";
import { onLeave } from "../main.js";

const ORIGINAL_HTML = "../app.nw/htmlui/index.html";

export function renderPrevot(root, navigate) {
  const wrap = el("div", {
    style: "display: grid; grid-template-rows: auto 1fr; height: 100%;",
  });

  // Bandeau supérieur (juste pour expliquer)
  const bar = el("div", {
    style: "padding: 8px 16px; background: var(--bg-elev); border-bottom: 1px solid var(--border); display: flex; gap: 12px; align-items: center;",
  });
  bar.appendChild(el("strong", {}, "Prevot FX (original) — pixel-perfect"));
  bar.appendChild(el("span", {
    style: "font-size: 11px; color: var(--text-soft);",
  }, "Mode hors-ligne strict · login/cloud/inventaire neutralisés au runtime"));
  bar.appendChild(el("div", { style: "flex: 1;" }));

  const reloadBtn = el("button", {
    class: "btn btn-ghost",
    onClick: () => mount(),
  }, "↻ Recharger");
  bar.appendChild(reloadBtn);

  const stage = el("div", { style: "background: #000; min-height: 0;" });
  let currentBlobUrl = null;
  let currentIframe = null;

  wrap.append(bar, stage);
  root.appendChild(wrap);

  async function mount() {
    // Cleanup précédent
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
      currentBlobUrl = null;
    }
    stage.innerHTML = "";

    let iframe;
    try {
      // Construit le HTML patché (contient les patches inline avant le bundle)
      const patched = await buildPatchedHtml(ORIGINAL_HTML);
      const blob = new Blob([patched], { type: "text/html" });
      currentBlobUrl = URL.createObjectURL(blob);

      iframe = el("iframe", {
        src: currentBlobUrl,
        style: "width: 100%; height: 100%; border: 0; display: block; background: #000;",
        allow: "fullscreen",
      });

      // Filet : injection redondante au load au cas où le HTML patché ne
      // s'exécute pas (par exemple si fetch échoue).
      iframe.addEventListener("load", () => {
        injectPatchesAtLoad(iframe);
      });
    } catch (e) {
      // Fallback : iframe direct sur le HTML original + injection au load
      console.warn("[prevot] buildPatchedHtml failed, fallback simple iframe", e);
      iframe = el("iframe", {
        src: ORIGINAL_HTML,
        style: "width: 100%; height: 100%; border: 0; display: block; background: #000;",
        allow: "fullscreen",
      });
      iframe.addEventListener("load", () => {
        injectPatchesAtLoad(iframe);
      });
      toast("Mode fallback (chargement direct, patches au load).", "warning");
    }
    currentIframe = iframe;
    stage.appendChild(iframe);
  }

  mount();

  onLeave(() => {
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
      currentBlobUrl = null;
    }
    currentIframe = null;
  });
}
