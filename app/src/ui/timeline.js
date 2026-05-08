// Timeline pro multi-pistes (3 lanes : aérien / sol / sfx-light).
//
// - Drag-to-move : un cue ou un groupe sélectionné se déplacent ensemble
// - Drop d'un effet (data-transfer) sur n'importe quelle lane
// - Click vide = onEmptyClick(time) (pour ouvrir un picker)
// - Maj/Ctrl-clic sur cue = sélection multiple
// - Snap selon settings.snapStep

import { el, formatTime } from "./kit.js";
import * as store from "../store.js";
import { partTypeColor, partTypeIcon } from "../catalog.js";

const LANES = [
  {
    id: "aerial",
    label: "Aérien",
    partTypes: new Set([
      "shell", "candle", "rocket", "comet", "cake", "rack", "mortar",
    ]),
  },
  {
    id: "ground",
    label: "Sol",
    partTypes: new Set(["fountain", "gerb", "mine", "flame"]),
  },
  {
    id: "sfx",
    label: "SFX / Lum.",
    partTypes: new Set(["sfx", "light"]),
  },
];

function laneOf(eff) {
  if (!eff) return "aerial";
  for (const lane of LANES) {
    if (lane.partTypes.has(eff.partType)) return lane.id;
  }
  return "aerial";
}

function snap(t) {
  const step = store.getSettings().snapStep;
  if (!step) return Math.round(t * 10) / 10;
  return Math.round(t / step) * step;
}

export function buildTimeline(ctx) {
  const { show } = ctx;

  const wrap = el("div", { class: "tl" });

  // Bande waveform si audio
  if (show.audio?.peaks?.length) {
    wrap.appendChild(buildWaveform(show, ctx));
  }

  // Ruler
  const ruler = el("div", { class: "tl-ruler" });
  const stepSec = show.duration <= 30 ? 5
                : show.duration <= 60 ? 10
                : show.duration <= 180 ? 20
                : show.duration <= 600 ? 60 : 120;
  for (let t = 0; t <= show.duration; t += stepSec) {
    const left = (t / show.duration) * 100;
    ruler.appendChild(el("div", {
      class: "tl-tick",
      style: { left: `${left}%` },
    }, el("span", { class: "tl-tick-label" }, formatTime(t))));
  }
  if (typeof ctx.onSeek === "function") {
    ruler.style.cursor = "pointer";
    ruler.addEventListener("click", (e) => {
      const r = ruler.getBoundingClientRect();
      const t = ((e.clientX - r.left) / r.width) * show.duration;
      ctx.onSeek(Math.max(0, Math.min(show.duration, t)));
    });
  }

  // Lanes
  const lanes = el("div", { class: "tl-lanes" });
  for (const lane of LANES) {
    lanes.appendChild(buildLane(ctx, lane, show));
  }

  // Playhead
  const playhead = el("div", { class: "tl-playhead" });
  if (typeof ctx.playheadTime === "number") {
    playhead.style.left = `${(ctx.playheadTime / show.duration) * 100}%`;
  }
  lanes.appendChild(playhead);

  wrap.append(ruler, lanes);

  return {
    node: wrap,
    setPlayhead(time) {
      const left = Math.max(0, Math.min(1, time / show.duration)) * 100;
      playhead.style.left = `${left}%`;
    },
  };
}

