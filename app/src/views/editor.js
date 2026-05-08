// Éditeur stub V2.
//
// Squelette fonctionnel : édition basique d'un spectacle (nom, durée,
// description, ajout/suppression de cues, table des cues éditable).
// L'éditeur studio 3-zones avec timeline pro et inspector sera porté
// dans la prochaine itération.

import { el, formatPrice, formatTime, prompt, confirm, toast, modal } from "../ui/kit.js";
import * as store from "../store.js";
import {
  PART_TYPES, partTypeLabel, partTypeColor, partTypeIcon, subtypeLabel,
} from "../catalog.js";

export function renderEditor(root, navigate, params = {}) {
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

  const refresh = () => navigate("editor", { id: sh.id });

  // Header
  root.appendChild(el("header", { class: "page-header" },
    el("div", {},
      el("h1", { class: "page-title" }, sh.name),
      el("p", { class: "page-subtitle" },
        `${sh.cues.length} cue(s) · ${sh.duration}s · ${formatPrice(store.showCost(sh))}`)),
    el("div", { class: "page-actions" },
      el("button", { class: "btn", onClick: () => navigate("shows") }, "← Retour"),
      el("button", {
        class: "btn",
        onClick: () => navigate("orders", { id: sh.id }),
      }, "Commande"),
      el("button", {
        class: "btn btn-primary",
        onClick: () => navigate("viewer", { id: sh.id }),
      }, "▶ Visualiser"))));

  // Métadonnées éditables
  const metaGrid = el("div", {
    style: "display: grid; grid-template-columns: 2fr 1fr 3fr; gap: 12px; margin-bottom: 18px;",
  });
  metaGrid.appendChild(field("Nom",
    el("input", {
      type: "text", value: sh.name,
      onChange: (e) => {
        store.updateShow(sh.id, { name: e.target.value || sh.name });
        refresh();
      },
    })));
  metaGrid.appendChild(field("Durée (s)",
    el("input", {
      type: "number", min: 5, max: 1800, value: sh.duration,
      onChange: (e) => {
        store.updateShow(sh.id, { duration: +e.target.value || sh.duration });
        refresh();
      },
    })));
  metaGrid.appendChild(field("Description",
    el("input", {
      type: "text", value: sh.description || "",
      onChange: (e) => store.updateShow(sh.id, { description: e.target.value }),
    })));
  root.appendChild(metaGrid);

  // Timeline simple
  root.appendChild(el("div", {
    style: "display: flex; justify-content: space-between; align-items: center; margin: 18px 0 8px;",
  },
    el("h2", { class: "section-title" }, "Timeline"),
    el("button", {
      class: "btn btn-primary",
      onClick: () => openPicker(sh, refresh),
    }, "+ Ajouter un cue")));
  root.appendChild(buildTimeline(sh, refresh));

  // Tableau des cues
  root.appendChild(el("h2", { class: "section-title", style: "margin-top: 18px;" },
    `Liste des cues (${sh.cues.length})`));
  root.appendChild(buildCueTable(sh, refresh));
}

function field(label, control) {
  return el("div", { class: "field" },
    el("span", { class: "field-label" }, label),
    control);
}

function buildTimeline(sh, refresh) {
  const wrap = el("div", {
    style: "position: relative; height: 60px; background: var(--bg-elev); border: 1px solid var(--border); border-radius: 6px; overflow: hidden;",
  });
  // Ticks
  const stepSec = sh.duration <= 30 ? 5 : sh.duration <= 180 ? 20 : 60;
  for (let t = 0; t <= sh.duration; t += stepSec) {
    const left = (t / sh.duration) * 100;
    wrap.appendChild(el("div", {
      style: {
        position: "absolute", left: `${left}%`, top: 0, bottom: 0,
        borderLeft: "1px solid var(--border)", paddingLeft: "4px",
        fontSize: "10px", color: "var(--text-mute)",
      },
    }, formatTime(t)));
  }
  // Cues
  for (const cue of sh.cues) {
    const eff = store.findEffect(cue.effectId);
    if (!eff) continue;
    const left = (cue.time / sh.duration) * 100;
    const c = partTypeColor(eff.partType);
    const w = Math.max(1.5, (eff.duration / sh.duration) * 100);
    wrap.appendChild(el("div", {
      title: `${eff.name} · ${formatTime(cue.time)}`,
      style: {
        position: "absolute",
        left: `${left}%`,
        width: `${w}%`,
        top: "8px",
        bottom: "8px",
        background: `${c}55`,
        borderLeft: `3px solid ${c}`,
        borderRadius: "3px",
        cursor: "pointer",
        padding: "4px 6px",
        fontSize: "11px",
        color: "#fff",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      },
      onClick: () => openEditCue(sh, cue, refresh),
    }, partTypeIcon(eff.partType), " ", eff.name));
  }
  return wrap;
}

