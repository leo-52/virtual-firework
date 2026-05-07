import {
  el, pageHeader, formatPrice, modal, toast, confirmDialog,
} from "../lib/dom.js";
import {
  getAllEffects, isFavorite, toggleFavorite,
  addCustomEffect, updateCustomEffect, deleteCustomEffect,
} from "../lib/state.js";
import {
  EFFECTS, CATEGORIES, SUBTYPES, partTypeLabel, subtypeLabel, PART_TYPES,
} from "../data/effects.js";
import { t } from "../lib/i18n.js";

export function renderLibrary(main, navigate, params = {}) {
  let partTypeFilter = params.partType || "all";
  let subtypeFilter = "all";
  let scope = "all"; // all | favorites | custom | builtIn
  let search = "";
  let sortBy = "name";

  main.append(
    pageHeader(
      t("library.title"),
      `${getAllEffects().length} effets · ${EFFECTS.length} catalogue · favoris et personnalisés inclus.`,
      [
        el("button", {
          class: "btn btn-primary",
          onClick: () => openCustomEditor(null, () => render()),
        }, "+ " + t("effect.createCustom")),
      ]
    )
  );

  const tabs = el("div", { class: "tabs" },
    tabBtn(t("all"),         "all",        () => set("scope", "all"),        true),
    tabBtn(t("library.favorites") + " ⭐", "favorites", () => set("scope", "favorites")),
    tabBtn(t("library.custom"),  "custom",     () => set("scope", "custom")),
    tabBtn(t("library.builtIn"), "builtIn",    () => set("scope", "builtIn")),
  );
  main.append(tabs);

  const filters = el("div", { class: "library-filters" });
  filters.appendChild(
    el("input", {
      type: "text",
      placeholder: t("search"),
      class: "input-search",
      onInput: (e) => { search = e.target.value; redraw(); },
    })
  );
  const ptSelect = el("select", {
    onChange: (e) => { partTypeFilter = e.target.value; redraw(); },
  },
    el("option", { value: "all" }, t("library.partType") + " : tous"),
    ...Object.keys(PART_TYPES).map((k) =>
      el("option", { value: k }, partTypeLabel(k))
    )
  );
  ptSelect.value = partTypeFilter;
  filters.appendChild(ptSelect);

  const stSelect = el("select", {
    onChange: (e) => { subtypeFilter = e.target.value; redraw(); },
  },
    el("option", { value: "all" }, t("library.subtype") + " : tous"),
    ...Object.keys(SUBTYPES).map((k) =>
      el("option", { value: k }, subtypeLabel(k))
    )
  );
  filters.appendChild(stSelect);

  filters.appendChild(
    el("select", {
      onChange: (e) => { sortBy = e.target.value; redraw(); },
    },
      el("option", { value: "name" }, "Trier : nom"),
      el("option", { value: "price" }, "Trier : prix"),
      el("option", { value: "caliber" }, "Trier : calibre")
    )
  );
  main.append(filters);

  const grid = el("div", { class: "library-grid" });
  main.append(grid);

  function set(key, value) {
    if (key === "scope") {
      scope = value;
      [...tabs.children].forEach((c, i) => c.classList.toggle("active",
        ["all", "favorites", "custom", "builtIn"][i] === scope));
      redraw();
    }
  }

  function applyFilters() {
    let items = getAllEffects();
    if (scope === "favorites") items = items.filter((e) => isFavorite(e.id));
    else if (scope === "custom") items = items.filter((e) => e.custom);
    else if (scope === "builtIn") items = items.filter((e) => !e.custom);
    if (partTypeFilter !== "all") items = items.filter((e) => e.partType === partTypeFilter);
    if (subtypeFilter !== "all") items = items.filter((e) => e.subtype === subtypeFilter);
    if (search) {
      const s = search.toLowerCase();
      items = items.filter((e) => e.name.toLowerCase().includes(s));
    }
    if (sortBy === "price") items = items.slice().sort((a, b) => a.price - b.price);
    else if (sortBy === "caliber") items = items.slice().sort((a, b) => a.caliber - b.caliber);
    else items = items.slice().sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return items;
  }

  function redraw() {
    grid.innerHTML = "";
    const items = applyFilters();
    if (!items.length) {
      grid.appendChild(
        el("div", { class: "empty empty-compact" },
          el("p", { class: "empty-desc" }, "Aucun effet correspondant."))
      );
      return;
    }
    for (const eff of items) grid.appendChild(libraryCard(eff, render));
  }

  function render() {
    redraw();
  }
  redraw();

  // Si demandé par le routeur
  if (params.newCustom) openCustomEditor(null, render);
}

function tabBtn(label, key, onClick, active) {
  return el("button", { class: "tab" + (active ? " active" : ""), onClick }, label);
}

function libraryCard(eff, refresh) {
  const cat = CATEGORIES[eff.partType] || CATEGORIES.other;
  const fav = isFavorite(eff.id);
  const swatch = el("div", { class: "lib-swatch" });
  for (const c of eff.colors) {
    swatch.appendChild(el("div", { class: "lib-swatch-dot", style: { background: c } }));
  }

  return el(
    "article",
    { class: "lib-card clickable", onClick: () => openDetail(eff, refresh) },
    el("div", { class: "lib-card-header", style: { borderColor: cat.color } },
      el("span", { class: "category-badge", style: { color: cat.color, borderColor: cat.color } },
        cat.icon, " ", cat.label),
      el("button", {
        class: "studio-fav" + (fav ? " active" : ""),
        title: fav ? "Retirer des favoris" : "Ajouter aux favoris",
        onClick: (e) => {
          e.stopPropagation();
          toggleFavorite(eff.id);
          refresh();
        },
      }, fav ? "★" : "☆")
    ),
    el("h3", { class: "lib-name" }, eff.name),
    swatch,
    el(
      "dl",
      { class: "lib-spec" },
      specRow("Type", `${cat.label}${eff.subtype ? ` · ${subtypeLabel(eff.subtype)}` : ""}`),
      specRow("Calibre", eff.caliber ? `${eff.caliber}mm` : "—"),
      specRow("Durée", `${eff.duration}s`),
      specRow("Hauteur", `${eff.height} m`),
      specRow("Fournisseur", eff.vendor),
      specRow("Prix", formatPrice(eff.price))
    ),
    eff.custom ? el("div", { class: "lib-custom-tag" }, "Personnalisé") : null
  );
}

