// PrevoFX — bootstrap : topbar, routeur, raccourcis clavier.

import { installShield, getStats, onChange } from "./lib/network-shield.js";
import * as kbd from "./lib/keyboard.js";
import * as clipboard from "./lib/clipboard.js";
import { history } from "./lib/history.js";
import { state, saveState, createShow, addCue, findEffect } from "./lib/state.js";
import { toast } from "./lib/dom.js";
import { t } from "./lib/i18n.js";

import { renderHome } from "./views/home.js";
import { renderShows } from "./views/shows.js";
import { renderEditor, getCurrentEditor, clearCurrentEditor } from "./views/editor.js";
import { renderLibrary } from "./views/library.js";
import { renderViewer } from "./views/viewer.js";
import { renderOrders } from "./views/orders.js";
import { renderSettings } from "./views/settings.js";
import { renderGpuLab } from "./views/gpu-lab.js";
import { setupTopbar, buildTopbar } from "./views/topbar.js";
import { openPerfDialog } from "./views/perf-dialog.js";
import { openPresentation } from "./views/presentation.js";
import { getShow } from "./lib/state.js";

// Active le bouclier réseau le plus tôt possible.
installShield();
kbd.init();

const NAV = [
  { route: "home",     label: t("view.home"),     icon: "⌂" },
  { route: "shows",    label: t("view.shows"),    icon: "✦" },
  { route: "library",  label: t("view.library"),  icon: "⌗" },
  { route: "viewer",   label: t("view.viewer"),   icon: "▶" },
  { route: "orders",   label: t("view.orders"),   icon: "⛬" },
  { route: "gpulab",   label: "GPU Lab",          icon: "⚛" },
];

const FOOTER_NAV = [
  { route: "settings", label: t("view.settings"), icon: "⚙" },
];

const ROUTES = {
  home: renderHome,
  shows: renderShows,
  editor: renderEditor,
  library: renderLibrary,
  viewer: renderViewer,
  orders: renderOrders,
  settings: renderSettings,
  gpulab: renderGpuLab,
};

// Raccourcis globaux : F8 diagnostic, F5 présentation
window.addEventListener("keydown", (e) => {
  if (e.key === "F8") { e.preventDefault(); openPerfDialog(); }
  if (e.key === "F5") {
    e.preventDefault();
    const id = currentParams?.id || (state.shows[0] && state.shows[0].id);
    if (!id) { toast("Aucun spectacle à présenter."); return; }
    const sh = getShow(id);
    if (sh) openPresentation(sh);
  }
});

const main = document.getElementById("main");
const topbarRoot = document.getElementById("topbar");
const navContainer = document.getElementById("nav");
const navFooter = document.getElementById("nav-footer");

let currentRoute = "home";
let currentParams = {};

setupTopbar({
  getCurrentShowId: () => currentParams?.id || null,
  navigate,
  onUndoRedoCallback: () => {
    if (currentRoute === "editor") {
      const ed = getCurrentEditor();
      if (ed) ed.refresh();
    } else {
      navigate(currentRoute, currentParams);
    }
  },
});
topbarRoot.appendChild(buildTopbar());

function buildShieldIndicator() {
  const root = document.createElement("div");
  root.className = "shield-indicator";
  root.title = "Mode hors-ligne — toutes les requêtes vers les serveurs distants sont bloquées.";
  const dot = document.createElement("span");
  dot.className = "shield-dot";
  const label = document.createElement("span");
  label.className = "shield-label";
  const count = document.createElement("span");
  count.className = "shield-count";
  root.append(dot, label, count);
  root.addEventListener("click", () => navigate("settings"));

  const update = (s) => {
    label.textContent = s.enabled ? "Hors-ligne" : "Réseau libre";
    count.textContent = s.blocked > 0 ? ` · ${s.blocked} bloquée${s.blocked > 1 ? "s" : ""}` : "";
    root.classList.toggle("shield-active", s.enabled);
  };
  update(getStats());
  onChange(update);
  return root;
}

function buildNav(items, container) {
  for (const item of items) {
    const btn = document.createElement("button");
    btn.className = "nav-item";
    btn.dataset.route = item.route;
    btn.innerHTML = `<span class="nav-icon" aria-hidden="true">${item.icon}</span><span>${item.label}</span>`;
    btn.addEventListener("click", () => navigate(item.route));
    container.appendChild(btn);
  }
}
buildNav(NAV, navContainer);
buildNav(FOOTER_NAV, navFooter);
navFooter.appendChild(buildShieldIndicator());

