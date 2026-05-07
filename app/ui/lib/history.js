// Historique undo/redo générique. On capture des snapshots JSON sérialisables
// d'un sous-ensemble de l'état (les spectacles), et on rejoue.
//
// Stratégie : snapshot complet plutôt que reverse-deltas.
// - simple à implémenter et à raisonner
// - peu coûteux : un spectacle moyen pèse < 10 Ko en JSON
// - on plafonne à 50 snapshots pour limiter la mémoire

const MAX = 50;

class HistoryStack {
  constructor() {
    this.stack = []; // [{ snapshot, label, ts }]
    this.index = -1;
    this.listeners = new Set();
  }

  push(snapshot, label = "Modification") {
    // Tronque toute redo-history en avant
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push({ snapshot: deepClone(snapshot), label, ts: Date.now() });
    if (this.stack.length > MAX) this.stack.shift();
    this.index = this.stack.length - 1;
    this._notify();
  }

  // Annule : rend l'état précédent (sans bouger le présent si on est déjà en bas)
  undo() {
    if (this.index <= 0) return null;
    this.index--;
    this._notify();
    return deepClone(this.stack[this.index].snapshot);
  }

  redo() {
    if (this.index >= this.stack.length - 1) return null;
    this.index++;
    this._notify();
    return deepClone(this.stack[this.index].snapshot);
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
