import {
  el, pageHeader, toast, formatDate, formatPrice,
  promptDialog, confirmDialog,
} from "../lib/dom.js";
import {
  state, createShow, deleteShow, duplicateShow,
  showCost, showEffectCount,
} from "../lib/state.js";
import { t } from "../lib/i18n.js";

export function renderShows(main, navigate) {
  let search = "";
  let sortBy = "updatedAt"; // updatedAt | name | cues | duration | cost
  let order = "desc";
  let viewMode = "grid"; // grid | list

  const newShow = async () => {
    const name = await promptDialog("Nouveau spectacle", "Nom du spectacle", "Mon nouveau spectacle");
    if (!name) return;
    const show = createShow(name);
    toast(`Spectacle « ${show.name} » créé.`);
    navigate("editor", { id: show.id });
  };

  main.append(
    pageHeader(
      "Mes spectacles",
      "Tous vos projets pyrotechniques.",
      [
        el("button", { class: "btn btn-primary", onClick: newShow }, "+ Nouveau spectacle"),
      ]
    )
  );

  if (!state.shows.length) {
    main.append(
      el("div", { class: "empty" },
        el("div", { class: "empty-icon" }, "✦"),
        el("h2", { class: "empty-title" }, "Aucun spectacle pour le moment"),
        el("p", { class: "empty-desc" }, "Créez votre premier spectacle pour commencer."),
        el("button", { class: "btn btn-primary", onClick: newShow }, "+ Créer un spectacle"))
    );
    return;
  }

  // Toolbar : recherche, tri, mode d'affichage
  const toolbar = el("div", { class: "shows-toolbar" });
  const searchInput = el("input", {
    type: "text",
    placeholder: t("search"),
    class: "input-search",
    onInput: (e) => { search = e.target.value; redraw(); },
  });
  const sortSelect = el("select", {
    onChange: (e) => { sortBy = e.target.value; redraw(); },
  },
    el("option", { value: "updatedAt" }, "Trier : récents"),
    el("option", { value: "name" }, "Trier : nom"),
    el("option", { value: "cues" }, "Trier : nb cues"),
    el("option", { value: "duration" }, "Trier : durée"),
    el("option", { value: "cost" }, "Trier : coût"));
  const orderBtn = el("button", {
    class: "btn btn-ghost",
    onClick: () => { order = order === "desc" ? "asc" : "desc"; redraw(); },
  }, order === "desc" ? "↓" : "↑");
  const viewBtns = el("div", { class: "view-toggle" },
    el("button", {
      class: "btn btn-ghost",
      onClick: () => { viewMode = "grid"; redraw(); },
    }, "▦"),
    el("button", {
      class: "btn btn-ghost",
      onClick: () => { viewMode = "list"; redraw(); },
    }, "≡"));
  toolbar.append(searchInput, sortSelect, orderBtn, viewBtns);
  main.append(toolbar);

  const container = el("div", {});
  main.append(container);

  function applyFilters() {
    let items = [...state.shows];
    if (search) {
      const s = search.toLowerCase();
      items = items.filter((sh) =>
        sh.name.toLowerCase().includes(s) ||
        (sh.description || "").toLowerCase().includes(s));
    }
    items.sort((a, b) => {
      let va, vb;
      switch (sortBy) {
        case "name": va = a.name; vb = b.name; break;
        case "cues": va = a.cues.length; vb = b.cues.length; break;
        case "duration": va = a.duration; vb = b.duration; break;
        case "cost": va = showCost(a); vb = showCost(b); break;
        default: va = a.updatedAt || a.createdAt; vb = b.updatedAt || b.createdAt;
      }
      if (typeof va === "string") {
        return order === "desc" ? vb.localeCompare(va, "fr") : va.localeCompare(vb, "fr");
      }
      return order === "desc" ? vb - va : va - vb;
    });
    return items;
  }

  function redraw() {
    [...viewBtns.children].forEach((c, i) =>
      c.classList.toggle("active", ["grid", "list"][i] === viewMode));
    orderBtn.textContent = order === "desc" ? "↓" : "↑";

    container.innerHTML = "";
    const items = applyFilters();
    if (!items.length) {
      container.appendChild(el("div", { class: "empty empty-compact" },
        el("p", { class: "empty-desc" }, "Aucun spectacle correspondant.")));
      return;
    }
    if (viewMode === "list") {
      container.appendChild(buildShowsTable(items, navigate));
    } else {
      const grid = el("div", { class: "cards" });
      for (const show of items) grid.appendChild(showCard(show, navigate));
      container.appendChild(grid);
    }
  }
  redraw();
}

