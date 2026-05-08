// Bons de tir et de commande imprimables (HTML print-friendly).
//
// Ouvre une nouvelle fenêtre avec un document HTML stylisé pour @media
// print. Bouton "Imprimer" déclenche le dialog OS, qui sait sortir en
// PDF via l'imprimante virtuelle.

import * as store from "../store.js";
import { partTypeLabel, subtypeLabel, partTypeColor } from "../catalog.js";
import { toast } from "../ui/kit.js";

const CSS = `
@media print {
  @page { size: A4; margin: 14mm 12mm; }
  body { background: #fff; }
}
body {
  font-family: system-ui, -apple-system, "Segoe UI", "Helvetica Neue", sans-serif;
  color: #111; background: #f6f7fa; margin: 0; padding: 24px; font-size: 12px;
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
.badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px; border: 1px solid; }
.footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #ccc;
          font-size: 10px; color: #777; display: flex; justify-content: space-between; }
.toolbar { position: fixed; top: 12px; right: 12px; display: flex; gap: 6px; z-index: 999; }
.toolbar button { background: #111; color: #fff; border: 0; padding: 8px 14px;
                  border-radius: 4px; cursor: pointer; font-size: 12px; }
.toolbar button:hover { background: #444; }
@media print { .toolbar { display: none; } }
`;

const fmtPrice = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const fmt = (n) => fmtPrice.format(n || 0);

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds * 10) % 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${ms}`;
}

function buildShootSheet(show) {
  const cues = [...show.cues].sort((a, b) => a.time - b.time);
  const total = store.showCost(show);
  const dateStr = new Date().toLocaleDateString("fr-FR");

  const rows = cues.map((cue, i) => {
    const eff = store.findEffect(cue.effectId);
    if (!eff) return "";
    const color = partTypeColor(eff.partType);
    return `
      <tr>
        <td class="num">${i + 1}</td>
        <td class="num"><strong>${fmtTime(cue.time)}</strong></td>
        <td><span class="badge" style="color:${color};border-color:${color}">${escapeHtml(partTypeLabel(eff.partType))}</span></td>
        <td>${escapeHtml(eff.name)}</td>
        <td>${eff.subtype ? escapeHtml(subtypeLabel(eff.subtype)) : "—"}</td>
        <td class="num">${eff.caliber || "—"}${eff.caliber ? "mm" : ""}</td>
        <td class="num">${eff.duration}s</td>
        <td class="num">${cue.quantity}</td>
        <td class="num">${escapeHtml(eff.vendor || "—")}</td>
      </tr>`;
  }).join("");

  return `
    <div class="page">
      <h1>Bon de tir</h1>
      <p style="margin: 0; color: #666;">${escapeHtml(show.name)}</p>
      <div class="meta">
        <div class="meta-item"><span class="meta-label">Date</span><span class="meta-value">${dateStr}</span></div>
        <div class="meta-item"><span class="meta-label">Durée</span><span class="meta-value">${show.duration}s</span></div>
        <div class="meta-item"><span class="meta-label">Cues</span><span class="meta-value">${cues.length}</span></div>
        <div class="meta-item"><span class="meta-label">Coût HT</span><span class="meta-value">${fmt(total)}</span></div>
      </div>
      <h2>Séquence chronologique</h2>
      <table>
        <thead><tr>
          <th class="num">#</th><th class="num">Temps</th><th>Type</th>
          <th>Effet</th><th>Style</th><th class="num">Calibre</th>
          <th class="num">Durée</th><th class="num">Qté</th><th>Fournisseur</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">
        <span>PrevoFX — ${escapeHtml(show.name)}</span>
        <span>Imprimé le ${new Date().toLocaleString("fr-FR")}</span>
      </div>
    </div>`;
}

function buildOrderSheet(show) {
  const rows = store.aggregateOrder(show);
  const total = rows.reduce((s, r) => s + r.quantity * r.effect.price, 0);
  const totalQty = rows.reduce((s, r) => s + r.quantity, 0);
  const html = rows.map((r) => {
    const e = r.effect;
    const color = partTypeColor(e.partType);
    return `
      <tr>
        <td>${escapeHtml(e.id)}</td>
        <td>${escapeHtml(e.name)}</td>
        <td><span class="badge" style="color:${color};border-color:${color}">${escapeHtml(partTypeLabel(e.partType))}</span></td>
        <td class="num">${e.caliber ? e.caliber + "mm" : "—"}</td>
        <td>${escapeHtml(e.vendor || "—")}</td>
        <td class="num">${r.quantity}</td>
        <td class="num">${fmt(e.price)}</td>
        <td class="num">${fmt(e.price * r.quantity)}</td>
      </tr>`;
  }).join("");
  return `
    <div class="page">
      <h1>Bon de commande</h1>
      <p style="margin: 0; color: #666;">${escapeHtml(show.name)}</p>
      <div class="meta">
        <div class="meta-item"><span class="meta-label">Date</span><span class="meta-value">${new Date().toLocaleDateString("fr-FR")}</span></div>
        <div class="meta-item"><span class="meta-label">Lignes</span><span class="meta-value">${rows.length}</span></div>
        <div class="meta-item"><span class="meta-label">Quantité</span><span class="meta-value">${totalQty}</span></div>
        <div class="meta-item"><span class="meta-label">Total HT</span><span class="meta-value">${fmt(total)}</span></div>
      </div>
      <table>
        <thead><tr>
          <th>Réf</th><th>Effet</th><th>Type</th><th class="num">Calibre</th>
          <th>Fournisseur</th><th class="num">Qté</th><th class="num">PU HT</th><th class="num">Total HT</th>
        </tr></thead>
        <tbody>${html}
          <tr class="subtotal">
            <td colspan="5"></td>
            <td class="num">${totalQty}</td>
            <td class="num">TOTAL</td>
            <td class="num">${fmt(total)}</td>
          </tr>
        </tbody>
      </table>
      <div class="footer">
        <span>PrevoFX — Bon de commande pour ${escapeHtml(show.name)}</span>
        <span>Imprimé le ${new Date().toLocaleString("fr-FR")}</span>
      </div>
    </div>`;
}

function openWindow(title, html) {
  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) {
    toast("Impossible d'ouvrir la fenêtre d'impression (popups bloqués ?)", "error");
    return null;
  }
  win.document.open();
  win.document.write(`<!doctype html><html lang="fr"><head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <style>${CSS}</style>
  </head><body>
    <div class="toolbar">
      <button onclick="window.print()">Imprimer</button>
      <button onclick="window.close()">Fermer</button>
    </div>
    ${html}
  </body></html>`);
  win.document.close();
  return win;
}

export function printShootSheet(showId) {
  const sh = store.getShow(showId);
  if (!sh) { toast("Spectacle introuvable.", "error"); return; }
  if (openWindow(`Bon de tir — ${sh.name}`, buildShootSheet(sh))) {
    toast("Bon de tir ouvert. Imprimer = PDF système.", "success");
  }
}

export function printOrderSheet(showId) {
  const sh = store.getShow(showId);
  if (!sh) { toast("Spectacle introuvable.", "error"); return; }
  if (openWindow(`Bon de commande — ${sh.name}`, buildOrderSheet(sh))) {
    toast("Bon de commande ouvert. Imprimer = PDF système.", "success");
  }
}
