// Historique undo/redo générique. On capture des snapshots JSON sérialisables
// d'un sous-ensemble de l'état (les spectacles), et on rejoue.
//
// Stratégie : snapshot complet plutôt que reverse-deltas.
// - simple à implémenter et à raisonner
// - peu coûteux : un spectacle moyen pèse < 10 Ko en JSON
// - on plafonne à 50 snapshots pour limiter la mémoire
// - les payloads audio (dataUrl base64, peut peser plusieurs Mo) sont
//   exclus des snapshots — l'undo conserve le show.audio courant en
//   mémoire et le réinjecte au restore (cf. fonctions slim/restore).

const MAX = 50;
const audioCache = new Map();   // showId → audio (préservé hors snapshots)

class HistoryStack {
  constructor() {
    this.stack = []; // [{ snapshot, label, ts }]
    this.index = -1;
    this.listeners = new Set();
  }

  push(snapshot, label = "Modification") {
    // Tronque toute redo-history en avant
    this.stack = this.stack.slice(0, this.index + 1);
    const slim = slimSnapshot(snapshot);
    this.stack.push({ snapshot: slim, label, ts: Date.now() });
    if (this.stack.length > MAX) this.stack.shift();
    this.index = this.stack.length - 1;
    this._notify();
  }

  // Annule : rend l'état précédent (sans bouger le présent si on est déjà en bas)
  undo() {
    if (this.index <= 0) return null;
    this.index--;
    this._notify();
    return restoreSnapshot(this.stack[this.index].snapshot);
  }

  redo() {
    if (this.index >= this.stack.length - 1) return null;
    this.index++;
    this._notify();
    return restoreSnapshot(this.stack[this.index].snapshot);
  }

  canUndo() { return this.index > 0; }
  canRedo() { return this.index < this.stack.length - 1; }

  current() {
    return this.index >= 0 ? this.stack[this.index] : null;
  }

  clear() {
    this.stack = [];
    this.index = -1;
    this._notify();
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _notify() {
    for (const fn of this.listeners) {
      try { fn(this); } catch (e) { /* ignore */ }
    }
  }
}

export const history = new HistoryStack();

function deepClone(o) {
  return JSON.parse(JSON.stringify(o));
}

// Slim : extrait les payloads audio.dataUrl du snapshot (lourd) et les
// stocke dans un cache hors snapshots. Au restore, on les réinjecte si
// le show référencé existe encore.
function slimSnapshot(shows) {
  if (!Array.isArray(shows)) return deepClone(shows);
  return shows.map((sh) => {
    if (!sh.audio || !sh.audio.dataUrl) return deepClone(sh);
    audioCache.set(sh.id, sh.audio);
    const slim = JSON.parse(JSON.stringify(sh));
    slim.audio = {
      ...sh.audio,
      dataUrl: null,
      _audioRef: sh.id, // marqueur pour restore
    };
    return slim;
  });
}

function restoreSnapshot(slimShows) {
  if (!Array.isArray(slimShows)) return JSON.parse(JSON.stringify(slimShows));
  return slimShows.map((sh) => {
    const out = JSON.parse(JSON.stringify(sh));
    if (out.audio && out.audio._audioRef) {
      const cached = audioCache.get(out.audio._audioRef);
      if (cached) {
        out.audio = { ...out.audio, dataUrl: cached.dataUrl };
      }
      delete out.audio._audioRef;
    }
    return out;
  });
}
