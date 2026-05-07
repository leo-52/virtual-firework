// Diagnostic de rendu : modal en temps réel.
//
// Affiche : FPS lissé, frame time (ms), heap RAM (si performance.memory),
// nombre de particules actives (si un renderer 3D est branché), nombre
// de cues, nombre de batches GPU. Inspiré du RenderPerformanceDialog
// du moteur Finale 3D.
//
// Usage : openPerfDialog({ getStats })
//
// `getStats` est une fonction appelée à chaque frame qui doit retourner
// un objet { particles, batches, drawCalls, triangles, ... }.

import { el } from "../lib/dom.js";

let activeProvider = null;
const subscribers = new Set();

// API pour publier des stats depuis n'importe quelle source (renderer GL,
// simulateur 2D, etc.).
export function publishPerf(stats) {
  for (const fn of subscribers) {
    try { fn(stats); } catch { /* ignore */ }
  }
}

export function setStatsProvider(fn) {
  activeProvider = fn;
}

function bytesToMB(b) {
  return (b / (1024 * 1024)).toFixed(1) + " Mo";
}

export function openPerfDialog() {
  const overlay = el("div", { class: "modal-overlay" });
  const card = el("div", { class: "modal modal-perf" });
  card.appendChild(el("header", { class: "modal-header" },
    el("h2", {}, "Diagnostic de rendu"),
    el("button", {
      class: "btn btn-ghost",
      onClick: () => close(),
    }, "✕")));

  const body = el("div", { class: "modal-body perf-body" });
  card.appendChild(body);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // ---- Tuiles métriques ----
  const tiles = el("div", { class: "perf-tiles" });
  const fpsTile     = makeTile("FPS", "0", "—");
  const frameTile   = makeTile("Frame time", "0 ms", "objectif < 16.6 ms");
  const ramTile     = makeTile("RAM (heap)", "—", "JS heap utilisé");
  const partTile    = makeTile("Particules", "0", "actives au frame");
  const batchTile   = makeTile("Batches", "0", "draw calls");
  const cuesTile    = makeTile("Cues", "0", "déclenchés");
  tiles.append(fpsTile.node, frameTile.node, ramTile.node, partTile.node, batchTile.node, cuesTile.node);
  body.appendChild(tiles);

  // ---- Graphe FPS (rolling window) ----
  body.appendChild(el("div", { class: "form-label" }, "Historique FPS (10 s)"));
  const canvas = document.createElement("canvas");
  canvas.className = "perf-graph";
  canvas.width = 600;
  canvas.height = 100;
  body.appendChild(canvas);
  const cx = canvas.getContext("2d");
  const history = new Array(120).fill(0);

  // ---- Source des stats ----
  body.appendChild(el("div", { class: "form-label" }, "Source"));
  body.appendChild(el("p", { class: "page-subtitle" },
    "Les stats proviennent du renderer 3D actif (s'il y en a un) ou du simulateur 2D."));

  // ---- Loop ----
  let running = true;
  let lastFrame = performance.now();
  let smoothFps = 0;
  let frameCount = 0;
  let bucketStart = lastFrame;
  let lastStats = { particles: 0, batches: 0, cues: 0 };

  const onStats = (stats) => { lastStats = { ...lastStats, ...stats }; };
  subscribers.add(onStats);

  function tick() {
    if (!running) return;
    const now = performance.now();
    const dt = now - lastFrame;
    lastFrame = now;
    frameCount++;
    if (now - bucketStart >= 250) {
      smoothFps = (frameCount * 1000) / (now - bucketStart);
      frameCount = 0;
      bucketStart = now;
      history.shift();
      history.push(smoothFps);
    }

    // Demande au provider courant des infos additionnelles
    const extra = activeProvider ? (activeProvider() || {}) : {};
    const merged = { ...lastStats, ...extra };

    fpsTile.value.textContent = smoothFps.toFixed(0);
    frameTile.value.textContent = dt.toFixed(1) + " ms";
    if (performance.memory) {
      ramTile.value.textContent = bytesToMB(performance.memory.usedJSHeapSize);
      ramTile.sub.textContent =
        `${bytesToMB(performance.memory.totalJSHeapSize)} alloué`;
    } else {
      ramTile.value.textContent = "n/a";
      ramTile.sub.textContent = "performance.memory absent";
    }
    partTile.value.textContent = String(merged.particles ?? 0);
    batchTile.value.textContent = String(merged.batches ?? merged.drawCalls ?? 0);
    cuesTile.value.textContent = String(merged.cues ?? 0);

    drawGraph();
    requestAnimationFrame(tick);
  }

  function drawGraph() {
    const W = canvas.width, H = canvas.height;
    cx.fillStyle = "#04060f";
    cx.fillRect(0, 0, W, H);
    // Grille (16/30/60 fps)
    for (const f of [16, 30, 60]) {
      const y = H - (f / 90) * H;
      cx.strokeStyle = "rgba(255,255,255,0.08)";
      cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke();
      cx.fillStyle = "rgba(255,255,255,0.4)";
      cx.font = "10px sans-serif";
      cx.fillText(`${f}`, 4, y - 2);
    }
    // Trace
    cx.strokeStyle = "#46a758";
    cx.lineWidth = 1.5;
    cx.beginPath();
    for (let i = 0; i < history.length; i++) {
      const x = (i / (history.length - 1)) * W;
      const y = H - Math.min(90, history[i]) / 90 * H;
      if (i === 0) cx.moveTo(x, y);
      else cx.lineTo(x, y);
    }
    cx.stroke();
  }

  function close() {
    running = false;
    subscribers.delete(onStats);
    overlay.remove();
  }
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", function onKey(e) {
    if (e.key === "Escape") {
      document.removeEventListener("keydown", onKey);
      close();
    }
  });

  requestAnimationFrame(tick);
}

function makeTile(label, value, sub) {
  const value_el = el("div", { class: "perf-tile-value" }, value);
  const sub_el = el("div", { class: "perf-tile-sub" }, sub);
  const node = el("div", { class: "perf-tile" },
    el("div", { class: "perf-tile-label" }, label),
    value_el, sub_el);
  return { node, value: value_el, sub: sub_el };
}
