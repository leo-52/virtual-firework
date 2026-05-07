// PrevoFX — bootstrap : routeur et navigation latérale.

import { installShield, getStats, onChange } from "./lib/network-shield.js";
import { renderHome } from "./views/home.js";
import { renderShows } from "./views/shows.js";
import { renderEditor } from "./views/editor.js";
import { renderLibrary } from "./views/library.js";
import { renderViewer } from "./views/viewer.js";
import { renderOrders } from "./views/orders.js";
import { renderSettings } from "./views/settings.js";

const NAV = [
  { route: "home",     label: "Accueil",          icon: "⌂" },
  { route: "shows",    label: "Mes spectacles",   icon: "✦" },
  { route: "library",  label: "Bibliothèque",     icon: "⌗" },
  { route: "viewer",   label: "Visualiseur",      icon: "▶" },
  { route: "orders",   label: "Commandes",        icon: "⛬" },
];

const FOOTER_NAV = [
  { route: "settings", label: "Paramètres",       icon: "⚙" },
];

const ROUTES = {
  home: renderHome,
  shows: renderShows,
  editor: renderEditor,     // ouvert via lien depuis Spectacles
  library: renderLibrary,
  viewer: renderViewer,
  orders: renderOrders,
  settings: renderSettings,
};

// Active le bouclier réseau le plus tôt possible (avant tout autre rendu).
installShield();

const main = document.getElementById("main");
const navContainer = document.getElementById("nav");
const navFooter = document.getElementById("nav-footer");

let currentRoute = "home";

// Indicateur "Hors-ligne" dans la sidebar : pastille avec compteur de
// requêtes bloquées, mise à jour en temps réel.
function buildShieldIndicator() {
  const root = document.createElement("div");
  root.className = "shield-indicator";
  root.title = "Mode hors-ligne — toutes les requêtes vers les serveurs distants sont bloquées.";
  const dot = document.createElement("span");
  dot.className = "shield-dot";
  const label = document.createElement("span");
  label.className = "shield-label";
  const count = document.createElement("span");
  count.className = "shield-count";
  root.append(dot, label, count);
  root.addEventListener("click", () => navigate("settings"));

  const update = (s) => {
    label.textContent = s.enabled ? "Hors-ligne" : "Réseau libre";
    count.textContent = s.blocked > 0 ? ` · ${s.blocked} bloquée${s.blocked > 1 ? "s" : ""}` : "";
    root.classList.toggle("shield-active", s.enabled);
  };
  update(getStats());
  onChange(update);
  return root;
}

function buildNav(items, container, isFooter) {
  for (const item of items) {
    const btn = document.createElement("button");
    btn.className = "nav-item";
    btn.dataset.route = item.route;
    btn.innerHTML = `<span class="nav-icon" aria-hidden="true">${item.icon}</span><span>${item.label}</span>`;
    btn.addEventListener("click", () => navigate(item.route));
    container.appendChild(btn);
  }
}
buildNav(NAV, navContainer, false);
buildNav(FOOTER_NAV, navFooter, true);
navFooter.appendChild(buildShieldIndicator());

export function navigate(route, params = {}) {
  if (!ROUTES[route]) route = "home";
  currentRoute = route;

  // Highlight nav (route éditeur retombe sur "shows")
  const navHighlight = route === "editor" ? "shows" : route;
  document.querySelectorAll(".nav-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.route === navHighlight);
  });

  main.innerHTML = "";
  ROUTES[route](main, navigate, params);
  main.scrollTop = 0;
}

// Premier rendu
navigate("home");

// Raccourci clavier : Ctrl+, → paramètres
window.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === ",") {
    e.preventDefault();
    navigate("settings");
  }
});