function specRow(k, v) {
  return el("div", { class: "lib-spec-row" }, el("dt", {}, k), el("dd", {}, v));
}

function openDetail(eff, refresh) {
  const cat = CATEGORIES[eff.partType] || CATEGORIES.other;
  const footer = [];
  if (eff.custom) {
    footer.push(
      el("button", {
        class: "btn btn-danger",
        onClick: async () => {
          if (!await confirmDialog(`Supprimer l'effet « ${eff.name} » ?`)) return;
          deleteCustomEffect(eff.id);
          toast("Effet supprimé.");
          close();
          refresh();
        },
      }, t("delete")),
      el("button", {
        class: "btn btn-primary",
        onClick: () => { close(); openCustomEditor(eff, refresh); },
      }, t("edit"))
    );
  }
  const { close } = modal({
    title: eff.name,
    body: el(
      "div",
      {},
      el("p", { class: "page-subtitle" },
        `${cat.icon} ${cat.label}${eff.subtype ? ` · ${subtypeLabel(eff.subtype)}` : ""}${eff.caliber ? ` · ${eff.caliber}mm` : ""}`),
      el("dl", { class: "lib-spec lib-spec-detail" },
        specRow("Durée d'effet", `${eff.duration} s`),
        specRow("Hauteur de tir", `${eff.height} m`),
        specRow("Couleurs", eff.colors.join(", ")),
        specRow("Fournisseur", eff.vendor),
        specRow("Prix unitaire", formatPrice(eff.price)),
        specRow("Identifiant", eff.id))
    ),
    footer,
  });
}

// ---- Éditeur d'effet personnalisé -----------------------------------------

function openCustomEditor(initial, refresh) {
  const eff = initial || {
    name: "Mon nouvel effet",
    partType: "shell",
    subtype: "peony",
    caliber: 75,
    duration: 4,
    height: 70,
    colors: ["#ffd60a"],
    price: 0,
    vendor: "Personnalisé",
  };

  const fields = {};
  const f = (key, label, control) => {
    fields[key] = control;
    return el("label", { class: "form-field" },
      el("span", { class: "form-label" }, label), control);
  };

  const colorInput = el("input", { type: "text", value: eff.colors.join(", ") });

  const body = el("div", { style: "display: grid; grid-template-columns: 1fr 1fr; gap: 10px;" },
    f("name", "Nom", el("input", { type: "text", value: eff.name })),
    f("vendor", "Fournisseur", el("input", { type: "text", value: eff.vendor || "Personnalisé" })),
    f("partType", "Type de pièce",
      (() => {
        const s = el("select", {},
          ...Object.keys(PART_TYPES).map((k) =>
            el("option", { value: k }, partTypeLabel(k))));
        s.value = eff.partType;
        return s;
      })()
    ),
    f("subtype", "Style visuel",
      (() => {
        const s = el("select", {},
          ...Object.keys(SUBTYPES).map((k) =>
            el("option", { value: k }, subtypeLabel(k))));
        s.value = eff.subtype || "other";
        return s;
      })()
    ),
    f("caliber", "Calibre (mm)",
      el("input", { type: "number", min: "0", max: "300", value: eff.caliber })),
    f("duration", "Durée d'effet (s)",
      el("input", { type: "number", min: "0.1", step: "0.1", value: eff.duration })),
    f("height", "Hauteur (m)",
      el("input", { type: "number", min: "0", value: eff.height })),
    f("price", "Prix (€)",
      el("input", { type: "number", min: "0", step: "0.01", value: eff.price })),
    el("div", { style: "grid-column: span 2;" },
      el("label", { class: "form-label" }, "Couleurs (codes hex séparés par virgules)"),
      colorInput)
  );

  const { close } = modal({
    title: initial ? `Éditer : ${eff.name}` : t("effect.createCustom"),
    body,
    footer: [
      el("button", { class: "btn", onClick: () => close() }, t("cancel")),
      el("button", {
        class: "btn btn-primary",
        onClick: () => {
          const colors = colorInput.value.split(",").map((s) => s.trim()).filter(Boolean);
          const patch = {
            name: fields.name.value || "Sans nom",
            vendor: fields.vendor.value || "Personnalisé",
            partType: fields.partType.value,
            subtype: fields.subtype.value,
            caliber: +fields.caliber.value || 0,
            duration: +fields.duration.value || 1,
            height: +fields.height.value || 1,
            price: +fields.price.value || 0,
            colors: colors.length ? colors : ["#ffd60a"],
          };
          if (initial) {
            updateCustomEffect(initial.id, patch);
            toast("Effet mis à jour.");
          } else {
            addCustomEffect(patch);
            toast("Effet personnalisé créé.");
          }
          close();
          refresh();
        },
      }, t("save")),
    ],
  });
}
