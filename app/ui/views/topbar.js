// Topbar avec menus drop-down style application bureau classique.
// Fichier · Édition · Affichage · Effet · Outils · Aide

import { el, toast, confirmDialog, downloadFile, modal } from "../lib/dom.js";
import { openMenu } from "../lib/menu.js";
import { t } from "../lib/i18n.js";
import { state, saveState, resetState, createShow } from "../lib/state.js";
import { history } from "../lib/history.js";
import { listBindings } from "../lib/keyboard.js";
import { parseKml } from "../lib/kml.js";
import { setShowLocation } from "../lib/state.js";
import { printShootSheet, printOrderSheet } from "./order-print.js";
import { openPerfDialog } from "./perf-dialog.js";

let currentShowIdGetter = () => null;
let currentNavigate = () => {};
let onUndoRedo = () => {};

export function setupTopbar({ getCurrentShowId, navigate, onUndoRedoCallback }) {
  currentShowIdGetter = getCurrentShowId;
  currentNavigate = navigate;
  onUndoRedo = onUndoRedoCallback || (() => {});
}

export function buildTopbar() {
  const bar = el("header", { class: "topbar" });
  bar.appendChild(el("div", { class: "topbar-brand" },
    el("span", { class: "brand-mark" }),
    el("span", { class: "topbar-title" }, "PrevoFX")));

  const menus = el("nav", { class: "topbar-menus" });
  const items = [
    { key: "file",   label: t("menu.file"),   build: fileMenu },
    { key: "edit",   label: t("menu.edit"),   build: editMenu },
    { key: "view",   label: t("menu.view"),   build: viewMenu },
    { key: "effect", label: t("menu.effect"), build: effectMenu },
    { key: "tools",  label: t("menu.tools"),  build: toolsMenu },
    { key: "help",   label: t("menu.help"),   build: helpMenu },
  ];
  for (const m of items) {
    const btn = el("button", {
      class: "topbar-menu",
      onClick: () => openMenu(btn, m.build()),
    }, m.label);
    menus.appendChild(btn);
  }
  bar.appendChild(menus);

  // Right-side : history hint + status
  const right = el("div", { class: "topbar-right" });
  const undoBtn = el("button", {
    class: "topbar-iconbtn",
    title: `${t("edit.undo")} (Ctrl+Z)`,
    onClick: () => doUndo(),
  }, "↶");
  const redoBtn = el("button", {
    class: "topbar-iconbtn",
    title: `${t("edit.redo")} (Ctrl+Shift+Z)`,
    onClick: () => doRedo(),
  }, "↷");
  const refreshHistoryButtons = () => {
    undoBtn.disabled = !history.canUndo();
    redoBtn.disabled = !history.canRedo();
  };
  history.onChange(refreshHistoryButtons);
  refreshHistoryButtons();
  right.appendChild(undoBtn);
  right.appendChild(redoBtn);
  bar.appendChild(right);

  return bar;
}

// ---- Fichier ----
function fileMenu() {
  const items = [
    { label: t("file.new"), shortcut: "Ctrl+N", action: doNewShow },
    { label: t("file.open"), shortcut: "Ctrl+O", action: () => currentNavigate("shows") },
    { separator: true },
    { label: t("file.save"), shortcut: "Ctrl+S", action: () => { saveState(); toast("Enregistré."); } },
    { separator: true },
    {
      label: t("file.import"),
      submenu: [
        { label: t("file.importKml"), action: doImportKml },
        { label: t("file.importJson"), action: doImportJson },
      ],
    },
    {
      label: t("file.export"),
      submenu: [
        { label: t("file.exportJson"), action: doExportJson },
        { label: t("file.exportCsv"), action: () => currentNavigate("orders") },
        { separator: true },
        {
          label: "Bon de tir (PDF)",
          disabled: !currentShowIdGetter(),
          action: () => {
            const id = currentShowIdGetter();
            if (id) printShootSheet(id);
          },
        },
        {
          label: "Bon de commande (PDF)",
          disabled: !currentShowIdGetter(),
          action: () => {
            const id = currentShowIdGetter();
            if (id) printOrderSheet(id);
          },
        },
      ],
    },
    { separator: true },
    { label: t("file.print"), shortcut: "Ctrl+P", action: () => window.print() },
  ];
  if (typeof process !== "undefined" && process.versions && process.versions.nw) {
    items.push({ separator: true });
    items.push({ label: t("file.quit"), shortcut: "Ctrl+Q", action: doQuit });
  }
  return items;
}

