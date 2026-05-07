// Petits utilitaires DOM partagés.

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v === true) {
      node.setAttribute(k, "");
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

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function pageHeader(title, subtitle, actions = []) {
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

export function toast(message, kind = "info") {
  let t = document.querySelector(".toast");
  if (!t) {
    t = el("div", { class: "toast" });
    document.body.appendChild(t);
  }
  t.textContent = message;
  t.dataset.kind = kind;
  t.classList.add("visible");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("visible"), 2000);
}

export function modal({ title, body, footer }) {
  const overlay = el("div", { class: "modal-overlay" });
  const close = () => overlay.remove();
  const dialog = el(
    "div",
    { class: "modal", onClick: (e) => e.stopPropagation() },
    el(
      "header",
      { class: "modal-header" },
      el("h2", { class: "modal-title" }, title),
      el("button", { class: "modal-close", onClick: close, "aria-label": "Fermer" }, "✕")
    ),
    el("div", { class: "modal-body" }, body),
    footer ? el("footer", { class: "modal-footer" }, ...footer) : null
  );
  overlay.appendChild(dialog);
  overlay.addEventListener("click", close);
  document.body.appendChild(overlay);
  return { close, overlay };
}

export function formatDate(ts) {
  return new Date(ts).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(s) {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.floor((s - Math.floor(s)) * 10);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${cs}`;
}

export function formatPrice(n) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(n || 0);
}

export function downloadFile(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function confirmDialog(message) {
  return new Promise((resolve) => {
    const { close } = modal({
      title: "Confirmation",
      body: el("p", { style: "margin: 0;" }, message),
      footer: [
        el(
          "button",
          {
            class: "btn",
            onClick: () => {
              close();
              resolve(false);
            },
          },
          "Annuler"
        ),
        el(
          "button",
          {
            class: "btn btn-danger",
            onClick: () => {
              close();
              resolve(true);
            },
          },
          "Confirmer"
        ),
      ],
    });
  });
}

export function promptDialog(title, label, initial = "") {
  return new Promise((resolve) => {
    const input = el("input", {
      type: "text",
      value: initial,
      style: "width: 100%; padding: 8px 10px;",
    });
    const submit = () => {
      const v = input.value.trim();
      close();
      resolve(v || null);
    };
    const { close } = modal({
      title,
      body: el(
        "div",
        {},
        el("label", { class: "form-label" }, label),
        input
      ),
      footer: [
        el("button", { class: "btn", onClick: () => { close(); resolve(null); } }, "Annuler"),
        el("button", { class: "btn btn-primary", onClick: submit }, "Valider"),
      ],
    });
    input.focus();
    input.select();
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
      else if (e.key === "Escape") { close(); resolve(null); }
    });
  });
}
