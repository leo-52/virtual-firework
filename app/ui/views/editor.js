// Éditeur "studio" : layout 3 zones type DAW pyrotechnique.
//
//   ┌─────────────────────────────────────────────────────────────┐
//   │ Topbar (en-tête spectacle, actions globales, géo)            │
//   ├──────────────┬───────────────────────────┬──────────────────┤
//   │ Bibliothèque │ Scène (preview 2D)         │ Inspecteur       │
//   │ (filtre +    │  + sélecteur de cue        │ (props du cue    │
//   │  glisser)    │                           │  sélectionné)    │
//   ├──────────────┴───────────────────────────┴──────────────────┤
//   │ Timeline multi-pistes (cliquable, scroll, sélection)         │
//   └─────────────────────────────────────────────────────────────┘

import {
  el, pageHeader, toast, modal, formatTime, formatPrice, confirmDialog,
} from "../lib/dom.js";
import {
  state, getShow, updateShow, addCue, updateCue, removeCue,
  showCost, isFavorite, toggleFavorite, findEffect, getAllEffects,
  setShowLocation,
} from "../lib/state.js";
import { history } from "../lib/history.js";
import { makeSelection } from "../lib/selection.js";
import { CATEGORIES, SUBTYPES, partTypeLabel, subtypeLabel, EFFECTS } from "../data/effects.js";
import { t } from "../lib/i18n.js";
import { renderInspector } from "./inspector.js";
import { buildTimeline } from "./timeline.js";
import { openPresentation } from "./presentation.js";

let currentEditor = null;

export function getCurrentEditor() { return currentEditor; }

export function renderEditor(main, navigate, params = {}) {
  const show = getShow(params.id);
  if (!show) {
    main.append(
      pageHeader("Spectacle introuvable"),
      el("p", {}, "Le spectacle demandé n'existe pas."),
      el("button", { class: "btn", onClick: () => navigate("shows") }, "← Retour")
    );
    currentEditor = null;
    return;
  }

  // Snapshot initial à l'historique (si stack vide)
  if (history.canUndo() === false && history.canRedo() === false) {
    history.push(state.shows, "Ouverture du spectacle");
  }

  const selection = makeSelection();
  const ctx = {
    showId: show.id,
    show,
    navigate,
    selection,
    refresh: () => {
      const fresh = getShow(show.id);
      if (!fresh) return;
      ctx.show = fresh;
      mainRoot.innerHTML = "";
      buildLayout();
    },
    snapshotBefore: (label) => history.push(state.shows, label),
  };
  currentEditor = ctx;

  const mainRoot = el("div", { class: "studio" });
  main.appendChild(mainRoot);

  function buildLayout() {
    mainRoot.appendChild(studioHeader(ctx));
    mainRoot.appendChild(
      el("div", { class: "studio-body" },
        leftPane(ctx),
        centerPane(ctx),
        rightPane(ctx)
      )
    );
    mainRoot.appendChild(timelineRow(ctx));
  }

  buildLayout();

  // Si le router demande "addEffect", ouvrir le picker
  if (params.addEffect) openEffectPicker(ctx);
}

// ---- Header studio ---------------------------------------------------------

function studioHeader(ctx) {
  const { show, navigate } = ctx;
  return el(
    "header",
    { class: "studio-header" },
    el("div", { class: "studio-header-left" },
      el("button", { class: "btn btn-ghost", onClick: () => navigate("shows") }, "← " + t("file.recent")),
      el("input", {
        type: "text",
        class: "studio-show-name",
        value: show.name,
        onChange: (e) => {
          ctx.snapshotBefore("Renommage");
          updateShow(show.id, { name: e.target.value || show.name });
          ctx.refresh();
        },
      })
    ),
    el("div", { class: "studio-header-stats" },
      stat("Cues", show.cues.length),
      stat("Durée", `${show.duration}s`),
      stat("Coût", formatPrice(showCost(show))),
      show.location ? stat("Lieu", show.location.name || `${show.location.lat.toFixed(3)}, ${show.location.lon.toFixed(3)}`) : null
    ),
    el("div", { class: "studio-header-actions" },
      el("button", { class: "btn", onClick: () => navigate("orders", { id: show.id }) }, "Commande"),
      el("button", {
        class: "btn",
        title: "Mode présentation plein écran (F5)",
        onClick: () => openPresentation(show),
      }, "🎭 Présenter"),
      el("button", {
        class: "btn btn-primary",
        onClick: () => navigate("viewer", { id: show.id }),
      }, "▶ Lancer la prévisu")
    )
  );
}

