// Bons de tir et bons de commande imprimables (HTML print-friendly).
//
// On ouvre une fenêtre dédiée (NW.js / popup) avec un document HTML
// stylisé pour l'impression. Au choix : "tir" (séquence chronologique
// pour l'artificier) ou "commande" (agrégation par effet pour le
// fournisseur).

import { state, getShow, aggregateOrder, showCost, findEffect } from "../lib/state.js";
import { CATEGORIES, partTypeLabel, subtypeLabel } from "../data/effects.js";
import { toast } from "../lib/dom.js";

const PRINT_CSS = `
  @media print {
    @page { size: A4; margin: 14mm 12mm; }
    body { background: #fff; }
  }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", "Helvetica Neue", sans-serif;
    color: #111;
    background: #f6f7fa;
    margin: 0;
    padding: 24px;
    font-size: 12px;
  }
  .page { background: #fff; max-width: 800px; margin: 0 auto 16px; padding: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08); border-radius: 4px; }
  @media print { .page { box-shadow: none; padding: 0; max-width: 100%; } }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #d0d4dc; }
  .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
          margin: 16px 0; padding: 10px; background: #f0f2f7; border-radius: 4px; }
  .meta-item { display: flex; flex-direction: column; gap: 2px; }
  .meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: #666; }
  .meta-value { font-weight: 600; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;
       color: #444; padding: 8px 6px; border-bottom: 2px solid #111; }
  td { padding: 6px; border-bottom: 1px solid #e0e3eb; vertical-align: top; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr.subtotal td { font-weight: 700; border-top: 1px solid #111; border-bottom: 1px solid #111; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px;
           border: 1px solid; }
  .footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #ccc;
            font-size: 10px; color: #777; display: flex; justify-content: space-between; }
  .toolbar { position: fixed; top: 12px; right: 12px; display: flex; gap: 6px; z-index: 999; }
  .toolbar button { background: #111; color: #fff; border: 0; padding: 8px 14px;
                    border-radius: 4px; cursor: pointer; font-size: 12px; }
  .toolbar button:hover { background: #444; }
  @media print { .toolbar { display: none; } }
  .lane-section h3 { font-size: 12px; margin: 12px 0 4px; color: #555; }
`;

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function fmt(n) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n || 0);
}

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds * 10) % 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${ms}`;
}

function header(title, subtitle) {
  return `
    <h1>${escapeHtml(title)}</h1>
    <p style="margin: 0; color: #666;">${escapeHtml(subtitle)}</p>
  `;
}

function metaBox(items) {
  return `
    <div class="meta">
      ${items.map((i) =>
        `<div class="meta-item">
           <span class="meta-label">${escapeHtml(i.label)}</span>
           <span class="meta-value">${escapeHtml(i.value)}</span>
         </div>`
      ).join("")}
    </div>
  `;
}

function buildShootSheet(show) {
  const cues = [...show.cues].sort((a, b) => a.time - b.time);
  const total = showCost(show);
  const dateStr = new Date().toLocaleDateString("fr-FR");

  const rows = cues.map((cue, i) => {
    const eff = findEffect(cue.effectId);
    if (!eff) return "";
    const cat = CATEGORIES[eff.partType] || CATEGORIES.other;
    return `
      <tr>
        <td class="num">${i + 1}</td>
        <td class="num"><strong>${fmtTime(cue.time)}</strong></td>
        <td><span class="badge" style="color:${cat.color};border-color:${cat.color}">${escapeHtml(cat.label)}</span></td>
        <td>${escapeHtml(eff.name)}</td>
        <td>${eff.subtype ? escapeHtml(subtypeLabel(eff.subtype)) : "—"}</td>
        <td class="num">${eff.caliber || "—"}${eff.caliber ? "mm" : ""}</td>
        <td class="num">${eff.duration}s</td>
        <td class="num">${cue.quantity}</td>
        <td class="num">${escapeHtml(eff.vendor || "—")}</td>
      </tr>
    `;
  }).join("");

  return `
    <div class="page">
      ${header("Bon de tir", show.name)}
      ${metaBox([
        { label: "Date", value: dateStr },
        { label: "Durée", value: `${show.duration}s (${fmtTime(show.duration)})` },
        { label: "Cues", value: cues.length },
        { label: "Coût total HT", value: fmt(total) },
        { label: "Lieu", value: show.location?.name || "—" },
        { label: "Coordonnées", value: show.location ?
          `${show.location.lat.toFixed(5)}, ${show.location.lon.toFixed(5)}` : "—" },
        { label: "Description", value: show.description || "—" },
        { label: "Imprimé le", value: new Date().toLocaleString("fr-FR") },
      ])}
      <h2>Séquence chronologique</h2>
      <table>
        <thead>
          <tr>
            <th class="num">#</th><th class="num">Temps</th>
            <th>Type</th><th>Effet</th><th>Style</th>
            <th class="num">Calibre</th><th class="num">Durée</th>
            <th class="num">Qté</th><th>Fournisseur</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">
        <span>PrevoFX — ${escapeHtml(show.name)}</span>
        <span>Page 1</span>
      </div>
    </div>
  `;
}

function buildOrderSheet(show) {
  const rows = aggregateOrder(show);
  const total = rows.reduce((s, r) => s + r.quantity * r.effect.price, 0);
  const totalQty = rows.reduce((s, r) => s + r.quantity, 0);
  const dateStr = new Date().toLocaleDateString("fr-FR");

  const html = rows.map((r) => {
    const eff = r.effect;
    const cat = CATEGORIES[eff.partType] || CATEGORIES.other;
    return `
      <tr>
        <td>${escapeHtml(eff.id)}</td>
        <td>${escapeHtml(eff.name)}</td>
        <td><span class="badge" style="color:${cat.color};border-color:${cat.color}">${escapeHtml(cat.label)}</span></td>
        <td class="num">${eff.caliber ? eff.caliber + "mm" : "—"}</td>
        <td>${escapeHtml(eff.vendor || "—")}</td>
        <td class="num">${r.quantity}</td>
        <td class="num">${fmt(eff.price)}</td>
        <td class="num">${fmt(eff.price * r.quantity)}</td>
      </tr>
    `;
  }).join("");

  return `
    <div class="page">
      ${header("Bon de commande", show.name)}
      ${metaBox([
        { label: "Date", value: dateStr },
        { label: "Lignes", value: rows.length },
        { label: "Quantité totale", value: totalQty },
        { label: "Montant total HT", value: fmt(total) },
      ])}
      <h2>Détail par effet</h2>
      <table>
        <thead>
          <tr>
            <th>Réf.</th><th>Effet</th><th>Type</th>
            <th class="num">Calibre</th><th>Fournisseur</th>
            <th class="num">Qté</th><th class="num">PU HT</th><th class="num">Total HT</th>
          </tr>
        </thead>
        <tbody>${html}
          <tr class="subtotal">
            <td colspan="5"></td>
            <td class="num">${totalQty}</td>
            <td class="num">TOTAL HT</td>
            <td class="num">${fmt(total)}</td>
          </tr>
        </tbody>
      </table>
      <div class="footer">
        <span>PrevoFX — Bon de commande pour ${escapeHtml(show.name)}</span>
        <span>Imprimé le ${new Date().toLocaleString("fr-FR")}</span>
      </div>
    </div>
  `;
}

function openPrintWindow(title, html) {
  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) {
    toast("Impossible d'ouvrir une fenêtre d'impression (popups bloqués ?)");
    return null;
  }
  win.document.open();
  win.document.write(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">Imprimer</button>
    <button onclick="window.close()">Fermer</button>
  </div>
  ${html}
</body>
</html>`);
  win.document.close();
  return win;
}

