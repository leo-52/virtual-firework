import { el } from "./kit.js";

export const NAV = [
  { route: "home",     label: "Accueil",       icon: "⌂" },
  { route: "shows",    label: "Spectacles",    icon: "✦" },
  { route: "library",  label: "Bibliothèque",  icon: "⌗" },
  { route: "viewer",   label: "Visualiseur",   icon: "▶" },
  { route: "orders",   label: "Commandes",     icon: "⛬" },
];

const FOOTER = [
  { route: "settings", label: "Paramètres",    icon: "⚙" },
];

export function renderSidebar(root, navigate) {
  root.innerHTML = "";

  for (const item of NAV) {
    root.appendChild(navItem(item, navigate));
  }

  root.appendChild(el("div", { class: "sidebar-spacer" }));

  for (const item of FOOTER) {
    root.appendChild(navItem(item, navigate));
  }
}

function navItem(item, navigate) {
  return el("button", {
    class: "nav-item",
    "data-route": item.route,
    onClick: () => navigate(item.route),
  },
    el("span", { class: "nav-icon" }, item.icon),
    el("span", {}, item.label));
}
