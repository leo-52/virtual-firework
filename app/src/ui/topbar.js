// Topbar : marque + menus drop-down + statut "Enregistré".
//
// Les actions sensibles (undo/redo/copier/coller/etc.) sont câblées via
// shortcuts.js. La topbar est juste un point d'entrée visuel.

import { el, modal, toast, prompt, confirm, pickFile, download } from "./kit.js";
import * as store from "../store.js";
import { loadAudioFile } from "../tools/audio.js";
import { parseKml } from "../tools/kml.js";
import { printShootSheet, printOrderSheet } from "../tools/pdf.js";

let _navigate = () => {};
let _getCurrentShowId = () => null;

export function renderTopbar(root, navigate, getCurrentShowId) {
  _navigate = navigate;
  _getCurrentShowId = getCurrentShowId;
  root.innerHTML = "";

  // Marque
  root.appendChild(el("div", { class: "topbar-brand" },
    el("span", { class: "topbar-brand-mark" }),
    el("span", {}, "PrevoFX")));

  // Menus
  const menus = el("nav", { class: "topbar-menus" });
  const items = [
    ["Fichier",   fileMenu],
    ["Édition",   editMenu],
    ["Affichage", viewMenu],
    ["Outils",    toolsMenu],
    ["Aide",      helpMenu],
  ];
  for (const [label, build] of items) {
    const btn = el("button", {
      class: "topbar-menu",
      onClick: () => openDropdown(btn, build()),
    }, label);
    menus.appendChild(btn);
  }
  root.appendChild(menus);

  // Spacer
  root.appendChild(el("div", { class: "topbar-spacer" }));

  // Indicateur "Enregistré"
  const saveStatus = el("div", {
    class: "topbar-status",
    title: "État local — sauvegardé automatiquement",
  },
    el("span", { class: "topbar-status-dot" }),
    el("span", {}, "Enregistré"));
  root.appendChild(saveStatus);

  window.addEventListener("saved", () => {
    saveStatus.classList.add("pulse");
    setTimeout(() => saveStatus.classList.remove("pulse"), 600);
  });
}

// ---- Drop-down ----

let activeMenu = null;

function closeDropdown() {
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
    window.removeEventListener("mousedown", onDocClick, true);
    window.removeEventListener("keydown", onKey, true);
  }
}

function onDocClick(e) {
  if (activeMenu && !activeMenu.contains(e.target)) closeDropdown();
}

function onKey(e) {
  if (e.key === "Escape") { e.preventDefault(); closeDropdown(); }
}

function openDropdown(anchor, items) {
  closeDropdown();
  const m = el("div", { class: "menu" });
  for (const item of items) {
    if (item.separator) {
      m.appendChild(el("div", { class: "menu-sep" }));
      continue;
    }
    const it = el("div", {
      class: "menu-item" + (item.disabled ? " disabled" : ""),
      onClick: () => {
        if (item.disabled) return;
        closeDropdown();
        try { item.action(); } catch (e) { console.error(e); }
      },
    },
      el("span", { class: "menu-label" }, item.label),
      item.shortcut ? el("span", { class: "menu-shortcut" }, item.shortcut) : null);
    m.appendChild(it);
  }
  const r = anchor.getBoundingClientRect();
  m.style.left = r.left + "px";
  m.style.top = (r.bottom + 2) + "px";
  document.body.appendChild(m);
  activeMenu = m;
  // ajustement débord droit
  const mr = m.getBoundingClientRect();
  if (mr.right > window.innerWidth - 8) {
    m.style.left = (window.innerWidth - mr.width - 8) + "px";
  }
  window.addEventListener("mousedown", onDocClick, true);
  window.addEventListener("keydown", onKey, true);
}

// ---- Actions ----

async function doNew() {
  const name = await prompt("Nom du spectacle", "Nouveau spectacle", { title: "Nouveau spectacle" });
  if (!name) return;
  const sh = store.createShow(name);
  toast(`« ${sh.name} » créé.`, "success");
  _navigate("editor", { id: sh.id });
}

