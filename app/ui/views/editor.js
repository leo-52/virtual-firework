import {
  el, pageHeader, toast, modal, formatTime, formatPrice, confirmDialog,
} from "../lib/dom.js";
import {
  getShow, updateShow, addCue, updateCue, removeCue,
  showCost, showEffectCount,
} from "../lib/state.js";
import { EFFECTS, CATEGORIES, getEffect } from "../data/effects.js";

export function renderEditor(main, navigate, params = {}) {
  const show = getShow(params.id);
  if (!show) {
    main.append(
      pageHeader("Spectacle introuvable"),
      el("p", {}, "Le spectacle demandé n'existe pas."),
      el("button", { class: "btn", onClick: () => navigate("shows") }, "← Retour")
    );
    return;
  }

  const refresh = () => {
    main.innerHTML = "";
    renderEditor(main, navigate, params);
  };

  // ---- En-tête ----
  main.append(
    pageHeader(
      show.name,
      `Durée ${show.duration}s · ${show.cues.length} cue(s) · ${formatPrice(showCost(show))}`,
      [
        el("button", { class: "btn", onClick: () => navigate("shows") }, "← Retour"),
        el(
          "button",
          { class: "btn", onClick: () => navigate("orders", { id: show.id }) },
          "Bon de commande"
        ),
        el(
          "button",
          {
            class: "btn btn-primary",
            onClick: () => navigate("viewer", { id: show.id }),
          },
          "▶ Lancer la prévisu"
        ),
      ]
    )
  );

  // ---- Métadonnées éditables ----
  const meta = el(
    "div",
    { class: "editor-meta" },
    field("Nom", el("input", {
      type: "text",
      value: show.name,
      onChange: (e) => { updateShow(show.id, { name: e.target.value || show.name }); refresh(); },
    })),
    field("Durée (s)", el("input", {
      type: "number",
      min: "5",
      max: "1800",
      value: show.duration,
      onChange: (e) => {
        const d = Math.max(5, Math.min(1800, +e.target.value || show.duration));
        updateShow(show.id, { duration: d });
        refresh();
      },
    })),
    field("Description", el("input", {
      type: "text",
      value: show.description || "",
      onChange: (e) => updateShow(show.id, { description: e.target.value }),
    }), 2)
  );
  main.append(meta);

  // ---- Timeline ----
  main.append(
    el(
      "div",
      { class: "section-header" },
      el("h2", { class: "section-title" }, "Timeline"),
      el(
        "button",
        { class: "btn btn-primary", onClick: () => openEffectPicker(show, refresh) },
        "+ Ajouter un effet"
      )
    )
  );
  main.append(buildTimeline(show, refresh));

  // ---- Liste des cues ----
  main.append(
    el(
      "div",
      { class: "section-header" },
      el("h2", { class: "section-title" }, `Liste des cues (${show.cues.length})`)
    )
  );
  main.append(buildCueTable(show, refresh));
}

function field(label, control, span = 1) {
  return el(
    "label",
    { class: `form-field span-${span}` },
    el("span", { class: "form-label" }, label),
    control
  );
}

// ---- Timeline horizontale --------------------------------------------------

function buildTimeline(show, refresh) {
  const container = el("div", { class: "timeline" });
  const ruler = el("div", { class: "timeline-ruler" });
  const stepSec = chooseStep(show.duration);
  for (let t = 0; t <= show.duration; t += stepSec) {
    const left = (t / show.duration) * 100;
    ruler.appendChild(
      el(
        "div",
        { class: "timeline-tick", style: { left: `${left}%` } },
        el("span", { class: "timeline-tick-label" }, formatTime(t))
      )
    );
  }
  container.appendChild(ruler);

  const track = el("div", { class: "timeline-track" });
  for (const cue of show.cues) {
    const eff = getEffect(cue.effectId);
    if (!eff) continue;
    const cat = CATEGORIES[eff.category];
    const left = (cue.time / show.duration) * 100;
    const width = Math.max(0.6, (eff.duration / show.duration) * 100);
    track.appendChild(
      el(
        "div",
        {
          class: "timeline-cue",
          title: `${eff.name} à ${formatTime(cue.time)}`,
          style: {
            left: `${left}%`,
            width: `${width}%`,
            background: `linear-gradient(90deg, ${cat.color}cc, ${cat.color}55)`,
            borderColor: cat.color,
          },
          onClick: () => openCueEditor(show, cue, refresh),
        },
        el("span", { class: "timeline-cue-icon" }, cat.icon),
        el("span", { class: "timeline-cue-label" }, eff.name)
      )
    );
  }

  // Click vide pour ajouter un effet à un temps précis
  track.addEventListener("click", (e) => {
    if (e.target !== track) return;
    const rect = track.getBoundingClientRect();
    const time = ((e.clientX - rect.left) / rect.width) * show.duration;
    openEffectPicker(show, refresh, Math.round(time * 10) / 10);
  });

  container.appendChild(track);
  return container;
}

function chooseStep(duration) {
  if (duration <= 30) return 5;
  if (duration <= 60) return 10;
  if (duration <= 180) return 20;
  if (duration <= 600) return 60;
  return 120;
}

// ---- Tableau des cues ------------------------------------------------------

