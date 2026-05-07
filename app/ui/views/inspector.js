// Inspecteur : édition live des propriétés d'un cue sélectionné.
//
// Sections : Synchronisation (temps, quantité), Géométrie (calibre,
// hauteur), Apparence (effet, couleurs, fournisseur). Boutons d'action :
// dupliquer, supprimer, isoler.

import { el, formatPrice, formatTime, confirmDialog } from "../lib/dom.js";
import { findEffect, updateCue, removeCue } from "../lib/state.js";
import { addCue } from "../lib/state.js";
import { CATEGORIES, subtypeLabel } from "../data/effects.js";
import { t } from "../lib/i18n.js";
import { createCurveEditor, PRESETS } from "../lib/curve-editor.js";

export function renderInspector(root, ctx, cue) {
  const eff = findEffect(cue.effectId);
  const cat = eff ? (CATEGORIES[eff.partType] || CATEGORIES.other) : null;

  // Header : effet + actions
  root.appendChild(el("div", { class: "inspector-eff" },
    el("div", {
      class: "inspector-color",
      style: { background: eff?.colors[0] || "#888" },
    }),
    el("div", { class: "inspector-eff-info" },
      el("div", { class: "inspector-eff-name" }, eff?.name || "Effet introuvable"),
      cat ? el("div", { class: "inspector-eff-meta" },
        `${cat.icon} ${cat.label}${eff.subtype ? ` · ${subtypeLabel(eff.subtype)}` : ""}`) : null
    )
  ));

  // Section : Synchronisation
  root.appendChild(section(t("inspector.timing"),
    field(t("cue.time") + " (s)",
      el("input", {
        type: "number",
        min: "0",
        max: String(ctx.show.duration),
        step: "0.1",
        value: cue.time,
        onChange: (e) => {
          ctx.snapshotBefore("Modification du temps");
          updateCue(ctx.showId, cue.id, { time: +e.target.value });
          ctx.refresh();
        },
      })
    ),
    field(t("cue.quantity"),
      el("input", {
        type: "number",
        min: "1",
        max: "99",
        value: cue.quantity,
        onChange: (e) => {
          ctx.snapshotBefore("Modification de la quantité");
          updateCue(ctx.showId, cue.id, { quantity: +e.target.value });
          ctx.refresh();
        },
      })
    ),
    field("Décalage rapide",
      el("div", { class: "inspector-row" },
        nudge(-1, "−1s"), nudge(-0.1, "−0.1s"),
        nudge(0.1, "+0.1s"), nudge(1, "+1s")),
    )
  ));

  function nudge(dt, label) {
    return el("button", {
      class: "btn btn-ghost",
      onClick: () => {
        ctx.snapshotBefore("Ajustement du temps");
        updateCue(ctx.showId, cue.id, { time: cue.time + dt });
        ctx.refresh();
      },
    }, label);
  }

  // Section : Géométrie (lecture seule pour catalog, modifiable pour custom)
  if (eff) {
    root.appendChild(section(t("inspector.geometry"),
      readonly("Calibre", eff.caliber ? `${eff.caliber} mm` : "—"),
      readonly("Durée d'effet", `${eff.duration} s`),
      readonly("Hauteur de tir", `${eff.height} m`)
    ));

    // Section : Apparence
    root.appendChild(section(t("inspector.appearance"),
      readonly("Style visuel", eff.subtype ? subtypeLabel(eff.subtype) : "—"),
      colorRow("Couleurs", eff.colors),
      readonly("Fournisseur", eff.vendor || "—"),
      readonly("Prix unitaire", formatPrice(eff.price)),
      readonly("Coût total (cue)", formatPrice(eff.price * cue.quantity))
    ));
  }

  // Section : Courbe d'enveloppe (intensité du cue dans le temps)
  root.appendChild(buildEnvelopeSection(ctx, cue));

  // Section : Notes + tags
  root.appendChild(buildNotesSection(ctx, cue));

  // Actions
  root.appendChild(el("div", { class: "inspector-actions" },
    el("button", {
      class: "btn",
      onClick: () => {
        if (!eff) return;
        ctx.snapshotBefore("Duplication d'un cue");
        const next = addCue(ctx.showId, eff.id,
          Math.min(ctx.show.duration, cue.time + 1), cue.quantity);
        ctx.selection.set([next.id]);
        ctx.refresh();
      },
    }, t("duplicate")),
    el("button", {
      class: "btn",
      onClick: () => {
        ctx.selection.set([cue.id]);
        ctx.refresh();
      },
    }, "Isoler"),
    el("button", {
      class: "btn btn-danger",
      onClick: async () => {
        if (!await confirmDialog("Supprimer ce cue ?")) return;
        ctx.snapshotBefore("Suppression d'un cue");
        removeCue(ctx.showId, cue.id);
        ctx.selection.clear();
        ctx.refresh();
      },
    }, t("delete"))
  ));
}