function doSave() {
  // Le store sauve à chaque mutation. Ce bouton force juste un toast
  // pour rassurer l'utilisateur.
  toast("Tout est déjà enregistré localement.", "success");
}

function doExportJson() {
  const date = new Date().toISOString().slice(0, 10);
  download(`prevofx_${date}.json`, store.exportJson(), "application/json");
  toast("Export JSON téléchargé.", "success");
}

async function doImportJson() {
  const f = await pickFile("application/json");
  if (!f) return;
  try {
    const text = await f.text();
    const before = store.getShows().length;
    if (!await confirm(
      `Remplacer ${before} spectacle(s) par les données importées ?`,
      { title: "Importer JSON", okLabel: "Remplacer", danger: true }
    )) return;
    store.importJson(text);
    toast("Import réussi.", "success");
    _navigate("home");
  } catch (e) {
    toast("Échec : " + e.message, "error");
  }
}

function doQuit() {
  try {
    const nw = require("nw.gui");
    nw.App.quit();
  } catch {
    window.close();
  }
}

function doShortcuts() {
  modal({
    title: "Raccourcis clavier",
    body: el("table", { class: "table" },
      el("tbody", {},
        ...[
          ["Ctrl+N", "Nouveau spectacle"],
          ["Ctrl+S", "Forcer un enregistrement (geste rassurant)"],
          ["Ctrl+O", "Aller aux spectacles"],
          ["Ctrl+L", "Bibliothèque"],
          ["Ctrl+H", "Accueil"],
          ["Ctrl+,", "Paramètres"],
          ["Ctrl+Z / Ctrl+Y", "Annuler / Rétablir"],
          ["Ctrl+C / Ctrl+V / Ctrl+X", "Copier / Coller / Couper (cues)"],
          ["Ctrl+D", "Dupliquer la sélection"],
          ["Ctrl+A", "Tout sélectionner"],
          ["Suppr", "Supprimer la sélection"],
          ["Échap", "Désélectionner"],
          ["F5", "Mode présentation plein écran"],
        ].map(([k, l]) =>
          el("tr", {},
            el("td", { style: "width:160px;" }, el("code", {}, k)),
            el("td", {}, l))))),
    footer: [],
  });
}

function doAbout() {
  modal({
    title: "À propos de PrevoFX",
    body: el("div", {},
      el("p", {}, el("strong", {}, "PrevoFX 2.0"), " — application bureau de design pyrotechnique."),
      el("p", { class: "page-subtitle" },
        "Mode hors-ligne strict. Aucune donnée ne quitte votre machine."),
      el("p", { class: "page-subtitle" },
        "NW.js + WebGL2 + WebAudio. ~3 Mo, ~20 modules, code lisible.")),
    footer: [],
  });
}

// ---- Menus ----

function fileMenu() {
  const inNw = typeof process !== "undefined" && process.versions && process.versions.nw;
  const id = _getCurrentShowId();
  const items = [
    { label: "Nouveau spectacle…", shortcut: "Ctrl+N", action: doNew },
    { label: "Voir les spectacles", shortcut: "Ctrl+O", action: () => _navigate("shows") },
    { separator: true },
    { label: "Enregistrer", shortcut: "Ctrl+S", action: doSave },
    { separator: true },
    { label: "Importer KML…", disabled: !id, action: doImportKml },
    { label: "Importer audio (mp3/wav)…", disabled: !id, action: doImportAudio },
    { label: "Importer JSON…", action: doImportJson },
    { separator: true },
    { label: "Exporter JSON", action: doExportJson },
    { label: "Bon de tir (PDF)…", disabled: !id, action: () => id && printShootSheet(id) },
    { label: "Bon de commande (PDF)…", disabled: !id, action: () => id && printOrderSheet(id) },
  ];
  if (inNw) {
    items.push({ separator: true });
    items.push({ label: "Quitter", shortcut: "Ctrl+Q", action: doQuit });
  }
  return items;
}

