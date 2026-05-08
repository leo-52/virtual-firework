// PrevoFX V2 — point d'entrée.
//
// Architecture simple :
//   - Sidebar fixe, topbar fixe, main qui change selon la route.
//   - Pas de state global de routing : currentRoute est local à ce fichier.
//   - Chaque vue est une fonction (root, navigate, params) qui rend son contenu.
//   - Plus de bus d'événements complexe : juste les events DOM standards
//     (toast, saved) attrapés ici.

import { renderTopbar } from "./ui/topbar.js";
import { renderSidebar, NAV } from "./ui/sidebar.js";
import { toast } from "./ui/kit.js";
import { initShortcuts } from "./shortcuts.js";
import { log, installGlobalHooks } from "./lib/debug-log.js";

import { renderHome } from "./views/home.js";
import { renderShows } from "./views/shows.js";
import { renderEditor } from "./views/editor.js";
import { renderLibrary } from "./views/library.js";
import { renderViewer } from "./views/viewer.js";
import { renderOrders } from "./views/orders.js";
import { renderSettings } from "./views/settings.js";
import { renderPrevot } from "./views/prevot.js";

const ROUTES = {
  home:     renderHome,
  shows:    renderShows,
  editor:   renderEditor,
  library:  renderLibrary,
  viewer:   renderViewer,
  orders:   renderOrders,
  settings: renderSettings,
  prevot:   renderPrevot,
};

const main = document.getElementById("main");
const topbar = document.getElementById("topbar");
const sidebar = document.getElementById("sidebar");

let currentRoute = "home";
let currentParams = {};

// Lifecycle simple : chaque vue peut enregistrer un onLeave() qui est
// appelé avant le démontage. Permet de libérer les ressources (Renderer
// WebGL2, AudioContext, RAF, listeners, etc.) sans coupler les vues.
let pendingCleanup = null;

export function onLeave(fn) {
  pendingCleanup = fn;
}

export function navigate(route, params = {}) {
  if (!ROUTES[route]) route = "home";
  log("nav", { route, params, from: currentRoute });

  // Cleanup de la vue précédente
  if (pendingCleanup) {
    try { pendingCleanup(); } catch (e) {
      console.warn("[router] onLeave error", e);
      log("error", { phase: "onLeave", message: String(e.message || e) });
    }
    pendingCleanup = null;
  }

  currentRoute = route;
  currentParams = params;

  // Highlight nav (route éditeur retombe sur "shows")
  const highlight = route === "editor" ? "shows" : route;
  for (const item of sidebar.querySelectorAll(".nav-item")) {
    item.classList.toggle("active", item.dataset.route === highlight);
  }

  main.innerHTML = "";
  try {
    ROUTES[route](main, navigate, params);
  } catch (e) {
    console.error("[router]", e);
    log("error", { phase: "render", route, message: String(e.message || e), stack: e.stack });
    main.innerHTML = "";
    main.appendChild(buildCrashPanel(e));
  }
  main.scrollTop = 0;
}

function buildCrashPanel(err) {
  const div = document.createElement("div");
  div.className = "empty";
  div.innerHTML = `
    <div class="empty-icon">⚠</div>
    <h2 class="empty-title">Une erreur est survenue</h2>
    <p class="empty-desc">La vue n'a pas pu s'afficher. Vos données sont saines.</p>
    <pre style="font-size:11px;color:#999;background:#0a0d18;padding:10px;border-radius:4px;max-width:600px;overflow:auto;text-align:left;">${escapeHtml(err && (err.stack || err.message) || String(err))}</pre>
    <button class="btn btn-primary" onclick="location.reload()">Recharger</button>
  `;
  return div;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---- Bootstrap ----

renderSidebar(sidebar, navigate);
renderTopbar(topbar, navigate, () => currentParams.id);
initShortcuts({
  navigate,
  getRoute: () => currentRoute,
  getParams: () => currentParams,
});

// Bus minimal : event 'toast' -> kit.toast()
window.addEventListener("toast", (e) => {
  const d = e.detail || {};
  toast(d.msg || "", d.kind || "info");
});

// Hooks de debug : capture errors / rejections / console.error
installGlobalHooks();

// Premier rendu
navigate("home");