function buildCueTable(sh, refresh) {
  if (!sh.cues.length) {
    return el("p", { class: "empty-desc" }, "Aucun cue. Cliquez sur « + Ajouter un cue ».");
  }
  const t = el("table", { class: "table" });
  t.appendChild(el("thead", {},
    el("tr", {},
      el("th", { class: "num" }, "Temps"),
      el("th", {}, "Effet"),
      el("th", {}, "Type"),
      el("th", { class: "num" }, "Calibre"),
      el("th", { class: "num" }, "Qté"),
      el("th", { class: "num" }, "Coût"),
      el("th", {}, ""))));
  const tb = el("tbody");
  for (const cue of sh.cues) {
    const eff = store.findEffect(cue.effectId);
    if (!eff) continue;
    const c = partTypeColor(eff.partType);
    tb.appendChild(el("tr", {},
      el("td", { class: "num" },
        el("input", {
          type: "number", min: 0, max: sh.duration, step: 0.1,
          value: cue.time,
          style: "width: 80px;",
          onChange: (e) => {
            store.updateCue(sh.id, cue.id, { time: +e.target.value });
            refresh();
          },
        })),
      el("td", {}, eff.name),
      el("td", {},
        el("span", { class: "badge", style: { color: c, borderColor: c } },
          partTypeIcon(eff.partType), " ", partTypeLabel(eff.partType))),
      el("td", { class: "num" }, eff.caliber ? `${eff.caliber}mm` : "—"),
      el("td", { class: "num" },
        el("input", {
          type: "number", min: 1, max: 99, value: cue.quantity,
          style: "width: 60px;",
          onChange: (e) => {
            store.updateCue(sh.id, cue.id, { quantity: +e.target.value });
            refresh();
          },
        })),
      el("td", { class: "num" }, formatPrice(eff.price * cue.quantity)),
      el("td", {},
        el("button", {
          class: "btn btn-ghost",
          style: "color: var(--danger); padding: 2px 8px;",
          onClick: async () => {
            const ok = await confirm("Supprimer ce cue ?", { danger: true, okLabel: "Supprimer" });
            if (!ok) return;
            store.removeCue(sh.id, cue.id);
            refresh();
          },
        }, "🗑"))));
  }
  t.appendChild(tb);
  return t;
}

function openPicker(sh, refresh) {
  let search = "";
  let partType = "all";

  const list = el("div", {
    style: "max-height: 50vh; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;",
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
    for (const eff of items.slice(0, 80)) {
      const c = partTypeColor(eff.partType);
      list.appendChild(el("div", {
        style: "display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 4px; cursor: pointer; border: 1px solid var(--border-soft);",
        onClick: () => {
          const t = sh.cues.length ?
            Math.min(sh.duration, sh.cues[sh.cues.length - 1].time + 2) : 0;
          store.addCue(sh.id, eff.id, t, 1);
          close();
          refresh();
        },
      },
        el("div", {
          style: { width: "10px", height: "10px", borderRadius: "50%",
                   background: eff.colors[0], boxShadow: `0 0 6px ${eff.colors[0]}` },
        }),
        el("div", { style: "flex: 1;" },
          el("div", { style: "font-size: 12px;" }, eff.name),
          el("div", { style: "font-size: 10px; color: var(--text-mute);" },
            partTypeLabel(eff.partType),
            eff.caliber ? ` · ${eff.caliber}mm` : "",
            ` · ${eff.duration}s · ${formatPrice(eff.price)}`))));
    }
  };

  const ptSelect = el("select", {
    onChange: (e) => { partType = e.target.value; draw(); },
  },
    el("option", { value: "all" }, "Tous"),
    ...Object.keys(PART_TYPES).map((k) =>
      el("option", { value: k }, partTypeLabel(k))));

  const filters = el("div", {
    style: "display: flex; gap: 8px; margin-bottom: 12px;",
  },
    el("input", {
      type: "search", placeholder: "Rechercher…",
      style: "flex: 1;",
      onInput: (e) => { search = e.target.value; draw(); },
    }),
    ptSelect);

  draw();
  const { close } = modal({
    title: "Ajouter un cue",
    body: el("div", {}, filters, list),
    footer: [el("button", { class: "btn", onClick: () => close() }, "Fermer")],
  });
}

function openEditCue(sh, cue, refresh) {
  const eff = store.findEffect(cue.effectId);
  if (!eff) return;
  const c = partTypeColor(eff.partType);
  modal({
    title: eff.name,
    body: el("div", {},
      el("p", { class: "page-subtitle" },
        `${partTypeLabel(eff.partType)}${eff.subtype ? ` · ${subtypeLabel(eff.subtype)}` : ""}${eff.caliber ? ` · ${eff.caliber}mm` : ""} · ${eff.duration}s`),
      field("Temps (s)",
        el("input", {
          type: "number", min: 0, max: sh.duration, step: 0.1,
          value: cue.time,
          onChange: (e) => {
            store.updateCue(sh.id, cue.id, { time: +e.target.value });
          },
        })),
      field("Quantité",
        el("input", {
          type: "number", min: 1, max: 99,
          value: cue.quantity,
          onChange: (e) => {
            store.updateCue(sh.id, cue.id, { quantity: +e.target.value });
          },
        }))),
    footer: [
      el("button", {
        class: "btn btn-danger",
        onClick: async () => {
          const ok = await confirm("Supprimer ce cue ?", { danger: true, okLabel: "Supprimer" });
          if (!ok) return;
          store.removeCue(sh.id, cue.id);
          refresh();
        },
      }, "Supprimer"),
      el("button", {
        class: "btn btn-primary",
        onClick: () => { refresh(); },
      }, "OK"),
    ],
  });
}
