// Store unique : état de l'application + persistance localStorage.
//
// Principes :
//   - Un seul fichier, pas d'event bus, pas de couches.
//   - Mutations explicites via fonctions exportées (pas de proxy magique).
//   - Chaque mutation persistée immédiatement (saveState).
//   - Sanitization au load (cues orphelins retirés, NaN clampés).
//   - Pas d'audio dataUrl dans la stack d'undo (sinon RAM explose).

import { getEffect, CATALOG } from "./catalog.js";

const STORAGE_KEY = "prevofx.v2";

const DEFAULTS = {
  shows: [],
  favorites: [],         // ids d'effets favoris
  customEffects: [],     // effets personnalisés (mêmes champs que catalog)
  settings: {
    defaultDuration: 180,
    defaultViewer: "fx",      // fx | sim
    bloom: true,
    bloomIntensity: 0.9,
    audioVolume: 1.0,
    beepOnCue: false,
    snapStep: 0.1,
  },
  meta: { version: 1 },
};

// ---- État global (singleton) ----

let state = load();

// Sanitize au démarrage : retire cues orphelins (effects disparus du catalogue).
{
  let removed = 0;
  for (const sh of state.shows) {
    const before = sh.cues.length;
    sh.cues = sh.cues.filter((c) => findEffect(c.effectId));
    removed += before - sh.cues.length;
  }
  if (removed > 0) {
    save();
    queueMicrotask(() => {
      try {
        window.dispatchEvent(new CustomEvent("toast", {
          detail: { msg: `${removed} cue(s) orphelin(s) retiré(s).`, kind: "warning" },
        }));
      } catch {}
    });
  }
}

// ---- Persistance ----

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedDemo(structuredClone(DEFAULTS));
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULTS,
      ...parsed,
      favorites: parsed.favorites || [],
      customEffects: parsed.customEffects || [],
      settings: { ...DEFAULTS.settings, ...(parsed.settings || {}) },
    };
  } catch {
    return seedDemo(structuredClone(DEFAULTS));
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    try { window.dispatchEvent(new CustomEvent("saved")); } catch {}
  } catch (e) {
    if (isQuotaError(e)) {
      // Tentative sans audio dataUrl
      try {
        const slim = stripAudio(state);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
        try {
          window.dispatchEvent(new CustomEvent("toast", {
            detail: {
              msg: "Stockage saturé : audio importés non persistés. Pensez à exporter.",
              kind: "warning",
            },
          }));
        } catch {}
      } catch (e2) {
        console.error("[store] saveState échec :", e2);
      }
    } else {
      console.error("[store] saveState erreur :", e);
    }
  }
}

function isQuotaError(e) {
  return e && (e.name === "QuotaExceededError" || e.code === 22 ||
               e.code === 1014 || /quota/i.test(e.message || ""));
}

function stripAudio(s) {
  return {
    ...s,
    shows: s.shows.map((sh) => sh.audio ? {
      ...sh, audio: { ...sh.audio, dataUrl: null },
    } : sh),
  };
}

export function reset() {
  localStorage.removeItem(STORAGE_KEY);
  state = seedDemo(structuredClone(DEFAULTS));
}

// ---- Accès lecture seule ----

export function get() { return state; }
export function getShows() { return state.shows; }
export function getSettings() { return state.settings; }

// ---- Helpers de validation ----

function safeTime(t, max) {
  const n = Number(t);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, n));
}

function safeQty(q) {
  const n = (Number(q) | 0);
  return Math.max(1, Math.min(999, n || 1));
}

function genId(prefix) {
  return prefix + "_" + Date.now().toString(36) + "_" +
         Math.random().toString(36).slice(2, 7);
}

// ---- Effets : lookup unifié (catalogue + custom) ----

export function findEffect(id) {
  return state.customEffects.find((e) => e.id === id) || getEffect(id);
}

export function getAllEffects() {
  return [...state.customEffects, ...CATALOG];
}

// ---- Spectacles ----

export function getShow(id) {
  return state.shows.find((s) => s.id === id) || null;
}

