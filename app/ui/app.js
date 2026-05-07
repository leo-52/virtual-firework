/* PrevoFX — shell de l'application
 * Architecture simple : un routeur SPA côté client, des vues qui rendent du HTML.
 * Aucun build step. Le visualiseur 3D existant (htmlui/) est chargé dans une iframe.
 */

const STORAGE_KEY = "prevofx.state.v1";

const defaultState = {
  shows: [],
  settings: {
    language: "fr",
    theme: "dark",
  },
};

const state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    return { ...defaultState, ...JSON.parse(raw) };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------- Routing ---------- */

const routes = {
  home: renderHome,
  shows: renderShows,
  viewer: renderViewer,
  orders: renderOrders,
  settings: renderSettings,
};

function navigate(route) {
  const target = routes[route] ? route : "home";
  document.querySelectorAll(".nav-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.route === target);
  });
  const main = document.getElementById("main");
  main.innerHTML = "";
  routes[target](main);
}

document.querySelectorAll(".nav-item").forEach((el) => {
  el.addEventListener("click", () => navigate(el.dataset.route));
});

/* ---------- Helpers ---------- */

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v !== false && v != null) {
      node.setAttribute(k, v);
    }
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(c));
  }
  return node;
}

function pageHeader(title, subtitle, actions = []) {
  return el(
    "header",
    { class: "page-header" },
    el(
      "div",
      {},
      el("h1", { class: "page-title" }, title),
      subtitle ? el("p", { class: "page-subtitle" }, subtitle) : null
    ),
    actions.length ? el("div", { class: "page-actions" }, ...actions) : null
  );
}

function toast(message) {
  let t = document.querySelector(".toast");
  if (!t) {
    t = el("div", { class: "toast" });
    document.body.appendChild(t);
  }
  t.textContent = message;
  t.classList.add("visible");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("visible"), 1800);
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* ---------- Pages ---------- */

function renderHome(main) {
  main.append(
    pageHeader("Bienvenue dans PrevoFX", "Concevez, visualisez et commandez vos spectacles pyrotechniques.")
  );

  const tiles = [
    {
      title: "Nouveau spectacle",
      desc: "Démarrer la conception d'un nouveau show pyrotechnique.",
      action: () => createShow(),
    },
    {
      title: "Mes spectacles",
      desc: "Reprendre un spectacle existant.",
      action: () => navigate("shows"),
    },
    {
      title: "Visualiseur 3D",
      desc: "Lancer la prévisualisation 3D du moteur de rendu.",
      action: () => navigate("viewer"),
    },
    {
      title: "Commandes",
      desc: "Préparer et passer commande des effets.",
      action: () => navigate("orders"),
    },
  ];

  const grid = el("div", { class: "cards" });
  for (const t of tiles) {
    grid.appendChild(
      el(
        "article",
        { class: "card clickable", onClick: t.action },
        el("h3", { class: "card-title" }, t.title),
        el("p", { class: "card-desc" }, t.desc)
      )
    );
  }
  main.append(grid);
}

function renderShows(main) {
  main.append(
    pageHeader(
      "Mes spectacles",
      "Tous vos projets pyrotechniques.",
      [
        el(
          "button",
          { class: "btn btn-primary", onClick: createShow },
          "+ Nouveau spectacle"
        ),
      ]
    )
  );

  if (!state.shows.length) {
    main.append(
      el(
        "div",
        { class: "empty" },
        el("div", { class: "empty-icon" }, "✦"),
        el("h2", { class: "empty-title" }, "Aucun spectacle pour le moment"),
        el(
          "p",
          { class: "empty-desc" },
          "Créez votre premier spectacle pour commencer à concevoir vos effets."
        ),
        el(
          "button",
          { class: "btn btn-primary", onClick: createShow },
          "+ Créer un spectacle"
        )
      )
    );
    return;
  }

  const grid = el("div", { class: "cards" });
  for (const show of state.shows) {
    grid.appendChild(
      el(
        "article",
        { class: "card clickable", onClick: () => openShow(show.id) },
        el("h3", { class: "card-title" }, show.name),
        el(
          "p",
          { class: "card-desc" },
          show.description || "Aucune description."
        ),
        el(
          "div",
          { class: "card-meta" },
          el("span", {}, `Créé le ${formatDate(show.createdAt)}`),
          el("span", {}, `${show.effectCount || 0} effet(s)`)
        )
      )
    );
  }
  main.append(grid);
}

