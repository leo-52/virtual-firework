// État de l'application : spectacles, paramètres, persistance localStorage.

import { EFFECTS, getEffect } from "../data/effects.js";

const STORAGE_KEY = "prevofx.state.v3";

const defaultState = {
  shows: [],
  favorites: [],         // ids d'effets favoris
  customEffects: [],     // effets utilisateur (mêmes champs que data/effects.js)
  settings: {
    language: "fr",
    theme: "dark",
    defaultDuration: 180,
    defaultViewer: "gl",      // gl | sim | finale3d
    bloom: true,
    bloomIntensity: 0.9,
    audioVolume: 1.0,
    beepOnCue: false,
    snapStep: 0.1,            // s, pour quantifier les drops/drag timeline
  },
  meta: { version: 3 },
};

export const state = loadState();

// Sanitize au démarrage : retire les cues orphelins et signale.
{
  let orphans = 0;
  for (const sh of state.shows) {
    const before = sh.cues.length;
    sh.cues = sh.cues.filter((c) => findEffect(c.effectId));
    orphans += before - sh.cues.length;
  }
  if (orphans > 0) {
    saveState();
    queueMicrotask(() => {
      try {
        window.dispatchEvent(new CustomEvent("prevofx:toast",
          { detail: `${orphans} cue(s) orphelin(s) retiré(s) (effets disparus du catalogue).` }));
      } catch {}
    });
  }
}

function loadState() {
  try {
    // Migration : on lit aussi l'ancienne clé v2 si v3 absente.
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) raw = localStorage.getItem("prevofx.state.v2");
    if (!raw) return seedDemo(structuredClone(defaultState));
    const parsed = JSON.parse(raw);
    return {
      ...defaultState,
      ...parsed,
      favorites: parsed.favorites || [],
      customEffects: parsed.customEffects || [],
      settings: { ...defaultState.settings, ...(parsed.settings || {}) },
    };
  } catch {
    return seedDemo(structuredClone(defaultState));
  }
}

export function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    try { window.dispatchEvent(new CustomEvent("prevofx:saved")); } catch {}
  } catch (e) {
    // Quota dépassé : essai sans les gros dataUrl audio
    if (isQuotaError(e)) {
      console.warn("[state] localStorage saturé, on tente sans dataUrl audio");
      try {
        const slim = stripAudioPayloads(state);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
        if (!_quotaWarned) {
          _quotaWarned = true;
          dispatchToast(
            "Stockage local saturé : les fichiers audio importés ne sont plus conservés au redémarrage. Pensez à exporter vos spectacles."
          );
        }
        return;
      } catch (e2) {
        console.error("[state] échec saveState même sans audio :", e2);
      }
    } else {
      console.error("[state] saveState a échoué :", e);
    }
  }
}

let _quotaWarned = false;

function isQuotaError(e) {
  return e && (
    e.name === "QuotaExceededError" ||
    e.code === 22 ||
    e.code === 1014 ||
    /quota/i.test(e.message || "")
  );
}

function stripAudioPayloads(s) {
  return {
    ...s,
    shows: s.shows.map((sh) => sh.audio ? {
      ...sh,
      audio: { ...sh.audio, dataUrl: null },
    } : sh),
  };
}

function dispatchToast(msg) {
  // dom.js toast n'est pas importable ici (cycle), on dispatch un event
  try {
    window.dispatchEvent(new CustomEvent("prevofx:toast", { detail: msg }));
  } catch { /* SSR ou window absent */ }
}

export function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  Object.assign(state, seedDemo(structuredClone(defaultState)));
}

// ---- Spectacles -----------------------------------------------------------

// ---- Helpers spectacle (étendus avec géolocalisation) ----------------------

export function createShow(name, description = "") {
  const show = {
    id: "show_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: name.trim(),
    description,
    location: null,        // { name, lat, lon, alt? }
    placemarks: [],        // import KML (zones de tir, public, etc.)
    createdAt: Date.now(),
    updatedAt: Date.now(),
    duration: state.settings.defaultDuration || 180,
    cues: [],
  };
  state.shows.unshift(show);
  saveState();
  return show;
}

export function getShow(id) {
  return state.shows.find((s) => s.id === id);
}

export function updateShow(id, patch) {
  const show = getShow(id);
  if (!show) return null;
  Object.assign(show, patch, { updatedAt: Date.now() });
  saveState();
  return show;
}

export function deleteShow(id) {
  const i = state.shows.findIndex((s) => s.id === id);
  if (i >= 0) {
    state.shows.splice(i, 1);
    saveState();
  }
}

export function duplicateShow(id) {
  const show = getShow(id);
  if (!show) return null;
  const copy = JSON.parse(JSON.stringify(show));
  copy.id = "show_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  copy.name = show.name + " (copie)";
  copy.createdAt = Date.now();
  copy.updatedAt = Date.now();
  copy.cues = copy.cues.map((c) => ({
    ...c,
    id: "cue_" + Math.random().toString(36).slice(2, 9),
  }));
  state.shows.unshift(copy);
  saveState();
  return copy;
}

// ---- Cues (déclenchements) ------------------------------------------------

function safeTime(time, max) {
  const t = Number(time);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.min(max, t));
}

function safeQty(q) {
  const n = Number(q) | 0;
  return Math.max(1, Math.min(999, n || 1));
}

export function addCue(showId, effectId, time, quantity = 1) {
  const show = getShow(showId);
  if (!show) return null;
  const cue = {
    id: "cue_" + Math.random().toString(36).slice(2, 9),
    effectId,
    time: safeTime(time, show.duration),
    quantity: safeQty(quantity),
  };
  show.cues.push(cue);
  show.cues.sort((a, b) => a.time - b.time);
  show.updatedAt = Date.now();
  saveState();
  return cue;
}

