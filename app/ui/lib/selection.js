// Gestionnaire de sélection multiple (cues, effets, etc.).
// Modèle observé : un Set d'IDs, avec helpers et listeners.

export function makeSelection() {
  const set = new Set();
  const listeners = new Set();
  const notify = () => {
    for (const fn of listeners) {
      try { fn([...set]); } catch (e) { /* ignore */ }
    }
  };
  return {
    has: (id) => set.has(id),
    size: () => set.size,
    list: () => [...set],
    clear: () => { if (set.size) { set.clear(); notify(); } },
    set: (ids) => {
      set.clear();
      for (const id of ids) set.add(id);
      notify();
    },
    add: (id) => { if (!set.has(id)) { set.add(id); notify(); } },
    remove: (id) => { if (set.has(id)) { set.delete(id); notify(); } },
    toggle: (id) => { if (set.has(id)) set.delete(id); else set.add(id); notify(); },
    onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