function buildCueTable(show, refresh) {
  if (!show.cues.length) {
    return el(
      "div",
      { class: "empty empty-compact" },
      el("p", { class: "empty-desc", style: "margin: 0;" },
        "Aucun cue. Cliquez sur la timeline ou « + Ajouter un effet »."
      )
    );
  }

  const table = el("table", { class: "table" });
  table.appendChild(
    el(
      "thead",
      {},
      el(
        "tr",
        {},
        el("th", {}, "Temps"),
        el("th", {}, "Catégorie"),
        el("th", {}, "Effet"),
        el("th", { class: "num" }, "Calibre"),
        el("th", { class: "num" }, "Qté"),
        el("th", { class: "num" }, "Coût"),
        el("th", {}, "")
      )
    )
  );

  const tbody = el("tbody");
  for (const cue of show.cues) {
    const eff = getEffect(cue.effectId);
    if (!eff) continue;
    const cat = CATEGORIES[eff.category];
    tbody.appendChild(
      el(
        "tr",
        {},
        el(
          "td",
          {},
          el("input", {
            type: "number",
            class: "input-inline",
            min: "0",
            max: String(show.duration),
            step: "0.1",
            value: cue.time,
            onChange: (e) => {
              updateCue(show.id, cue.id, { time: +e.target.value });
              refresh();
            },
          })
        ),
        el(
          "td",
          {},
          el(
            "span",
            {
              class: "category-badge",
              style: { color: cat.color, borderColor: cat.color },
            },
            cat.icon, " ", cat.label
          )
        ),
        el("td", {}, eff.name),
        el("td", { class: "num" }, eff.caliber ? `${eff.caliber}mm` : "—"),
        el(
          "td",
          { class: "num" },
          el("input", {
            type: "number",
            class: "input-inline",
            min: "1",
            max: "99",
            value: cue.quantity,
            onChange: (e) => {
              updateCue(show.id, cue.id, { quantity: +e.target.value });
              refresh();
            },
          })
        ),
        el("td", { class: "num" }, formatPrice(eff.price * cue.quantity)),
        el(
          "td",
          {},
          el(
            "button",
            {
              class: "btn btn-ghost btn-danger-text",
              onClick: async () => {
                if (await confirmDialog("Supprimer ce cue ?")) {
                  removeCue(show.id, cue.id);
                  refresh();
                }
              },
            },
            "✕"
          )
        )
      )
    );
  }
  table.appendChild(tbody);
  return table;
}

// ---- Picker d'effets -------------------------------------------------------

function openEffectPicker(show, refresh, defaultTime = null) {
  let categoryFilter = "all";
  let search = "";

  const list = el("div", { class: "picker-list" });

  const draw = () => {
    list.innerHTML = "";
    const items = EFFECTS.filter((e) => {
      if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
      if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    if (!items.length) {
      list.appendChild(el("p", { class: "empty-desc" }, "Aucun effet correspondant."));
      return;
    }
    for (const eff of items) {
      const cat = CATEGORIES[eff.category];
      list.appendChild(
        el(
          "div",
          {
            class: "picker-item",
            onClick: () => {
              const t = defaultTime != null
                ? defaultTime
                : show.cues.length
                  ? Math.min(show.duration, show.cues[show.cues.length - 1].time + 3)
                  : 0;
              addCue(show.id, eff.id, t);
              toast(`Cue « ${eff.name} » ajouté.`);
              close();
              refresh();
            },
          },
          el("div", { class: "picker-color", style: { background: eff.colors[0] } }),
          el(
            "div",
            { class: "picker-info" },
            el("div", { class: "picker-name" }, eff.name),
            el(
              "div",
              { class: "picker-meta" },
              cat.label,
              eff.caliber ? ` · ${eff.caliber}mm` : "",
              ` · ${eff.duration}s`,
              ` · ${formatPrice(eff.price)}`
            )
          )
        )
      );
    }
  };

  const filterRow = el(
    "div",
    { class: "picker-filters" },
    el("input", {
      type: "text",
      placeholder: "Rechercher un effet…",
      onInput: (e) => { search = e.target.value; draw(); },
    }),
    el(
      "select",
      {
        onChange: (e) => { categoryFilter = e.target.value; draw(); },
      },
      el("option", { value: "all" }, "Toutes catégories"),
      ...Object.entries(CATEGORIES).map(([k, c]) =>
        el("option", { value: k }, c.label)
      )
    )
  );

  draw();

  const { close } = modal({
    title: defaultTime != null
      ? `Ajouter un effet à ${formatTime(defaultTime)}`
      : "Ajouter un effet",
    body: el("div", {}, filterRow, list),
    footer: [el("button", { class: "btn", onClick: () => close() }, "Fermer")],
  });
}

// ---- Édition rapide d'un cue (clic sur la timeline) ------------------------

function openCueEditor(show, cue, refresh) {
  const eff = getEffect(cue.effectId);
  if (!eff) return;

  const timeInput = el("input", { type: "number", min: "0", max: String(show.duration), step: "0.1", value: cue.time });
  const qtyInput = el("input", { type: "number", min: "1", max: "99", value: cue.quantity });

  const { close } = modal({
    title: `Cue : ${eff.name}`,
    body: el(
      "div",
      {},
      field("Temps (s)", timeInput),
      field("Quantité", qtyInput),
      el("p", { class: "page-subtitle" }, `${CATEGORIES[eff.category].label} · ${eff.caliber || "—"}mm · ${eff.duration}s · ${formatPrice(eff.price)}/u`)
    ),
    footer: [
      el(
        "button",
        {
          class: "btn btn-danger-text",
          onClick: async () => {
            if (await confirmDialog("Supprimer ce cue ?")) {
              removeCue(show.id, cue.id);
              close();
              refresh();
            }
          },
        },
        "Supprimer"
      ),
      el("button", { class: "btn", onClick: () => close() }, "Annuler"),
      el(
        "button",
        {
          class: "btn btn-primary",
          onClick: () => {
            updateCue(show.id, cue.id, {
              time: +timeInput.value,
              quantity: +qtyInput.value,
            });
            close();
            refresh();
          },
        },
        "Enregistrer"
      ),
    ],
  });
}
