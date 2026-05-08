// Visualiseur stub (V2 — version réécriture).
//
// Squelette fonctionnel : sélection de spectacle, contrôles play/pause,
// progress bar, mini canvas 2D pour visualiser. Le moteur 3D WebGL2
// complet sera porté dans la prochaine itération.

import { el, formatTime, toast } from "../ui/kit.js";
import * as store from "../store.js";
import { partTypeColor } from "../catalog.js";

export function renderViewer(root, navigate, params = {}) {
  let currentId = params.id || (store.getShows()[0] && store.getShows()[0].id);
  let raf = null;
  let playing = false;
  let t = 0;
  let lastFrame = 0;

  root.appendChild(el("header", { class: "page-header" },
    el("div", {},
      el("h1", { class: "page-title" }, "Visualiseur"),
      el("p", { class: "page-subtitle" },
        "Prévisualisation du spectacle. Le moteur 3D sera porté dans la prochaine itération."))));

  if (!store.getShows().length) {
    root.appendChild(el("div", { class: "empty" },
      el("h2", { class: "empty-title" }, "Aucun spectacle à prévisualiser"),
      el("p", { class: "empty-desc" }, "Créez un spectacle d'abord."),
      el("button", {
        class: "btn btn-primary",
        onClick: () => navigate("shows"),
      }, "Aller aux spectacles")));
    return;
  }

  const show = store.getShow(currentId) || store.getShows()[0];
  currentId = show.id;

  // Sélecteur
  const select = el("select", {
    onChange: (e) => {
      currentId = e.target.value;
      navigate("viewer", { id: currentId });
    },
  }, ...store.getShows().map((s) =>
    el("option", { value: s.id, selected: s.id === currentId }, s.name)));

  // Canvas
  const canvas = el("canvas", {
    style: "width: 100%; height: 480px; background: #02030a; border-radius: 6px; display: block;",
  });
  const ctx = canvas.getContext("2d");

  // Contrôles
  const playBtn = el("button", { class: "btn btn-primary", onClick: () => togglePlay() }, "▶ Lecture");
  const resetBtn = el("button", { class: "btn", onClick: () => reset() }, "⟲ Reprendre");
  const timeLabel = el("span", { style: "font-variant-numeric: tabular-nums;" }, "00:00.0");
  const progress = el("div", {
    style: "flex: 1; height: 6px; background: var(--bg-soft); border-radius: 3px; cursor: pointer;",
    onClick: (e) => {
      const r = progress.getBoundingClientRect();
      const ratio = (e.clientX - r.left) / r.width;
      seek(ratio * show.duration);
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
  root.appendChild(el("div", {
    style: "display: flex; gap: 12px; align-items: center; margin-top: 12px;",
  }, playBtn, resetBtn, progress,
    timeLabel,
    el("span", { class: "page-subtitle" }, ` / ${formatTime(show.duration)}`)));

  // Liste des cues à venir
  root.appendChild(el("div", { class: "section" },
    el("h2", { class: "section-title" }, `Cues du spectacle (${show.cues.length})`),
    buildCueList(show)));

  // ---- Boucle ----

  function fitCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const r = canvas.getBoundingClientRect();
    canvas.width = r.width * dpr;
    canvas.height = r.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function reset() {
    playing = false;
    t = 0;
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    redraw();
    playBtn.textContent = "▶ Lecture";
  }

  function seek(time) {
    t = Math.max(0, Math.min(show.duration, time));
    redraw();
  }

  function togglePlay() {
    if (playing) {
      playing = false;
      playBtn.textContent = "▶ Lecture";
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    } else {
      if (t >= show.duration) t = 0;
      playing = true;
      playBtn.textContent = "⏸ Pause";
      lastFrame = performance.now();
      loop();
    }
  }

  function loop() {
    if (!playing) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    t += dt;
    if (t >= show.duration) {
      t = show.duration;
      playing = false;
      playBtn.textContent = "▶ Lecture";
    }
    redraw();
    if (playing) raf = requestAnimationFrame(loop);
  }

  function redraw() {
    fitCanvas();
    const r = canvas.getBoundingClientRect();
    const W = r.width, H = r.height;
    // Fond dégradé nuit
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#02030a");
    g.addColorStop(1, "#0c0f1c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Sol
    ctx.fillStyle = "#070912";
    ctx.fillRect(0, H - 12, W, 12);

    // Cues : tous affichés comme des dots, ceux passés brillent encore
    const maxH = 200;
    for (const cue of show.cues) {
      const eff = store.findEffect(cue.effectId);
      if (!eff) continue;
      const dt = t - cue.time;
      if (dt < 0) continue;             // pas encore tiré
      if (dt > eff.duration) continue;  // déjà fini
      const ratio = Math.min(1, eff.height / maxH);
      const x = ((cue.time / show.duration) * 0.6 + 0.2) * W;
      const y = (H - 12) - ratio * (H - 30);
      const fade = 1 - dt / eff.duration;
      const c = eff.colors[0];
      ctx.fillStyle = c;
      ctx.shadowBlur = 16 * fade;
      ctx.shadowColor = c;
      ctx.beginPath();
      ctx.arc(x, y, 4 + 8 * fade, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    timeLabel.textContent = formatTime(t);
    progressBar.style.width = `${(t / show.duration) * 100}%`;
  }

  redraw();
}

function buildCueList(show) {
  if (!show.cues.length) return el("p", { class: "empty-desc" }, "Aucun cue.");
  const list = el("ul", { style: "list-style: none; padding: 0; margin: 0;" });
  for (const cue of show.cues.slice(0, 20)) {
    const eff = store.findEffect(cue.effectId);
    if (!eff) continue;
    const c = partTypeColor(eff.partType);
    list.appendChild(el("li", {
      style: "display: grid; grid-template-columns: 70px 1fr auto; gap: 8px; align-items: center; padding: 6px 10px; border-bottom: 1px solid var(--border-soft);",
    },
      el("span", { style: "color: var(--text-mute); font-variant-numeric: tabular-nums;" },
        formatTime(cue.time)),
      el("span", {},
        el("span", { style: { color: c, marginRight: "6px" } }, "●"),
        eff.name),
      cue.quantity > 1 ?
        el("span", { class: "badge" }, `×${cue.quantity}`) : null));
  }
  if (show.cues.length > 20) {
    list.appendChild(el("li", { class: "page-subtitle", style: "padding: 6px 10px;" },
      `… et ${show.cues.length - 20} autre(s).`));
  }
  return list;
}
