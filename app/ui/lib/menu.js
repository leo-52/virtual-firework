// Menus drop-down pour la topbar et menus contextuels.
//
// Une définition de menu est un tableau d'items :
//   { label, action?, shortcut?, submenu?, disabled?, separator? }
//   { separator: true }
//
// Le helper `openMenu(anchor, items)` ouvre un panneau positionné sous
// l'élément `anchor`, et le ferme automatiquement au clic externe.

import { el } from "./dom.js";

let activeMenu = null;

function closeActive() {
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
    window.removeEventListener("mousedown", onDocClick, true);
    window.removeEventListener("keydown", onKey, true);
  }
}

function onDocClick(e) {
  if (activeMenu && !activeMenu.contains(e.target)) closeActive();
}

function onKey(e) {
  if (e.key === "Escape") {
    e.preventDefault();
    closeActive();
  }
}

function buildItems(items, root) {
  const list = el("ul", { class: "menu-list" });
  for (const item of items) {
    if (item.separator) {
      list.appendChild(el("li", { class: "menu-sep" }));
      continue;
    }
    const li = el("li", {
      class: "menu-item" + (item.disabled ? " menu-disabled" : "") +
             (item.submenu ? " menu-has-submenu" : ""),
    });
    li.appendChild(el("span", { class: "menu-label" }, item.label));
    if (item.shortcut) {
      li.appendChild(el("span", { class: "menu-shortcut" }, item.shortcut));
    }
    if (item.submenu) {
      li.appendChild(el("span", { class: "menu-arrow" }, "›"));
      let sub = null;
      li.addEventListener("mouseenter", () => {
        if (sub) return;
        sub = el("div", { class: "menu menu-sub" });
        sub.appendChild(buildItems(item.submenu, sub));
        const r = li.getBoundingClientRect();
        sub.style.left = r.right + "px";
        sub.style.top = r.top + "px";
        document.body.appendChild(sub);
        li._sub = sub;
      });
      li.addEventListener("mouseleave", () => {
        if (sub) {
          sub.remove();
          sub = null;
          li._sub = null;
        }
      });
    } else if (!item.disabled && item.action) {
      li.addEventListener("click", () => {
        const action = item.action;
        closeActive();
        try { action(); } catch (err) { console.error(err); }
      });
    }
    list.appendChild(li);
  }
  return list;
}

export function openMenu(anchor, items, opts = {}) {
  closeActive();
  const menu = el("div", { class: "menu" });
  menu.appendChild(buildItems(items, menu));

  const r = anchor.getBoundingClientRect();
  if (opts.below !== false) {
    menu.style.left = r.left + "px";
    menu.style.top = (r.bottom + 2) + "px";
  } else {
    menu.style.left = (opts.x || r.left) + "px";
    menu.style.top = (opts.y || r.top) + "px";
  }
  document.body.appendChild(menu);
  activeMenu = menu;

  // Ajustement si déborde à droite
  const mr = menu.getBoundingClientRect();
  if (mr.right > window.innerWidth - 8) {
    menu.style.left = (window.innerWidth - mr.width - 8) + "px";
  }

  window.addEventListener("mousedown", onDocClick, true);
  window.addEventListener("keydown", onKey, true);
  return { close: closeActive };
}

export function contextMenu(event, items) {
  event.preventDefault();
  return openMenu(
    event.target,
    items,
    { below: false, x: event.clientX, y: event.clientY }
  );
}
