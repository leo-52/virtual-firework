// Inspector : édition d'un cue sélectionné.
//
// Sections : Effet, Synchronisation, Géométrie, Apparence, Notes & tags,
// Enveloppe d'intensité (courbe canvas éditable), Actions.

import { el, formatPrice, formatTime, confirm } from "./kit.js";
import { createCurveEditor, PRESETS } from "./curve-editor.js";
import * as store from "../store.js";
import { partTypeColor, partTypeIcon, partTypeLabel, subtypeLabel } from "../catalog.js";

export function renderInspector(root, ctx, cue) {
  const eff = store.findEffect(cue.effectId);
  const c = eff ? partTypeColor(eff.partType) : "#888";

  // Header
  root.appendChild(el("div", { class: "ins-eff" },
    el("div", {
      class: "ins-color",
      style: { background: eff?.colors?.[0] || "#888" },
    }),
    el("div", {},
      el("div", { class: "ins-eff-name" }, eff?.name || "Effet introuvable"),
      eff ? el("div", { class: "ins-eff-meta" },
        `${partTypeIcon(eff.partType)} ${partTypeLabel(eff.partType)}${eff.subtype ? ` · ${subtypeLabel(eff.subtype)}` : ""}`)
        : el("div", { class: "ins-eff-meta" },
            `Référence ${cue.effectId} — peut-être supprimée.`))));

  // Synchronisation
  root.appendChild(section("Synchronisation",
    field("Temps (s)",
      el("input", {
        type: "number", min: 0, max: ctx.show.duration, step: 0.1,
        value: cue.time,
        onChange: (e) => {
          ctx.snapshotBefore?.("Modif temps");
          store.updateCue(ctx.showId, cue.id, { time: +e.target.value });
          ctx.refresh();
        },
      })),
    field("Quantité",
      el("input", {
        type: "number", min: 1, max: 99, value: cue.quantity,
        onChange: (e) => {
          ctx.snapshotBefore?.("Modif qté");
          store.updateCue(ctx.showId, cue.id, { quantity: +e.target.value });
          ctx.refresh();
        },
      })),
    field("Décalage rapide",
      el("div", { style: "display: flex; gap: 4px;" },
        nudge(ctx, cue, -1, "−1s"),
        nudge(ctx, cue, -0.1, "−0.1s"),
        nudge(ctx, cue, 0.1, "+0.1s"),
        nudge(ctx, cue, 1, "+1s")))));

  // Géométrie + Apparence (lecture)
  if (eff) {
    root.appendChild(section("Géométrie",
      readonly("Calibre", eff.caliber ? `${eff.caliber} mm` : "—"),
      readonly("Durée d'effet", `${eff.duration} s`),
      readonly("Hauteur", `${eff.height} m`)));

    root.appendChild(section("Apparence",
      readonly("Style", eff.subtype ? subtypeLabel(eff.subtype) : "—"),
      colorRow("Couleurs", eff.colors),
      readonly("Fournisseur", eff.vendor || "—"),
      readonly("PU HT", formatPrice(eff.price)),
      readonly("Coût total", formatPrice(eff.price * cue.quantity))));
  }

  // Notes & étiquettes
  root.appendChild(buildNotesSection(ctx, cue));

  // Enveloppe d'intensité
  root.appendChild(buildEnvelopeSection(ctx, cue));

  // Actions
  root.appendChild(el("div", { class: "ins-actions" },
    el("button", {
      class: "btn",
      onClick: () => {
        if (!eff) return;
        ctx.snapshotBefore?.("Duplication");
        const next = store.addCue(ctx.showId, eff.id,
          Math.min(ctx.show.duration, cue.time + 1), cue.quantity);
        if (next) ctx.selection?.set([next.id]);
        ctx.refresh();
      },
    }, "Dupliquer"),
    el("button", {
      class: "btn",
      onClick: () => { ctx.selection?.set([cue.id]); ctx.refresh(); },
    }, "Isoler"),
    el("button", {
      class: "btn btn-danger",
      onClick: async () => {
        if (!await confirm("Supprimer ce cue ?", { danger: true, okLabel: "Supprimer" })) return;
        ctx.snapshotBefore?.("Suppression");
        store.removeCue(ctx.showId, cue.id);
        ctx.selection?.clear();
        ctx.refresh();
      },
    }, "Supprimer")));
}

