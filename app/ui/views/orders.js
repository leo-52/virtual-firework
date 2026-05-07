import {
  el, pageHeader, formatPrice, downloadFile, toast,
} from "../lib/dom.js";
import { state, getShow, aggregateOrder, showCost } from "../lib/state.js";
import { CATEGORIES } from "../data/effects.js";

export function renderOrders(main, navigate, params = {}) {
  let scope = params.id || "all"; // "all" ou un id de show
  let groupBy = "effect";        // effect | category | vendor

  main.append(
    pageHeader(
      "Bons de commande",
      "Agrégez les effets utilisés dans vos spectacles et exportez la commande.",
      [
        el("button", { class: "btn", onClick: () => exportCsv() }, "⤓ Export CSV"),
        el("button", { class: "btn btn-primary", onClick: () => print() }, "Imprimer"),
      ]
    )
  );

  // ---- Sélecteurs ----
  const scopeSelect = el(
    "select",
    {
      onChange: (e) => { scope = e.target.value; redraw(); },
    },
    el("option", { value: "all" }, "Tous les spectacles"),
    ...state.shows.map((s) => el("option", { value: s.id }, s.name))
  );
  scopeSelect.value = scope;

  const groupSelect = el(
    "select",
    {
      onChange: (e) => { groupBy = e.target.value; redraw(); },
    },
    el("option", { value: "effect" }, "Par effet"),
    el("option", { value: "category" }, "Par catégorie"),
    el("option", { value: "vendor" }, "Par fournisseur")
  );

  main.append(
    el(
      "div",
      { class: "orders-filters" },
      el("label", { class: "form-label" }, "Périmètre"),
      scopeSelect,
      el("label", { class: "form-label" }, "Regroupement"),
      groupSelect
    )
  );

  const container = el("div", { id: "order-container" });
  main.append(container);

  function buildScope() {
    const shows = scope === "all" ? state.shows : [getShow(scope)].filter(Boolean);
    if (!shows.length) return [];
    const merged = new Map();
    for (const sh of shows) {
      for (const row of aggregateOrder(sh)) {
        const cur = merged.get(row.effect.id) || { effect: row.effect, quantity: 0 };
        cur.quantity += row.quantity;
        merged.set(row.effect.id, cur);
      }
    }
    return [...merged.values()].sort((a, b) =>
      a.effect.name.localeCompare(b.effect.name, "fr")
    );
  }

  function redraw() {
    container.innerHTML = "";
    const rows = buildScope();
    if (!rows.length) {
      container.appendChild(
        el("div", { class: "empty" },
          el("h2", { class: "empty-title" }, "Rien à commander"),
          el("p", { class: "empty-desc" },
            "Aucun effet n'a été ajouté aux spectacles sélectionnés."))
      );
      return;
    }

    const total = rows.reduce((s, r) => s + r.quantity * r.effect.price, 0);
    const totalQty = rows.reduce((s, r) => s + r.quantity, 0);

    container.appendChild(
      el("div", { class: "order-summary" },
        statTile("Lignes", rows.length),
        statTile("Quantité totale", totalQty),
        statTile("Montant total HT", formatPrice(total)))
    );

    if (groupBy === "effect") {
      container.appendChild(buildEffectTable(rows));
    } else if (groupBy === "category") {
      container.appendChild(buildGroupedTable(rows, (r) => r.effect.partType, CATEGORIES));
    } else {
      container.appendChild(buildGroupedTable(rows, (r) => r.effect.vendor));
    }
  }

  function exportCsv() {
    const rows = buildScope();
    if (!rows.length) {
      toast("Rien à exporter.");
      return;
    }
    const lines = [
      ["ID", "Nom", "Catégorie", "Calibre (mm)", "Durée (s)", "Hauteur (m)", "Fournisseur", "Quantité", "PU (€)", "Total (€)"].join(";"),
    ];
    let total = 0;
    for (const r of rows) {
      const eff = r.effect;
      const totalLine = (r.quantity * eff.price).toFixed(2);
      total += r.quantity * eff.price;
      lines.push(
        [
          eff.id,
          csvEsc(eff.name),
          eff.partType,
          eff.caliber || "",
          eff.duration,
          eff.height,
          csvEsc(eff.vendor),
          r.quantity,
          eff.price.toFixed(2),
          totalLine,
        ].join(";")
      );
    }
    lines.push(["", "", "", "", "", "", "", "TOTAL", "", total.toFixed(2)].join(";"));
    const date = new Date().toISOString().slice(0, 10);
    const scopeName = scope === "all" ? "tous_spectacles" : (getShow(scope)?.name || "spectacle").replace(/[^a-z0-9]+/gi, "_");
    downloadFile(`commande_${scopeName}_${date}.csv`, lines.join("\n"), "text/csv");
    toast("Export CSV téléchargé.");
  }

  function print() {
    window.print();
  }

  redraw();
}

function csvEsc(s) {
  if (s == null) return "";
  return /[;"\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : String(s);
}

function statTile(label, value) {
  return el(
    "div",
    { class: "stat-tile" },
    el("div", { class: "stat-tile-value" }, String(value)),
    el("div", { class: "stat-tile-label" }, label)
  );
}

function buildEffectTable(rows) {
  const table = el("table", { class: "table table-order" });
  table.appendChild(
    el(
      "thead",
      {},
      el(
        "tr",
        {},
        el("th", {}, "Effet"),
        el("th", {}, "Catégorie"),
        el("th", { class: "num" }, "Calibre"),
        el("th", {}, "Fournisseur"),
        el("th", { class: "num" }, "Qté"),
        el("th", { class: "num" }, "PU"),
        el("th", { class: "num" }, "Total")
      )
    )
  );
  const tbody = el("tbody");
  for (const r of rows) {
    const eff = r.effect;
    const cat = CATEGORIES[eff.partType];
    tbody.appendChild(
      el(
        "tr",
        {},
        el("td", {}, eff.name),
        el(
          "td",
          {},
          el(
            "span",
            { class: "category-badge", style: { color: cat.color, borderColor: cat.color } },
            cat.icon, " ", cat.label
          )
        ),
        el("td", { class: "num" }, eff.caliber ? `${eff.caliber}mm` : "—"),
        el("td", {}, eff.vendor),
        el("td", { class: "num" }, r.quantity),
        el("td", { class: "num" }, formatPrice(eff.price)),
        el("td", { class: "num" }, formatPrice(eff.price * r.quantity))
      )
    );
  }
  table.appendChild(tbody);
  return table;
}

function buildGroupedTable(rows, keyFn, labels) {
  const groups = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const wrap = el("div", {});
  for (const [k, items] of groups) {
    const total = items.reduce((s, r) => s + r.quantity * r.effect.price, 0);
    const qty = items.reduce((s, r) => s + r.quantity, 0);
    const label = labels?.[k]?.label || k;
    wrap.appendChild(
      el("div", { class: "group-header" },
        el("strong", {}, label),
        el("span", { class: "page-subtitle" },
          ` — ${qty} unité(s) · ${formatPrice(total)}`))
    );
    wrap.appendChild(buildEffectTable(items));
  }
  return wrap;
}
