// Timeline multi-pistes interactive.
//
//   - 3 pistes (lanes) : aerial (bombes/comètes/chandelles), ground
//     (fontaines/gerbes/mines), sfx (effets sonores et lumineux).
//   - Cues : clic = sélection, Maj/Ctrl+clic = ajouter/retirer, drag = déplacer.
//   - Drop d'un effet de la bibliothèque sur une zone = ajout d'un cue à
//     la position temporelle correspondante.
//   - Curseur de lecture (playhead) déplaçable au clic / drag sur le ruler.
//   - Clic vide sur une lane vide = ouvre le picker à ce temps.

import { el, formatTime } from "../lib/dom.js";
import {
  findEffect, addCue, updateCue, removeCue,
} from "../lib/state.js";
import { CATEGORIES } from "../data/effects.js";

const LANES = [
  { id: "aerial", label: "Aérien",
    partTypes: new Set(["shell", "candle", "rocket", "comet", "cake", "rack", "mortar", "singleShot"]) },
  { id: "ground", label: "Sol",
    partTypes: new Set(["fountain", "gerb", "mine", "flame"]) },
  { id: "sfx",    label: "SFX / Lum.",
    partTypes: new Set(["sfx", "light"]) },
];

function laneOf(eff) {
  if (!eff) return "aerial";
  for (const lane of LANES) {
    if (lane.partTypes.has(eff.partType)) return lane.id;
  }
  return "aerial";
}

export function buildTimeline(ctx, opts = {}) {
  const { show } = ctx;
  const playhead = opts.playhead || null; // { time, onSeek? }

  const wrap = el("div", { class: "timeline-pro" });

  // En-tête : colonne actions à gauche du temps
  const ruler = el("div", { class: "timeline-pro-ruler" });
  const stepSec = chooseStep(show.duration);
  for (let t = 0; t <= show.duration; t += stepSec) {
    const left = (t / show.duration) * 100;
    ruler.appendChild(
      el("div", { class: "timeline-tick", style: { left: `${left}%` } },
        el("span", { class: "timeline-tick-label" }, formatTime(t)))
    );
  }

  // Curseur de lecture (playhead)
  const playheadEl = el("div", { class: "timeline-pro-playhead" });
  const updatePlayhead = (time) => {
    const left = Math.max(0, Math.min(1, time / show.duration)) * 100;
    playheadEl.style.left = `${left}%`;
  };
  if (playhead) updatePlayhead(playhead.time);

  // Click sur le ruler = seek
  if (playhead && typeof playhead.onSeek === "function") {
    ruler.style.cursor = "pointer";
    ruler.addEventListener("click", (e) => {
      const rect = ruler.getBoundingClientRect();
      const t = ((e.clientX - rect.left) / rect.width) * show.duration;
      playhead.onSeek(Math.max(0, Math.min(show.duration, t)));
    });
  }

  // Lanes
  const lanes = el("div", { class: "timeline-pro-lanes" });
  for (const lane of LANES) {
    lanes.appendChild(buildLane(ctx, lane, show));
  }
  lanes.appendChild(playheadEl);

  wrap.append(ruler, lanes);

  return { node: wrap, updatePlayhead };
}

function buildLane(ctx, lane, show) {
  const { selection, refresh, snapshotBefore, showId } = ctx;

  const row = el("div", { class: "timeline-pro-lane", "data-lane": lane.id });
  row.appendChild(el("div", { class: "timeline-pro-lane-label" }, lane.label));

  const stage = el("div", { class: "timeline-pro-lane-stage" });

  // Drop d'un effet depuis la library
  stage.addEventListener("dragover", (e) => {
    const id = e.dataTransfer.types.includes("text/effect-id");
    if (id) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }
  });
  stage.addEventListener("drop", (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/effect-id");
    if (!id) return;
    const rect = stage.getBoundingClientRect();
    const time = ((e.clientX - rect.left) / rect.width) * show.duration;
    snapshotBefore("Ajout d'un cue (drop)");
    const cue = addCue(showId, id, Math.round(time * 10) / 10);
    selection.set([cue.id]);
    refresh();
  });

  // Cues affectés à cette lane
  for (const cue of show.cues) {
    const eff = findEffect(cue.effectId);
    if (!eff) continue;
    if (laneOf(eff) !== lane.id) continue;
    stage.appendChild(buildCueBlock(ctx, cue, eff, show));
  }

  // Click vide sur la lane → désélectionner (ou picker via shift)
  stage.addEventListener("click", (e) => {
    if (e.target !== stage) return;
    if (e.shiftKey || e.altKey) {
      const rect = stage.getBoundingClientRect();
      const time = ((e.clientX - rect.left) / rect.width) * show.duration;
      if (typeof ctx.onEmptyClick === "function") {
        ctx.onEmptyClick(Math.round(time * 10) / 10);
      }
    } else if (!e.ctrlKey && !e.metaKey) {
      selection.clear();
    }
  });

  row.appendChild(stage);
  return row;
}

