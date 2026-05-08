// Éditeur Studio (V2 complet) : 3-zones (lib | scène | inspector) + timeline.

import { el, formatPrice, formatTime, modal, confirm, toast } from "../ui/kit.js";
import * as store from "../store.js";
import {
  PART_TYPES, partTypeColor, partTypeIcon, partTypeLabel,
} from "../catalog.js";
import { history } from "../lib/history.js";
import { makeSelection } from "../lib/selection.js";
import * as clipboard from "../lib/clipboard.js";
import { buildTimeline } from "../ui/timeline.js";
import { renderInspector } from "../ui/inspector.js";
import { registerBinding } from "../shortcuts.js";
import { TEMPLATES } from "../templates.js";
import { openPresentation } from "./presentation.js";
import { onLeave } from "../main.js";

let _cleanups = [];

export function renderEditor(root, navigate, params = {}) {
  // Cleanup any leftover bindings from previous editor session
  _cleanups.forEach((fn) => { try { fn(); } catch {} });
  _cleanups = [];

  const sh = store.getShow(params.id);
  if (!sh) {
    root.appendChild(el("div", { class: "empty" },
      el("h2", { class: "empty-title" }, "Spectacle introuvable"),
      el("button", {
        class: "btn btn-primary",
        onClick: () => navigate("shows"),
      }, "← Retour aux spectacles")));
    return;
  }

  // Snapshot initial dans l'historique
  if (!history.canUndo()) {
    history.push(store.getShows(), "Ouverture éditeur");
  }

  const selection = makeSelection();

  const ctx = {
    showId: sh.id,
    show: sh,
    selection,
    refresh: () => navigate("editor", { id: sh.id }),
    snapshotBefore: (label) => history.push(store.getShows(), label),
    onEmptyClick: (time) => openPicker(ctx, time),
  };

  // ---- Layout 3-zones ----

  const studio = el("div", { class: "studio" });

  // Header
  studio.appendChild(buildHeader(ctx, navigate));

  // Body : grille 3 colonnes
  const body = el("div", { class: "studio-body" });
  body.appendChild(buildLeftPane(ctx));
  body.appendChild(buildCenterPane(ctx));
  body.appendChild(buildRightPane(ctx));
  studio.appendChild(body);

  // Timeline
  studio.appendChild(buildTimelineRow(ctx));

  root.appendChild(studio);

  // ---- Raccourcis contextuels ----

  _cleanups.push(registerBinding("Delete", () => {
    const ids = selection.list();
    if (!ids.length) return;
    ctx.snapshotBefore("Suppression");
    store.removeCues(sh.id, ids);
    selection.clear();
    ctx.refresh();
    toast(`${ids.length} cue(s) supprimé(s).`, "success");
  }));

  _cleanups.push(registerBinding("Ctrl+a", () => {
    selection.set(sh.cues.map((c) => c.id));
    rebuildInspector();
  }));

  _cleanups.push(registerBinding("Escape", () => {
    selection.clear();
    rebuildInspector();
  }));

  // Copy / Cut / Paste / Duplicate
  _cleanups.push(registerBinding("Ctrl+c", () => copyCues(ctx, false)));
  _cleanups.push(registerBinding("Ctrl+x", () => copyCues(ctx, true)));
  _cleanups.push(registerBinding("Ctrl+v", () => pasteCues(ctx)));
  _cleanups.push(registerBinding("Ctrl+d", () => duplicateCues(ctx)));

  // Undo / Redo
  _cleanups.push(registerBinding("Ctrl+z", () => doUndo(ctx)));
  _cleanups.push(registerBinding("Ctrl+y", () => doRedo(ctx)));

  // Trigger redraw of inspector when selection changes
  let rightPane = body.querySelector(".studio-right");
  function rebuildInspector() {
    if (!rightPane) return;
    rightPane.innerHTML = "";
    rightPane.appendChild(buildInspectorContent(ctx));
  }
  selection.onChange(rebuildInspector);

  // Lifecycle : libère les bindings clavier de l'éditeur quand on quitte
  onLeave(() => {
    _cleanups.forEach((fn) => { try { fn(); } catch {} });
    _cleanups = [];
  });
}

// ---- Header ----