function buildNotesSection(ctx, cue) {
  const sec = el("section", { class: "inspector-section" },
    el("h4", { class: "inspector-section-title" }, "Notes & étiquettes"));

  // Notes
  const ta = el("textarea", {
    class: "inspector-notes",
    rows: "3",
    placeholder: "Notes pour l'artificier (consignes de tir, repères audio, etc.)",
    onChange: (e) => {
      ctx.snapshotBefore("Modification des notes");
      updateCue(ctx.showId, cue.id, { notes: e.target.value });
    },
  });
  ta.value = cue.notes || "";
  sec.appendChild(ta);

  // Tags : entrée + chips
  const tagsRow = el("div", { class: "inspector-tags" });
  const tags = Array.isArray(cue.tags) ? cue.tags.slice() : [];

  function rebuildChips() {
    tagsRow.innerHTML = "";
    for (const t of tags) {
      tagsRow.appendChild(el("span", { class: "tag-chip" },
        t,
        el("button", {
          class: "tag-chip-x",
          title: "Retirer",
          onClick: () => {
            const i = tags.indexOf(t);
            if (i >= 0) {
              tags.splice(i, 1);
              ctx.snapshotBefore("Retrait d'une étiquette");
              updateCue(ctx.showId, cue.id, { tags: tags.slice() });
              rebuildChips();
            }
          },
        }, "×")));
    }
    tagsRow.appendChild(input);
  }

  const input = el("input", {
    type: "text",
    class: "tag-input",
    placeholder: "+ étiquette",
    onKeydown: (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        const v = input.value.trim().replace(/,$/, "");
        if (v && !tags.includes(v)) {
          tags.push(v);
          ctx.snapshotBefore("Ajout d'une étiquette");
          updateCue(ctx.showId, cue.id, { tags: tags.slice() });
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
  const sec = el("section", { class: "inspector-section" },
    el("h4", { class: "inspector-section-title" }, "Enveloppe d'intensité"));
  const points = (cue.envelope && cue.envelope.length)
    ? cue.envelope
    : PRESETS.attack.slice();
  const ed = createCurveEditor({
    points,
    color: "#0091ff",
    onChange: (newPts) => {
      ctx.snapshotBefore("Modification de l'enveloppe");
      updateCue(ctx.showId, cue.id, { envelope: newPts });
    },
  });
  sec.appendChild(ed.node);

  // Presets
  const presets = el("div", { class: "envelope-presets" });
  for (const [name, p] of Object.entries(PRESETS)) {
    presets.appendChild(el("button", {
      class: "btn btn-ghost",
      onClick: () => {
        ed.set(p.slice());
        ctx.snapshotBefore("Preset enveloppe");
        updateCue(ctx.showId, cue.id, { envelope: p.slice() });
      },
    }, presetLabel(name)));
  }
  sec.appendChild(presets);
  return sec;
}

function presetLabel(name) {
  return ({
    flat: "Plat",
    attack: "Attaque",
    decay: "Decay",
    bell: "Cloche",
    pulse: "Pulse",
  })[name] || name;
}

function section(title, ...children) {
  return el("section", { class: "inspector-section" },
    el("h4", { class: "inspector-section-title" }, title),
    ...children);
}

function field(label, control) {
  return el("label", { class: "inspector-field" },
    el("span", { class: "form-label" }, label),
    control);
}

function readonly(label, value) {
  return el("div", { class: "inspector-readonly" },
    el("span", { class: "form-label" }, label),
    el("span", { class: "inspector-readonly-value" }, String(value))
  );
}

function colorRow(label, colors) {
  return el("div", { class: "inspector-readonly" },
    el("span", { class: "form-label" }, label),
    el("div", { class: "inspector-colors" },
      ...colors.map((c) => el("div", { class: "inspector-color-dot", style: { background: c }, title: c }))
    ));
}
