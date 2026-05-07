import {
  el, pageHeader, toast, formatDate, formatPrice,
  promptDialog, confirmDialog,
} from "../lib/dom.js";
import {
  state, createShow, deleteShow, duplicateShow,
  showCost, showEffectCount,
} from "../lib/state.js";

export function renderShows(main, navigate) {
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
      [el("button", { class: "btn btn-primary", onClick: newShow }, "+ Nouveau spectacle")]
    )
  );

  if (!state.shows.length) {
    main.append(
      el(
        "div",
        { class: "empty" },
        el("div", { class: "empty-icon" }, "✦"),
        el("h2", { class: "empty-title" }, "Aucun spectacle pour le moment"),
        el("p", { class: "empty-desc" }, "Créez votre premier spectacle pour commencer."),
        el("button", { class: "btn btn-primary", onClick: newShow }, "+ Créer un spectacle")
      )
    );
    return;
  }

  const grid = el("div", { class: "cards" });
  for (const show of state.shows) {
    grid.appendChild(showCard(show, navigate));
  }
  main.append(grid);
}

function showCard(show, navigate) {
  const cost = showCost(show);
  const effects = showEffectCount(show);

  return el(
    "article",
    { class: "card show-card" },
    el(
      "div",
      { class: "show-card-body", onClick: () => navigate("editor", { id: show.id }) },
      el("h3", { class: "card-title" }, show.name),
      el("p", { class: "card-desc" }, show.description || "Aucune description."),
      el(
        "div",
        { class: "show-stats" },
        el("span", { class: "show-stat" }, `${show.cues.length} cue(s)`),
        el("span", { class: "show-stat" }, `${effects} effet(s)`),
        el("span", { class: "show-stat" }, `${show.duration}s`),
        el("span", { class: "show-stat highlight" }, formatPrice(cost))
      ),
      el(
        "div",
        { class: "card-meta" },
        el("span", {}, `Modifié le ${formatDate(show.updatedAt)}`)
      )
    ),
    el(
      "footer",
      { class: "show-card-actions" },
      el(
        "button",
        {
          class: "btn btn-ghost",
          onClick: () => navigate("editor", { id: show.id }),
        },
        "Éditer"
      ),
      el(
        "button",
        {
          class: "btn btn-ghost",
          onClick: () => navigate("viewer", { id: show.id }),
        },
        "▶ Lancer"
      ),
      el(
        "button",
        {
          class: "btn btn-ghost",
          onClick: () => navigate("orders", { id: show.id }),
        },
        "Commande"
      ),
      el(
        "button",
        {
          class: "btn btn-ghost",
          onClick: () => {
            const copy = duplicateShow(show.id);
            if (copy) {
              toast(`« ${copy.name} » créé.`);
              navigate("shows");
            }
          },
        },
        "Dupliquer"
      ),
      el(
        "button",
        {
          class: "btn btn-ghost btn-danger-text",
          onClick: async () => {
            const ok = await confirmDialog(`Supprimer « ${show.name} » ?`);
            if (!ok) return;
            deleteShow(show.id);
            toast("Spectacle supprimé.");
            navigate("shows");
          },
        },
        "Supprimer"
      )
    )
  );
}
