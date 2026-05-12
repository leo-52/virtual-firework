// Vue Prevot : charge ../app.nw/htmlui/index.html dans une iframe
// avec ses chemins absolus réécrits, puis injecte CSS et JS patches.

import { log } from "../lib/debug-log.js";
import { buildPatchCss, applyPatches } from "../lib/prevot-patches.js";

const HTMLUI_REL = "../app.nw/htmlui/";

async function buildPatchedHtml() {
  const baseAbs = new URL(HTMLUI_REL, location.href).href;
  const res = await fetch(baseAbs + "index.html");
  if (!res.ok) throw new Error("fetch index.html: " + res.status);
  let html = await res.text();

  // Réécrit les chemins absolus (/index-xxx.js, /favicon.ico, etc.) vers
  // l'URL absolue du dossier htmlui.
  html = html.replace(/((?:src|href)=")\/([^"]+)"/g, (m, attr, p) => attr + baseAbs + p + '"');

  // Force une <base> pour les fetch dynamiques (wasm, json, etc.)
  html = html.replace(/<head>/i, '<head>\n<base href="' + baseAbs + '">');

  return html;
}

export async function mountPrevotView(container) {
  container.innerHTML = '<div class="loading-msg">Chargement de Prevot FX…</div>';

  let html;
  try {
    html = await buildPatchedHtml();
    log("prevot-html-built", { length: html.length });
  } catch (e) {
    container.innerHTML = '<div class="loading-msg">Erreur chargement : ' + e.message + '</div>';
    log("prevot-build-error", { message: e.message, stack: e.stack });
    return;
  }

  const blob = new Blob([html], { type: "text/html" });
  const blobUrl = URL.createObjectURL(blob);

  const iframe = document.createElement("iframe");
  iframe.id = "prevot-frame";
  iframe.setAttribute("nwfaketop", "");
  iframe.src = blobUrl;

  iframe.addEventListener("load", () => {
    log("prevot-iframe-load", { src: iframe.src });
    try {
      injectPatches(iframe);
    } catch (e) {
      log("prevot-patch-error", { message: e.message, stack: e.stack });
    }
  });

  iframe.addEventListener("error", (e) => {
    log("prevot-iframe-error", { message: String(e.message || e) });
  });

  container.innerHTML = "";
  container.appendChild(iframe);
}

function injectPatches(iframe) {
  const doc = iframe.contentDocument;
  if (!doc) {
    log("prevot-no-contentDocument", {});
    return;
  }

  // CSS : thème + masquage
  const style = doc.createElement("style");
  style.id = "prevofx-patches";
  style.textContent = buildPatchCss();
  doc.head.appendChild(style);

  // Synchronise le thème courant avec l'iframe
  const curTheme = document.body.classList.contains("theme-light") ? "light" : "dark";
  doc.documentElement.setAttribute("data-prevofx-theme", curTheme);

  // Écoute les changements de thème
  iframe.contentWindow.addEventListener("message", (ev) => {
    if (ev.data && ev.data.type === "prevofx-theme") {
      doc.documentElement.setAttribute("data-prevofx-theme", ev.data.theme);
      log("prevot-theme-applied", { theme: ev.data.theme });
    }
  });

  // Patches DOM (rebranding texte + observer pour les nouveaux nœuds)
  applyPatches(doc);

  // Capture les erreurs internes de l'iframe
  iframe.contentWindow.addEventListener("error", (e) => {
    log("prevot-inner-error", {
      message: String(e.message || ""),
      filename: e.filename,
      line: e.lineno,
      col: e.colno,
    });
  });
  iframe.contentWindow.addEventListener("unhandledrejection", (e) => {
    log("prevot-inner-rejection", {
      reason: String(e.reason && (e.reason.message || e.reason) || ""),
    });
  });

  log("prevot-patches-applied", {});
}
