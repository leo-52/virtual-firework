// ── SON DES FEUX dans le simulateur de site 3D (B391) ───────────────────────────────────────
// Le même module son que PrevoFX web (src/audio.js : enregistrements de l'user, calibrés par
// calibre et distance, retard de propagation, panoramique, réverbération de plein air), injecté
// par outils/faire_moteur_simu.py avec les 7 mp3 EMBARQUÉS (la page est un fichier unique,
// ouvert en file:// ou sur /3d/). Les deux marqueurs ci-dessous sont remplis par le générateur.
// Crochets : on enveloppe window._feuMaj (la boucle du feu) et on observe les obus de _feu.obus :
// un obus nouveau = DÉPART ; un obus qui passe en phase « burst » = ÉCLATEMENT (c'est ce que fait
// la couche de PrevoFX web avec onLaunch/onBurst). Les mini-marrons du multi passent par le
// crochet du moteur (PFX.__setMarronPop) quand il est exporté.
// Bouton 🔊 dans la barre de tir ; ON par défaut (mémorisé) ; ?son=0 dans l'adresse = pas de son.
(function () {
"use strict";
if (typeof PFX === "undefined" || typeof window._feuMaj !== "function" || /[?&]son=0\b/.test(location.search)) return;
const SONS_B64 = /*@@SONS@@*/{};
const b64 = s => { const bin = atob(s), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a.buffer; };
const SONS_AB = {}; for (const k of Object.keys(SONS_B64)) { try { SONS_AB[k] = b64(SONS_B64[k]); } catch (e) {} }

/*@@AUDIO@@*/

const audio = new PyroAudio();
window._son = audio;
const _V3 = new THREE.Vector3();
function monde(x, y, z) { PFX.scene.updateMatrixWorld(true); return PFX.scene.localToWorld(_V3.set(x, y, z)); }
function ou(x, y, z) {
  const w = monde(x, y, z);
  return { dist: camera.position.distanceTo(w), pan: panDepuisCamera(camera, w.x, w.y, w.z) };
}
// traduction archétype -> son (mêmes règles que PrevoFX web, plus les effets « fa_* » des feux automatiques)
function sonDepart(s) {
  const a = String(s.arch || ""), { dist, pan } = ou(s.ox, 0, s.oz);
  if (/fa_titaneEclair/.test(a)) return;                                       // 2e charge de la bombe titane, même tube : un seul départ
  if (/^candle10/.test(a)) audio.candle(dist, pan);
  else audio.launch(s.cal, dist, pan);
}
function sonEclat(s) {
  const a = String(s.arch || ""), cal = s.cal, { dist, pan } = ou(s.bx, s.cfg.apex, s.bz);
  if (/^candle10egg/.test(a)) audio.candleEgg(dist, pan);
  else if (/^candle10$|^candle30k?$|tourbBomb/.test(a)) {}                     // s'éteint sans bruit
  else if (/candle30qc/.test(a)) audio.candleTip(dist, pan);
  else if (/dragonEgg|fa_oeuf|candle10egg/.test(a)) audio.dragonEgg(cal, dist, pan);
  else if (/crackling|brocartCrep/.test(a)) audio.crackling(cal, dist, pan);
  else if (/^salute$|fa_titaneEclair/.test(a)) audio.marron(0.03, dist, cal, 1, pan);
  else if (/^saluteMulti/.test(a)) audio.breakOpen(40, dist, pan);
  else if (/spinner|tourb/.test(a)) audio.hibou(0, dist, pan);
  else if (/sifflant/.test(a)) audio.whistle(0, dist, pan);
  else if (/^d8\b/.test(a)) { audio.breakOpen(cal, dist, pan); audio.crackle(cal, dist, 4.1, 1, pan); audio.crackle(cal, dist, 4.75, 0.7, pan); }
  else if (/fa_titane\b|fa_titane\|/.test(a)) {}                                // l'éclair titane (2e charge synchronisée) porte le marron
  else audio.breakOpen(cal, dist, pan);
}
const vus = new WeakSet(), phases = new WeakMap();
const _majOrig = window._feuMaj;
window._feuMaj = function (dt) {
  try { for (const s of _feu.obus) phases.set(s, s.phase); } catch (e) {}
  const r = _majOrig.apply(this, arguments);
  try {
    for (const s of _feu.obus) {
      if (!vus.has(s)) { vus.add(s); phases.set(s, s.phase); sonDepart(s); }
      const avant = phases.get(s);
      if (avant !== "burst" && s.phase === "burst") { phases.set(s, "burst"); sonEclat(s); }
    }
  } catch (e) { console.warn("[son]", e); }
  return r;
};
try { if (PFX.__setMarronPop) PFX.__setMarronPop((x, y, z) => { const { dist, pan } = ou(x, y, z); audio.marron(0, dist, 40, 0.7, pan); }); } catch (e) {}

// bouton dans la barre de tir
const barre = document.getElementById("feuBarre");
if (barre) {
  const b = document.createElement("button"); b.id = "feuSon"; b.type = "button";
  b.style.cssText = "background:transparent;color:var(--text);border:1px solid var(--line,#3a332c);padding:0 10px;font-weight:500";
  const LIB = { off: "🔇", attente: "🔊", chargement: "🔊…", pret: "🔊", secours: "🔊" };
  const TITRE = { off: "Son coupé — cliquer pour l'activer", attente: "Son : touche l'écran pour l'activer", chargement: "Son : chargement…", pret: "Son activé — cliquer pour couper", secours: "Son activé (secours) — cliquer pour couper" };
  const maj = () => { const st = audio.status(); b.textContent = LIB[st] || "🔊"; b.title = TITRE[st] || "Son"; b.style.opacity = st === "off" ? "0.55" : "1"; };
  audio.onStatus = maj; maj();
  b.addEventListener("click", () => { audio.unlock(); audio.setEnabled(!audio.enabled); maj(); });
  barre.appendChild(b);
}
})();
