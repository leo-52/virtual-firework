// effects.js
// Bibliothèque d'effets pyrotechniques. Charge data/effects.json
// et expose un registre interrogeable + un util de couleur.
//
// API publique :
//   await Effects.load()         -> charge le catalogue
//   Effects.all()                -> tableau d'effets
//   Effects.get(id)              -> définition d'un effet
//   Effects.byCategory(category) -> filtre par catégorie

const Effects = (() => {
  let _effects = [];
  let _byId = new Map();

  async function load(url = 'data/effects.json') {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Impossible de charger ${url}`);
    const data = await res.json();
    _effects = data.effects;
    _byId = new Map(_effects.map(e => [e.id, e]));
    return _effects;
  }

  function all() { return _effects.slice(); }
  function get(id) { return _byId.get(id); }
  function byCategory(cat) { return _effects.filter(e => e.category === cat); }

  // Transforme "#rrggbb" en {r,g,b} dans [0..1]
  function colorToRGB(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h, 16);
    return {
      r: ((n >> 16) & 0xff) / 255,
      g: ((n >> 8) & 0xff) / 255,
      b: (n & 0xff) / 255,
    };
  }

  return { load, all, get, byCategory, colorToRGB };
})();

window.Effects = Effects;