// ---- Édition ----
function editMenu() {
  // Les actions Copier/Coller/etc. sont déclenchées par l'événement clavier
  // global (cf. app.js). Depuis le menu, on dispatch un keydown synthétique :
  // c'est plus simple que d'ex-importer toutes les fonctions dans la topbar.
  const dispatch = (combo) => () => {
    const [mods, key] = parseCombo(combo);
    window.dispatchEvent(new KeyboardEvent("keydown", {
      key,
      ctrlKey: mods.has("ctrl"),
      shiftKey: mods.has("shift"),
      altKey: mods.has("alt"),
      bubbles: true,
    }));
  };
  return [
    { label: t("edit.undo"), shortcut: "Ctrl+Z", disabled: !history.canUndo(), action: doUndo },
    { label: t("edit.redo"), shortcut: "Ctrl+Shift+Z", disabled: !history.canRedo(), action: doRedo },
    { separator: true },
    { label: t("edit.cut"),       shortcut: "Ctrl+X", action: dispatch("Ctrl+X") },
    { label: t("edit.copy"),      shortcut: "Ctrl+C", action: dispatch("Ctrl+C") },
    { label: t("edit.paste"),     shortcut: "Ctrl+V", action: dispatch("Ctrl+V") },
    { separator: true },
    { label: t("edit.duplicate"), shortcut: "Ctrl+D", action: dispatch("Ctrl+D") },
    { label: t("edit.delete"),    shortcut: "Suppr",  action: dispatch("Delete") },
    { separator: true },
    { label: t("edit.selectAll"), shortcut: "Ctrl+A", action: dispatch("Ctrl+A") },
  ];
}

function parseCombo(combo) {
  const parts = combo.split("+");
  const mods = new Set();
  let key = "";
  for (const p of parts) {
    const lc = p.toLowerCase();
    if (lc === "ctrl") mods.add("ctrl");
    else if (lc === "shift") mods.add("shift");
    else if (lc === "alt") mods.add("alt");
    else key = p.length === 1 ? p.toLowerCase() : p;
  }
  return [mods, key];
}

// ---- Affichage ----
function viewMenu() {
  return [
    { label: t("view.home"),     action: () => currentNavigate("home") },
    { label: t("view.shows"),    action: () => currentNavigate("shows") },
    { label: t("view.editor"),   action: () => {
        const id = currentShowIdGetter() || (state.shows[0] && state.shows[0].id);
        if (id) currentNavigate("editor", { id });
        else toast("Aucun spectacle ouvert.");
      } },
    { label: t("view.library"),  action: () => currentNavigate("library") },
    { label: t("view.viewer"),   action: () => currentNavigate("viewer") },
    { label: t("view.orders"),   action: () => currentNavigate("orders") },
    { separator: true },
    { label: t("view.settings"), shortcut: "Ctrl+,", action: () => currentNavigate("settings") },
  ];
}

// ---- Effet ----
function effectMenu() {
  return [
    { label: t("effect.add"),
      action: () => {
        const id = currentShowIdGetter();
        if (id) currentNavigate("editor", { id, addEffect: true });
        else toast("Ouvrez un spectacle d'abord.");
      } },
    { label: t("effect.library"), action: () => currentNavigate("library") },
    { separator: true },
    { label: t("effect.createCustom"), action: () => currentNavigate("library", { newCustom: true }) },
  ];
}

// ---- Outils ----
function toolsMenu() {
  return [
    { label: "Moteur 3D PrevoFX",  action: () => currentNavigate("viewer", { mode: "gl" }) },
    { label: t("tools.simulator"), action: () => currentNavigate("viewer", { mode: "sim" }) },
    { label: t("tools.finale3d"),  action: () => currentNavigate("viewer", { mode: "finale3d" }) },
    { separator: true },
    { label: "GPU Lab",            action: () => currentNavigate("gpulab") },
    { label: t("tools.diagnostics"), shortcut: "F8", action: () => openPerfDialog() },
    { separator: true },
    { label: t("tools.networkShield"), action: () => currentNavigate("settings") },
  ];
}

