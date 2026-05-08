// Patches pour faire tourner l'app Prevot FX d'origine sans cloud.
//
// L'app est chargée dans une iframe. Au moment où l'iframe émet 'load',
// on injecte ces patches dans son contexte. On peut aussi pré-builder
// un HTML patché (buildPatchedHtml) et le servir via blob URL pour que
// les patches s'appliquent AVANT le bundle.

const PATCH_SCRIPT = `
(function() {
  var BLOCKED = [
    /prevotfx\\.com/i, /finale-blobcas/i, /apollodata\\.com/i,
    /fb\\.me/i, /google-analytics/i, /doubleclick/i, /sentry\\.io/i,
  ];
  function isExt(url) {
    if (!url || typeof url !== 'string') return false;
    if (!/^https?:/i.test(url)) return false;
    for (var i = 0; i < BLOCKED.length; i++) {
      if (BLOCKED[i].test(url)) return true;
    }
    return false;
  }

  // ---- Réseau : intercept fetch ----
  if (window.fetch) {
    var origFetch = window.fetch.bind(window);
    window.fetch = function(input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      if (isExt(url)) {
        console.info('[shield] blocked fetch:', url);
        return Promise.resolve(new Response(
          JSON.stringify({ data: null, errors: null }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ));
      }
      return origFetch(input, init);
    };
  }

  // ---- Réseau : intercept XHR ----
  if (window.XMLHttpRequest) {
    var origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      if (isExt(url)) {
        console.info('[shield] blocked xhr:', url);
        this.__blocked = true;
      }
      return origOpen.apply(this, arguments);
    };
    var origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function() {
      if (this.__blocked) {
        var self = this;
        setTimeout(function() {
          try {
            Object.defineProperty(self, 'status', { value: 200, configurable: true });
            Object.defineProperty(self, 'responseText', { value: '{"data":null,"errors":null}', configurable: true });
            Object.defineProperty(self, 'readyState', { value: 4, configurable: true });
          } catch (e) {}
          if (self.onreadystatechange) try { self.onreadystatechange(); } catch (e) {}
          if (self.onload) try { self.onload(); } catch (e) {}
        }, 0);
        return;
      }
      return origSend.apply(this, arguments);
    };
  }

  // ---- Auth : faire croire qu'un user est connecté ----
  try {
    if (!localStorage.getItem('auth_token')) {
      localStorage.setItem('auth_token', 'local-bypass-' + Date.now());
    }
    if (!localStorage.getItem('user')) {
      localStorage.setItem('user', JSON.stringify({
        id: 'local-user',
        email: 'local@prevofx.local',
        name: 'Utilisateur local',
        verified: true,
        emailVerified: true,
      }));
    }
  } catch (e) {}

  // ---- Force FR ----
  try {
    Object.defineProperty(navigator, 'language', { value: 'fr-FR', configurable: true });
    Object.defineProperty(navigator, 'languages', { value: ['fr-FR', 'fr'], configurable: true });
    localStorage.setItem('language', 'fr');
    localStorage.setItem('locale', 'fr');
    localStorage.setItem('i18n.locale', 'fr');
  } catch (e) {}

  // ---- Stubs APIs externes (pour ne pas crasher si bloqué) ----
  if (!window.google) {
    window.google = {
      maps: {
        Map: function() { return { addListener: function() {} }; },
        LatLng: function(lat, lng) { return { lat: lat, lng: lng }; },
        event: { addListener: function() {}, addListenerOnce: function() {} },
        Geocoder: function() { return { geocode: function() {} }; },
      },
    };
  }

  console.info('[Prevot FX patches] activés (hors-ligne strict)');
})();
`;

// Construit un HTML patché à partir du index.html original. Le patch
// est inséré juste après <head> donc s'exécute AVANT le bundle.
// Les chemins absolus "/index-XXX.js" sont rewrites en relatifs.
export async function buildPatchedHtml(originalHtmlPath) {
  const text = await fetch(originalHtmlPath).then((r) => r.text());
  const baseDir = originalHtmlPath.replace(/[^/]+$/, "");
  const patched = text
    .replace(/<head[^>]*>/i, (m) => m + "\n<script>" + PATCH_SCRIPT + "</script>")
    .replace(/(src|href)="\/([^"]+)"/g, `$1="${baseDir}$2"`);
  return patched;
}

// Injection au load de l'iframe (filet de sécurité si buildPatchedHtml
// ne peut pas s'exécuter — par exemple en file://).
export function injectPatchesAtLoad(iframe) {
  if (!iframe || !iframe.contentWindow) return false;
  try {
    const w = iframe.contentWindow;
    const doc = w.document;
    const s = doc.createElement("script");
    s.textContent = PATCH_SCRIPT;
    if (doc.head && doc.head.firstChild) {
      doc.head.insertBefore(s, doc.head.firstChild);
    } else if (doc.head) {
      doc.head.appendChild(s);
    } else {
      doc.documentElement.appendChild(s);
    }
    return true;
  } catch (e) {
    console.error("[patches] injection failed", e);
    return false;
  }
}
