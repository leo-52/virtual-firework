import { downloadLog, getLogPath } from "../lib/debug-log.js";

function showToast(msg, ms = 4000) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

export function renderTopbar({ onToggleTheme }) {
  const root = document.getElementById("topbar");
  if (!root) return;
  root.innerHTML = "";

  const title = document.createElement("div");
  title.className = "title";
  title.textContent = "Prevot FX";
  root.appendChild(title);

  const spacer = document.createElement("div");
  spacer.className = "spacer";
  root.appendChild(spacer);

  const themeBtn = document.createElement("button");
  themeBtn.type = "button";
  themeBtn.textContent = "Thème";
  themeBtn.title = "Basculer clair / sombre";
  themeBtn.addEventListener("click", () => onToggleTheme && onToggleTheme());
  root.appendChild(themeBtn);

  const logBtn = document.createElement("button");
  logBtn.type = "button";
  logBtn.textContent = "📋 Log";
  logBtn.title = "Exporter le journal de debug";
  logBtn.addEventListener("click", async () => {
    await downloadLog();
    const path = getLogPath();
    if (path) showToast("Log exporté. Fichier sur disque : " + path);
    else showToast("Log exporté (mode mémoire — pas de fichier disque).");
  });
  root.appendChild(logBtn);
}
