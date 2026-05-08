import { el, formatPrice } from "../ui/kit.js";
import * as store from "../store.js";
import {
  PART_TYPES, SUBTYPES, CATALOG,
  partTypeLabel, partTypeColor, partTypeIcon, subtypeLabel,
} from "../catalog.js";

export function renderLibrary(root, navigate, params = {}) {
  let scope = "all";       // all | favorites | custom
  let partType = params.partType || "all";
  let subtype = "all";
  let search = "";

  // Header
  root.appendChild(el("header", { class: "page-header" },
    el("div", {},
      el("h1", { class: "page-title" }, "Bibliothèque d'effets"),
      el("p", { class: "page-subtitle" },
        `${store.getAllEffects().length} effets · ${CATALOG.length} catalogue · favoris et personnalisés.`))));

  // Onglets scope
  const tabs = el("div", {
    style: "display: flex; gap: 4px; margin-bottom: 12px;",
  });
  for (const [key, label] of [["all", "Tous"], ["favorites", "★ Favoris"], ["custom", "Mes effets"]]) {
    const btn = el("button", {
      class: "btn" + (scope === key ? " btn-primary" : ""),
      onClick: () => { scope = key; redraw(); },
    }, label);
    btn.dataset.scope = key;
    tabs.appendChild(btn);
  }
  root.appendChild(tabs);

  // Filtres
  const ptSelect = el("select", {
    onChange: (e) => { partType = e.target.value; redraw(); },
  },
    el("option", { value: "all" }, "Tous types"),
    ...Object.keys(PART_TYPES).map((k) =>
      el("option", { value: k }, partTypeLabel(k))));
  ptSelect.value = partType;

  const stSelect = el("select", {
    onChange: (e) => { subtype = e.target.value; redraw(); },
  },
    el("option", { value: "all" }, "Tous styles"),
    ...Object.keys(SUBTYPES).map((k) =>
      el("option", { value: k }, subtypeLabel(k))));

  const searchInput = el("input", {
    type: "search", placeholder: "Rechercher un effet…",
    onInput: (e) => { search = e.target.value; redraw(); },
  });

  root.appendChild(el("div", {
    style: "display: flex; gap: 8px; margin-bottom: 14px;",
  }, searchInput, ptSelect, stSelect));

  const grid = el("div", { class: "cards" });
  root.appendChild(grid);

  function applyFilters() {
    let items = store.getAllEffects();
    if (scope === "favorites") items = items.filter((e) => store.isFavorite(e.id));
    if (scope === "custom") items = items.filter((e) => e.custom);
    if (partType !== "all") items = items.filter((e) => e.partType === partType);
    if (subtype !== "all") items = items.filter((e) => e.subtype === subtype);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((e) => e.name.toLowerCase().includes(q));
    }
    items.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return items;
  }

  function redraw() {
    for (const t of tabs.children) {
      t.classList.toggle("btn-primary", t.dataset.scope === scope);
    }
    grid.innerHTML = "";
    const items = applyFilters();
    if (!items.length) {
      grid.appendChild(el("p", { class: "empty-desc" }, "Aucun effet correspondant."));
      return;
    }
    for (const eff of items) grid.appendChild(effectCard(eff, redraw));
  }
  redraw();
}

function effectCard(eff, refresh) {
  const fav = store.isFavorite(eff.id);
  const color = partTypeColor(eff.partType);

  const swatch = el("div", { style: "display: flex; gap: 4px; margin: 6px 0;" });
  for (const c of eff.colors) {
    swatch.appendChild(el("div", {
      style: { background: c, width: "12px", height: "12px", borderRadius: "3px",
               boxShadow: `0 0 6px ${c}` },
    }));
  }

  return el("article", { class: "card" },
    el("div", {
      style: "display: flex; justify-content: space-between; align-items: center;",
    },
      el("span", {
        class: "badge",
        style: { color, borderColor: color },
      }, partTypeIcon(eff.partType), " ", partTypeLabel(eff.partType)),
      el("button", {
        class: "btn btn-ghost",
        style: { color: fav ? "#ffd60a" : "var(--text-mute)", padding: "2px 6px" },
        title: fav ? "Retirer des favoris" : "Ajouter aux favoris",
        onClick: (e) => {
          e.stopPropagation();
          store.toggleFavorite(eff.id);
          refresh();
        },
      }, fav ? "★" : "☆")),
    el("h3", { class: "card-title" }, eff.name),
    swatch,
    el("div", { class: "card-meta" },
      eff.subtype ? el("span", {}, subtypeLabel(eff.subtype)) : null,
      eff.caliber ? el("span", {}, `${eff.caliber}mm`) : null,
      el("span", {}, `${eff.duration}s`),
      el("span", { style: "color: var(--accent-text);" }, formatPrice(eff.price))),
    eff.custom ? el("span", {
      class: "badge",
      style: "color: var(--accent-text); border-color: var(--accent); margin-top: 6px;",
    }, "Personnalisé") : null);
}
