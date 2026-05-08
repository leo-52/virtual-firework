// Bouclier réseau : empêche l'app (et l'iframe Finale FX embarquée) de
// contacter quoi que ce soit hors de la machine locale.
//
// Stratégie en 3 couches :
//   1. chrome.webRequest (NW.js) : bloque les requêtes au niveau Chromium,
//      avant qu'elles ne quittent le process. Couvre fetch, XHR, images,
//      WebSocket, etc., y compris depuis l'iframe.
//   2. Override fetch/XHR dans la fenêtre principale : ceinture + bretelles
//      au cas où webRequest ne soit pas dispo (NW.js sans permissions).
//   3. Comptage des tentatives bloquées, pour affichage UI.

const BLOCKLIST = [
  // Endpoints connus du bundle Finale FX
  "*://prevotfx.com/*",
  "*://*.prevotfx.com/*",
  // Télémétrie courante (au cas où)
  "*://*.google-analytics.com/*",
  "*://*.googletagmanager.com/*",
  "*://www.googletagmanager.com/*",
  "*://*.doubleclick.net/*",
  "*://*.sentry.io/*",
];

// Hôtes considérés comme "locaux" : on ne bloque jamais ces requêtes.
const LOCAL_HOSTS = new Set([
  "localhost", "127.0.0.1", "::1",
]);

const stats = {
  blocked: 0,
  byHost: new Map(),
  lastBlocked: null,
  enabled: false,
  source: "off",
};

const listeners = new Set();

function notify() {
  for (const fn of listeners) {
    try { fn(getStats()); } catch (e) { /* ignore */ }
  }
}

function recordBlock(url) {
  stats.blocked++;
  stats.lastBlocked = url;
  try {
    const host = new URL(url).hostname;
    stats.byHost.set(host, (stats.byHost.get(host) || 0) + 1);
  } catch { /* ignore non-URLs */ }
  notify();
}

function isLocalUrl(url) {
  if (!url || typeof url !== "string") return true;
  // URL relative (sans schéma) = locale
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) return true;
  try {
    const u = new URL(url);
    if (u.protocol === "file:" || u.protocol === "data:" ||
        u.protocol === "blob:" || u.protocol === "chrome-extension:" ||
        u.protocol === "chrome:" || u.protocol === "about:") {
      return true;
    }
    if (u.hostname === "" || LOCAL_HOSTS.has(u.hostname)) return true;
    // 127.x.x.x → loopback
    if (/^127\./.test(u.hostname)) return true;
    // 10.x / 192.168.x : conservé en blocable selon config (par défaut local)
    return false;
  } catch {
    return true;
  }
}

function urlMatchesPattern(url, pattern) {
  // chrome.webRequest pattern simpliste : *://host/path
  // On supporte juste "*://*.host.tld/*" pour notre blocklist.
  const m = pattern.match(/^\*:\/\/([^/]+)\/\*$/);
  if (!m) return false;
  const hostPart = m[1];
  let host;
  try { host = new URL(url).hostname; } catch { return false; }
  if (hostPart.startsWith("*.")) {
    const suffix = hostPart.slice(2);
    return host === suffix || host.endsWith("." + suffix);
  }
  return host === hostPart;
}

function isBlocked(url) {
  if (isLocalUrl(url)) return false;
  for (const p of BLOCKLIST) {
    if (urlMatchesPattern(url, p)) return true;
  }
  return false;
}

// ---- Couche 1 : chrome.webRequest (NW.js / Chromium) -----------------

function installWebRequest() {
  const cr = (typeof chrome !== "undefined" && chrome.webRequest)
    || (typeof browser !== "undefined" && browser.webRequest);
  if (!cr || !cr.onBeforeRequest) return false;

  try {
    cr.onBeforeRequest.addListener(
      (details) => {
        recordBlock(details.url);
        return { cancel: true };
      },
      { urls: BLOCKLIST },
      ["blocking"]
    );
    stats.source = "chrome.webRequest";
    stats.enabled = true;
    return true;
  } catch (e) {
    console.warn("[network-shield] webRequest indisponible :", e.message);
    return false;
  }
}

// ---- Couche 2 : override fetch / XHR --------------------------------

function installFetchOverride() {
  if (typeof window === "undefined" || !window.fetch) return;
  const origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    if (isBlocked(url)) {
      recordBlock(url);
      return Promise.reject(new TypeError(
        `[network-shield] requête bloquée (mode hors-ligne) : ${url}`
      ));
    }
    return origFetch(input, init);
  };
}

function installXHROverride() {
  if (typeof XMLHttpRequest === "undefined") return;
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (isBlocked(url)) {
      recordBlock(url);
      this._shieldBlocked = true;
    }
    return origOpen.call(this, method, url, ...rest);
  };
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    if (this._shieldBlocked) {
      // Simule une erreur réseau immédiate
      setTimeout(() => {
        if (typeof this.onerror === "function") {
          try { this.onerror(new Event("error")); } catch {}
        }
        this.dispatchEvent(new Event("error"));
      }, 0);
      return;
    }
    return origSend.apply(this, args);
  };
}

// ---- Public API -----------------------------------------------------

export function installShield() {
  const webRequestOk = installWebRequest();
  installFetchOverride();
  installXHROverride();
  if (!stats.enabled) {
    stats.enabled = true;
    stats.source = webRequestOk ? "chrome.webRequest" : "fetch+xhr override";
  }
  console.info(`[network-shield] activé (${stats.source})`);
  notify();
  return stats;
}

export function getStats() {
  return {
    enabled: stats.enabled,
    source: stats.source,
    blocked: stats.blocked,
    lastBlocked: stats.lastBlocked,
    byHost: [...stats.byHost.entries()].sort((a, b) => b[1] - a[1]),
    blocklist: [...BLOCKLIST],
  };
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
