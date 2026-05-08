import { el, formatPrice, download, toast } from "../ui/kit.js";
import * as store from "../store.js";
import { partTypeLabel } from "../catalog.js";
import { printShootSheet, printOrderSheet } from "../tools/pdf.js";

export function renderOrders(root, navigate, params = {}) {
  let scope = params.id || "all";
  let groupBy = "effect"; // effect | vendor

  const shows = store.getShows();

  root.appendChild(el("header", { class: "page-header" },
    el("div", {},
      el("h1", { class: "page-title" }, "Bons de commande"),
      el("p", { class: "page-subtitle" },
        "Agrégez les effets et exportez la commande au format CSV ou PDF.")),
    el("div", { class: "page-actions" },
      el("button", { class: "btn", onClick: () => exportCsv() }, "⤓ CSV"),
      el("button", {
        class: "btn",
        disabled: scope === "all",
        onClick: () => scope !== "all" && printOrderSheet(scope),
      }, "🖨 Bon de commande"),
      el("button", {
        class: "btn btn-primary",
        disabled: scope === "all",
        onClick: () => scope !== "all" && printShootSheet(scope),
      }, "🖨 Bon de tir"))));

  if (!shows.length) {
    root.appendChild(el("div", { class: "empty" },
      el("h2", { class: "empty-title" }, "Aucun spectacle"),
      el("p", { class: "empty-desc" }, "Créez d'abord un spectacle.")));
    return;
  }

  // Filtres
  const scopeSelect = el("select", {
    onChange: (e) => { scope = e.target.value; redraw(); },
  },
    el("option", { value: "all" }, "Tous spectacles"),
    ...shows.map((s) => el("option", { value: s.id }, s.name)));
  scopeSelect.value = scope;

  const groupSelect = el("select", {
    onChange: (e) => { groupBy = e.target.value; redraw(); },
  },
    el("option", { value: "effect" }, "Par effet"),
    el("option", { value: "vendor" }, "Par fournisseur"));

  root.appendChild(el("div", {
    style: "display: flex; gap: 8px; margin-bottom: 14px; align-items: center;",
  },
    el("label", { class: "field-label" }, "Périmètre"), scopeSelect,
    el("label", { class: "field-label" }, "Regrouper par"), groupSelect));

  const container = el("div");
  root.appendChild(container);

  function buildScope() {
    const sources = scope === "all" ? shows : [store.getShow(scope)].filter(Boolean);
    const merged = new Map();
    for (const sh of sources) {
      for (const r of store.aggregateOrder(sh)) {
        const cur = merged.get(r.effect.id) || { effect: r.effect, quantity: 0 };
        cur.quantity += r.quantity;
        merged.set(r.effect.id, cur);
      }
    }
    return [...merged.values()].sort((a, b) =>
      a.effect.name.localeCompare(b.effect.name, "fr"));
  }

  function exportCsv() {
    const rows = buildScope();
    if (!rows.length) { toast("Rien à exporter."); return; }
    const lines = [
      ["Réf", "Nom", "Type", "Calibre", "Durée", "Hauteur", "Fournisseur",
       "Qté", "PU HT", "Total HT"].join(";"),
    ];
    let total = 0;
    for (const r of rows) {
      const e = r.effect;
      const t = r.quantity * e.price;
      total += t;
      lines.push([
        e.id, csv(e.name), csv(partTypeLabel(e.partType)),
        e.caliber || "", e.duration, e.height,
        csv(e.vendor || ""), r.quantity,
        e.price.toFixed(2), t.toFixed(2),
      ].join(";"));
    }
    lines.push(["", "", "", "", "", "", "", "TOTAL", "", total.toFixed(2)].join(";"));
    const date = new Date().toISOString().slice(0, 10);
    download(`commande_${date}.csv`, lines.join("\n"), "text/csv");
    toast("Export CSV téléchargé.", "success");
  }

  function redraw() {
    container.innerHTML = "";
    const rows = buildScope();
    if (!rows.length) {
      container.appendChild(el("p", { class: "empty-desc" }, "Rien à commander."));
      return;
    }
    const total = rows.reduce((s, r) => s + r.quantity * r.effect.price, 0);
    const totalQty = rows.reduce((s, r) => s + r.quantity, 0);

    container.appendChild(el("div", { class: "stats" },
      stat("Lignes", rows.length),
      stat("Quantité", totalQty),
      stat("Montant HT", formatPrice(total))));

    if (groupBy === "vendor") {
      const groups = new Map();
      for (const r of rows) {
        const k = r.effect.vendor || "—";
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(r);
      }
      for (const [vendor, items] of groups) {
        const vTotal = items.reduce((s, r) => s + r.quantity * r.effect.price, 0);
        container.appendChild(el("h3", { class: "section-title" },
          `${vendor} — ${items.length} ligne(s) — ${formatPrice(vTotal)}`));
        container.appendChild(buildTable(items));
      }
    } else {
      container.appendChild(buildTable(rows));
    }
  }

  redraw();
}

function buildTable(rows) {
  const t = el("table", { class: "table" });
  t.appendChild(el("thead", {},
    el("tr", {},
      el("th", {}, "Effet"),
      el("th", {}, "Type"),
      el("th", { class: "num" }, "Calibre"),
      el("th", {}, "Fournisseur"),
      el("th", { class: "num" }, "Qté"),
      el("th", { class: "num" }, "PU"),
      el("th", { class: "num" }, "Total HT"))));
  const tb = el("tbody");
  for (const r of rows) {
    const e = r.effect;
    tb.appendChild(el("tr", {},
      el("td", {}, e.name),
      el("td", {}, partTypeLabel(e.partType)),
      el("td", { class: "num" }, e.caliber ? `${e.caliber}mm` : "—"),
      el("td", {}, e.vendor || "—"),
      el("td", { class: "num" }, String(r.quantity)),
      el("td", { class: "num" }, formatPrice(e.price)),
      el("td", { class: "num" }, formatPrice(e.price * r.quantity))));
  }
  t.appendChild(tb);
  return t;
}

function stat(label, value) {
  return el("div", { class: "stat" },
    el("div", { class: "stat-value" }, String(value)),
    el("div", { class: "stat-label" }, label));
}

function csv(s) {
  if (s == null) return "";
  return /[;"\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : String(s);
}