function buildLane(ctx, lane, show) {
  const { selection, refresh, snapshotBefore, showId } = ctx;
  const row = el("div", { class: "tl-lane", "data-lane": lane.id });

  row.appendChild(el("div", { class: "tl-lane-label" }, lane.label));

  const stage = el("div", { class: "tl-stage" });

  // Drop d'un effet de la library
  stage.addEventListener("dragover", (e) => {
    if (e.dataTransfer.types.includes("text/effect-id")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  });
  stage.addEventListener("drop", (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/effect-id");
    if (!id) return;
    const r = stage.getBoundingClientRect();
    const time = ((e.clientX - r.left) / r.width) * show.duration;
    if (snapshotBefore) snapshotBefore("Drop d'un cue");
    const cue = store.addCue(showId, id, snap(time));
    if (cue && selection) selection.set([cue.id]);
    refresh();
  });

  // Click vide → désélectionner ou picker
  stage.addEventListener("click", (e) => {
    if (e.target !== stage) return;
    if (e.shiftKey || e.altKey) {
      if (typeof ctx.onEmptyClick === "function") {
        const r = stage.getBoundingClientRect();
        const t = ((e.clientX - r.left) / r.width) * show.duration;
        ctx.onEmptyClick(snap(Math.max(0, Math.min(show.duration, t))));
      }
    } else if (selection && !e.ctrlKey && !e.metaKey) {
      selection.clear();
    }
  });

  // Cues affectés à cette lane
  for (const cue of show.cues) {
    const eff = store.findEffect(cue.effectId);
    if (!eff) continue;
    if (laneOf(eff) !== lane.id) continue;
    stage.appendChild(buildCueBlock(ctx, cue, eff, show));
  }

  row.appendChild(stage);
  return row;
}

function buildCueBlock(ctx, cue, eff, show) {
  const { selection, refresh, snapshotBefore, showId } = ctx;
  const c = partTypeColor(eff.partType);
  const left = (cue.time / show.duration) * 100;
  const width = Math.max(1.5, (eff.duration / show.duration) * 100);
  const isSel = selection?.has(cue.id);

  const block = el("div", {
    class: "tl-cue" + (isSel ? " selected" : ""),
    title: `${eff.name} · ${formatTime(cue.time)}${cue.quantity > 1 ? ` ×${cue.quantity}` : ""}`,
    style: {
      left: `${left}%`, width: `${width}%`,
      background: `linear-gradient(90deg, ${c}cc, ${c}55)`,
      borderColor: c,
    },
  });
  block.appendChild(el("span", { class: "tl-cue-icon" }, partTypeIcon(eff.partType)));
  block.appendChild(el("span", { class: "tl-cue-label" }, eff.name));
  if (cue.quantity > 1) {
    block.appendChild(el("span", { class: "badge" }, `×${cue.quantity}`));
  }
  block.dataset.cueId = cue.id;

  // Sélection au clic
  block.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!selection) return;
    if (e.shiftKey || e.ctrlKey || e.metaKey) selection.toggle(cue.id);
    else selection.set([cue.id]);
  });

  // Drag pour déplacer
  block.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    if (!selection) return;
    const stage = block.parentElement;
    const r = stage.getBoundingClientRect();
    const startX = e.clientX;
    let moved = false;

    if (!selection.has(cue.id) && !e.shiftKey) selection.set([cue.id]);
    const draggedIds = selection.list();
    const startTimes = new Map();
    for (const id of draggedIds) {
      const c = show.cues.find((x) => x.id === id);
      if (c) startTimes.set(id, c.time);
    }

    block.classList.add("dragging");

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dt = (dx / r.width) * show.duration;
      if (Math.abs(dx) > 2) moved = true;
      for (const id of draggedIds) {
        const t0 = startTimes.get(id);
        if (t0 == null) continue;
        const newT = Math.max(0, Math.min(show.duration, snap(t0 + dt)));
        const cu = show.cues.find((x) => x.id === id);
        if (cu) {
          cu.time = newT;
          const b = stage.querySelector(`[data-cue-id="${id}"]`);
          if (b) b.style.left = `${(newT / show.duration) * 100}%`;
        }
      }
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      block.classList.remove("dragging");
      if (moved) {
        if (snapshotBefore) snapshotBefore("Déplacement de cue(s)");
        for (const id of draggedIds) {
          const c = show.cues.find((x) => x.id === id);
          if (c) store.updateCue(showId, id, { time: c.time });
        }
        refresh();
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });

  return block;
}

function buildWaveform(show, ctx) {
  const wrap = el("div", { class: "tl-waveform" });
  wrap.appendChild(el("div", { class: "tl-lane-label" },
    "♪ " + (show.audio.name || "audio")));
  const stage = el("div", { class: "tl-waveform-stage" });
  const canvas = document.createElement("canvas");
  canvas.className = "tl-waveform-canvas";
  stage.appendChild(canvas);
  wrap.appendChild(stage);

  // Click → seek
  if (typeof ctx.onSeek === "function") {
    stage.style.cursor = "pointer";
    stage.addEventListener("click", (e) => {
      const r = stage.getBoundingClientRect();
      const t = ((e.clientX - r.left) / r.width) * show.duration;
      ctx.onSeek(Math.max(0, Math.min(show.duration, t)));
    });
  }

  requestAnimationFrame(() => drawWaveform(canvas, show));
  return wrap;
}

function drawWaveform(canvas, show) {
  const dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  if (!r.width) return;
  canvas.width = r.width * dpr;
  canvas.height = r.height * dpr;
  const cx = canvas.getContext("2d");
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = r.width, H = r.height;
  cx.fillStyle = "#04060f";
  cx.fillRect(0, 0, W, H);

  const peaks = show.audio.peaks;
  const audioDur = show.audio.duration || show.duration;
  const widthRatio = Math.min(1, audioDur / show.duration);
  const drawW = W * widthRatio;
  cx.fillStyle = "#0091ff";
  for (let i = 0; i < peaks.length; i++) {
    const x = (i / peaks.length) * drawW;
    const v = peaks[i];
    const h = v * (H - 4);
    cx.fillRect(x, (H - h) / 2, Math.max(1, drawW / peaks.length), h);
  }
}
