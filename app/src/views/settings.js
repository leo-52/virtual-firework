import { el, toast, confirm } from "../ui/kit.js";
import * as store from "../store.js";

export function renderSettings(root, navigate) {
  const s = store.getSettings();

  root.appendChild(el("header", { class: "page-header" },
    el("div", {},
      el("h1", { class: "page-title" }, "Paramètres"),
      el("p", { class: "page-subtitle" }, "Préférences de l'application — toutes locales."))));

  // Visualisation
  root.appendChild(section("Visualisation", [
    row("Moteur par défaut",
      "Mode utilisé à l'ouverture du visualiseur.",
      selectField(s.defaultViewer, [
        ["fx", "Moteur FX (3D)"],
        ["sim", "Simulateur 2D"],
      ], (v) => store.setSetting("defaultViewer", v))),

    row("Bloom",
      "Effet de halo lumineux sur les feux d'artifice.",
      checkbox(s.bloom !== false, (v) => store.setSetting("bloom", v))),

    row("Intensité du bloom",
      "0 = aucun halo, 2 = halo très intense.",
      rangeField(s.bloomIntensity ?? 0.9, 0, 2, 0.05,
        (v) => store.setSetting("bloomIntensity", v))),

    row("Bip à chaque cue",
      "Bip de feedback quand un cue se déclenche.",
      checkbox(!!s.beepOnCue, (v) => store.setSetting("beepOnCue", v))),

    row("Pas de quantification (s)",
      "Snap des cues sur la timeline. 0 = libre, 0.1s par défaut.",
      el("input", {
        type: "number", min: 0, max: 5, step: 0.05,
        value: s.snapStep ?? 0.1,
        onChange: (e) => store.setSetting("snapStep", +e.target.value || 0),
      })),

    row("Durée par défaut (s)",
      "Durée d'un nouveau spectacle.",
      el("input", {
        type: "number", min: 10, max: 1800,
        value: s.defaultDuration || 180,
        onChange: (e) => store.setSetting("defaultDuration", +e.target.value || 180),
      })),
  ]));

  // Données
  root.appendChild(section("Données", [
    row("Réinitialiser",
      "⚠ Supprime tous les spectacles, favoris et effets personnalisés.",
      el("button", {
        class: "btn btn-danger",
        onClick: async () => {
          const ok = await confirm(
            "Tout supprimer ? Cette action est irréversible.",
            { title: "Réinitialiser", okLabel: "Tout supprimer", danger: true }
          );
          if (!ok) return;
          store.reset();
          toast("Tout a été réinitialisé.", "warning");
          navigate("home");
        },
      }, "Réinitialiser tout")),
  ]));

  // À propos
  root.appendChild(section("À propos", [
    row("Version",
      "PrevoFX 2.0 — réécriture propre, hors-ligne stricte, ~3 Mo de code.",
      el("span", { class: "badge" }, "v2.0.0")),
    row("Mode hors-ligne",
      "Aucune donnée ne quitte votre machine. Aucune connexion réseau.",
      el("span", { class: "badge", style: "color: var(--success); border-color: var(--success);" },
        "✓ ACTIF")),
  ]));
}

function section(title, rows) {
  return el("section", { class: "section" },
    el("h2", { class: "section-title" }, title),
    el("div", {
      style: "background: var(--bg-elev); border: 1px solid var(--border); border-radius: 6px;",
    }, ...rows));
}

function row(label, desc, control) {
  return el("div", {
    style: "display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--border-soft);",
  },
    el("div", {},
      el("div", { style: "font-size: 13px; font-weight: 500;" }, label),
      el("div", { style: "font-size: 11px; color: var(--text-soft); margin-top: 2px;" }, desc)),
    control);
}

function selectField(value, options, onChange) {
  const s = el("select", {
    onChange: (e) => onChange(e.target.value),
  }, ...options.map(([v, l]) => el("option", { value: v }, l)));
  s.value = value;
  return s;
}

function checkbox(value, onChange) {
  const c = el("input", {
    type: "checkbox",
    onChange: (e) => onChange(e.target.checked),
  });
  c.checked = value;
  return c;
}

function rangeField(value, min, max, step, onChange) {
  const r = el("input", {
    type: "range", min, max, step,
    value: String(value),
    onInput: (e) => onChange(+e.target.value),
  });
  return r;
}
