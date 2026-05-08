// Debug logger : écrit chaque événement important dans app/debug.log
// (NW.js, accès fs via require), ou en mémoire en fallback navigateur.
//
// Format : JSON-lines (1 ligne = 1 événement). Facile à parser, à lire,
// à partager.
//
// Usage :
//   import { log, downloadLog, clearLog } from "./lib/debug-log.js";
//   log("nav", { route: "home" });
//   log("error", { message: e.message, stack: e.stack });
//
// Côté utilisateur : bouton "Exporter le log" dans la topbar (statut),
// ou ouvrir directement app/debug.log avec un éditeur de texte.

const LOG_FILENAME = "debug.log";
const MAX_MEMORY_LINES = 5000; // garde-fou si fs indispo

let _fs = null;
let _path = null;
let _logPath = null;
let _enabled = true;
let _memoryBuffer = [];   // fallback si pas de fs
let _initialised = false;

function init() {
  if (_initialised) return;
  _initialised = true;
  // Détection NW.js : process global est exposé via node-remote
  try {
    if (typeof require === "function" &&
        typeof process !== "undefined" &&
        process.versions && process.versions.nw) {
      _fs = require("fs");
      _path = require("path");
      // Le cwd dépend de comment l'app est lancée. On utilise __dirname si
      // dispo, sinon on se base sur location.pathname.
      let baseDir = "";
      try {
        baseDir = _path.dirname(decodeURI(
          location.pathname.replace(/^\/([a-zA-Z]:)/, "$1")
        ));
      } catch { baseDir = "."; }
      _logPath = _path.join(baseDir, LOG_FILENAME);
      // Header de session
      const sep = "\n========== Session " + new Date().toISOString() + " ==========\n";
      try { _fs.appendFileSync(_logPath, sep); } catch (e) {
        console.warn("[debug-log] cannot write to", _logPath, e.message);
        _fs = null;
      }
    }
  } catch (e) {
    console.info("[debug-log] no fs (browser mode):", e.message);
  }
}

function fmt(type, payload) {
  return JSON.stringify({
    t: Date.now(),
    iso: new Date().toISOString(),
    type,
    ...payload,
  }) + "\n";
}

export function log(type, payload = {}) {
  if (!_enabled) return;
  init();
  const line = fmt(type, payload);
  // Toujours afficher dans la console pour DevTools
  if (type === "error" || type === "warn") {
    console.warn("[" + type + "]", payload);
  } else {
    // verbose en debug seulement
    // console.debug("[" + type + "]", payload);
  }
  // Écriture fichier ou buffer mémoire
  if (_fs && _logPath) {
    try { _fs.appendFileSync(_logPath, line); } catch (e) { /* disque plein */ }
  } else {
    _memoryBuffer.push(line);
    if (_memoryBuffer.length > MAX_MEMORY_LINES) {
      _memoryBuffer.shift();
    }
  }
}

export function getLogPath() {
  init();
  return _logPath;
}

export function getInMemoryLog() {
  return _memoryBuffer.join("");
}

// Exporte le contenu actuel du log via téléchargement Blob (utile en
// browser ou si on veut copier au-delà du fichier).
export async function downloadLog() {
  init();
  let content = "";
  if (_fs && _logPath) {
    try { content = _fs.readFileSync(_logPath, "utf8"); }
    catch (e) { content = "[lecture log impossible : " + e.message + "]"; }
  } else {
    content = _memoryBuffer.join("");
  }
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "prevofx-debug-" + Date.now() + ".log";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
  return content;
}

export function clearLog() {
  init();
  if (_fs && _logPath) {
    try { _fs.writeFileSync(_logPath, ""); } catch (e) {}
  }
  _memoryBuffer = [];
}

export function setEnabled(b) { _enabled = b; }

// ---- Hooks globaux : à brancher au démarrage de l'app ----
//
// Capture les erreurs JS non gérées et les promesses rejetées.

export function installGlobalHooks() {
  init();
  if (typeof window === "undefined") return;

  window.addEventListener("error", (e) => {
    log("error", {
      message: String(e.message || ""),
      filename: e.filename,
      line: e.lineno,
      col: e.colno,
      stack: e.error && e.error.stack ? e.error.stack : null,
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    log("rejection", {
      reason: String(e.reason && (e.reason.message || e.reason) || ""),
      stack: e.reason && e.reason.stack ? e.reason.stack : null,
    });
  });

  // Console errors aussi
  const origError = console.error.bind(console);
  console.error = function (...args) {
    try {
      log("console-error", {
        args: args.map((a) => {
          if (a instanceof Error) return a.stack || a.message;
          if (typeof a === "object") {
            try { return JSON.stringify(a); } catch { return String(a); }
          }
          return String(a);
        }),
      });
    } catch {}
    origError(...args);
  };

  log("session-start", {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    nw: !!(_fs),
    logPath: _logPath,
  });
}
