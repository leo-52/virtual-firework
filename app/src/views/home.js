import { el, formatPrice, modal, toast } from "../ui/kit.js";
import * as store from "../store.js";
import { PART_TYPES, partTypeColor, partTypeIcon, partTypeLabel } from "../catalog.js";
import { TEMPLATES } from "../templates.js";

export function renderHome(root, navigate) {
  const stats = store.globalStats();
  const shows = store.getShows();
  const last = [...shows].sort((a, b) =>
    (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)
  )[0];

  // Header
  root.appendChild(el("header", { class: "page-header" },
    el("div", {},
      el("h1", { class: "page-title" }, "Tableau de bord"),
      el("p", { class: "page-subtitle" },
        last ? `Dernier spectacle : ${last.name}` : "Démarrez en créant votre premier spectacle.")),
    el("div", { class: "page-actions" },
      el("button", {
        class: "btn",
        onClick: () => openTemplatePicker(navigate),
      }, "📋 Templates"),
      el("button", {
        class: "btn",
        onClick: () => navigate("library"),
      }, "Bibliothèque"),
      el("button", {
        class: "btn btn-primary",
        onClick: () => {
          const sh = store.createShow("Nouveau spectacle");
          navigate("editor", { id: sh.id });
        },
      }, "+ Nouveau spectacle"))));

  // Stats
  root.appendChild(el("div", { class: "stats" },
    statTile("Spectacles", stats.showCount),
    statTile("Cues totaux", stats.totalCues),
    statTile("Tirs", stats.totalShots),
    statTile("Coût cumulé HT", formatPrice(stats.totalCost))));

  // Spectacles récents
  if (shows.length) {
    root.appendChild(el("div", { class: "section" },
      el("h2", { class: "section-title" }, "Spectacles récents")));
    const grid = el("div", { class: "cards" });
    for (const sh of shows.slice(0, 6)) grid.appendChild(showCard(sh, navigate));
    root.appendChild(grid);
  } else {
    root.appendChild(el("div", { class: "empty" },
      el("div", { class: "empty-icon" }, "✦"),
      el("h2", { class: "empty-title" }, "Aucun spectacle"),
      el("p", { class: "empty-desc" },
        "Créez votre premier spectacle pour commencer."),
      el("button", {
        class: "btn btn-primary",
        onClick: () => {
          const sh = store.createShow("Mon premier spectacle");
          navigate("editor", { id: sh.id });
        },
      }, "+ Créer un spectacle")));
  }

  // Catégories du catalogue
  root.appendChild(el("div", { class: "section" },
    el("h2", { class: "section-title" }, "Catégories du catalogue")));
  const cats = el("div", {
    style: "display: flex; flex-wrap: wrap; gap: 6px;",
  });
  for (const key of Object.keys(PART_TYPES)) {
    const c = PART_TYPES[key];
    cats.appendChild(el("button", {
      class: "btn",
      style: { borderColor: c.color, color: c.color },
      onClick: () => navigate("library", { partType: key }),
    }, c.icon, " ", c.label));
  }
  root.appendChild(cats);
}

function statTile(label, value) {
  return el("div", { class: "stat" },
    el("div", { class: "stat-value" }, String(value)),
    el("div", { class: "stat-label" }, label));
}

function showCard(sh, navigate) {
  const cost = store.showCost(sh);
  const cat = sh.cues.length ?
    PART_TYPES[store.findEffect(sh.cues[0].effectId)?.partType] : null;
  return el("article", {
    class: "card",
    onClick: () => navigate("editor", { id: sh.id }),
  },
    el("h3", { class: "card-title" }, sh.name),
    el("p", { class: "card-desc" }, sh.description || "Aucune description."),
    el("div", { class: "card-meta" },
      el("span", {}, `${sh.cues.length} cue(s)`),
      el("span", {}, `${sh.duration}s`),
      el("span", { style: "color: var(--accent-text);" }, formatPrice(cost))));
}

function openTemplatePicker(navigate) {
  const grid = el("div", {
    style: "display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px;",
  });
  for (const tpl of TEMPLATES) {
    grid.appendChild(el("article", {
      class: "card",
      style: { borderColor: tpl.accent },
      onClick: () => {
        const sh = store.createShowFromTemplate(tpl);
        toast(`« ${sh.name} » créé.`, "success");
        close();
        navigate("editor", { id: sh.id });
      },
    },
      el("div", { style: { fontSize: "32px", color: tpl.accent } }, tpl.icon),
      el("h3", { class: "card-title" }, tpl.name),
      el("p", { class: "card-desc" }, tpl.description),
      el("div", { class: "card-meta" },
        el("span", {}, `${tpl.duration}s`),
        el("span", {}, " · "),
        el("span", {}, `${tpl.build().cues.length} cues`))));
  }
  const { close } = modal({
    title: "Choisir un template",
    body: grid,
    footer: [el("button", { class: "btn", onClick: () => close() }, "Annuler")],
  });
}
