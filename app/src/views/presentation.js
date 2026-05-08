// Mode présentation : full-screen avec gros timer + 3 prochains cues.

import { el, formatTime, toast } from "../ui/kit.js";
import * as store from "../store.js";
import { partTypeColor, partTypeIcon } from "../catalog.js";
import { Renderer } from "../engine/renderer.js";
import { AudioPlayer } from "../tools/audio.js";

export function openPresentation(show) {
  const overlay = el("div", { class: "presentation" });
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  const top = el("div", { class: "presentation-top" });
  const main = el("div", { class: "presentation-main" });
  const bottom = el("div", { class: "presentation-bottom" });
  overlay.append(top, main, bottom);

  top.appendChild(el("div", {},
    el("strong", { style: "font-size: 16px;" }, show.name),
    el("span", { style: "color: var(--text-soft); margin-left: 12px;" },
      `${show.cues.length} cue(s) · ${formatTime(show.duration)}`)));
  top.appendChild(el("button", {
    class: "btn",
    onClick: () => close(),
  }, "Quitter (Échap)"));

  const canvas = el("canvas", {
    style: "width: 100%; height: 100%; display: block;",
  });
  main.appendChild(canvas);

  const timer = el("div", { class: "presentation-timer" }, "00:00.0");
  const upcoming = el("div", { class: "presentation-upcoming" });
  const ctrls = el("div", { style: "display: flex; gap: 6px;" },
    el("button", { class: "btn btn-primary", onClick: () => onPlay() }, "▶ Lecture"),
    el("button", { class: "btn", onClick: () => onPause() }, "⏸ Pause"),
    el("button", { class: "btn", onClick: () => onReset() }, "⟲ Reprendre"));
  bottom.append(timer, upcoming, ctrls);

  // Init renderer
  let renderer, audio;
  try {
    renderer = new Renderer(canvas);
  } catch (e) {
    toast("WebGL2 indisponible : " + e.message, "error");
    close();
    return;
  }
  renderer.load(show);
  renderer.onTick = (t) => {
    timer.textContent = formatTime(t);
    refreshUpcoming(t);
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
    if (audio?.buffer) audio.play(renderer.t);
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
      const eff = store.findEffect(cue.effectId);
      if (!eff) continue;
      const c = partTypeColor(eff.partType);
      upcoming.appendChild(el("div", { class: "presentation-cue" },
        el("span", { style: { color: c, fontSize: "20px" } },
          partTypeIcon(eff.partType)),
        el("div", {},
          el("strong", {}, eff.name),
          el("div", { style: "font-size: 11px; color: var(--text-soft);" },
            `dans ${(cue.time - t).toFixed(1)}s · ${formatTime(cue.time)}`),
          cue.notes ? el("div", { style: "font-size: 11px; color: #ffd60a; margin-top: 2px;" },
            "📝 " + cue.notes) : null)));
    }
    if (!next.length) {
      upcoming.appendChild(el("p", { class: "page-subtitle" }, "Plus de cue à venir."));
    }
  }
  refreshUpcoming(0);

  function close() {
    if (renderer) {
      try { renderer.pause(); } catch {}
      try { renderer.destroy?.(); } catch {}
    }
    if (audio) audio.stop();
    document.removeEventListener("keydown", onKey);
    document.body.style.overflow = "";
    overlay.remove();
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
