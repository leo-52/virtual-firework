// Visualiseur V2 complet : moteur 3D WebGL2 + audio sync + presets caméra.

import { el, formatTime, toast } from "../ui/kit.js";
import * as store from "../store.js";
import { Renderer } from "../engine/renderer.js";
import { AudioPlayer, playBeep } from "../tools/audio.js";
import { onLeave } from "../main.js";

export function renderViewer(root, navigate, params = {}) {
  let currentId = params.id || (store.getShows()[0] && store.getShows()[0].id);
  let renderer = null;
  let audio = null;
  let switchToken = 0;

  if (!store.getShows().length) {
    root.appendChild(el("header", { class: "page-header" },
      el("div", {}, el("h1", { class: "page-title" }, "Visualiseur"))));
    root.appendChild(el("div", { class: "empty" },
      el("h2", { class: "empty-title" }, "Aucun spectacle"),
      el("p", { class: "empty-desc" }, "Créez d'abord un spectacle."),
      el("button", {
        class: "btn btn-primary",
        onClick: () => navigate("shows"),
      }, "Aller aux spectacles")));
    return;
  }

  const show = store.getShow(currentId) || store.getShows()[0];
  currentId = show.id;

  // Header
  root.appendChild(el("header", { class: "page-header" },
    el("div", {},
      el("h1", { class: "page-title" }, "Visualiseur"),
      el("p", { class: "page-subtitle" }, `Moteur FX 3D · ${show.name}`)),
    el("div", { class: "page-actions" },
      el("button", {
        class: "btn",
        onClick: () => navigate("editor", { id: show.id }),
      }, "← Éditer"))));

  // Sélecteur
  const select = el("select", {
    onChange: (e) => {
      currentId = e.target.value;
      navigate("viewer", { id: currentId });
    },
  }, ...store.getShows().map((s) =>
    el("option", { value: s.id, selected: s.id === currentId }, s.name)));

  // Canvas
  const canvas = el("canvas", { class: "viewer-canvas" });

  // Contrôles
  const playBtn = el("button", { class: "btn btn-primary", onClick: () => playToggle() }, "▶ Lecture");
  const resetBtn = el("button", { class: "btn", onClick: () => doReset() }, "⟲ Reprendre");
  const timeLabel = el("span", { style: "font-variant-numeric: tabular-nums;" }, "00:00.0");
  const progress = el("div", {
    style: "flex: 1; height: 6px; background: var(--bg-soft); border-radius: 3px; cursor: pointer;",
    onClick: (e) => {
      const r = progress.getBoundingClientRect();
      const ratio = (e.clientX - r.left) / r.width;
      doSeek(ratio * show.duration);
    },
  });
  const progressBar = el("div", {
    style: "height: 100%; width: 0%; background: var(--accent); border-radius: 3px; transition: width 50ms linear;",
  });
  progress.appendChild(progressBar);

  root.appendChild(el("div", {
    style: "display: flex; gap: 8px; align-items: center; margin-bottom: 12px;",
  }, el("label", { class: "field-label" }, "Spectacle"), select));
  root.appendChild(canvas);

  // Toolbar contrôles
  root.appendChild(el("div", {
    style: "display: flex; gap: 12px; align-items: center; margin-top: 10px;",
  }, playBtn, resetBtn, progress, timeLabel,
    el("span", { class: "page-subtitle" }, ` / ${formatTime(show.duration)}`)));

  // Toolbar caméra + bloom + audio
  const cam = el("div", { class: "viewer-toolbar" });
  cam.appendChild(el("span", { class: "field-label" }, "Caméra"));
  for (const [label, k] of [
    ["Spectateur", "spectator"],
    ["Tireur", "shooter"],
    ["Plongée", "topdown"],
    ["Dramatique", "dramatic"],
    ["Reset", "default"],
  ]) {
    cam.appendChild(el("button", {
      class: "btn btn-ghost",
      onClick: () => renderer && renderer.applyCameraPreset(k),
    }, label));
  }

  cam.appendChild(el("span", { class: "viewer-toolbar-sep" }));

  const bloomToggle = el("input", { type: "checkbox" });
  bloomToggle.checked = store.getSettings().bloom !== false;
  bloomToggle.addEventListener("change", () =>
    renderer && renderer.setBloomEnabled(bloomToggle.checked));
  cam.appendChild(el("label", { class: "viewer-toolbar-item" }, bloomToggle, "Bloom"));

  const bloomSlider = el("input", {
    type: "range", min: 0, max: 2, step: 0.05,
    value: String(store.getSettings().bloomIntensity ?? 0.9),
    onInput: (e) => renderer && renderer.setBloomIntensity(+e.target.value),
  });
  cam.appendChild(el("label", { class: "viewer-toolbar-item" }, "Intensité", bloomSlider));

  cam.appendChild(el("span", { class: "viewer-toolbar-sep" }));

  const beepToggle = el("input", { type: "checkbox" });
  beepToggle.checked = !!store.getSettings().beepOnCue;
  cam.appendChild(el("label", { class: "viewer-toolbar-item" }, beepToggle, "Bip cue"));

  const volSlider = el("input", {
    type: "range", min: 0, max: 1, step: 0.05, value: 1,
    onInput: (e) => audio && audio.setVolume(+e.target.value),
  });
  cam.appendChild(el("label", { class: "viewer-toolbar-item" }, "Volume", volSlider));

  root.appendChild(cam);

  root.appendChild(el("p", {
    style: "margin-top: 8px; padding: 6px 10px; font-size: 11px; color: var(--text-soft); background: var(--bg-soft); border-radius: 4px; text-align: center;",
  }, "🖱 Glisser : orbiter · Maj+glisser : pan · Roulette : zoom"));

  // ---- Init renderer ----

  switchToken++;
  const myToken = switchToken;
  requestAnimationFrame(() => {
    if (myToken !== switchToken) return;
    try {
      renderer = new Renderer(canvas);
    } catch (e) {
      toast("WebGL2 indisponible : " + e.message, "error");
      return;
    }
    renderer.load(show);
    renderer.onTick = (t, dur) => {
      timeLabel.textContent = formatTime(t);
      progressBar.style.width = `${(t / dur) * 100}%`;
    };
    renderer.onEnd = () => {
      toast("Spectacle terminé.", "success");
      if (audio) audio.stop();
    };
    renderer.onCueFired = () => {
      if (beepToggle.checked) playBeep(880, 0.05, 0.15);
    };
    renderer.setBloomEnabled(bloomToggle.checked);
    renderer.setBloomIntensity(+bloomSlider.value);
    attachAudio(show);
  });

  async function attachAudio(show) {
    if (audio) { audio.stop(); audio = null; }
    if (!show.audio?.dataUrl) return;
    try {
      audio = new AudioPlayer();
      await audio.setFromDataUrl(show.audio.dataUrl);
      audio.setVolume(+volSlider.value);
    } catch (e) {
      toast("Audio illisible : " + e.message, "warning");
      audio = null;
    }
  }

  // ---- Contrôles ----

  function playToggle() {
    if (!renderer) return;
    if (renderer.playing) {
      renderer.pause();
      if (audio) audio.pause();
      playBtn.textContent = "▶ Lecture";
    } else {
      renderer.play();
      if (audio?.buffer) audio.play(renderer.t);
      playBtn.textContent = "⏸ Pause";
    }
  }
  function doReset() {
    if (!renderer) return;
    renderer.reset();
    if (audio) { audio.stop(); audio.startOffset = 0; }
    playBtn.textContent = "▶ Lecture";
  }
  function doSeek(t) {
    if (!renderer) return;
    renderer.seek(t);
    if (audio) {
      if (renderer.playing) audio.play(t);
      else { audio.stop(); audio.startOffset = t; }
    }
  }

  // Cleanup quand on change de route
  onLeave(() => {
    switchToken++; // annule tout init en cours
    if (renderer) {
      try { renderer.pause?.(); } catch {}
      try { renderer.destroy?.(); } catch {}
      renderer = null;
    }
    if (audio) {
      try { audio.stop(); } catch {}
      audio = null;
    }
  });
}
