// Patches injectés dans l'iframe Finale 3D pour la transformer en Prevot FX :
//   - Thème sombre/clair + accent orange (via CSS variables et filtres)
//   - Rebranding texte : "Finale 3D" / "Finale" → "Prevot FX" / "Prevot"
//   - Masquage des fonctions inutiles (Help, Cloud, Shop, Auth, Network,
//     systèmes de tir hors Cobra)
//
// Note : les sélecteurs ci-dessous sont génériques (substring match sur
// classes / attributs / textes). Ils peuvent rater des éléments si Finale
// utilise des noms compilés Vite (ex : "ShopPanel_xz4f7"). Dans ce cas,
// on étend la liste après inspection DOM.

const REBRAND_MAP = [
  // Ordre important : plus spécifique d'abord
  ["Finale 3D", "Prevot FX"],
  ["FINALE 3D", "PREVOT FX"],
  ["finale3d", "prevotfx"],
  ["Finale3D", "PrevotFX"],
  ["Finale", "Prevot"],
  ["FINALE", "PREVOT"],
  ["finale", "prevot"],
];

// Mots-clés des fonctions à masquer. On cache tout élément dont une
// classe / un id / un aria-label / un texte propre matche.
const HIDE_KEYWORDS = [
  "help", "tutorial", "tutoriel", "guide", "learn",
  "shop", "store", "buy", "purchase", "boutique", "achat", "stock",
  "cloud", "share", "shared", "online", "sync", "upload",
  "login", "signin", "signup", "register", "account", "profile", "auth",
  "network", "networking", "reseau", "réseau",
];

// Mots-clés des systèmes de tir à GARDER (whitelist). Tout le reste matchant
// "firing", "fire-system", "ignit", etc. sera caché.
const FIRING_KEEP = ["cobra"];
const FIRING_HIDE_KEYWORDS = ["fireone", "pyrodigital", "mongoose", "explo", "showpro", "infinity"];

// ----- CSS -----

export function buildPatchCss() {
  return `
/* ============ Prevot FX — surcouche thème ============ */

/* Variables d'accent partagées */
:root {
  --prevofx-accent: #ff7a18;
  --prevofx-accent-hover: #ff8f3c;
}

/* THEME SOMBRE */
html[data-prevofx-theme="dark"] {
  color-scheme: dark;
  --prevofx-bg: #1a1a1a;
  --prevofx-bg-elev: #242424;
  --prevofx-text: #f0f0f0;
  --prevofx-border: #333;
}
html[data-prevofx-theme="dark"] body {
  background: var(--prevofx-bg) !important;
  color: var(--prevofx-text) !important;
}

/* THEME CLAIR */
html[data-prevofx-theme="light"] {
  color-scheme: light;
  --prevofx-bg: #f7f7f8;
  --prevofx-bg-elev: #ffffff;
  --prevofx-text: #1a1a1a;
  --prevofx-border: #d8d8dc;
}
html[data-prevofx-theme="light"] body {
  background: var(--prevofx-bg) !important;
  color: var(--prevofx-text) !important;
}

/* Force les éléments bleus (couleur d'accent par défaut Finale) à utiliser
   l'orange. Pattern conservateur : seulement sur boutons / liens / focus. */
html[data-prevofx-theme] button:hover,
html[data-prevofx-theme] a:hover,
html[data-prevofx-theme] [role="button"]:hover {
  color: var(--prevofx-accent) !important;
}
html[data-prevofx-theme] button.primary,
html[data-prevofx-theme] button[class*="primary"],
html[data-prevofx-theme] button[class*="Primary"] {
  background: var(--prevofx-accent) !important;
  border-color: var(--prevofx-accent) !important;
  color: #1a1a1a !important;
}

/* Masque les éléments à fonction inutile */
.prevofx-hidden,
[data-prevofx-hidden="1"] {
  display: none !important;
}
`;
}

// ----- DOM patches -----

function replaceInTextNode(node) {
  let v = node.nodeValue;
  let changed = false;
  for (const [from, to] of REBRAND_MAP) {
    if (v.includes(from)) {
      v = v.split(from).join(to);
      changed = true;
    }
  }
  if (changed) node.nodeValue = v;
}

function walkAndRebrand(root) {
  const w = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let n;
  while ((n = w.nextNode())) {
    replaceInTextNode(n);
  }
  // attributs : title, aria-label, alt, placeholder
  const all = root.querySelectorAll ? root.querySelectorAll("[title],[aria-label],[alt],[placeholder]") : [];
  for (const el of all) {
    for (const attr of ["title", "aria-label", "alt", "placeholder"]) {
      const v = el.getAttribute && el.getAttribute(attr);
      if (!v) continue;
      let nv = v;
      for (const [from, to] of REBRAND_MAP) {
        if (nv.includes(from)) nv = nv.split(from).join(to);
      }
      if (nv !== v) el.setAttribute(attr, nv);
    }
  }
}

function matchesHide(el) {
  // 1. Whitelist tir Cobra
  const haystack = [
    el.id || "",
    el.className && typeof el.className === "string" ? el.className : (el.className && el.className.baseVal) || "",
    el.getAttribute ? (el.getAttribute("aria-label") || "") : "",
    el.getAttribute ? (el.getAttribute("data-testid") || "") : "",
  ].join(" ").toLowerCase();

  if (FIRING_KEEP.some((k) => haystack.includes(k))) return false;

  // 2. Hide keywords
  if (HIDE_KEYWORDS.some((k) => haystack.includes(k))) return true;
  if (FIRING_HIDE_KEYWORDS.some((k) => haystack.includes(k))) return true;

  // 3. Texte propre (sans descendre) — pour éléments comme <button>Help</button>
  if (el.children && el.children.length === 0 && el.textContent) {
    const t = el.textContent.trim().toLowerCase();
    if (t.length > 0 && t.length < 40) {
      const matchHide = HIDE_KEYWORDS.some((k) => t === k || t.startsWith(k + " ") || t.endsWith(" " + k));
      if (matchHide) return true;
    }
  }

  return false;
}

function walkAndHide(root) {
  if (!root.querySelectorAll) return;
  const candidates = root.querySelectorAll("button, a, [role='button'], [role='menuitem'], li, .menu-item, [class*='menu'], [class*='Menu'], [class*='nav'], [class*='Nav']");
  for (const el of candidates) {
    if (el.hasAttribute("data-prevofx-hidden")) continue;
    if (matchesHide(el)) {
      el.setAttribute("data-prevofx-hidden", "1");
    }
  }
}

let _observer = null;

export function applyPatches(doc) {
  // Pass initial
  walkAndRebrand(doc.body);
  walkAndHide(doc.body);

  // MutationObserver pour repatcher au fur et à mesure que le React app
  // monte ses composants
  if (_observer) _observer.disconnect();
  _observer = new doc.defaultView.MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "childList") {
        for (const n of m.addedNodes) {
          if (n.nodeType === 1) {
            walkAndRebrand(n);
            walkAndHide(n);
          } else if (n.nodeType === 3) {
            replaceInTextNode(n);
          }
        }
      } else if (m.type === "characterData" && m.target.nodeType === 3) {
        replaceInTextNode(m.target);
      }
    }
  });
  _observer.observe(doc.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}