function stat(label, value) {
  return el("div", { class: "studio-stat" },
    el("span", { class: "studio-stat-label" }, label),
    el("span", { class: "studio-stat-value" }, String(value)));
}

// ---- Pane gauche : bibliothèque condensée ---------------------------------

function leftPane(ctx) {
  const pane = el("aside", { class: "studio-pane studio-pane-left" });
  pane.appendChild(el("div", { class: "studio-pane-header" },
    el("h3", {}, t("library.title")),
    el("button", {
      class: "btn btn-ghost",
      onClick: () => ctx.navigate("library"),
      title: "Ouvrir la bibliothèque complète",
    }, "↗")
  ));

  let search = "";
  let filter = "all"; // "favorites" | "custom" | "<partType>"
  const list = el("div", { class: "studio-lib" });

  const tabs = el("div", { class: "tabs studio-lib-tabs" },
    tab("Tous", () => { filter = "all"; redraw(); }, true),
    tab("⭐", () => { filter = "favorites"; redraw(); }),
    tab("Mes", () => { filter = "custom"; redraw(); }),
  );
  pane.appendChild(tabs);

  pane.appendChild(el("input", {
    type: "text",
    class: "input-search",
    placeholder: t("search"),
    onInput: (e) => { search = e.target.value; redraw(); },
  }));

  function redraw() {
    [...tabs.children].forEach((c) => c.classList.remove("active"));
    if (filter === "all") tabs.children[0].classList.add("active");
    else if (filter === "favorites") tabs.children[1].classList.add("active");
    else if (filter === "custom") tabs.children[2].classList.add("active");

    list.innerHTML = "";
    let items = getAllEffects();
    if (filter === "favorites") items = items.filter((e) => isFavorite(e.id));
    else if (filter === "custom") items = items.filter((e) => e.custom);
    if (search) {
      const s = search.toLowerCase();
      items = items.filter((e) => e.name.toLowerCase().includes(s));
    }
    items = items.slice(0, 80); // pagination triviale
    if (!items.length) {
      list.appendChild(el("p", { class: "empty-desc" }, "Aucun effet."));
      return;
    }
    for (const eff of items) list.appendChild(libItem(eff, ctx));
  }

  redraw();
  pane.appendChild(list);
  return pane;
}

function libItem(eff, ctx) {
  const cat = CATEGORIES[eff.partType] || CATEGORIES.other;
  const fav = isFavorite(eff.id);
  const item = el("div", {
    class: "studio-lib-item",
    draggable: "true",
    title: eff.name,
    onDblclick: () => {
      ctx.snapshotBefore("Ajout d'un cue");
      const t0 = nextCueTime(ctx.show);
      const cue = addCue(ctx.showId, eff.id, t0);
      ctx.selection.set([cue.id]);
      ctx.refresh();
    },
    onDragstart: (e) => {
      e.dataTransfer.setData("text/effect-id", eff.id);
      e.dataTransfer.effectAllowed = "copy";
    },
  });
  item.appendChild(el("div", {
    class: "studio-lib-color",
    style: { background: eff.colors[0] },
  }));
  item.appendChild(el("div", { class: "studio-lib-info" },
    el("div", { class: "studio-lib-name" }, eff.name),
    el("div", { class: "studio-lib-meta" },
      `${cat.icon} ${cat.label}${eff.caliber ? ` · ${eff.caliber}mm` : ""} · ${formatPrice(eff.price)}`)
  ));
  item.appendChild(el("button", {
    class: "studio-fav" + (fav ? " active" : ""),
    title: fav ? "Retirer des favoris" : "Ajouter aux favoris",
    onClick: (e) => {
      e.stopPropagation();
      toggleFavorite(eff.id);
      e.currentTarget.classList.toggle("active");
    },
  }, fav ? "★" : "☆"));
  return item;
}

function nextCueTime(show) {
  if (!show.cues.length) return 0;
  const last = show.cues[show.cues.length - 1];
  const eff = findEffect(last.effectId);
  return Math.min(show.duration, last.time + (eff ? Math.max(2, eff.duration / 2) : 3));
}

// ---- Pane centre : preview ------------------------------------------------

function centerPane(ctx) {
  const pane = el("section", { class: "studio-pane studio-pane-center" });
  pane.appendChild(el("div", { class: "studio-pane-header" },
    el("h3", {}, "Scène"),
    el("button", {
      class: "btn btn-ghost",
      onClick: () => ctx.navigate("viewer", { id: ctx.showId }),
    }, "▶ Plein écran")
  ));

  // Mini-canvas qui montre une "carte 2D" du spectacle : axe X = temps,
  // axe Y = hauteur d'effet, dot = cue. Vue d'ensemble cliquable.
  const canvas = el("canvas", { class: "studio-canvas" });
  pane.appendChild(canvas);
  // Géo
  pane.appendChild(geoSection(ctx));

  requestAnimationFrame(() => drawOverview(canvas, ctx));
  ctx.selection.onChange(() => drawOverview(canvas, ctx));
  return pane;
}

