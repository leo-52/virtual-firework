import { el, formatPrice, formatDate, prompt, confirm, toast } from "../ui/kit.js";
import * as store from "../store.js";

export function renderShows(root, navigate) {
  let search = "";
  let sortBy = "updatedAt";
  let order = "desc";

  // Header
  root.appendChild(el("header", { class: "page-header" },
    el("div", {},
      el("h1", { class: "page-title" }, "Mes spectacles"),
      el("p", { class: "page-subtitle" },
        `${store.getShows().length} projet(s) pyrotechnique(s).`)),
    el("div", { class: "page-actions" },
      el("button", {
        class: "btn btn-primary",
        onClick: async () => {
          const name = await prompt("Nom du spectacle", "Nouveau spectacle",
            { title: "Nouveau spectacle" });
          if (!name) return;
          const sh = store.createShow(name);
          toast(`« ${sh.name} » créé.`, "success");
          navigate("editor", { id: sh.id });
        },
      }, "+ Nouveau spectacle"))));

  if (!store.getShows().length) {
    root.appendChild(el("div", { class: "empty" },
      el("div", { class: "empty-icon" }, "✦"),
      el("h2", { class: "empty-title" }, "Aucun spectacle"),
      el("p", { class: "empty-desc" }, "Créez votre premier spectacle.")));
    return;
  }

  // Toolbar
  const searchInput = el("input", {
    type: "search", placeholder: "Rechercher…",
    onInput: (e) => { search = e.target.value; redraw(); },
  });
  const sortSelect = el("select", {
    onChange: (e) => { sortBy = e.target.value; redraw(); },
  },
    el("option", { value: "updatedAt" }, "Récents"),
    el("option", { value: "name" }, "Nom"),
    el("option", { value: "cues" }, "Nb cues"),
    el("option", { value: "cost" }, "Coût"));
  const orderBtn = el("button", {
    class: "btn",
    onClick: () => { order = order === "desc" ? "asc" : "desc"; redraw(); },
  }, order === "desc" ? "↓" : "↑");

  root.appendChild(el("div", {
    style: "display: flex; gap: 8px; margin-bottom: 14px; align-items: center;",
  }, searchInput, sortSelect, orderBtn));

  const container = el("div");
  root.appendChild(container);

  function applyFilters() {
    let items = [...store.getShows()];
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description || "").toLowerCase().includes(q));
    }
    items.sort((a, b) => {
      let va, vb;
      if (sortBy === "name") { va = a.name; vb = b.name; }
      else if (sortBy === "cues") { va = a.cues.length; vb = b.cues.length; }
      else if (sortBy === "cost") { va = store.showCost(a); vb = store.showCost(b); }
      else { va = a.updatedAt || a.createdAt; vb = b.updatedAt || b.createdAt; }
      if (typeof va === "string") {
        return order === "desc" ? vb.localeCompare(va, "fr") : va.localeCompare(vb, "fr");
      }
      return order === "desc" ? vb - va : va - vb;
    });
    return items;
  }

  function redraw() {
    orderBtn.textContent = order === "desc" ? "↓" : "↑";
    container.innerHTML = "";
    const items = applyFilters();
    if (!items.length) {
      container.appendChild(el("p", { class: "empty-desc" }, "Aucun résultat."));
      return;
    }
    container.appendChild(buildTable(items, navigate));
  }
  redraw();
}

function buildTable(items, navigate) {
  const table = el("table", { class: "table" });
  table.appendChild(el("thead", {},
    el("tr", {},
      el("th", {}, "Nom"),
      el("th", { class: "num" }, "Cues"),
      el("th", { class: "num" }, "Durée"),
      el("th", { class: "num" }, "Coût HT"),
      el("th", {}, "Modifié"),
      el("th", {}, ""))));
  const tbody = el("tbody");
  for (const sh of items) {
    const cost = store.showCost(sh);
    tbody.appendChild(el("tr", {
      class: "clickable",
      onClick: () => navigate("editor", { id: sh.id }),
    },
      el("td", {},
        el("strong", {}, sh.name),
        sh.description ? el("div", { class: "page-subtitle", style: "font-size: 11px;" }, sh.description) : null),
      el("td", { class: "num" }, String(sh.cues.length)),
      el("td", { class: "num" }, `${sh.duration}s`),
      el("td", { class: "num" }, formatPrice(cost)),
      el("td", {}, formatDate(sh.updatedAt)),
      el("td", {},
        el("button", {
          class: "btn btn-ghost",
          title: "Dupliquer",
          onClick: (e) => {
            e.stopPropagation();
            const c = store.duplicateShow(sh.id);
            if (c) { toast(`« ${c.name} » créé.`, "success"); navigate("shows"); }
          },
        }, "⎘"),
        el("button", {
          class: "btn btn-ghost",
          title: "Supprimer",
          style: "color: var(--danger);",
          onClick: async (e) => {
            e.stopPropagation();
            const ok = await confirm(`Supprimer « ${sh.name} » ?`,
              { danger: true, okLabel: "Supprimer" });
            if (!ok) return;
            store.deleteShow(sh.id);
            toast("Spectacle supprimé.", "success");
            navigate("shows");
          },
        }, "🗑"))));
  }
  table.appendChild(tbody);
  return table;
}