function buildHeader(ctx, navigate) {
  const { show, showId } = ctx;
  return el("header", { class: "studio-header" },
    el("div", {
      style: "display: flex; gap: 10px; align-items: center;",
    },
      el("button", {
        class: "btn btn-ghost",
        onClick: () => navigate("shows"),
      }, "← Spectacles"),
      el("input", {
        type: "text", value: show.name,
        class: "studio-name",
        onChange: (e) => {
          ctx.snapshotBefore("Renommage");
          store.updateShow(showId, { name: e.target.value || show.name });
          ctx.refresh();
        },
      })),
    el("div", {
      style: "display: flex; gap: 16px; align-items: center;",
    },
      stat("Cues", show.cues.length),
      stat("Durée", `${show.duration}s`),
      stat("Coût", formatPrice(store.showCost(show))),
      show.location ? stat("Lieu", show.location.name || "📍") : null),
    el("div", { style: "display: flex; gap: 6px;" },
      el("button", {
        class: "btn",
        onClick: () => navigate("orders", { id: showId }),
      }, "Commande"),
      el("button", {
        class: "btn",
        title: "Mode présentation (F5)",
        onClick: () => openPresentation(show),
      }, "🎭 Présenter"),
      el("button", {
        class: "btn btn-primary",
        onClick: () => navigate("viewer", { id: showId }),
      }, "▶ Visualiser")));
}

function stat(label, value) {
  return el("div", { style: "display: flex; flex-direction: column;" },
    el("span", {
      style: "font-size: 9px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-mute);",
    }, label),
    el("span", { style: "font-weight: 600;" }, String(value)));
}

// ---- Left pane : library condensée ----

function buildLeftPane(ctx) {
  const pane = el("aside", { class: "studio-left" });

  pane.appendChild(el("h3", { class: "studio-pane-title" }, "Bibliothèque"));

  let scope = "all";
  let search = "";

  const tabs = el("div", { style: "display: flex; gap: 2px; padding: 0 8px 6px; border-bottom: 1px solid var(--border);" });
  for (const [k, label] of [["all", "Tous"], ["fav", "★"], ["custom", "Mes"]]) {
    const t = el("button", {
      class: "btn btn-ghost",
      style: { padding: "4px 8px", fontSize: "11px",
        background: scope === k ? "var(--accent-soft)" : "transparent" },
      onClick: () => { scope = k; t.classList.add("active"); redraw(); },
    }, label);
    t.dataset.scope = k;
    tabs.appendChild(t);
  }
  pane.appendChild(tabs);

  pane.appendChild(el("input", {
    type: "search", placeholder: "Rechercher…",
    style: "margin: 8px; width: calc(100% - 16px);",
    onInput: (e) => { search = e.target.value; redraw(); },
  }));

  const list = el("div", { class: "studio-lib-list" });
  pane.appendChild(list);

  function redraw() {
    list.innerHTML = "";
    let items = store.getAllEffects();
    if (scope === "fav") items = items.filter((e) => store.isFavorite(e.id));
    else if (scope === "custom") items = items.filter((e) => e.custom);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((e) => e.name.toLowerCase().includes(q));
    }
    items = items.slice(0, 80);

    [...tabs.children].forEach((t) =>
      t.style.background = t.dataset.scope === scope ? "var(--accent-soft)" : "transparent");

    if (!items.length) {
      list.appendChild(el("p", { class: "empty-desc", style: "padding: 12px;" }, "Aucun effet."));
      return;
    }
    for (const eff of items) list.appendChild(libItem(ctx, eff, redraw));
  }
  redraw();
  return pane;
}

function libItem(ctx, eff, refresh) {
  const c = partTypeColor(eff.partType);
  const fav = store.isFavorite(eff.id);

  return el("div", {
    class: "studio-lib-item",
    draggable: true,
    title: eff.name,
    onDblclick: () => {
      const t = nextCueTime(ctx.show);
      ctx.snapshotBefore("Ajout cue");
      const cue = store.addCue(ctx.showId, eff.id, t);
      if (cue) ctx.selection.set([cue.id]);
      ctx.refresh();
    },
    onDragstart: (e) => {
      e.dataTransfer.setData("text/effect-id", eff.id);
      e.dataTransfer.effectAllowed = "copy";
    },
  },
    el("div", {
      style: { background: eff.colors[0], width: "12px", height: "12px",
               borderRadius: "3px", boxShadow: `0 0 6px ${eff.colors[0]}`,
               flex: "0 0 auto" },
    }),
    el("div", { style: "flex: 1; min-width: 0;" },
      el("div", { class: "studio-lib-name" }, eff.name),
      el("div", { class: "studio-lib-meta" },
        `${partTypeLabel(eff.partType)}${eff.caliber ? ` · ${eff.caliber}mm` : ""} · ${formatPrice(eff.price)}`)),
    el("button", {
      class: "btn btn-ghost",
      style: { padding: "0 6px", color: fav ? "#ffd60a" : "var(--text-mute)" },
      onClick: (e) => {
        e.stopPropagation();
        store.toggleFavorite(eff.id);
        refresh();
      },
    }, fav ? "★" : "☆"));
}