function drawOverview(canvas, ctx) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const cx = canvas.getContext("2d");
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = rect.width, H = rect.height;

  // Background
  const grad = cx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#040611");
  grad.addColorStop(1, "#0c0f1c");
  cx.fillStyle = grad;
  cx.fillRect(0, 0, W, H);

  // Sol
  cx.fillStyle = "#070912";
  cx.fillRect(0, H - 12, W, 12);

  // Axes
  cx.strokeStyle = "rgba(255,255,255,0.06)";
  cx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    cx.beginPath();
    cx.moveTo(0, (H - 12) * (1 - i / 5));
    cx.lineTo(W, (H - 12) * (1 - i / 5));
    cx.stroke();
  }

  const show = ctx.show;
  const sel = new Set(ctx.selection.list());
  const maxH = 200;

  for (const cue of show.cues) {
    const eff = findEffect(cue.effectId);
    if (!eff) continue;
    const x = (cue.time / show.duration) * W;
    const ratio = Math.min(1, eff.height / maxH);
    const y = (H - 12) - ratio * (H - 30);
    const c = eff.colors[0];
    const isSel = sel.has(cue.id);
    cx.shadowBlur = 12;
    cx.shadowColor = c;
    cx.fillStyle = c;
    cx.beginPath();
    cx.arc(x, y, isSel ? 6 : 4, 0, Math.PI * 2);
    cx.fill();
    cx.shadowBlur = 0;

    if (isSel) {
      cx.strokeStyle = "#fff";
      cx.lineWidth = 1.5;
      cx.beginPath();
      cx.arc(x, y, 9, 0, Math.PI * 2);
      cx.stroke();
    }
  }
}

function geoSection(ctx) {
  const wrap = el("div", { class: "studio-geo" });
  const head = el("div", { class: "form-label" }, t("geo.title"));
  wrap.appendChild(head);
  if (ctx.show.location) {
    wrap.appendChild(
      el("div", { class: "studio-geo-info" },
        el("strong", {}, ctx.show.location.name || "Sans nom"),
        el("span", { class: "page-subtitle" },
          ` · ${ctx.show.location.lat.toFixed(5)}, ${ctx.show.location.lon.toFixed(5)}`),
        el("span", { class: "page-subtitle" },
          ` · ${ctx.show.placemarks?.length || 0} repère(s) KML`)
      )
    );
    wrap.appendChild(el("button", {
      class: "btn btn-ghost",
      onClick: () => {
        ctx.snapshotBefore("Suppression du lieu");
        setShowLocation(ctx.showId, null, []);
        ctx.refresh();
      },
    }, "Effacer le lieu"));
  } else {
    wrap.appendChild(el("p", { class: "page-subtitle" }, t("geo.placeholder")));
    wrap.appendChild(el("p", { class: "page-subtitle" },
      "Importez un fichier KML via Fichier → Importer → KML."));
  }
  return wrap;
}

// ---- Pane droite : inspecteur ---------------------------------------------

function rightPane(ctx) {
  const pane = el("aside", { class: "studio-pane studio-pane-right" });
  pane.appendChild(el("div", { class: "studio-pane-header" },
    el("h3", {}, t("inspector.title"))));
  const body = el("div", { class: "studio-inspector" });
  pane.appendChild(body);

  const refresh = () => {
    body.innerHTML = "";
    const ids = ctx.selection.list();
    if (!ids.length) {
      body.appendChild(el("p", { class: "empty-desc" }, t("inspector.empty")));
      return;
    }
    if (ids.length > 1) {
      body.appendChild(el("p", { class: "page-subtitle" },
        `${ids.length} cues sélectionnés.`));
      body.appendChild(buildBulkActions(ctx));
      return;
    }
    const cue = ctx.show.cues.find((c) => c.id === ids[0]);
    if (!cue) {
      ctx.selection.clear();
      return;
    }
    renderInspector(body, ctx, cue);
  };

  ctx.selection.onChange(refresh);
  refresh();
  return pane;
}

