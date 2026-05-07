// Mode présentation : full-screen overlay avec gros timer et liste des
// 3 prochains cues. Pour le terrain, lecture sans distractions.
//
// Reçoit un renderer/sim actif, lui demande son t et duration via callback.
// Démarre lui-même un AudioPlayer si le show a un audio.

import { el, formatTime, toast } from "../lib/dom.js";
import { findEffect } from "../lib/state.js";
import { CATEGORIES } from "../data/effects.js";
import { AudioPlayer } from "../lib/audio.js";
import { Renderer } from "../gl/renderer.js";

export function openPresentation(show) {
  const overlay = el("div", { class: "presentation-overlay" });
  document.body.appendChild(overlay);
  document.body.classList.add("presentation-active");

  // Layout
  const top = el("div", { class: "presentation-top" });
  const main = el("div", { class: "presentation-main" });
  const bottom = el("div", { class: "presentation-bottom" });
  overlay.append(top, main, bottom);

  // Titre + sortie
  top.appendChild(el("div", { class: "presentation-title" },
    el("strong", {}, show.name),
    el("span", { class: "page-subtitle" },
      ` · ${show.cues.length} cue(s) · ${formatTime(show.duration)}`)));
  const closeBtn = el("button", { class: "btn",
    onClick: () => close() }, "Quitter (Échap)");
  top.appendChild(closeBtn);

  // Canvas 3D principal
  const canvas = el("canvas", { class: "presentation-canvas" });
  main.appendChild(canvas);

  // Bandeau bas : timer + prochains cues + contrôles
  const timer = el("div", { class: "presentation-timer" }, "00:00.0");
  const upcoming = el("div", { class: "presentation-upcoming" });
  const controls = el("div", { class: "presentation-controls" },
    el("button", { class: "btn btn-primary",
      onClick: () => onPlay() }, "▶ Lecture"),
    el("button", { class: "btn",
      onClick: () => onPause() }, "⏸ Pause"),
    el("button", { class: "btn",
      onClick: () => onReset() }, "⟲ Reprendre"));
  bottom.append(timer, upcoming, controls);

  // Init renderer
  let renderer;
  let audio;
  try {
    renderer = new Renderer(canvas);
  } catch (e) {
    toast("WebGL2 indisponible : " + e.message);
    close();
    return;
  }
  renderer.load(show);
  renderer.onTick = (t, dur) => {
    timer.textContent = formatTime(t);
    refreshUpcoming(t);
    if (dur > 0 && t >= dur) timer.classList.add("done");
    else timer.classList.remove("done");
  };
  renderer.onEnd = () => {
    if (audio) audio.stop();
  };

  if (show.audio?.dataUrl) {
    audio = new AudioPlayer();
    audio.setFromDataUrl(show.audio.dataUrl).catch(() => { audio = null; });
  }

  function onPlay() {
    renderer.play();
    if (audio && audio.buffer) audio.play(renderer.t);
  }
  function onPause() {
    renderer.pause();
    if (audio) audio.pause();
  }
  function onReset() {
    renderer.reset();
    if (audio) { audio.stop(); audio.startOffset = 0; }
  }

  function refreshUpcoming(t) {
    upcoming.innerHTML = "";
    const next = show.cues
      .filter((c) => c.time >= t)
      .sort((a, b) => a.time - b.time)
      .slice(0, 3);
    for (const cue of next) {
      const eff = findEffect(cue.effectId);
      if (!eff) continue;
      const cat = CATEGORIES[eff.partType] || CATEGORIES.other;
      const dt = cue.time - t;
      upcoming.appendChild(
        el("div", { class: "presentation-cue" },
          el("span", {
            class: "presentation-cue-icon",
            style: { color: cat.color },
          }, cat.icon),
          el("div", { class: "presentation-cue-info" },
            el("strong", {}, eff.name),
            el("span", { class: "page-subtitle" },
              ` · dans ${dt.toFixed(1)}s · ${formatTime(cue.time)}`)),
          cue.notes ? el("div", { class: "presentation-cue-notes" },
            "📝 " + cue.notes) : null
        )
      );
    }
    if (!next.length) {
      upcoming.appendChild(el("p", { class: "page-subtitle" },
        "Plus de cue à venir."));
    }
  }
  refreshUpcoming(0);

  function close() {
    if (renderer) {
      renderer.pause();
      renderer.destroy();
    }
    if (audio) audio.stop();
    document.removeEventListener("keydown", onKey);
    overlay.remove();
    document.body.classList.remove("presentation-active");
  }

  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    if (e.key === " ") {
      e.preventDefault();
      if (renderer.playing) onPause();
      else onPlay();
    }
  }
  document.addEventListener("keydown", onKey);
}
