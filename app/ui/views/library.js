import { el, pageHeader, formatPrice, modal } from "../lib/dom.js";
import { EFFECTS, CATEGORIES } from "../data/effects.js";

export function renderLibrary(main, navigate, params = {}) {
  let categoryFilter = params.category || "all";
  let search = "";
  let sortBy = "name"; // name | price | caliber

  main.append(
    pageHeader(
      "Bibliothèque d'effets",
      `${EFFECTS.length} effets disponibles dans le catalogue.`
    )
  );

  const filters = el("div", { class: "library-filters" });

  filters.appendChild(
    el("input", {
      type: "text",
      placeholder: "Rechercher…",
      class: "input-search",
      onInput: (e) => { search = e.target.value; redraw(); },
    })
  );

  const catSelect = el(
    "select",
    {
      onChange: (e) => { categoryFilter = e.target.value; redraw(); },
    },
    el("option", { value: "all" }, "Toutes catégories"),
    ...Object.entries(CATEGORIES).map(([k, c]) =>
      el("option", { value: k }, c.label)
    )
  );
  catSelect.value = categoryFilter;
  filters.appendChild(catSelect);

  filters.appendChild(
    el(
      "select",
      {
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

  function redraw() {
    grid.innerHTML = "";
    let items = EFFECTS.filter((e) => {
      if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
      if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    if (sortBy === "price") items = items.slice().sort((a, b) => a.price - b.price);
    else if (sortBy === "caliber") items = items.slice().sort((a, b) => a.caliber - b.caliber);
    else items = items.slice().sort((a, b) => a.name.localeCompare(b.name, "fr"));

    if (!items.length) {
      grid.appendChild(
        el("div", { class: "empty empty-compact" },
          el("p", { class: "empty-desc" }, "Aucun effet correspondant."))
      );
      return;
    }

    for (const eff of items) {
      grid.appendChild(libraryCard(eff));
    }
  }
  redraw();
}

function libraryCard(eff) {
  const cat = CATEGORIES[eff.category];
  const swatch = el("div", { class: "lib-swatch" });
  for (const c of eff.colors) {
    swatch.appendChild(
      el("div", { class: "lib-swatch-dot", style: { background: c } })
    );
  }

  return el(
    "article",
    {
      class: "lib-card clickable",
      onClick: () => openDetail(eff),
    },
    el("div", { class: "lib-card-header", style: { borderColor: cat.color } },
      el("span", { class: "category-badge", style: { color: cat.color, borderColor: cat.color } },
        cat.icon, " ", cat.label),
      eff.caliber ? el("span", { class: "lib-caliber" }, `${eff.caliber}mm`) : null
    ),
    el("h3", { class: "lib-name" }, eff.name),
    swatch,
    el(
      "dl",
      { class: "lib-spec" },
      specRow("Durée", `${eff.duration}s`),
      specRow("Hauteur", `${eff.height} m`),
      specRow("Fournisseur", eff.vendor),
      specRow("Prix", formatPrice(eff.price))
    )
  );
}

function specRow(k, v) {
  return el(
    "div",
    { class: "lib-spec-row" },
    el("dt", {}, k),
    el("dd", {}, v)
  );
}

function openDetail(eff) {
  const cat = CATEGORIES[eff.category];
  modal({
    title: eff.name,
    body: el(
      "div",
      {},
      el("p", { class: "page-subtitle" },
        `${cat.icon} ${cat.label}${eff.caliber ? ` · calibre ${eff.caliber}mm` : ""}`),
      el(
        "dl",
        { class: "lib-spec lib-spec-detail" },
        specRow("Durée d'effet", `${eff.duration} s`),
        specRow("Hauteur de tir", `${eff.height} m`),
        specRow("Couleurs", eff.colors.join(", ")),
        specRow("Fournisseur", eff.vendor),
        specRow("Prix unitaire", formatPrice(eff.price)),
        specRow("Identifiant", eff.id)
      )
    ),
    footer: [],
  });
}