function showCard(show, navigate) {
  const cost = showCost(show);
  const effects = showEffectCount(show);

  return el("article", { class: "card show-card" },
    el("div", {
      class: "show-card-body",
      onClick: () => navigate("editor", { id: show.id }),
    },
      el("h3", { class: "card-title" }, show.name),
      el("p", { class: "card-desc" }, show.description || "Aucune description."),
      el("div", { class: "show-stats" },
        el("span", { class: "show-stat" }, `${show.cues.length} cue(s)`),
        el("span", { class: "show-stat" }, `${effects} effet(s)`),
        el("span", { class: "show-stat" }, `${show.duration}s`),
        el("span", { class: "show-stat highlight" }, formatPrice(cost))),
      el("div", { class: "card-meta" },
        el("span", {}, `Modifié le ${formatDate(show.updatedAt)}`),
        show.location ? el("span", {}, " · 📍 " + (show.location.name || "Lieu défini")) : null)
    ),
    el("footer", { class: "show-card-actions" },
      el("button", { class: "btn btn-ghost",
        onClick: () => navigate("editor", { id: show.id }) }, "Éditer"),
      el("button", { class: "btn btn-ghost",
        onClick: () => navigate("viewer", { id: show.id }) }, "▶ Lancer"),
      el("button", { class: "btn btn-ghost",
        onClick: () => navigate("orders", { id: show.id }) }, "Commande"),
      el("button", { class: "btn btn-ghost",
        onClick: () => {
          const copy = duplicateShow(show.id);
          if (copy) { toast(`« ${copy.name} » créé.`); navigate("shows"); }
        } }, "Dupliquer"),
      el("button", { class: "btn btn-ghost btn-danger-text",
        onClick: async () => {
          const ok = await confirmDialog(`Supprimer « ${show.name} » ?`);
          if (!ok) return;
          deleteShow(show.id);
          toast("Spectacle supprimé.");
          navigate("shows");
        } }, "Supprimer"))
  );
}

function buildShowsTable(items, navigate) {
  const table = el("table", { class: "table" });
  table.appendChild(el("thead", {},
    el("tr", {},
      el("th", {}, "Nom"),
      el("th", { class: "num" }, "Cues"),
      el("th", { class: "num" }, "Durée"),
      el("th", { class: "num" }, "Coût HT"),
      el("th", {}, "Lieu"),
      el("th", {}, "Modifié"),
      el("th", {}, ""))));
  const tbody = el("tbody");
  for (const show of items) {
    const cost = showCost(show);
    tbody.appendChild(
      el("tr", {
        class: "clickable",
        onClick: () => navigate("editor", { id: show.id }),
      },
        el("td", {},
          el("div", {},
            el("strong", {}, show.name),
            show.description ?
              el("div", { class: "page-subtitle", style: "font-size: 11px;" }, show.description) :
              null)),
        el("td", { class: "num" }, String(show.cues.length)),
        el("td", { class: "num" }, `${show.duration}s`),
        el("td", { class: "num" }, formatPrice(cost)),
        el("td", {}, show.location?.name || "—"),
        el("td", {}, formatDate(show.updatedAt)),
        el("td", {},
          el("button", {
            class: "btn btn-ghost btn-danger-text",
            onClick: async (e) => {
              e.stopPropagation();
              const ok = await confirmDialog(`Supprimer « ${show.name} » ?`);
              if (!ok) return;
              deleteShow(show.id);
              navigate("shows");
            },
          }, "🗑"))
      )
    );
  }
  table.appendChild(tbody);
  return table;
}
