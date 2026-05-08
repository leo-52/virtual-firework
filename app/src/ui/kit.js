// Kit DOM minimaliste : helpers de création d'éléments + utilitaires de
// formatage. C'est notre seule "lib UI", on n'a pas besoin de plus.

/**
 * Crée un élément DOM.
 *
 *   el("button", { class: "btn", onClick: fn }, "Texte")
 *   el("div", {}, child1, child2, ...)
 *
 * - props.class           → className
 * - props.style           → string OU objet { color: "red" }
 * - props["data-foo"]     → dataset.foo
 * - props.onClick et co.  → addEventListener
 * - children              → noeuds, strings, ou tableaux nestés (filtre les null/undefined)
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "style") {
      if (typeof v === "string") node.style.cssText = v;
      else Object.assign(node.style, v);
    } else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === "value" || k === "checked" || k === "disabled" ||
               k === "selected" || k === "draggable") {
      node[k] = v;
    } else {
      node.setAttribute(k, v);
    }
  }
  appendKids(node, children);
  return node;
}

function appendKids(node, kids) {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) appendKids(node, k);
    else if (k instanceof Node) node.appendChild(k);
    else node.appendChild(document.createTextNode(String(k)));
  }
}

// Vide un élément.
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// ---- Formatage ----

const fmtPrice = new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR",
});

export function formatPrice(n) {
  return fmtPrice.format(Number.isFinite(n) ? n : 0);
}

export function formatTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${String(m).padStart(2, "0")}:${r.toFixed(1).padStart(4, "0")}`;
}

export function formatDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---- Toast / notifications ----

let toastRoot = null;

export function toast(message, kind = "info", durationMs = 3000) {
  if (!toastRoot) toastRoot = document.getElementById("toast-root");
  if (!toastRoot) return;
  const t = el("div", { class: `toast ${kind}` }, message);
  toastRoot.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateX(20px)";
    t.style.transition = "opacity 200ms ease, transform 200ms ease";
    setTimeout(() => t.remove(), 220);
  }, durationMs);
}

// ---- Modal simple ----

export function modal({ title, body, footer = [], width }) {
  const root = document.getElementById("modal-root");
  const overlay = el("div", { class: "modal-overlay" });
  const m = el("div", {
    class: "modal",
    style: width ? `min-width: ${width}px;` : "",
  });

  const close = () => overlay.remove();
  m.appendChild(el("header", { class: "modal-header" },
    el("h2", {}, title),
    el("button", { class: "btn btn-ghost", onClick: close, title: "Fermer (Échap)" }, "✕")));
  m.appendChild(el("div", { class: "modal-body" }, body));
  if (footer.length) {
    m.appendChild(el("footer", { class: "modal-footer" }, ...footer));
  }
  overlay.appendChild(m);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  const onKey = (e) => {
    if (e.key === "Escape") {
      close();
      window.removeEventListener("keydown", onKey);
    }
  };
  window.addEventListener("keydown", onKey);
  root.appendChild(overlay);
  return { close };
}

export function confirm(message, { title = "Confirmer", okLabel = "OK", danger = false } = {}) {
  return new Promise((resolve) => {
    let resolved = false;
    const decide = (v) => { if (!resolved) { resolved = true; close(); resolve(v); } };
    const okBtn = el("button", {
      class: danger ? "btn btn-danger" : "btn btn-primary",
      onClick: () => decide(true),
    }, okLabel);
    const cancelBtn = el("button", { class: "btn", onClick: () => decide(false) }, "Annuler");
    const { close } = modal({ title, body: el("p", {}, message), footer: [cancelBtn, okBtn] });
    setTimeout(() => okBtn.focus(), 0);
  });
}

export function prompt(label, defaultValue = "", { title = "Saisie", okLabel = "OK" } = {}) {
  return new Promise((resolve) => {
    let resolved = false;
    const input = el("input", { type: "text", value: defaultValue, style: "width: 100%;" });
    const decide = (v) => { if (!resolved) { resolved = true; close(); resolve(v); } };
    const okBtn = el("button", {
      class: "btn btn-primary",
      onClick: () => decide(input.value.trim() || null),
    }, okLabel);
    const cancelBtn = el("button", { class: "btn", onClick: () => decide(null) }, "Annuler");
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") decide(input.value.trim() || null);
    });
    const { close } = modal({
      title,
      body: el("div", {},
        el("label", { class: "field-label" }, label),
        input),
      footer: [cancelBtn, okBtn],
    });
    setTimeout(() => input.select(), 0);
  });
}

// ---- File picker ----

export function pickFile(accept) {
  return new Promise((resolve) => {
    const input = el("input", {
      type: "file",
      accept: accept || "*",
      style: "display: none;",
    });
    input.addEventListener("change", () => {
      const f = input.files[0] || null;
      input.remove();
      resolve(f);
    }, { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

// ---- Download ----

export function download(filename, content, mime = "application/octet-stream") {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: filename, style: "display: none;" });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
}