function buildCueBlock(ctx, cue, eff, show) {
  const { selection, refresh, snapshotBefore, showId } = ctx;
  const cat = CATEGORIES[eff.partType] || CATEGORIES.other;
  const left = (cue.time / show.duration) * 100;
  const width = Math.max(1.5, (eff.duration / show.duration) * 100);
  const isSel = selection.has(cue.id);

  const block = el("div", {
    class: "timeline-pro-cue" + (isSel ? " selected" : ""),
    title: `${eff.name} · ${formatTime(cue.time)}${cue.quantity > 1 ? ` ×${cue.quantity}` : ""}`,
    style: {
      left: `${left}%`,
      width: `${width}%`,
      background: `linear-gradient(90deg, ${cat.color}cc, ${cat.color}55)`,
      borderColor: cat.color,
    },
  });

  block.appendChild(el("span", { class: "studio-cue-icon" }, cat.icon));
  block.appendChild(el("span", { class: "studio-cue-label" }, eff.name));
  if (cue.quantity > 1) {
    block.appendChild(el("span", { class: "qty-badge" }, `×${cue.quantity}`));
  }

  // Sélection au clic
  block.addEventListener("click", (e) => {
    e.stopPropagation();
    if (e.shiftKey || e.ctrlKey || e.metaKey) selection.toggle(cue.id);
    else selection.set([cue.id]);
  });

  // Drag pour déplacer dans le temps
  block.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    if (e.target.closest(".qty-badge, button")) return;
    const stage = block.parentElement;
    const rect = stage.getBoundingClientRect();
    const startX = e.clientX;
    const startTime = cue.time;
    let moved = false;

    // Si pas déjà sélectionné, on isole pour drag mono
    if (!selection.has(cue.id) && !e.shiftKey) {
      selection.set([cue.id]);
    }
    const draggedIds = selection.list();
    const startTimes = new Map();
    for (const id of draggedIds) {
      const c = show.cues.find((x) => x.id === id);
      if (c) startTimes.set(id, c.time);
    }

    block.classList.add("dragging");

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dt = (dx / rect.width) * show.duration;
      if (Math.abs(dx) > 2) moved = true;
      for (const id of draggedIds) {
        const t0 = startTimes.get(id);
        if (t0 == null) continue;
        const newT = clamp(t0 + dt, 0, show.duration);
        const c = show.cues.find((x) => x.id === id);
        if (c) {
          c.time = Math.round(newT * 10) / 10;
          // Repositionner visuellement les blocks correspondants
          updateBlockPosition(stage, c.id, c.time, show.duration);
        }
      }
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      block.classList.remove("dragging");
      if (moved) {
        snapshotBefore("Déplacement de cue(s)");
        for (const id of draggedIds) {
          const c = show.cues.find((x) => x.id === id);
          if (c) updateCue(showId, id, { time: c.time });
        }
        refresh();
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });

  block.dataset.cueId = cue.id;
  return block;
}

function updateBlockPosition(stage, cueId, time, duration) {
  const block = stage.querySelector(`[data-cue-id="${cueId}"]`);
  if (!block) return;
  const left = (time / duration) * 100;
  block.style.left = `${left}%`;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function chooseStep(duration) {
  if (duration <= 30) return 5;
  if (duration <= 60) return 10;
  if (duration <= 180) return 20;
  if (duration <= 600) return 60;
  return 120;
}
