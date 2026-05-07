import { el, pageHeader, toast, confirmDialog, downloadFile } from "../lib/dom.js";
import { state, saveState, resetState } from "../lib/state.js";
import { getStats as getShieldStats, onChange as onShieldChange } from "../lib/network-shield.js";

export function renderSettings(main, navigate) {
  main.append(pageHeader("Paramètres", "Préférences de l'application."));

  // ---- Apparence ----
  const apparenceGroup = el(
    "div",
    { class: "settings-group" },
    settingsRow(
      "Langue",
      "Langue de l'interface (FR par défaut).",
      buildSelect(
        [
          { value: "fr", label: "Français" },
          { value: "en", label: "English (à venir)" },
        ],
        state.settings.language,
        (v) => {
          state.settings.language = v;
          saveState();
          toast("Langue mise à jour.");
        }
      )
    ),
    settingsRow(
      "Thème",
      "Apparence de l'interface.",
      buildSelect(
        [
          { value: "dark", label: "Sombre" },
          { value: "light", label: "Clair (à venir)" },
        ],
        state.settings.theme,
        (v) => {
          state.settings.theme = v;
          saveState();
          toast("Thème mis à jour.");
        }
      )
    ),
    settingsRow(
      "Durée par défaut d'un spectacle",
      "Durée appliquée à tout nouveau spectacle (en secondes).",
      el("input", {
        type: "number",
        min: "10",
        max: "1800",
        value: state.settings.defaultDuration,
        onChange: (e) => {
          state.settings.defaultDuration = +e.target.value || 180;
          saveState();
        },
      })
    )
  );
  main.append(
    el("div", { class: "section-header" },
      el("h2", { class: "section-title" }, "Apparence")),
    apparenceGroup
  );

  // ---- Données ----
  const dataGroup = el(
    "div",
    { class: "settings-group" },
    settingsRow(
      "Exporter les données",
      "Télécharger un fichier JSON contenant tous vos spectacles et préférences.",
      el(
        "button",
        {
          class: "btn",
          onClick: () => {
            const date = new Date().toISOString().slice(0, 10);
            downloadFile(
              `prevofx_export_${date}.json`,
              JSON.stringify(state, null, 2),
              "application/json"
            );
            toast("Export téléchargé.");
          },
        },
        "Exporter"
      )
    ),
    settingsRow(
      "Importer un fichier",
      "Restaurer un export PrevoFX.json.",
      (() => {
        const input = el("input", {
          type: "file",
          accept: "application/json",
          style: "display: none;",
          onChange: async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
              const text = await file.text();
              const obj = JSON.parse(text);
              if (!obj || !Array.isArray(obj.shows)) throw new Error("Format invalide");
              const ok = await confirmDialog(
                `Remplacer ${state.shows.length} spectacle(s) par ${obj.shows.length} importé(s) ?`
              );
              if (!ok) return;
              Object.assign(state, obj);
              saveState();
              toast("Import réussi.");
              navigate("home");
            } catch (err) {
              toast("Échec de l'import : " + err.message);
            }
          },
        });
        return el(
          "span",
          {},
          input,
          el("button", { class: "btn", onClick: () => input.click() }, "Choisir un fichier…")
        );
      })()
    ),
    settingsRow(
      "Effacer les données locales",
      "Supprime vos spectacles et préférences enregistrés (action irréversible).",
      el(
        "button",
        {
          class: "btn btn-danger",
          onClick: async () => {
            const ok = await confirmDialog(
              "Effacer toutes les données locales ? Cette action est irréversible."
            );
            if (!ok) return;
            resetState();
            toast("Données effacées.");
            navigate("home");
          },
        },
        "Effacer"
      )
    )
  );
  main.append(
    el("div", { class: "section-header" },
      el("h2", { class: "section-title" }, "Données")),
    dataGroup
  );

  // ---- Confidentialité / Réseau ----
  main.append(
    el("div", { class: "section-header" },
      el("h2", { class: "section-title" }, "Confidentialité"))
  );
  main.append(buildShieldPanel());

  // ---- À propos ----
  main.append(
    el("div", { class: "section-header" },
      el("h2", { class: "section-title" }, "À propos"))
  );
  main.append(
    el(
      "div",
      { class: "settings-group" },
      settingsRow("Version", "PrevoFX v0.1.0",
        el("span", { class: "page-subtitle" }, "Prototype")),
      settingsRow("Moteur 3D embarqué", "Bundle Finale 3D fourni avec l'application.",
        el("span", { class: "page-subtitle" }, "app.nw/htmlui/")),
      settingsRow("Crédits",
        "Application bureau NW.js — UI vanilla, simulateur 2D Canvas.",
        el("span", { class: "page-subtitle" }, ""))
    )
  );
}

function settingsRow(label, hint, control) {
  return el(
    "div",
    { class: "settings-row" },
    el(
      "div",
      {},
      el("div", { class: "settings-label" }, label),
      hint ? el("div", { class: "settings-hint" }, hint) : null
    ),
    control
  );
}

function buildShieldPanel() {
  const group = el("div", { class: "settings-group" });

  const status = el("div", { class: "shield-status" });
  const dot = el("span", { class: "shield-dot shield-active" });
  const text = el("strong", {}, "Mode hors-ligne actif");
  const sub = el("div", { class: "settings-hint" }, "");
  status.append(
    el("div", { style: "display: flex; align-items: center; gap: 10px;" }, dot, text),
    sub
  );

  const counter = el("div", { class: "stat-tile-value" }, "0");
  const counterLabel = el("div", { class: "stat-tile-label" }, "Requêtes bloquées");
  const counterBox = el("div", { class: "stat-tile" }, counter, counterLabel);

  const hostsList = el("ul", { class: "shield-hosts" });

  const refresh = (s) => {
    sub.textContent = `Source : ${s.source}. Toutes les requêtes vers les serveurs externes sont rejetées avant de quitter votre machine.`;
    counter.textContent = String(s.blocked);
    hostsList.innerHTML = "";
    if (!s.byHost.length) {
      hostsList.appendChild(el("li", { class: "page-subtitle" },
        "Aucune tentative bloquée pour le moment."));
    } else {
      for (const [host, n] of s.byHost.slice(0, 12)) {
        hostsList.appendChild(
          el("li", {},
            el("span", { class: "shield-host" }, host),
            el("span", { class: "qty-badge" }, String(n)))
        );
      }
    }
  };
  refresh(getShieldStats());
  onShieldChange(refresh);

  group.append(
    el("div", { class: "settings-row", style: "flex-direction: column; align-items: stretch; gap: 12px;" },
      status,
      el("div", { class: "shield-grid" },
        counterBox,
        el("div", { class: "stat-tile" },
          el("div", { class: "stat-tile-value" }, `${getShieldStats().blocklist.length}`),
          el("div", { class: "stat-tile-label" }, "Domaines bloqués")
        )
      ),
      el("div", {},
        el("div", { class: "form-label" }, "Tentatives bloquées par hôte"),
        hostsList
      ),
      el("div", {},
        el("div", { class: "form-label" }, "Liste de blocage"),
        el("div", { class: "shield-blocklist" },
          ...getShieldStats().blocklist.map((p) =>
            el("code", { class: "shield-pattern" }, p)
          )
        )
      )
    )
  );

  return group;
}

function buildSelect(options, value, onChange) {
  const select = el("select", {
    onChange: (e) => onChange(e.target.value),
  });
  for (const o of options) {
    const opt = el("option", { value: o.value }, o.label);
    if (o.value === value) opt.selected = true;
    select.appendChild(opt);
  }
  return select;
}