function nextCueTime(show) {
  if (!show.cues.length) return 0;
  const last = show.cues[show.cues.length - 1];
  const eff = store.findEffect(last.effectId);
  return Math.min(show.duration, last.time + (eff ? Math.max(2, eff.duration / 2) : 3));
}

// ---- Center pane : aperçu ----

function buildCenterPane(ctx) {
  const pane = el("section", { class: "studio-center" });
  pane.appendChild(el("h3", { class: "studio-pane-title" }, "Aperçu"));

  const canvas = el("canvas", { class: "studio-overview" });
  pane.appendChild(canvas);

  // Section géo
  const geo = el("div", { class: "studio-geo" });
  if (ctx.show.location) {
    geo.appendChild(el("div", {},
      el("strong", {}, ctx.show.location.name || "Sans nom"),
      el("span", { class: "page-subtitle" },
        ` · ${ctx.show.location.lat.toFixed(5)}, ${ctx.show.location.lon.toFixed(5)}`),
      el("span", { class: "page-subtitle" },
        ` · ${ctx.show.placemarks?.length || 0} repère(s)`)));
  } else {
    geo.appendChild(el("p", { class: "empty-desc" },
      "Aucun lieu défini. Importez un KML via Fichier → Importer → KML."));
  }
  pane.appendChild(geo);

  requestAnimationFrame(() => drawOverview(canvas, ctx));
  ctx.selection.onChange(() => drawOverview(canvas, ctx));
  return pane;
}

function drawOverview(canvas, ctx) {
  const dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return;
  canvas.width = r.width * dpr;
  canvas.height = r.height * dpr;
  const cx = canvas.getContext("2d");
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = r.width, H = r.height;
  const g = cx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#040611");
  g.addColorStop(1, "#0c0f1c");
  cx.fillStyle = g;
  cx.fillRect(0, 0, W, H);
  cx.fillStyle = "#070912";
  cx.fillRect(0, H - 12, W, 12);
  cx.strokeStyle = "rgba(255,255,255,0.06)";
  for (let i = 1; i < 5; i++) {
    cx.beginPath(); cx.moveTo(0, (H - 12) * (1 - i / 5));
    cx.lineTo(W, (H - 12) * (1 - i / 5)); cx.stroke();
  }
  const sel = new Set(ctx.selection.list());
  const maxH = 200;
  for (const cue of ctx.show.cues) {
    const eff = store.findEffect(cue.effectId);
    if (!eff) continue;
    const x = (cue.time / ctx.show.duration) * W;
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
      cx.strokeStyle = "#fff"; cx.lineWidth = 1.5;
      cx.beginPath(); cx.arc(x, y, 9, 0, Math.PI * 2); cx.stroke();
    }
  }
}

// ---- Right pane : inspector ----

function buildRightPane(ctx) {
  const pane = el("aside", { class: "studio-right" });
  pane.appendChild(buildInspectorContent(ctx));
  return pane;
}

function buildInspectorContent(ctx) {
  const wrap = document.createDocumentFragment();
  const head = el("h3", { class: "studio-pane-title" }, "Inspecteur");
  wrap.appendChild(head);
  const body = el("div", { class: "studio-inspector" });

  const ids = ctx.selection.list();
  if (!ids.length) {
    body.appendChild(el("p", { class: "empty-desc" },
      "Sélectionnez un cue pour voir ses propriétés."));
  } else if (ids.length > 1) {
    body.appendChild(el("p", { class: "page-subtitle" },
      `${ids.length} cues sélectionnés.`));
    body.appendChild(buildBulkActions(ctx));
  } else {
    const cue = ctx.show.cues.find((c) => c.id === ids[0]);
    if (cue) renderInspector(body, ctx, cue);
  }
  wrap.appendChild(body);
  return wrap;
}