export function navigate(route, params = {}) {
  if (!ROUTES[route]) route = "home";
  // Cleanup éditeur quand on le quitte (référence stale au show)
  if (currentRoute === "editor" && route !== "editor") {
    try { clearCurrentEditor(); } catch {}
  }
  currentRoute = route;
  currentParams = params;

  const navHighlight = route === "editor" ? "shows" : route;
  document.querySelectorAll(".nav-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.route === navHighlight);
  });

  main.innerHTML = "";
  try {
    ROUTES[route](main, navigate, params);
  } catch (e) {
    console.error("[router] erreur de rendu :", e);
    main.innerHTML = "";
    main.appendChild(buildCrashPanel(e, () => navigate("home")));
    return;
  }
  main.scrollTop = 0;
}

function buildCrashPanel(err, onHome) {
  const panel = document.createElement("div");
  panel.className = "empty";
  panel.innerHTML = `
    <div class="empty-icon">⚠</div>
    <h2 class="empty-title">Une erreur est survenue</h2>
    <p class="empty-desc">La vue n'a pas pu s'afficher. Vos données sont saines, vous pouvez revenir à l'accueil.</p>
    <pre style="font-size:11px;color:#999;background:#0a0d18;padding:10px;border-radius:4px;max-width:600px;overflow:auto;text-align:left;">${escapeHtml(err && (err.stack || err.message) || String(err))}</pre>
  `;
  const btn = document.createElement("button");
  btn.className = "btn btn-primary";
  btn.textContent = "← Retour à l'accueil";
  btn.addEventListener("click", onHome);
  panel.appendChild(btn);
  return panel;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Toaster les events de quota saturé que state.js dispatch
window.addEventListener("prevofx:toast", (ev) => toast(ev.detail || ""));

// ---- Raccourcis clavier globaux ----

kbd.bind("Ctrl+N", () => {
  const sh = createShow("Nouveau spectacle");
  toast(`Spectacle « ${sh.name} » créé.`);
  navigate("editor", { id: sh.id });
}, { label: t("file.new") });

kbd.bind("Ctrl+S", () => {
  saveState();
  toast("Enregistré.");
}, { label: t("file.save") });

kbd.bind("Ctrl+O", () => navigate("shows"),
  { label: t("file.open") });

kbd.bind("Ctrl+P", () => window.print(),
  { label: t("file.print") });

kbd.bind("Ctrl+,", () => navigate("settings"),
  { label: t("view.settings") });

kbd.bind("Ctrl+L", () => navigate("library"),
  { label: t("view.library") });

kbd.bind("Ctrl+H", () => navigate("home"),
  { label: t("view.home") });

kbd.bind("Ctrl+Z", () => {
  const snap = history.undo();
  if (snap) {
    state.shows = snap;
    saveState();
    toast("Annulation.");
    if (currentRoute === "editor") {
      const ed = getCurrentEditor();
      if (ed) ed.refresh();
    }
  }
}, { label: t("edit.undo") });

kbd.bind("Ctrl+Shift+Z", () => {
  const snap = history.redo();
  if (snap) {
    state.shows = snap;
    saveState();
    toast("Rétablissement.");
    if (currentRoute === "editor") {
      const ed = getCurrentEditor();
      if (ed) ed.refresh();
    }
  }
}, { label: t("edit.redo") });

kbd.bind("Ctrl+Y", () => {
  const snap = history.redo();
  if (snap) {
    state.shows = snap;
    saveState();
    if (currentRoute === "editor") {
      const ed = getCurrentEditor();
      if (ed) ed.refresh();
    }
  }
}, { label: t("edit.redo") });

kbd.bind("Delete", () => {
  if (currentRoute !== "editor") return;
  const ed = getCurrentEditor();
  if (!ed) return;
  const ids = ed.selection.list();
  if (!ids.length) return;
  ed.snapshotBefore("Suppression sélection");
  for (const id of ids) {
    const i = ed.show.cues.findIndex((c) => c.id === id);
    if (i >= 0) ed.show.cues.splice(i, 1);
  }
  saveState();
  ed.selection.clear();
  ed.refresh();
  toast(`${ids.length} cue(s) supprimé(s).`);
}, { label: t("edit.delete") });

kbd.bind("Ctrl+A", () => {
  if (currentRoute !== "editor") return;
  const ed = getCurrentEditor();
  if (!ed) return;
  ed.selection.set(ed.show.cues.map((c) => c.id));
}, { label: t("edit.selectAll") });

kbd.bind("Escape", () => {
  if (currentRoute !== "editor") return;
  const ed = getCurrentEditor();
  if (!ed) return;
  ed.selection.clear();
}, { label: t("edit.deselect") });

// ---- Copier / Couper / Coller / Dupliquer (sur l'éditeur) ----

function copySelectedCues({ remove }) {
  if (currentRoute !== "editor") return false;
  const ed = getCurrentEditor();
  if (!ed) return false;
  const ids = ed.selection.list();
  if (!ids.length) return false;
  const cues = ed.show.cues
    .filter((c) => ids.includes(c.id))
    .map((c) => ({ effectId: c.effectId, time: c.time, quantity: c.quantity }));
  // On stocke les cues triés par temps avec le minimum de temps comme origine,
  // pour que le coller préserve les écarts relatifs.
  const minT = Math.min(...cues.map((c) => c.time));
  clipboard.set("cues", { cues, originTime: minT });

  if (remove) {
    ed.snapshotBefore("Couper");
    for (const id of ids) {
      const i = ed.show.cues.findIndex((c) => c.id === id);
      if (i >= 0) ed.show.cues.splice(i, 1);
    }
    saveState();
    ed.selection.clear();
    ed.refresh();
  }
  toast(`${cues.length} cue(s) ${remove ? "coupé(s)" : "copié(s)"}.`);
  return true;
}

function pasteCues() {
  if (currentRoute !== "editor") return;
  const ed = getCurrentEditor();
  if (!ed) return;
  const data = clipboard.get();
  if (!data || data.kind !== "cues") {
    toast("Presse-papier vide.");
    return;
  }
  const cues = data.payload.cues;
  if (!cues.length) return;

  // Position cible : au playhead ou après le dernier cue sélectionné
  const sel = ed.selection.list()
    .map((id) => ed.show.cues.find((c) => c.id === id))
    .filter(Boolean);
  let target;
  if (sel.length) {
    target = Math.max(...sel.map((c) => c.time)) + 0.5;
  } else {
    target = data.payload.originTime + 1;
  }
  const offset = target - data.payload.originTime;

  ed.snapshotBefore("Coller");
  const newIds = [];
  for (const c of cues) {
    const eff = findEffect(c.effectId);
    if (!eff) continue;
    const t = Math.max(0, Math.min(ed.show.duration, c.time + offset));
    const cue = addCue(ed.showId, c.effectId, Math.round(t * 10) / 10, c.quantity);
    newIds.push(cue.id);
  }
  ed.selection.set(newIds);
  ed.refresh();
  toast(`${newIds.length} cue(s) collé(s).`);
}

function duplicateSelected() {
  if (currentRoute !== "editor") return;
  const ed = getCurrentEditor();
  if (!ed) return;
  const ids = ed.selection.list();
  if (!ids.length) return;
  ed.snapshotBefore("Dupliquer");
  const newIds = [];
  for (const id of ids) {
    const c = ed.show.cues.find((x) => x.id === id);
    if (!c) continue;
    const t = Math.min(ed.show.duration, c.time + 1);
    const cue = addCue(ed.showId, c.effectId, Math.round(t * 10) / 10, c.quantity);
    newIds.push(cue.id);
  }
  ed.selection.set(newIds);
  ed.refresh();
  toast(`${newIds.length} cue(s) dupliqué(s).`);
}

kbd.bind("Ctrl+C", () => copySelectedCues({ remove: false }),
  { label: t("edit.copy") });

kbd.bind("Ctrl+X", () => copySelectedCues({ remove: true }),
  { label: t("edit.cut") });

kbd.bind("Ctrl+V", () => pasteCues(),
  { label: t("edit.paste") });

kbd.bind("Ctrl+D", () => duplicateSelected(),
  { label: t("edit.duplicate") });

// Premier rendu
navigate("home");