function nudge(ctx, cue, dt, label) {
  return el("button", {
    class: "btn btn-ghost",
    onClick: () => {
      ctx.snapshotBefore?.("Décalage");
      store.updateCue(ctx.showId, cue.id, { time: cue.time + dt });
      ctx.refresh();
    },
  }, label);
}

function buildNotesSection(ctx, cue) {
  const sec = el("section", { class: "ins-section" },
    el("h4", { class: "ins-section-title" }, "Notes & étiquettes"));

  const ta = el("textarea", {
    rows: 3,
    placeholder: "Notes pour l'artificier (consignes, repères audio, etc.)",
    style: "width: 100%;",
    onChange: (e) => {
      ctx.snapshotBefore?.("Notes");
      store.updateCue(ctx.showId, cue.id, { notes: e.target.value });
    },
  });
  ta.value = cue.notes || "";
  sec.appendChild(ta);

  const tagsRow = el("div", {
    style: "display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; padding: 4px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px;",
  });
  const tags = Array.isArray(cue.tags) ? cue.tags.slice() : [];

  function rebuildChips() {
    tagsRow.innerHTML = "";
    for (const t of tags) {
      tagsRow.appendChild(el("span", { class: "tag" }, t,
        el("button", {
          class: "tag-x",
          onClick: () => {
            const i = tags.indexOf(t);
            if (i >= 0) {
              tags.splice(i, 1);
              ctx.snapshotBefore?.("Retrait étiquette");
              store.updateCue(ctx.showId, cue.id, { tags: tags.slice() });
              rebuildChips();
            }
          },
        }, "×")));
    }
    tagsRow.appendChild(input);
  }

  const input = el("input", {
    type: "text",
    placeholder: "+ étiquette",
    style: "flex: 1; min-width: 80px; background: transparent; border: 0; padding: 2px 4px;",
    onKeydown: (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        const v = input.value.trim().replace(/,$/, "");
        if (v && !tags.includes(v)) {
          tags.push(v);
          ctx.snapshotBefore?.("Ajout étiquette");
          store.updateCue(ctx.showId, cue.id, { tags: tags.slice() });
        }
        input.value = "";
        rebuildChips();
        input.focus();
      }
    },
  });
  rebuildChips();
  sec.appendChild(tagsRow);
  return sec;
}

function buildEnvelopeSection(ctx, cue) {
  const sec = el("section", { class: "ins-section" },
    el("h4", { class: "ins-section-title" }, "Enveloppe d'intensité"));
  const points = (cue.envelope?.length) ? cue.envelope : PRESETS.attack.slice();
  const ed = createCurveEditor({
    points, color: "#ff7a3d",
    onChange: (newPts) => {
      ctx.snapshotBefore?.("Enveloppe");
      store.updateCue(ctx.showId, cue.id, { envelope: newPts });
    },
  });
  sec.appendChild(ed.node);

  const presets = el("div", {
    style: "display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;",
  });
  const labels = { flat: "Plat", attack: "Attaque", decay: "Decay", bell: "Cloche", pulse: "Pulse" };
  for (const [name, p] of Object.entries(PRESETS)) {
    presets.appendChild(el("button", {
      class: "btn btn-ghost",
      style: "padding: 3px 8px; font-size: 11px;",
      onClick: () => {
        ed.set(p.slice());
        ctx.snapshotBefore?.("Preset enveloppe");
        store.updateCue(ctx.showId, cue.id, { envelope: p.slice() });
      },
    }, labels[name] || name));
  }
  sec.appendChild(presets);
  return sec;
}

// ---- helpers ----

function section(title, ...children) {
  return el("section", { class: "ins-section" },
    el("h4", { class: "ins-section-title" }, title),
    ...children);
}

function field(label, control) {
  return el("label", { class: "field" },
    el("span", { class: "field-label" }, label),
    control);
}

function readonly(label, value) {
  return el("div", {
    style: "display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px;",
  },
    el("span", { class: "field-label" }, label),
    el("span", {}, String(value)));
}

function colorRow(label, colors) {
  return el("div", {
    style: "display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px;",
  },
    el("span", { class: "field-label" }, label),
    el("div", { style: "display: flex; gap: 4px;" },
      ...(colors || []).map((c) => el("div", {
        style: { background: c, width: "14px", height: "14px",
                 borderRadius: "3px", boxShadow: `0 0 6px ${c}` },
        title: c,
      }))));
}