// ---- Aide ----
function helpMenu() {
  return [
    { label: t("help.shortcuts"), action: doShowShortcuts },
    { label: t("help.about"),     action: doShowAbout },
  ];
}

// ---- Actions -----------------------------------------------------------

function doNewShow() {
  const sh = createShow("Nouveau spectacle");
  toast(`Spectacle « ${sh.name} » créé.`);
  currentNavigate("editor", { id: sh.id });
}

function doUndo() {
  const snap = history.undo();
  if (snap) {
    state.shows = snap;
    saveState();
    toast("Annulation.");
    onUndoRedo();
  }
}

function doRedo() {
  const snap = history.redo();
  if (snap) {
    state.shows = snap;
    saveState();
    toast("Rétablissement.");
    onUndoRedo();
  }
}

function doExportJson() {
  const date = new Date().toISOString().slice(0, 10);
  downloadFile(`prevofx_export_${date}.json`,
    JSON.stringify(state, null, 2), "application/json");
  toast("Export JSON téléchargé.");
}

function doImportJson() {
  const input = el("input", {
    type: "file",
    accept: "application/json",
    style: "display: none;",
    onChange: async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const obj = JSON.parse(await f.text());
        if (!obj || !Array.isArray(obj.shows)) throw new Error("Format invalide");
        const ok = await confirmDialog(
          `Remplacer ${state.shows.length} spectacle(s) par ${obj.shows.length} importé(s) ?`
        );
        if (!ok) return;
        Object.assign(state, obj);
        saveState();
        toast("Import réussi.");
        currentNavigate("home");
      } catch (err) {
        toast("Échec : " + err.message);
      }
    },
  });
  document.body.appendChild(input);
  input.click();
  setTimeout(() => input.remove(), 1000);
}

function doImportKml() {
  const showId = currentShowIdGetter();
  if (!showId) {
    toast("Ouvrez un spectacle pour y importer un KML.");
    return;
  }
  const input = el("input", {
    type: "file",
    accept: ".kml,application/vnd.google-earth.kml+xml,application/xml,text/xml",
    style: "display: none;",
    onChange: async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const data = parseKml(await f.text());
        if (!data.center) throw new Error("Aucune coordonnée valide trouvée.");
        setShowLocation(showId, {
          name: data.name,
          lat: data.center.lat,
          lon: data.center.lon,
        }, data.placemarks);
        toast(`KML importé : ${data.placemarks.length} repère(s) — ${data.name}`);
        currentNavigate("editor", { id: showId });
      } catch (err) {
        toast("KML invalide : " + err.message);
      }
    },
  });
  document.body.appendChild(input);
  input.click();
  setTimeout(() => input.remove(), 1000);
}

function doQuit() {
  try {
    // NW.js
    const nwProc = require("nw.gui");
    nwProc.App.quit();
  } catch (e) {
    window.close();
  }
}

function doShowShortcuts() {
  const list = listBindings();
  modal({
    title: t("help.shortcuts"),
    body: el(
      "table",
      { class: "table" },
      el("tbody", {},
        ...list.map((b) =>
          el("tr", {},
            el("td", { class: "num", style: "width:140px;" },
              el("code", {}, b.combo)),
            el("td", {}, b.label))
        )
      )
    ),
    footer: [],
  });
}

function doShowAbout() {
  modal({
    title: "À propos de PrevoFX",
    body: el(
      "div",
      {},
      el("p", {}, "PrevoFX — application bureau de design pyrotechnique."),
      el("p", { class: "page-subtitle" },
        "Version 0.1.0 · NW.js · Mode hors-ligne strict."),
      el("p", { class: "page-subtitle" },
        "Le moteur Finale 3D d'origine est embarqué pour la prévisu 3D ; toute la couche FR / projets / commandes est de PrevoFX.")
    ),
    footer: [],
  });
}
