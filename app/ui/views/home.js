import { el, pageHeader, formatPrice } from "../lib/dom.js";
import { state, globalStats } from "../lib/state.js";
import { CATEGORIES } from "../data/effects.js";

export function renderHome(main, navigate) {
  const stats = globalStats();

  main.append(
    pageHeader(
      "Tableau de bord",
      `Bonjour. Vous avez ${stats.showCount} spectacle${stats.showCount > 1 ? "s" : ""} et ${stats.catalogSize} effets disponibles.`
    )
  );

  // Stats
  const statGrid = el(
    "div",
    { class: "stats" },
    statCard("Spectacles", stats.showCount, "✦"),
    statCard("Cues totaux", stats.totalCues, "▸"),
    statCard("Effets utilisés", stats.totalEffects, "⌗"),
    statCard("Coût total", formatPrice(stats.totalCost), "€")
  );
  main.append(statGrid);

  // Actions rapides
  main.append(
    el(
      "div",
      { class: "section-header" },
      el("h2", { class: "section-title" }, "Actions rapides")
    )
  );

  const actions = el(
    "div",
    { class: "cards" },
    actionCard("Nouveau spectacle", "Démarrer la conception d'un nouveau show pyrotechnique.", "✦", () =>
      navigate("shows")
    ),
    actionCard("Mes spectacles", "Reprendre un spectacle existant.", "📋", () =>
      navigate("shows")
    ),
    actionCard("Bibliothèque d'effets", "Parcourir le catalogue.", "⌗", () =>
      navigate("library")
    ),
    actionCard("Visualiseur 3D", "Lancer la prévisualisation Finale 3D.", "▶", () =>
      navigate("viewer")
    )
  );
  main.append(actions);

  // Catégories
  main.append(
    el(
      "div",
      { class: "section-header" },
      el("h2", { class: "section-title" }, "Catégories du catalogue")
    )
  );

  const cats = el("div", { class: "category-grid" });
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    cats.appendChild(
      el(
        "div",
        {
          class: "category-pill",
          style: { borderColor: cat.color, color: cat.color },
          onClick: () => navigate("library", { category: key }),
        },
        el("span", { class: "category-icon" }, cat.icon),
        el("span", {}, cat.label)
      )
    );
  }
  main.append(cats);

  // Spectacles récents
  if (state.shows.length) {
    main.append(
      el(
        "div",
        { class: "section-header" },
        el("h2", { class: "section-title" }, "Spectacles récents"),
        el(
          "button",
          { class: "btn btn-ghost", onClick: () => navigate("shows") },
          "Tout voir →"
        )
      )
    );
    const list = el("div", { class: "cards" });
    for (const show of state.shows.slice(0, 3)) {
      list.appendChild(
        el(
          "article",
          {
            class: "card clickable",
            onClick: () => navigate("editor", { id: show.id }),
          },
          el("h3", { class: "card-title" }, show.name),
          el(
            "p",
            { class: "card-desc" },
            show.description || "Aucune description."
          ),
          el(
            "div",
            { class: "card-meta" },
            el("span", {}, `${show.cues.length} cue(s)`),
            el("span", {}, `${show.duration}s`)
          )
        )
      );
    }
    main.append(list);
  }
}

function statCard(label, value, icon) {
  return el(
    "div",
    { class: "stat-card" },
    el("div", { class: "stat-icon" }, icon),
    el(
      "div",
      {},
      el("div", { class: "stat-value" }, String(value)),
      el("div", { class: "stat-label" }, label)
    )
  );
}

function actionCard(title, desc, icon, onClick) {
  return el(
    "article",
    { class: "card clickable", onClick },
    el("div", { class: "card-icon" }, icon),
    el("h3", { class: "card-title" }, title),
    el("p", { class: "card-desc" }, desc)
  );
}