export function updateCue(showId, cueId, patch) {
  const show = getShow(showId);
  if (!show) return null;
  const cue = show.cues.find((c) => c.id === cueId);
  if (!cue) return null;
  // Sanitize avant assignation
  const safe = { ...patch };
  if (safe.time != null) safe.time = safeTime(safe.time, show.duration);
  if (safe.quantity != null) safe.quantity = safeQty(safe.quantity);
  Object.assign(cue, safe);
  if (patch.time != null) {
    show.cues.sort((a, b) => a.time - b.time);
  }
  show.updatedAt = Date.now();
  saveState();
  return cue;
}

// Garbage-collect : retire les cues qui pointent vers un effectId
// inexistant (catalogue + custom). Renvoie le nombre de cues supprimés.
export function gcOrphanCues(showId) {
  const show = showId ? getShow(showId) : null;
  const shows = show ? [show] : state.shows;
  let removed = 0;
  for (const sh of shows) {
    const before = sh.cues.length;
    sh.cues = sh.cues.filter((c) => findEffect(c.effectId));
    removed += before - sh.cues.length;
    if (before !== sh.cues.length) sh.updatedAt = Date.now();
  }
  if (removed) saveState();
  return removed;
}

export function removeCue(showId, cueId) {
  const show = getShow(showId);
  if (!show) return;
  const i = show.cues.findIndex((c) => c.id === cueId);
  if (i >= 0) show.cues.splice(i, 1);
  show.updatedAt = Date.now();
  saveState();
}

// ---- Favoris --------------------------------------------------------------

export function isFavorite(effectId) {
  return state.favorites.includes(effectId);
}

export function toggleFavorite(effectId) {
  const i = state.favorites.indexOf(effectId);
  if (i >= 0) state.favorites.splice(i, 1);
  else state.favorites.push(effectId);
  saveState();
  return isFavorite(effectId);
}

// ---- Effets personnalisés -------------------------------------------------

export function getAllEffects() {
  return [...state.customEffects, ...EFFECTS];
}

// Lookup global : effets personnalisés + catalogue
export function findEffect(id) {
  return state.customEffects.find((e) => e.id === id) || getEffect(id);
}

export function addCustomEffect(eff) {
  const id = eff.id || ("custom_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
  const full = {
    id,
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
  saveState();
  return full;
}

export function updateCustomEffect(id, patch) {
  const eff = state.customEffects.find((e) => e.id === id);
  if (!eff) return null;
  Object.assign(eff, patch);
  saveState();
  return eff;
}

export function deleteCustomEffect(id) {
  const i = state.customEffects.findIndex((e) => e.id === id);
  if (i >= 0) {
    state.customEffects.splice(i, 1);
    saveState();
  }
}

// ---- Templates ------------------------------------------------------------

export function createShowFromTemplate(template, overrideName) {
  const built = template.build();
  const sh = createShow(overrideName || template.name, template.description);
  sh.duration = built.duration;
  sh.cues = built.cues;
  sh.updatedAt = Date.now();
  saveState();
  return sh;
}

// ---- Audio ----------------------------------------------------------------

export function setShowAudio(showId, audio) {
  const show = getShow(showId);
  if (!show) return null;
  show.audio = audio;       // { name, dataUrl, peaks, duration, sampleRate, channels }
  // Si l'audio est plus long que la durée du show, on étend le show.
  if (audio && audio.duration > show.duration) {
    show.duration = Math.ceil(audio.duration);
  }
  show.updatedAt = Date.now();
  saveState();
  return show;
}

export function clearShowAudio(showId) {
  const show = getShow(showId);
  if (!show) return null;
  show.audio = null;
  show.updatedAt = Date.now();
  saveState();
  return show;
}

// ---- Géolocalisation ------------------------------------------------------

export function setShowLocation(showId, location, placemarks) {
  const show = getShow(showId);
  if (!show) return null;
  show.location = location || null;
  if (placemarks) show.placemarks = placemarks;
  show.updatedAt = Date.now();
  saveState();
  return show;
}

// ---- Stats / agrégations --------------------------------------------------

export function showCost(show) {
  return show.cues.reduce((sum, c) => {
    const eff = findEffect(c.effectId);
    return sum + (eff ? eff.price * c.quantity : 0);
  }, 0);
}

export function showEffectCount(show) {
  return show.cues.reduce((sum, c) => sum + c.quantity, 0);
}

export function aggregateOrder(show) {
  // Regroupe les cues par effectId et somme les quantités.
  const byEffect = new Map();
  for (const cue of show.cues) {
    const eff = findEffect(cue.effectId);
    if (!eff) continue;
    const cur = byEffect.get(eff.id) || { effect: eff, quantity: 0 };
    cur.quantity += cue.quantity;
    byEffect.set(eff.id, cur);
  }
  return [...byEffect.values()].sort((a, b) =>
    a.effect.name.localeCompare(b.effect.name, "fr")
  );
}

export function globalStats() {
  const totalCues = state.shows.reduce((s, sh) => s + sh.cues.length, 0);
  const totalEffects = state.shows.reduce((s, sh) => s + showEffectCount(sh), 0);
  const totalCost = state.shows.reduce((s, sh) => s + showCost(sh), 0);
  return {
    showCount: state.shows.length,
    catalogSize: EFFECTS.length,
    totalCues,
    totalEffects,
    totalCost,
  };
}

// ---- Démo de départ -------------------------------------------------------

function seedDemo(s) {
  // IDs basés sur le vrai catalogue VDL (cf. data/effects.js).
  const demo = {
    id: "show_demo_001",
    name: "Démo — 14 juillet",
    description: "Spectacle de démonstration. Vous pouvez le modifier ou le supprimer.",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    duration: 90,
    location: null,
    placemarks: [],
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