function buildBulkActions(ctx) {
  const ids = ctx.selection.list();
  const move = el("input", { type: "number", value: 0, step: 0.1, style: "width: 80px;" });
  return el("div", {},
    el("label", { class: "field-label" }, "Décaler tous (s)"),
    el("div", { style: "display: flex; gap: 6px; align-items: center; margin-bottom: 12px;" },
      move,
      el("button", {
        class: "btn",
        onClick: () => {
          const dt = +move.value;
          if (!dt) return;
          ctx.snapshotBefore("Décalage groupé");
          for (const id of ids) {
            const c = ctx.show.cues.find((x) => x.id === id);
            if (c) store.updateCue(ctx.showId, id, { time: c.time + dt });
          }
          ctx.refresh();
        },
      }, "Appliquer")),
    el("button", {
      class: "btn btn-danger",
      style: "width: 100%;",
      onClick: async () => {
        if (!await confirm(`Supprimer ${ids.length} cue(s) ?`,
          { danger: true, okLabel: "Supprimer" })) return;
        ctx.snapshotBefore("Suppression groupée");
        store.removeCues(ctx.showId, ids);
        ctx.selection.clear();
        ctx.refresh();
      },
    }, `Supprimer ${ids.length} cue(s)`));
}

// ---- Timeline row ----

function buildTimelineRow(ctx) {
  const wrap = el("section", { class: "studio-timeline-wrap" });
  wrap.appendChild(el("div", {
    style: "display: flex; justify-content: space-between; align-items: center; padding: 8px 14px;",
  },
    el("div", { class: "field-label" },
      `Timeline · ${ctx.show.cues.length} cue(s)`),
    el("div", { style: "display: flex; gap: 4px;" },
      el("button", {
        class: "btn btn-ghost",
        onClick: () => ctx.selection.clear(),
        disabled: ctx.selection.size() === 0,
      }, "Désélectionner"),
      el("button", {
        class: "btn btn-ghost",
        onClick: () => ctx.selection.set(ctx.show.cues.map((c) => c.id)),
      }, "Tout sélectionner"),
      el("button", {
        class: "btn btn-primary",
        onClick: () => openPicker(ctx),
      }, "+ Ajouter"))));

  const tl = buildTimeline(ctx);
  wrap.appendChild(tl.node);
  return wrap;
}

// ---- Picker ----

function openPicker(ctx, defaultTime = null) {
  let search = "";
  let partType = "all";

  const list = el("div", {
    style: "max-height: 50vh; overflow-y: auto;",
  });

  const draw = () => {
    list.innerHTML = "";
    let items = store.getAllEffects();
    if (partType !== "all") items = items.filter((e) => e.partType === partType);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((e) => e.name.toLowerCase().includes(q));
    }
    items.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    if (!items.length) {
      list.appendChild(el("p", { class: "empty-desc" }, "Aucun effet."));
      return;
    }
    for (const eff of items.slice(0, 100)) {
      list.appendChild(el("div", {
        style: "display: flex; gap: 8px; padding: 6px 10px; border-radius: 4px; cursor: pointer; align-items: center; border: 1px solid transparent;",
        onClick: () => {
          const t = defaultTime != null ? defaultTime : nextCueTime(ctx.show);
          ctx.snapshotBefore("Ajout cue");
          const cue = store.addCue(ctx.showId, eff.id, t);
          if (cue) ctx.selection.set([cue.id]);
          close();
          ctx.refresh();
        },
        onMouseenter: (e) => e.currentTarget.style.background = "var(--bg-soft)",
        onMouseleave: (e) => e.currentTarget.style.background = "transparent",
      },
        el("div", {
          style: { background: eff.colors[0], width: "10px", height: "10px",
                   borderRadius: "50%", boxShadow: `0 0 6px ${eff.colors[0]}` },
        }),
        el("div", { style: "flex: 1;" },
          el("div", { style: "font-size: 12px;" }, eff.name),
          el("div", { style: "font-size: 10px; color: var(--text-mute);" },
            `${partTypeLabel(eff.partType)}${eff.caliber ? ` · ${eff.caliber}mm` : ""} · ${eff.duration}s · ${formatPrice(eff.price)}`))));
    }
  };

  const ptSelect = el("select", {
    onChange: (e) => { partType = e.target.value; draw(); },
  },
    el("option", { value: "all" }, "Tous types"),
    ...Object.keys(PART_TYPES).map((k) =>
      el("option", { value: k }, partTypeLabel(k))));

  draw();
  const { close } = modal({
    title: defaultTime != null
      ? `Ajouter à ${formatTime(defaultTime)}`
      : "Ajouter un cue",
    body: el("div", {},
      el("div", { style: "display: flex; gap: 8px; margin-bottom: 12px;" },
        el("input", {
          type: "search", placeholder: "Rechercher…", style: "flex: 1;",
          onInput: (e) => { search = e.target.value; draw(); },
        }),
        ptSelect),
      list),
    footer: [el("button", { class: "btn", onClick: () => close() }, "Fermer")],
  });
}

