// Prevot FX — wrapper minimal :
//   - Topbar (titre + theme toggle + log button)
//   - Iframe qui charge Finale 3D depuis ../app.nw/htmlui/, avec patches injectés
//   - File logger pour debug

import { log, installGlobalHooks } from "./lib/debug-log.js";
import { renderTopbar } from "./ui/topbar.js";
import { mountPrevotView } from "./views/prevot.js";

const THEME_KEY = "prevofx.theme";

function getTheme() {
  try { return localStorage.getItem(THEME_KEY) || "dark"; }
  catch { return "dark"; }
}

function setTheme(t) {
  document.body.classList.remove("theme-dark", "theme-light");
  document.body.classList.add(t === "light" ? "theme-light" : "theme-dark");
  try { localStorage.setItem(THEME_KEY, t); } catch {}
  log("theme-change", { theme: t });
  // Notifie l'iframe pour qu'elle adapte ses patches
  const frame = document.getElementById("prevot-frame");
  if (frame && frame.contentWindow) {
    try {
      frame.contentWindow.postMessage({ type: "prevofx-theme", theme: t }, "*");
    } catch {}
  }
}

function toggleTheme() {
  const cur = document.body.classList.contains("theme-light") ? "light" : "dark";
  setTheme(cur === "light" ? "dark" : "light");
}

function init() {
  installGlobalHooks();
  setTheme(getTheme());
  renderTopbar({ onToggleTheme: toggleTheme });
  mountPrevotView(document.getElementById("main"));
  log("app-start", { theme: getTheme() });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
