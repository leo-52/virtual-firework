// Tableau de bord PrevoFX.
//
// Composé de 4 zones :
//   1. Stats globales (compteurs)
//   2. Actions rapides (lancer un nouveau show, etc.)
//   3. Spectacles récents (3 plus récents avec mini-timeline)
//   4. Catégories du catalogue (liens vers la bibliothèque filtrée)
//   5. Astuce du jour / raccourcis utiles

import { el, pageHeader, formatPrice, formatTime, modal, toast } from "../lib/dom.js";
import { state, globalStats, createShow, findEffect, createShowFromTemplate } from "../lib/state.js";
import { CATEGORIES, EFFECTS } from "../data/effects.js";
import { TEMPLATES } from "../data/templates.js";
import { t } from "../lib/i18n.js";

export function renderHome(main, navigate) {
  const stats = globalStats();
  const recent = [...state.shows]
    .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
    .slice(0, 3);
  const lastShow = recent[0];

  main.append(
    pageHeader(
      "Tableau de bord",
      lastShow
        ? `Dernier spectacle : « ${lastShow.name} »`
        : "Démarrez en créant votre premier spectacle.",
      [
        el("button", {
          class: "btn",
          onClick: () => openTemplatePicker(navigate),
        }, "📋 Templates"),
        el("button", {
          class: "btn",
          onClick: () => navigate("library"),
        }, t("view.library")),
        el("button", {
          class: "btn btn-primary",
          onClick: () => {
            const sh = createShow("Nouveau spectacle");
            navigate("editor", { id: sh.id });
          },
        }, "+ " + t("file.new")),
      ]
    )
  );

  // Si aucun spectacle : section démarrage rapide
  if (!state.shows.length) {
    const onboard = el("section", { class: "onboard" });
    onboard.append(
      el("h2", { class: "section-title" }, "Démarrage rapide"),
      el("p", { class: "page-subtitle" },
        "Bienvenue dans PrevoFX. Choisissez un template ou démarrez un spectacle vierge."));
    const grid = el("div", { class: "template-grid" });
    for (const tpl of TEMPLATES) grid.appendChild(templateCard(tpl, navigate));
    onboard.append(grid);
    main.append(onboard);
  }

  // ---- Stats ----
  main.append(
    el("div", { class: "stats" },
      statCard("Spectacles", stats.showCount, "✦"),
      statCard("Cues totaux", stats.totalCues, "▸"),
      statCard("Effets utilisés", stats.totalEffects, "⌗"),
      statCard("Coût cumulé HT", formatPrice(stats.totalCost), "€")
    )
  );

  // ---- Spectacle en cours / dernier ----
  if (lastShow) {
    main.append(
      el("div", { class: "section-header" },
        el("h2", { class: "section-title" }, "Reprendre"),
        el("button", {
          class: "btn btn-ghost",
          onClick: () => navigate("editor", { id: lastShow.id }),
        }, "Ouvrir →"))
    );
    main.append(buildHero(lastShow, navigate));
  }

  // ---- Actions rapides ----
  main.append(
    el("div", { class: "section-header" },
      el("h2", { class: "section-title" }, "Actions rapides"))
  );
  main.append(
    el("div", { class: "cards" },
      actionCard("Nouveau spectacle",
        "Démarrer la conception d'un nouveau show.",
        "✦",
        () => {
          const sh = createShow("Nouveau spectacle");
          navigate("editor", { id: sh.id });
        }),
      actionCard("Mes spectacles",
        `${state.shows.length} spectacle(s) enregistré(s).`,
        "📋",
        () => navigate("shows")),
      actionCard("Bibliothèque",
        `${EFFECTS.length} effets dans le catalogue + favoris + perso.`,
        "⌗",
        () => navigate("library")),
      actionCard("Visualiseur",
        "Prévisu 2D ou moteur Finale FX embarqué.",
        "▶",
        () => navigate("viewer")),
      actionCard("Bons de commande",
        "Agréger et exporter (CSV, PDF imprimable).",
        "⛬",
        () => navigate("orders")),
      actionCard("Paramètres",
        "Confidentialité, données, raccourcis.",
        "⚙",
        () => navigate("settings"))
    )
  );

  // ---- Spectacles récents ----
  if (recent.length > 1) {
    main.append(
      el("div", { class: "section-header" },
        el("h2", { class: "section-title" }, "Spectacles récents"),
        el("button", {
          class: "btn btn-ghost",
          onClick: () => navigate("shows"),
        }, "Tout voir →"))
    );
    const list = el("div", { class: "cards" });
    for (const show of recent) list.appendChild(showCard(show, navigate));
    main.append(list);
  }

  // ---- Catégories ----
  main.append(
    el("div", { class: "section-header" },
      el("h2", { class: "section-title" }, "Catégories du catalogue"))
  );
  const cats = el("div", { class: "category-grid" });
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    cats.appendChild(
      el("div", {
        class: "category-pill",
        style: { borderColor: cat.color, color: cat.color },
        onClick: () => navigate("library", { partType: key }),
      },
        el("span", { class: "category-icon" }, cat.icon),
        el("span", {}, cat.label))
    );
  }
  main.append(cats);

  // ---- Astuce / raccourcis ----
  main.append(
    el("div", { class: "section-header" },
      el("h2", { class: "section-title" }, "Astuces"))
  );
  main.append(buildTipsCard());
}

function statCard(label, value, icon) {
  return el("div", { class: "stat-card" },
    el("div", { class: "stat-icon" }, icon),
    el("div", {},
      el("div", { class: "stat-value" }, String(value)),
      el("div", { class: "stat-label" }, label)));
}

