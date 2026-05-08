// Raccourcis clavier globaux.
//
// Approche : un seul keydown listener, dispatch sur les combos enregistrés.
// Skip si le focus est sur un input/textarea sauf si allowInInput.

import * as store from "./store.js";
import { toast } from "./ui/kit.js";

const isMac = navigator.platform.toLowerCase().includes("mac");

let _navigate = () => {};
let _getRoute = () => "home";
let _getParams = () => ({});

const bindings = [];

export function initShortcuts({ navigate, getRoute, getParams }) {
  _navigate = navigate;
  _getRoute = getRoute;
  _getParams = getParams;

  // Navigation
  bind("Ctrl+H", () => _navigate("home"));
  bind("Ctrl+O", () => _navigate("shows"));
  bind("Ctrl+L", () => _navigate("library"));
  bind("Ctrl+,", () => _navigate("settings"));

  // Save (rassurant)
  bind("Ctrl+S", () => {
    toast("Tout est déjà enregistré localement.", "success");
  });

  // Nouveau spectacle
  bind("Ctrl+N", () => {
    const sh = store.createShow("Nouveau spectacle");
    toast(`« ${sh.name} » créé.`, "success");
    _navigate("editor", { id: sh.id });
  });

  // Imprimer
  bind("Ctrl+P", () => window.print());

  bind("F5", async () => {
    const id = _getParams()?.id;
    if (!id) { toast("Aucun spectacle ouvert."); return; }
    const sh = store.getShow(id);
    if (!sh) return;
    const m = await import("./views/presentation.js");
    m.openPresentation(sh);
  });

  // Diagnostic
  bind("F8", () => {
    window.dispatchEvent(new CustomEvent("diag", {}));
  });

  // L'éditeur écoutera ses propres events (Ctrl+C, Z, etc.) via custom events
  // → permet de partager le keyboard manager sans coupler.

  window.addEventListener("keydown", onKey);
}

function bind(combo, fn, opts = {}) {
  bindings.push({ combo: parseCombo(combo), fn, allowInInput: opts.allowInInput || false });
}

function parseCombo(combo) {
  const parts = combo.split("+").map((s) => s.trim().toLowerCase());
  const mods = new Set();
  let key = "";
  for (const p of parts) {
    if (p === "ctrl" || p === "cmd" || p === "control" || p === "meta") mods.add("mod");
    else if (p === "shift") mods.add("shift");
    else if (p === "alt" || p === "option") mods.add("alt");
    else key = p;
  }
  return { mods, key };
}

function eventMods(e) {
  const m = new Set();
  if (isMac ? e.metaKey : e.ctrlKey) m.add("mod");
  if (e.shiftKey) m.add("shift");
  if (e.altKey) m.add("alt");
  return m;
}

function isInputFocused() {
  const t = document.activeElement;
  if (!t) return false;
  const tag = t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (t.isContentEditable) return true;
  return false;
}

function onKey(e) {
  const evMods = eventMods(e);
  const evKey = (e.key || "").toLowerCase();
  for (const b of bindings) {
    if (evKey !== b.combo.key) continue;
    if (evMods.size !== b.combo.mods.size) continue;
    let allMatch = true;
    for (const m of b.combo.mods) if (!evMods.has(m)) { allMatch = false; break; }
    if (!allMatch) continue;
    if (isInputFocused() && !b.allowInInput) continue;
    e.preventDefault();
    try { b.fn(e); } catch (err) { console.error(err); }
    return;
  }
}

// On expose une fonction publique pour permettre aux vues d'enregistrer
// leurs propres bindings contextuels (l'éditeur p. ex.).
export function registerBinding(combo, fn, opts = {}) {
  bindings.push({ combo: parseCombo(combo), fn, allowInInput: opts.allowInInput || false });
  // Renvoie un disposer
  const last = bindings[bindings.length - 1];
  return () => {
    const i = bindings.indexOf(last);
    if (i >= 0) bindings.splice(i, 1);
  };
}

export function listBindings() {
  return bindings.slice();
}
