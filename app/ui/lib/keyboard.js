// Gestionnaire de raccourcis clavier global.
//
// Format des combos : "Mod+Key" où Mod ∈ {Ctrl, Shift, Alt, Meta}.
// Sur macOS, "Ctrl" est mappé sur Cmd (touche Meta) automatiquement.
// Insensible à la casse pour la touche.
//
// Les inputs <input>/<textarea>/<select>/[contenteditable] ne déclenchent
// PAS les raccourcis (sauf si le combo a un Mod et que le shortcut est marqué
// `allowInInput: true`).

const isMac = navigator.platform.toLowerCase().includes("mac");

const bindings = []; // [{ combo, fn, label, allowInInput }]

function normalize(combo) {
  const parts = combo.split("+").map((s) => s.trim());
  const mods = new Set();
  let key = "";
  for (const p of parts) {
    const lc = p.toLowerCase();
    if (lc === "ctrl" || lc === "cmd" || lc === "control" || lc === "meta") {
      mods.add("mod");
    } else if (lc === "shift") mods.add("shift");
    else if (lc === "alt" || lc === "option") mods.add("alt");
    else key = lc;
  }
  return { mods, key };
}

function eventMatches(e, target) {
  const evMods = new Set();
  if (isMac ? e.metaKey : e.ctrlKey) evMods.add("mod");
  if (e.shiftKey) evMods.add("shift");
  if (e.altKey) evMods.add("alt");
  if (evMods.size !== target.mods.size) return false;
  for (const m of target.mods) if (!evMods.has(m)) return false;
  const evKey = (e.key || "").toLowerCase();
  return evKey === target.key;
}

export function bind(combo, fn, opts = {}) {
  const target = normalize(combo);
  const entry = {
    combo,
    target,
    fn,
    label: opts.label || combo,
    allowInInput: opts.allowInInput || false,
  };
  bindings.push(entry);
  return () => {
    const i = bindings.indexOf(entry);
    if (i >= 0) bindings.splice(i, 1);
  };
}

function isInputElement(el) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

export function init() {
  window.addEventListener("keydown", (e) => {
    for (const b of bindings) {
      if (!eventMatches(e, b.target)) continue;
      if (isInputElement(e.target) && !b.allowInInput) continue;
      e.preventDefault();
      try { b.fn(e); } catch (err) { console.error(err); }
      return;
    }
  });
}

export function listBindings() {
  return bindings.map((b) => ({ combo: prettyCombo(b.combo), label: b.label }));
}

function prettyCombo(combo) {
  if (!isMac) return combo;
  return combo.replace(/Ctrl/gi, "⌘").replace(/Alt/gi, "⌥").replace(/Shift/gi, "⇧");
}