export function createShow(name, description = "") {
  const sh = {
    id: genId("show"),
    name: (name || "Nouveau spectacle").trim(),
    description: description || "",
    location: null,
    placemarks: [],
    audio: null,
    duration: state.settings.defaultDuration || 180,
    cues: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  state.shows.unshift(sh);
  save();
  return sh;
}

export function updateShow(id, patch) {
  const sh = getShow(id);
  if (!sh) return null;
  Object.assign(sh, patch, { updatedAt: Date.now() });
  save();
  return sh;
}

export function deleteShow(id) {
  const i = state.shows.findIndex((s) => s.id === id);
  if (i >= 0) {
    state.shows.splice(i, 1);
    save();
    return true;
  }
  return false;
}

export function duplicateShow(id) {
  const sh = getShow(id);
  if (!sh) return null;
  const copy = JSON.parse(JSON.stringify(sh));
  copy.id = genId("show");
  copy.name = sh.name + " (copie)";
  copy.createdAt = Date.now();
  copy.updatedAt = Date.now();
  copy.cues = copy.cues.map((c) => ({ ...c, id: genId("cue") }));
  state.shows.unshift(copy);
  save();
  return copy;
}

// ---- Cues ----

export function addCue(showId, effectId, time, quantity = 1) {
  const sh = getShow(showId);
  if (!sh) return null;
  if (!findEffect(effectId)) return null;
  const cue = {
    id: genId("cue"),
    effectId,
    time: safeTime(time, sh.duration),
    quantity: safeQty(quantity),
  };
  sh.cues.push(cue);
  sh.cues.sort((a, b) => a.time - b.time);
  sh.updatedAt = Date.now();
  save();
  return cue;
}

export function updateCue(showId, cueId, patch) {
  const sh = getShow(showId);
  if (!sh) return null;
  const cue = sh.cues.find((c) => c.id === cueId);
  if (!cue) return null;
  const safe = { ...patch };
  if (safe.time != null) safe.time = safeTime(safe.time, sh.duration);
  if (safe.quantity != null) safe.quantity = safeQty(safe.quantity);
  Object.assign(cue, safe);
  if (patch.time != null) sh.cues.sort((a, b) => a.time - b.time);
  sh.updatedAt = Date.now();
  save();
  return cue;
}

export function removeCue(showId, cueId) {
  const sh = getShow(showId);
  if (!sh) return false;
  const i = sh.cues.findIndex((c) => c.id === cueId);
  if (i < 0) return false;
  sh.cues.splice(i, 1);
  sh.updatedAt = Date.now();
  save();
  return true;
}

export function removeCues(showId, cueIds) {
  const sh = getShow(showId);
  if (!sh) return 0;
  const set = new Set(cueIds);
  const before = sh.cues.length;
  sh.cues = sh.cues.filter((c) => !set.has(c.id));
  sh.updatedAt = Date.now();
  save();
  return before - sh.cues.length;
}

// ---- Favoris ----

export function isFavorite(effectId) {
  return state.favorites.includes(effectId);
}

export function toggleFavorite(effectId) {
  const i = state.favorites.indexOf(effectId);
  if (i >= 0) state.favorites.splice(i, 1);
  else state.favorites.push(effectId);
  save();
  return isFavorite(effectId);
}

// ---- Custom effects ----

export function addCustomEffect(eff) {
  const full = {
    id: genId("custom"),
    custom: true,
    partType: "other",
    subtype: "other",
    caliber: 0,
    duration: 3,
    height: 30,
    colors: ["#ffd60a"],
    price: 0,
    vendor: "Personnalisé",
    ...eff,
  };
  state.customEffects.unshift(full);
  save();
  return full;
}

export function updateCustomEffect(id, patch) {
  const eff = state.customEffects.find((e) => e.id === id);
  if (!eff) return null;
  Object.assign(eff, patch);
  save();
  return eff;
}

export function deleteCustomEffect(id) {
  const i = state.customEffects.findIndex((e) => e.id === id);
  if (i >= 0) {
    state.customEffects.splice(i, 1);
    save();
    return true;
  }
  return false;
}

// ---- Audio / lieu ----

export function setShowAudio(showId, audio) {
  const sh = getShow(showId);
  if (!sh) return null;
  sh.audio = audio;
  if (audio && audio.duration > sh.duration) {
    sh.duration = Math.ceil(audio.duration);
  }
  sh.updatedAt = Date.now();
  save();
  return sh;
}

export function clearShowAudio(showId) {
  const sh = getShow(showId);
  if (!sh) return null;
  sh.audio = null;
  sh.updatedAt = Date.now();
  save();
  return sh;
}

export function setShowLocation(showId, location, placemarks) {
  const sh = getShow(showId);
  if (!sh) return null;
  sh.location = location || null;
  if (placemarks) sh.placemarks = placemarks;
  sh.updatedAt = Date.now();
  save();
  return sh;
}

// ---- Settings ----

export function setSetting(key, value) {
  state.settings[key] = value;
  save();
}

// ---- Stats / agrégations ----

export function showCost(sh) {
  return sh.cues.reduce((s, c) => {
    const eff = findEffect(c.effectId);
    return s + (eff ? eff.price * c.quantity : 0);
  }, 0);
}

export function showTotalShots(sh) {
  return sh.cues.reduce((s, c) => s + c.quantity, 0);
}

export function aggregateOrder(sh) {
  const byEff = new Map();
  for (const cue of sh.cues) {
    const eff = findEffect(cue.effectId);
    if (!eff) continue;
    const cur = byEff.get(eff.id) || { effect: eff, quantity: 0 };
    cur.quantity += cue.quantity;
    byEff.set(eff.id, cur);
  }
  return [...byEff.values()].sort((a, b) =>
    a.effect.name.localeCompare(b.effect.name, "fr")
  );
}

export function globalStats() {
  return {
    showCount: state.shows.length,
    totalCues: state.shows.reduce((s, sh) => s + sh.cues.length, 0),
    totalShots: state.shows.reduce((s, sh) => s + showTotalShots(sh), 0),
    totalCost: state.shows.reduce((s, sh) => s + showCost(sh), 0),
  };
}

// ---- Export / import JSON ----

export function exportJson() {
  return JSON.stringify(state, null, 2);
}

export function importJson(text) {
  const obj = JSON.parse(text);
  if (!obj || !Array.isArray(obj.shows)) throw new Error("Format invalide");
  state = {
    ...DEFAULTS,
    ...obj,
    favorites: obj.favorites || [],
    customEffects: obj.customEffects || [],
    settings: { ...DEFAULTS.settings, ...(obj.settings || {}) },
  };
  save();
}

// ---- Démo de départ ----

function seedDemo(s) {
  const demo = {
    id: "show_demo_001",
    name: "Démo — 14 juillet",
    description: "Spectacle de démonstration. Modifiez-le ou supprimez-le.",
    location: null,
    placemarks: [],
    audio: null,
    duration: 90,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    cues: [
      { id: "cue_d1",  effectId: "fountain_30s_silver",  time: 0,  quantity: 2 },
      { id: "cue_d2",  effectId: "comet_30_silver",      time: 4,  quantity: 1 },
      { id: "cue_d3",  effectId: "shell_75_peony_red",   time: 8,  quantity: 1 },
      { id: "cue_d4",  effectId: "shell_75_peony_blue",  time: 11, quantity: 1 },
      { id: "cue_d5",  effectId: "candle_30_gold_x12",   time: 15, quantity: 2 },
      { id: "cue_d6",  effectId: "shell_100_palm_gold",  time: 28, quantity: 1 },
      { id: "cue_d7",  effectId: "shell_100_chrys_silver", time: 35, quantity: 1 },
      { id: "cue_d8",  effectId: "mine_75_multi",        time: 45, quantity: 2 },
      { id: "cue_d9",  effectId: "shell_125_diadem",     time: 55, quantity: 1 },
      { id: "cue_d10", effectId: "candle_30_multi_x20",  time: 62, quantity: 2 },
      { id: "cue_d11", effectId: "cake_50_finale_25s",   time: 75, quantity: 1 },
      { id: "cue_d12", effectId: "shell_150_dahlia",     time: 88, quantity: 1 },
    ],
  };
  s.shows = [demo];
  return s;
}