export function printShootSheet(showId) {
  const show = getShow(showId);
  if (!show) { toast("Spectacle introuvable."); return; }
  const win = openPrintWindow(`Bon de tir — ${show.name}`, buildShootSheet(show));
  if (win) toast("Bon de tir ouvert. Utilisez « Imprimer » pour exporter en PDF.");
}

export function printOrderSheet(showId) {
  const show = getShow(showId);
  if (!show) { toast("Spectacle introuvable."); return; }
  const win = openPrintWindow(`Bon de commande — ${show.name}`, buildOrderSheet(show));
  if (win) toast("Bon de commande ouvert. Utilisez « Imprimer » pour exporter en PDF.");
}

// Export combiné : tous les spectacles sélectionnés agrégés.
export function printAllShowsOrder() {
  const all = state.shows;
  if (!all.length) { toast("Aucun spectacle."); return; }
  const merged = new Map();
  for (const sh of all) {
    for (const r of aggregateOrder(sh)) {
      const cur = merged.get(r.effect.id) || { effect: r.effect, quantity: 0 };
      cur.quantity += r.quantity;
      merged.set(r.effect.id, cur);
    }
  }
  const rows = [...merged.values()].sort((a, b) =>
    a.effect.name.localeCompare(b.effect.name, "fr"));
  const fakeShow = {
    name: `${all.length} spectacle(s) cumulé(s)`,
    cues: [],
    duration: 0,
  };
  const total = rows.reduce((s, r) => s + r.quantity * r.effect.price, 0);
  const totalQty = rows.reduce((s, r) => s + r.quantity, 0);
  const html = rows.map((r) => {
    const eff = r.effect;
    const cat = CATEGORIES[eff.partType] || CATEGORIES.other;
    return `
      <tr>
        <td>${escapeHtml(eff.id)}</td>
        <td>${escapeHtml(eff.name)}</td>
        <td><span class="badge" style="color:${cat.color};border-color:${cat.color}">${escapeHtml(cat.label)}</span></td>
        <td class="num">${eff.caliber || "—"}${eff.caliber ? "mm" : ""}</td>
        <td>${escapeHtml(eff.vendor || "—")}</td>
        <td class="num">${r.quantity}</td>
        <td class="num">${fmt(eff.price)}</td>
        <td class="num">${fmt(eff.price * r.quantity)}</td>
      </tr>`;
  }).join("");
  const body = `
    <div class="page">
      ${header("Bon de commande consolidé", `${all.length} spectacles`)}
      ${metaBox([
        { label: "Spectacles", value: all.length },
        { label: "Lignes", value: rows.length },
        { label: "Quantité totale", value: totalQty },
        { label: "Montant total HT", value: fmt(total) },
      ])}
      <h2>Détail consolidé</h2>
      <table>
        <thead>
          <tr><th>Réf.</th><th>Effet</th><th>Type</th><th class="num">Calibre</th><th>Fournisseur</th><th class="num">Qté</th><th class="num">PU HT</th><th class="num">Total HT</th></tr>
        </thead>
        <tbody>${html}
          <tr class="subtotal"><td colspan="5"></td><td class="num">${totalQty}</td><td class="num">TOTAL HT</td><td class="num">${fmt(total)}</td></tr>
        </tbody>
      </table>
      <div class="footer">
        <span>PrevoFX — Commande consolidée</span>
        <span>Imprimé le ${new Date().toLocaleString("fr-FR")}</span>
      </div>
    </div>`;
  openPrintWindow("Bon de commande consolidé", body);
}