// ---- Copy / Cut / Paste / Duplicate ----

function copyCues(ctx, remove) {
  const ids = ctx.selection.list();
  if (!ids.length) return;
  const cues = ctx.show.cues
    .filter((c) => ids.includes(c.id))
    .map((c) => ({
      effectId: c.effectId, time: c.time, quantity: c.quantity,
      notes: c.notes, tags: c.tags, envelope: c.envelope,
    }));
  const minT = Math.min(...cues.map((c) => c.time));
  clipboard.set("cues", { cues, originTime: minT });
  if (remove) {
    ctx.snapshotBefore("Couper");
    store.removeCues(ctx.showId, ids);
    ctx.selection.clear();
    ctx.refresh();
  }
  toast(`${cues.length} cue(s) ${remove ? "coupé(s)" : "copié(s)"}.`, "success");
}

function pasteCues(ctx) {
  const data = clipboard.get();
  if (!data || data.kind !== "cues") {
    toast("Presse-papier vide.", "warning");
    return;
  }
  const cues = data.payload.cues;
  if (!cues.length) return;

  const sel = ctx.selection.list()
    .map((id) => ctx.show.cues.find((c) => c.id === id))
    .filter(Boolean);
  let target = sel.length
    ? Math.max(...sel.map((c) => c.time)) + 0.5
    : data.payload.originTime + 1;
  const offset = target - data.payload.originTime;

  ctx.snapshotBefore("Coller");
  const newIds = [];
  for (const c of cues) {
    if (!store.findEffect(c.effectId)) continue;
    const t = Math.max(0, Math.min(ctx.show.duration, c.time + offset));
    const cue = store.addCue(ctx.showId, c.effectId, t, c.quantity);
    if (cue) {
      if (c.notes) store.updateCue(ctx.showId, cue.id, { notes: c.notes });
      if (c.tags) store.updateCue(ctx.showId, cue.id, { tags: c.tags });
      if (c.envelope) store.updateCue(ctx.showId, cue.id, { envelope: c.envelope });
      newIds.push(cue.id);
    }
  }
  ctx.selection.set(newIds);
  ctx.refresh();
  toast(`${newIds.length} cue(s) collé(s).`, "success");
}

function duplicateCues(ctx) {
  const ids = ctx.selection.list();
  if (!ids.length) return;
  ctx.snapshotBefore("Dupliquer");
  const newIds = [];
  for (const id of ids) {
    const c = ctx.show.cues.find((x) => x.id === id);
    if (!c) continue;
    const t = Math.min(ctx.show.duration, c.time + 1);
    const cue = store.addCue(ctx.showId, c.effectId, t, c.quantity);
    if (cue) newIds.push(cue.id);
  }
  ctx.selection.set(newIds);
  ctx.refresh();
  toast(`${newIds.length} cue(s) dupliqué(s).`, "success");
}

// ---- Undo / Redo ----

function doUndo(ctx) {
  const snap = history.undo();
  if (!snap) return;
  store.replaceShows(snap);
  if (!store.getShow(ctx.showId)) {
    toast("Annulation : spectacle disparu.", "warning");
    return;
  }
  ctx.refresh();
  toast("Annulation.", "info");
}

function doRedo(ctx) {
  const snap = history.redo();
  if (!snap) return;
  store.replaceShows(snap);
  if (!store.getShow(ctx.showId)) {
    toast("Rétablissement : spectacle disparu.", "warning");
    return;
  }
  ctx.refresh();
  toast("Rétablissement.", "info");
}
