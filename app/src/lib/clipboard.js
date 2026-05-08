// Clipboard interne pour copier/coller des éléments structurés
// (cues principalement, mais aussi des effets ou des fragments).
//
// On évite le clipboard système (navigator.clipboard) car :
//  - permissions différentes selon le contexte (NW.js / file://)
//  - les cues sont des objets internes, le clipboard système attend du texte
//  - un clipboard interne est plus prévisible
//
// Format : { kind: "cues" | "effect" | ..., payload, ts }

let entry = null;
const listeners = new Set();

function notify() {
  for (const fn of listeners) {
    try { fn(entry); } catch { /* ignore */ }
  }
}

export function set(kind, payload) {
  entry = {
    kind,
    payload: structuredClone(payload),
    ts: Date.now(),
  };
  notify();
  return entry;
}

export function get() {
  return entry ? structuredClone(entry) : null;
}

export function getKind() {
  return entry ? entry.kind : null;
}

export function isEmpty() {
  return entry === null;
}

export function clear() {
  entry = null;
  notify();
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