function buildBulkActions(ctx) {
  const wrap = el("div", { class: "studio-bulk" });
  const ids = ctx.selection.list();
  const move = el("input", { type: "number", class: "input-inline", value: 0, step: "0.1" });
  wrap.append(
    el("div", { class: "form-label" }, "Décaler tous les cues sélectionnés (s)"),
    el("div", { style: "display: flex; gap: 6px; align-items: center;" },
      move,
      el("button", {
        class: "btn",
        onClick: () => {
          const dt = +move.value;
          if (!dt) return;
          ctx.snapshotBefore("Décalage groupé");
          for (const id of ids) {
            const cue = ctx.show.cues.find((c) => c.id === id);
            if (cue) updateCue(ctx.showId, cue.id, { time: cue.time + dt });
          }
          ctx.refresh();
        },
      }, "Appliquer")),
    el("hr", { class: "studio-sep" }),
    el("button", {
      class: "btn btn-danger",
      onClick: async () => {
        if (!await confirmDialog(`Supprimer ${ids.length} cue(s) ?`)) return;
        ctx.snapshotBefore("Suppression groupée");
        for (const id of ids) removeCue(ctx.showId, id);
        ctx.selection.clear();
        ctx.refresh();
      },
    }, `Supprimer ${ids.length} cue(s)`)
  );
  return wrap;
}

// ---- Timeline -------------------------------------------------------------

function timelineRow(ctx) {
  const { show } = ctx;
  const wrap = el("section", { class: "studio-timeline-wrap" });

  // En-tête timeline avec actions
  wrap.appendChild(el("div", { class: "studio-timeline-header" },
    el("div", { class: "form-label" }, `${t("timeline")} · ${show.cues.length} cue(s)`),
    el("div", { class: "studio-timeline-actions" },
      el("button", {
        class: "btn btn-ghost",
        onClick: () => ctx.selection.clear(),
        disabled: ctx.selection.size() === 0,
      }, t("edit.deselect")),
      el("button", {
        class: "btn btn-ghost",
        onClick: () => ctx.selection.set(show.cues.map((c) => c.id)),
      }, t("edit.selectAll")),
      el("button", {
        class: "btn btn-primary",
        onClick: () => openEffectPicker(ctx),
      }, "+ Ajouter")
    )
  ));

  // Timeline pro multi-pistes (avec hooks pour clic vide)
  ctx.onEmptyClick = (time) => openEffectPicker(ctx, time);
  const tl = buildTimeline(ctx);
  wrap.appendChild(tl.node);
  return wrap;
}

function tab(label, onClick, active) {
  return el("button", {
    class: "tab" + (active ? " active" : ""),
    onClick,
  }, label);
}

// ---- Picker d'effets (réutilisable) ---------------------------------------

export function openEffectPicker(ctx, defaultTime = null) {
  const { show } = ctx;
  let categoryFilter = "all";
  let search = "";

  const list = el("div", { class: "picker-list" });

  const draw = () => {
    list.innerHTML = "";
    const items = getAllEffects().filter((e) => {
      if (categoryFilter !== "all" && e.partType !== categoryFilter) return false;
      if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    if (!items.length) {
      list.appendChild(el("p", { class: "empty-desc" }, "Aucun effet correspondant."));
      return;
    }
    for (const eff of items) {
      const cat = CATEGORIES[eff.partType] || CATEGORIES.other;
      list.appendChild(
        el("div", {
          class: "picker-item",
          onClick: () => {
            const t0 = defaultTime != null ? defaultTime : nextCueTime(show);
            ctx.snapshotBefore("Ajout d'un cue");
            const cue = addCue(ctx.showId, eff.id, t0);
            ctx.selection.set([cue.id]);
            close();
            ctx.refresh();
          },
        },
          el("div", { class: "picker-color", style: { background: eff.colors[0] } }),
          el("div", { class: "picker-info" },
            el("div", { class: "picker-name" }, eff.name),
            el("div", { class: "picker-meta" },
              cat.label,
              eff.caliber ? ` · ${eff.caliber}mm` : "",
              ` · ${eff.duration}s · ${formatPrice(eff.price)}`)
          )
        )
      );
    }
  };

  const filterRow = el("div", { class: "picker-filters" },
    el("input", {
      type: "text",
      placeholder: t("search"),
      onInput: (e) => { search = e.target.value; draw(); },
    }),
    el("select", {
      onChange: (e) => { categoryFilter = e.target.value; draw(); },
    },
      el("option", { value: "all" }, t("all")),
      ...Object.entries(CATEGORIES).map(([k, c]) => el("option", { value: k }, c.label))
    )
  );

  draw();
  const { close } = modal({
    title: defaultTime != null
      ? `Ajouter un effet à ${formatTime(defaultTime)}`
      : "Ajouter un effet",
    body: el("div", {}, filterRow, list),
    footer: [el("button", { class: "btn", onClick: () => close() }, t("close"))],
  });
}