function renderViewer(main) {
  main.append(
    pageHeader(
      "Visualiseur 3D",
      "Prévisualisation pyrotechnique en temps réel."
    )
  );

  const frame = el("iframe", {
    class: "viewer-frame",
    src: "../htmlui/index.html",
    allow: "fullscreen",
  });
  main.append(frame);
}

function renderOrders(main) {
  main.append(
    pageHeader(
      "Commandes",
      "Génération de bons de commande à partir de vos spectacles."
    )
  );

  main.append(
    el(
      "div",
      { class: "empty" },
      el("div", { class: "empty-icon" }, "⛬"),
      el("h2", { class: "empty-title" }, "Module de commande à venir"),
      el(
        "p",
        { class: "empty-desc" },
        "Bientôt : extraction des effets utilisés, agrégation par catégorie, et export vers vos fournisseurs."
      )
    )
  );
}

function renderSettings(main) {
  main.append(pageHeader("Paramètres", "Préférences de l'application."));

  const langGroup = el(
    "div",
    { class: "settings-group" },
    settingsRow(
      "Langue",
      "Langue de l'interface.",
      buildSelect(
        [
          { value: "fr", label: "Français" },
          { value: "en", label: "English" },
        ],
        state.settings.language,
        (v) => {
          state.settings.language = v;
          saveState();
          toast("Langue mise à jour. (le redémarrage peut être requis)");
        }
      )
    ),
    settingsRow(
      "Thème",
      "Apparence de l'interface.",
      buildSelect(
        [
          { value: "dark", label: "Sombre" },
          { value: "light", label: "Clair (à venir)" },
        ],
        state.settings.theme,
        (v) => {
          state.settings.theme = v;
          saveState();
          toast("Thème mis à jour.");
        }
      )
    )
  );
  main.append(langGroup);

  const dataGroup = el(
    "div",
    { class: "settings-group" },
    settingsRow(
      "Effacer les données locales",
      "Supprime vos spectacles et préférences enregistrés sur cet appareil.",
      el(
        "button",
        {
          class: "btn",
          onClick: () => {
            if (confirm("Effacer toutes les données locales ?")) {
              localStorage.removeItem(STORAGE_KEY);
              Object.assign(state, structuredClone(defaultState));
              toast("Données effacées.");
              navigate("home");
            }
          },
        },
        "Effacer"
      )
    )
  );
  main.append(dataGroup);

  main.append(
    el(
      "p",
      { class: "page-subtitle", style: "margin-top: 24px;" },
      `PrevoFX v0.1.0 — ${new Date().getFullYear()}`
    )
  );
}

function settingsRow(label, hint, control) {
  return el(
    "div",
    { class: "settings-row" },
    el(
      "div",
      {},
      el("div", { class: "settings-label" }, label),
      hint ? el("div", { class: "settings-hint" }, hint) : null
    ),
    control
  );
}

function buildSelect(options, value, onChange) {
  const select = el("select", {
    onChange: (e) => onChange(e.target.value),
  });
  for (const o of options) {
    const opt = el("option", { value: o.value }, o.label);
    if (o.value === value) opt.selected = true;
    select.appendChild(opt);
  }
  return select;
}

/* ---------- Actions ---------- */

function createShow() {
  const name = prompt("Nom du nouveau spectacle :", "Nouveau spectacle");
  if (!name) return;
  const show = {
    id: "show_" + Date.now().toString(36),
    name: name.trim(),
    description: "",
    createdAt: Date.now(),
    effectCount: 0,
  };
  state.shows.unshift(show);
  saveState();
  toast(`Spectacle « ${show.name} » créé.`);
  navigate("shows");
}

function openShow(id) {
  const show = state.shows.find((s) => s.id === id);
  if (!show) return;
  toast(`Ouverture de « ${show.name} » — éditeur à venir.`);
}

/* ---------- Init ---------- */

navigate("home");