async function doImportKml() {
  const id = _getCurrentShowIdSafe();
  if (!id) return toast("Ouvrez un spectacle.", "warning");
  const f = await pickFile(".kml,application/vnd.google-earth.kml+xml,application/xml");
  if (!f) return;
  try {
    const data = parseKml(await f.text());
    if (!data.center) throw new Error("Aucune coordonnée valide.");
    store.setShowLocation(id, {
      name: data.name, lat: data.center.lat, lon: data.center.lon,
    }, data.placemarks);
    toast(`KML importé : ${data.placemarks.length} repère(s).`, "success");
    _navigate("editor", { id });
  } catch (e) {
    toast("KML invalide : " + e.message, "error");
  }
}

async function doImportAudio() {
  const id = _getCurrentShowIdSafe();
  if (!id) return toast("Ouvrez un spectacle.", "warning");
  const f = await pickFile("audio/*,.mp3,.wav,.ogg,.flac,.m4a");
  if (!f) return;
  try {
    toast("Décodage audio…", "info");
    const audio = await loadAudioFile(f);
    store.setShowAudio(id, audio);
    toast(`Audio « ${audio.name} » importé.`, "success");
    _navigate("editor", { id });
  } catch (e) {
    toast("Échec : " + e.message, "error");
  }
}

function _getCurrentShowIdSafe() {
  return _getCurrentShowId() || null;
}

function editMenu() {
  // On dispatch les events clavier pour reuse les bindings de shortcuts.js
  const dispatch = (combo) => () => synthKey(combo);
  return [
    { label: "Annuler", shortcut: "Ctrl+Z", action: dispatch("Ctrl+z") },
    { label: "Rétablir", shortcut: "Ctrl+Y", action: dispatch("Ctrl+y") },
    { separator: true },
    { label: "Couper", shortcut: "Ctrl+X", action: dispatch("Ctrl+x") },
    { label: "Copier", shortcut: "Ctrl+C", action: dispatch("Ctrl+c") },
    { label: "Coller", shortcut: "Ctrl+V", action: dispatch("Ctrl+v") },
    { separator: true },
    { label: "Dupliquer", shortcut: "Ctrl+D", action: dispatch("Ctrl+d") },
    { label: "Supprimer", shortcut: "Suppr", action: dispatch("Delete") },
    { label: "Tout sélectionner", shortcut: "Ctrl+A", action: dispatch("Ctrl+a") },
  ];
}

function viewMenu() {
  return [
    { label: "Accueil", shortcut: "Ctrl+H", action: () => _navigate("home") },
    { label: "Spectacles", action: () => _navigate("shows") },
    { label: "Bibliothèque", shortcut: "Ctrl+L", action: () => _navigate("library") },
    { label: "Visualiseur", action: () => _navigate("viewer") },
    { label: "Commandes", action: () => _navigate("orders") },
    { separator: true },
    { label: "Paramètres", shortcut: "Ctrl+,", action: () => _navigate("settings") },
  ];
}

function toolsMenu() {
  const id = _getCurrentShowId();
  return [
    { label: "Visualiseur", action: () => _navigate("viewer") },
    { separator: true },
    { label: "Mode présentation", shortcut: "F5",
      disabled: !id,
      action: () => synthKey("F5") },
  ];
}

function helpMenu() {
  return [
    { label: "Raccourcis clavier", action: doShortcuts },
    { label: "À propos", action: doAbout },
  ];
}

function synthKey(combo) {
  const parts = combo.split("+");
  const ctrl = parts.some((p) => p.toLowerCase() === "ctrl");
  const shift = parts.some((p) => p.toLowerCase() === "shift");
  const alt = parts.some((p) => p.toLowerCase() === "alt");
  const key = parts[parts.length - 1];
  window.dispatchEvent(new KeyboardEvent("keydown", {
    key, ctrlKey: ctrl, shiftKey: shift, altKey: alt, bubbles: true,
  }));
}
