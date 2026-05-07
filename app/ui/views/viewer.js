import { el, pageHeader, formatTime, toast } from "../lib/dom.js";
import { state, getShow, findEffect } from "../lib/state.js";
import { FireworkSim } from "../sim/firework-sim.js";
import { Renderer } from "../gl/renderer.js";
import { setStatsProvider, openPerfDialog } from "./perf-dialog.js";

export function renderViewer(main, navigate, params = {}) {
  let mode = params.mode || "gl";  // gl | sim | finale3d
  let currentId = params.id || (state.shows[0] && state.shows[0].id);
  let activeRenderer = null; // Renderer | FireworkSim

  main.append(
    pageHeader(
      "Visualiseur",
      "Trois modes : 3D vanilla (notre moteur), simulateur 2D, ou moteur Finale 3D embarqué.",
      [
        el("button", {
          class: "btn",
          onClick: () => openPerfDialog(),
        }, "📊 Diagnostic"),
        el("button", { class: "btn", onClick: () => navigate("shows") }, "← Spectacles"),
      ]
    )
  );

  const tabs = el("div", { class: "tabs" },
    tabButton("Moteur 3D PrevoFX", mode === "gl", () => switchMode("gl")),
    tabButton("Simulateur 2D", mode === "sim", () => switchMode("sim")),
    tabButton("Moteur Finale 3D", mode === "finale3d", () => switchMode("finale3d"))
  );
  main.append(tabs);

  const stage = el("div", { class: "viewer-stage" });
  main.append(stage);

  function switchMode(m) {
    if (activeRenderer && activeRenderer.destroy) activeRenderer.destroy();
    if (activeRenderer && activeRenderer.pause) activeRenderer.pause();
    activeRenderer = null;
    setStatsProvider(null);

    mode = m;
    const idx = ["gl", "sim", "finale3d"].indexOf(m);
    [...tabs.children].forEach((b, i) => b.classList.toggle("active", i === idx));
    stage.innerHTML = "";
    if (m === "gl") renderGL();
    else if (m === "sim") renderSim();
    else renderFinale();
  }

  function renderFinale() {
    stage.appendChild(
      el("div", { class: "viewer-info" },
        el("p", { style: "margin: 0;" },
          "Le moteur Finale 3D d'origine est chargé ci-dessous (mode hors-ligne strict actif)."))
    );
    stage.appendChild(
      el("iframe", {
        class: "viewer-frame",
        src: "../../app.nw/htmlui/index.html",
        allow: "fullscreen",
      })
    );
  }

  function ensureShow() {
    if (!state.shows.length) {
      stage.appendChild(
        el("div", { class: "empty" },
          el("h2", { class: "empty-title" }, "Aucun spectacle à prévisualiser"),
          el("p", { class: "empty-desc" }, "Créez d'abord un spectacle."),
          el("button", { class: "btn btn-primary", onClick: () => navigate("shows") },
            "Aller aux spectacles"))
      );
      return null;
    }
    const show = getShow(currentId) || state.shows[0];
    currentId = show.id;
    return show;
  }

  function buildControls(show, onPlay, onPause, onReset, onSeek) {
    const select = el("select", {
      onChange: (e) => {
        currentId = e.target.value;
        switchMode(mode);
      },
    });
    for (const s of state.shows) {
      const opt = el("option", { value: s.id }, s.name);
      if (s.id === currentId) opt.selected = true;
      select.appendChild(opt);
    }
    const playBtn = el("button", { class: "btn btn-primary", onClick: onPlay }, "▶ Lecture");
    const pauseBtn = el("button", { class: "btn", onClick: onPause }, "⏸ Pause");
    const resetBtn = el("button", { class: "btn", onClick: onReset }, "⟲ Reprendre");
    const timeLabel = el("span", { class: "viewer-time" }, "00:00.0");
    const progress = el("div", { class: "viewer-progress" });
    const progressBar = el("div", { class: "viewer-progress-bar" });
    progress.appendChild(progressBar);
    progress.addEventListener("click", (e) => {
      const rect = progress.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      onSeek(ratio * show.duration);
    });
    const controls = el("div", { class: "viewer-controls" },
      el("div", { class: "viewer-controls-left" },
        el("label", { class: "form-label" }, "Spectacle"),
        select),
      el("div", { class: "viewer-controls-center" },
        playBtn, pauseBtn, resetBtn),
      el("div", { class: "viewer-controls-right" },
        timeLabel,
        el("span", { class: "page-subtitle" }, ` / ${formatTime(show.duration)}`))
    );
    return { controls, progress, progressBar, timeLabel };
  }

  function renderGL() {
    const show = ensureShow();
    if (!show) return;

    const canvas = el("canvas", { class: "viewer-canvas viewer-canvas-3d" });

    let renderer;
    const ctrl = buildControls(show,
      () => renderer && renderer.play(),
      () => renderer && renderer.pause(),
      () => renderer && renderer.reset(),
      (t) => renderer && renderer.seek(t));

    const help = el("div", { class: "viewer-help" },
      el("span", {}, "🖱 Glisser : orbiter · Maj+glisser : pan · Roulette : zoom"));

    stage.append(ctrl.controls, ctrl.progress, canvas, help, buildUpcoming(show));

    requestAnimationFrame(() => {
      try {
        renderer = new Renderer(canvas);
      } catch (e) {
        toast("WebGL2 indisponible : " + e.message);
        return;
      }
      renderer.load(show);
      renderer.onTick = (t, dur) => {
        ctrl.timeLabel.textContent = formatTime(t);
        ctrl.progressBar.style.width = `${(t / dur) * 100}%`;
      };
      renderer.onEnd = () => toast("Spectacle terminé.");
      activeRenderer = renderer;
      setStatsProvider(() => ({
        particles: renderer.particles.count,
        batches: renderer.stats.batches,
        drawCalls: renderer.stats.drawCalls,
        cues: renderer.scheduledEvents.filter((e) => e.fired).length,
      }));
      renderer._render();
    });
  }

  function renderSim() {
    const show = ensureShow();
    if (!show) return;

    const canvas = el("canvas", { class: "viewer-canvas" });
    let sim;
    const ctrl = buildControls(show,
      () => sim && sim.play(),
      () => sim && sim.pause(),
      () => sim && sim.reset(),
      (t) => sim && sim.seek(t));

    stage.append(ctrl.controls, ctrl.progress, canvas, buildUpcoming(show));
    requestAnimationFrame(() => {
      sim = new FireworkSim(canvas);
      sim.load(show);
      sim.onTick = (t, dur) => {
        ctrl.timeLabel.textContent = formatTime(t);
        ctrl.progressBar.style.width = `${(t / dur) * 100}%`;
      };
      sim.onEnd = () => toast("Spectacle terminé.");
      activeRenderer = sim;
      setStatsProvider(() => ({
        particles: sim.particles?.length || 0,
        cues: sim.cuesAll.length - sim.cuesPending.length,
        batches: 1,
      }));
    });
  }

  switchMode(mode);
}

function tabButton(label, active, onClick) {
  return el("button", { class: `tab ${active ? "active" : ""}`, onClick }, label);
}

function buildUpcoming(show) {
  const list = el("div", { class: "viewer-upcoming" });
  list.appendChild(el("div", { class: "section-title", style: "margin-bottom: 8px;" },
    `Cues de ce spectacle (${show.cues.length})`));
  if (!show.cues.length) {
    list.appendChild(el("p", { class: "empty-desc" }, "Aucun cue dans ce spectacle."));
    return list;
  }
  const ul = el("ul", { class: "viewer-cue-list" });
  for (const cue of show.cues.slice(0, 12)) {
    const eff = findEffect(cue.effectId);
    ul.appendChild(
      el("li", {},
        el("span", { class: "viewer-cue-time" }, formatTime(cue.time)),
        el("span", {}, eff ? eff.name : cue.effectId),
        cue.quantity > 1 ? el("span", { class: "qty-badge" }, `×${cue.quantity}`) : null)
    );
  }
  if (show.cues.length > 12) {
    ul.appendChild(el("li", { class: "page-subtitle" }, `… et ${show.cues.length - 12} autre(s)`));
  }
  list.appendChild(ul);
  return list;
}