function actionCard(title, desc, icon, onClick) {
  return el("article", { class: "card clickable", onClick },
    el("div", { class: "card-icon" }, icon),
    el("h3", { class: "card-title" }, title),
    el("p", { class: "card-desc" }, desc));
}

function showCard(show, navigate) {
  return el("article", {
    class: "card clickable",
    onClick: () => navigate("editor", { id: show.id }),
  },
    el("h3", { class: "card-title" }, show.name),
    el("p", { class: "card-desc" }, show.description || "Aucune description."),
    el("div", { class: "card-meta" },
      el("span", {}, `${show.cues.length} cue(s)`),
      el("span", {}, `${show.duration}s`),
      show.location ? el("span", {}, "📍 " + (show.location.name || "Lieu défini")) : null)
  );
}

function buildHero(show, navigate) {
  // Mini timeline visuelle du dernier spectacle
  const wrap = el("article", {
    class: "card clickable hero-card",
    onClick: () => navigate("editor", { id: show.id }),
  });
  wrap.appendChild(el("div", { class: "hero-card-header" },
    el("h3", {}, show.name),
    el("span", { class: "page-subtitle" },
      `${show.cues.length} cue(s) · ${formatTime(show.duration)} · ${show.cues.length ? "prêt" : "vide"}`)
  ));

  // Mini-timeline
  const tl = el("div", { class: "hero-timeline" });
  for (const cue of show.cues) {
    const eff = findEffect(cue.effectId);
    if (!eff) continue;
    const left = (cue.time / show.duration) * 100;
    tl.appendChild(el("span", {
      class: "hero-timeline-dot",
      style: { left: `${left}%`, background: eff.colors[0] },
      title: `${eff.name} · ${formatTime(cue.time)}`,
    }));
  }
  wrap.appendChild(tl);

  // Stats détaillées du show
  const cuesByLane = countByLane(show);
  wrap.appendChild(el("div", { class: "hero-card-stats" },
    miniStat("Aérien", cuesByLane.aerial, "✦"),
    miniStat("Sol", cuesByLane.ground, "⌃"),
    miniStat("SFX", cuesByLane.sfx, "♪"),
    miniStat("Coût", formatPrice(showCostOf(show)), "€")
  ));
  return wrap;
}

function miniStat(label, value, icon) {
  return el("div", { class: "hero-mini-stat" },
    el("span", { class: "hero-mini-stat-icon" }, icon),
    el("div", {},
      el("div", { class: "hero-mini-stat-value" }, String(value)),
      el("div", { class: "hero-mini-stat-label" }, label)));
}

function countByLane(show) {
  const out = { aerial: 0, ground: 0, sfx: 0 };
  for (const cue of show.cues) {
    const eff = findEffect(cue.effectId);
    if (!eff) continue;
    if (["fountain", "gerb", "mine", "flame"].includes(eff.partType)) out.ground++;
    else if (["sfx", "light"].includes(eff.partType)) out.sfx++;
    else out.aerial++;
  }
  return out;
}

function showCostOf(show) {
  let total = 0;
  for (const cue of show.cues) {
    const eff = findEffect(cue.effectId);
    if (eff) total += eff.price * cue.quantity;
  }
  return total;
}

function templateCard(tpl, navigate) {
  return el("article", {
    class: "template-card clickable",
    style: { borderColor: tpl.accent },
    onClick: () => {
      const sh = createShowFromTemplate(tpl);
      toast(`« ${sh.name} » créé.`);
      navigate("editor", { id: sh.id });
    },
  },
    el("div", { class: "template-icon", style: { color: tpl.accent } }, tpl.icon),
    el("h3", { class: "template-name" }, tpl.name),
    el("p", { class: "template-desc" }, tpl.description),
    el("div", { class: "template-meta" },
      el("span", {}, `${tpl.duration}s`),
      el("span", {}, " · "),
      el("span", {}, `${tpl.build().cues.length} cues`)));
}

function openTemplatePicker(navigate) {
  const grid = el("div", { class: "template-grid" });
  for (const tpl of TEMPLATES) {
    grid.appendChild(el("article", {
      class: "template-card clickable",
      style: { borderColor: tpl.accent },
      onClick: () => {
        const sh = createShowFromTemplate(tpl);
        toast(`« ${sh.name} » créé.`);
        close();
        navigate("editor", { id: sh.id });
      },
    },
      el("div", { class: "template-icon", style: { color: tpl.accent } }, tpl.icon),
      el("h3", { class: "template-name" }, tpl.name),
      el("p", { class: "template-desc" }, tpl.description),
      el("div", { class: "template-meta" },
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

function buildTipsCard() {
  const tips = [
    ["Glissez un effet", "depuis la bibliothèque sur la timeline pour ajouter un cue."],
    ["Ctrl+C / Ctrl+V", "copier et coller des cues, comme dans un éditeur de texte."],
    ["Maj+clic", "pour sélectionner plusieurs cues à la fois."],
    ["Ctrl+Z / Ctrl+Y", "tout est annulable. Aucun risque de casse."],
    ["Mode hors-ligne", "actif. Aucune donnée ne quitte votre machine."],
    ["Bons de tir", "imprimables en PDF depuis la vue Commandes."],
  ];
  const grid = el("div", { class: "tips-grid" });
  for (const [k, v] of tips) {
    grid.appendChild(el("div", { class: "tip" },
      el("strong", {}, k),
      el("span", {}, v)));
  }
  return grid;
}
