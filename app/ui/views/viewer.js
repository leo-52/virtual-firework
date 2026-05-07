import { el, pageHeader, formatTime, toast } from "../lib/dom.js";
import { state, getShow } from "../lib/state.js";
import { FireworkSim } from "../sim/firework-sim.js";

export function renderViewer(main, navigate, params = {}) {
  let mode = params.mode || "sim"; // sim | finale3d
  let currentId = params.id || (state.shows[0] && state.shows[0].id);

  main.append(
    pageHeader(
      "Visualiseur",
      "Prévisualisation rapide (simulateur 2D) ou moteur Finale 3D complet.",
      [el("button", { class: "btn", onClick: () => navigate("shows") }, "← Spectacles")]
    )
  );

  const tabs = el(
    "div",
    { class: "tabs" },
    tabButton("Simulateur 2D", mode === "sim", () => switchMode("sim")),
    tabButton("Moteur 3D (Finale)", mode === "finale3d", () => switchMode("finale3d"))
  );
  main.append(tabs);

  const stage = el("div", { class: "viewer-stage" });
  main.append(stage);

  function switchMode(m) {
    mode = m;
    [...tabs.children].forEach((b, i) => b.classList.toggle("active", i === (m === "sim" ? 0 : 1)));
    stage.innerHTML = "";
    if (m === "sim") renderSim();
    else renderFinale();
  }

  function renderFinale() {
    stage.appendChild(
      el(
        "div",
        { class: "viewer-info" },
        el("p", { style: "margin: 0;" },
          "Le moteur Finale 3D d'origine est chargé ci-dessous. Il fournit l'ensemble des rendus, simulations et effets de l'application initiale.")
      )
    );
    stage.appendChild(
      el("iframe", {
        class: "viewer-frame",
        src: "../../app.nw/htmlui/index.html",
        allow: "fullscreen",
      })
    );
  }

  function renderSim() {
    if (!state.shows.length) {
      stage.appendChild(
        el(
          "div",
          { class: "empty" },
          el("h2", { class: "empty-title" }, "Aucun spectacle à prévisualiser"),
          el("p", { class: "empty-desc" }, "Créez d'abord un spectacle."),
          el("button", { class: "btn btn-primary", onClick: () => navigate("shows") },
            "Aller aux spectacles")
        )
      );
      return;
    }

    const show = getShow(currentId) || state.shows[0];
    currentId = show.id;

    // Sélecteur de spectacle
    const select = el("select", {
      onChange: (e) => {
        currentId = e.target.value;
        renderSim();
      },
    });
    for (const s of state.shows) {
      const opt = el("option", { value: s.id }, s.name);
      if (s.id === currentId) opt.selected = true;
      select.appendChild(opt);
    }

    const canvas = el("canvas", { class: "viewer-canvas" });

    const timeLabel = el("span", { class: "viewer-time" }, "00:00.0");
    const progress = el("div", { class: "viewer-progress" });
    const progressBar = el("div", { class: "viewer-progress-bar" });
    progress.appendChild(progressBar);

    const playBtn = el("button", { class: "btn btn-primary" }, "▶ Lecture");
    const pauseBtn = el("button", { class: "btn" }, "⏸ Pause");
    const resetBtn = el("button", { class: "btn" }, "⟲ Reprendre");

    const controls = el(
      "div",
      { class: "viewer-controls" },
      el("div", { class: "viewer-controls-left" },
        el("label", { class: "form-label" }, "Spectacle"),
        select),
      el("div", { class: "viewer-controls-center" },
        playBtn, pauseBtn, resetBtn),
      el("div", { class: "viewer-controls-right" },
        timeLabel,
        el("span", { class: "page-subtitle" }, ` / ${formatTime(show.duration)}`))
    );

    stage.appendChild(controls);
    stage.appendChild(progress);
    stage.appendChild(canvas);
    stage.appendChild(buildUpcoming(show));

    // Initialise le simulateur après insertion (le canvas a besoin de dimensions)
    requestAnimationFrame(() => {
      const sim = new FireworkSim(canvas);
      sim.load(show);
      sim.onTick = (t, dur) => {
        timeLabel.textContent = formatTime(t);
        progressBar.style.width = `${(t / dur) * 100}%`;
      };
      sim.onEnd = () => toast("Spectacle terminé.");

      playBtn.addEventListener("click", () => sim.play());
      pauseBtn.addEventListener("click", () => sim.pause());
      resetBtn.addEventListener("click", () => sim.reset());

      progress.addEventListener("click", (e) => {
        const rect = progress.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        sim.seek(ratio * show.duration);
      });

      stage._sim = sim;
    });
  }

  switchMode(mode);
}

function tabButton(label, active, onClick) {
  return el(
    "button",
    { class: `tab ${active ? "active" : ""}`, onClick },
    label
  );
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
    ul.appendChild(
      el(
        "li",
        {},
        el("span", { class: "viewer-cue-time" }, formatTime(cue.time)),
        el("span", {}, cue.effectId),
        cue.quantity > 1 ? el("span", { class: "qty-badge" }, `×${cue.quantity}`) : null
      )
    );
  }
  if (show.cues.length > 12) {
    ul.appendChild(el("li", { class: "page-subtitle" }, `… et ${show.cues.length - 12} autre(s)`));
  }
  list.appendChild(ul);
  return list;
}
