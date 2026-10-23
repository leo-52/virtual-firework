// ── FEUX AUTOMATIQUES : DÉSIGNATION -> EFFET PREVOFX (simulateur de site 3D) ───────────────
// Chaque tir d'un feu automatique (FEUX_AUTO) est traduit d'après sa désignation en un effet du
// moteur PrevoFX, à l'échelle des bombettes (20 à 30 mm) :
//  - les effets que le moteur réussit déjà en petit calibre (saules, brocarts, saules clignotants)
//    gardent la recette PrevoFX ramenée au calibre, comme avant ;
//  - les autres ont ici leur propre réglage « bombette » (bombe titane à étoiles, mosaïque,
//    chrysanthème, feuilles tombantes, comètes, sifflants, œufs de dragon), écrit directement au
//    calibre (aucune réduction d'échelle par-dessus) : nombre d'étoiles, taille, durée, envergure ;
//  - « ascension <couleur> » : la montée a la couleur ; « ascension or / brocart / argent /
//    crépitante » : vraie traîne de comète à la montée.
// Les effets ajoutés sont des copies des effets PrevoFX (même rendu, mêmes mouvements) : le moteur
// n'est pas modifié et PrevoFX ne change pas.
// Retour à l'ancienne traduction : ?feux=ancien dans l'adresse, ou window.FEUX_AUTO_ANCIEN = true.
(function () {
"use strict";
if (typeof PFX === "undefined" || typeof effetFeu !== "function" || typeof tirerUnCoup !== "function") return;
const ANCIEN = () => window.FEUX_AUTO_ANCIEN === true || /[?&]feux=ancien\b/.test(location.search);
const _effetAncien = effetFeu, _tirerAncien = tirerUnCoup;
const E = PFX.EFFECTS, C = PFX.C;
const K = (c, k) => new THREE.Color(c.r * k, c.g * k, c.b * k);
const MECHE = new THREE.Color(0.55, 0.40, 0.20);
// base commune des bombettes : ouverture discrète (pas de boule de flash), montée discrète
const BOMBETTE = { heat: false, riseLean: 1.2, noFlash: true, burstSparks: false, riseTrail: false, headSize: 0.8, riseColor: MECHE };
const tr = (t, o) => Object.assign({}, t, o);

// ── effets « bombette » (au calibre, natifs) ──
const FA = {
  // BOMBE TITANE À ÉTOILES (30 mm) : éclair blanc du titane + étoiles de couleur qui se figent
  fa_titane: Object.assign({}, E.bombRouge, BOMBETTE, { cal: 30, apex: 39, color: C.GRN, flashBig: true, noFlash: false,
    stars: 52, starSize: 1.3, speedMul: 0.80, lifeBase75: 2.7, lifeJitter: 0.15, risingTail: "silver" }),
  // SIFFLANT (20 mm) : un trait argenté qui monte en vacillant et s'éteint au sommet
  fa_sifflant: Object.assign({}, E.comet, BOMBETTE, { cal: 20, apex: 25, color: K(C.WARMSILVER, 1.25), starSize: 1.5, headSize: 1.3,
    riseColor: K(C.WARMSILVER, 1.3), risingTail: "silver", lifeBase75: 1.6, speedMul: 0.55, gravStar: 0.9,
    trailing: tr(E.comet.trailing, { color: C.WARMSILVER, grain: 0.75, lifeMul: 1.1, period: 0.010 }) }),
  // FEUILLES TOMBANTES (25 mm) : étoiles qui descendent lentement en se balançant (~3,5 s)
  fa_feuilles: Object.assign({}, E.fallingLeaves, BOMBETTE, { cal: 25, apex: 32, stars: 42, starSize: 1.5, speedMul: 0.55,
    burstRadius: 13.5, lifeBase75: 8.0, gravStar: 0.70, sway: 1.1 }),
  // CHRYSANTHÈME (25 mm) : petite pivoine à petites étoiles (définition PrevoFX), plusieurs couleurs
  fa_chrys: Object.assign({}, E.chrysanthemum, BOMBETTE, { cal: 25, apex: 32, stars: 56, starSize: 1.15, speedMul: 0.80, speedJit: 0.06,
    lifeBase75: 3.3, lifeJitter: 0.14, gravStar: 0.6, dragStar: 0.55 }),
  // MOSAÏQUE (20 mm) : 6-7 comètes qui se redivisent chacune en petit bouquet
  fa_mosaique: Object.assign({}, E.mosaic, BOMBETTE, { cal: 20, apex: 25, stars: 7, nMax: 50, coreSplit: 6, burstRadius: 6.5,
    starSize: 2.4, splitStarSize: 1.7, speedMul: 1.05, lifeBase75: 5.6, lifeJitter: 0.08,
    trailing: tr(E.mosaic.trailing, { grain: 0.85, lifeMul: 1.5 }) }),
  // COMÈTE « tête <couleur>, queue or » (20 mm) : la tête colorée monte avec sa queue or, puis file un instant
  fa_comete: Object.assign({}, E.comet, BOMBETTE, { cal: 20, apex: 25, headSize: 3.0, risingTail: "gold", starSize: 2.6,
    lifeBase75: 2.2, speedMul: 0.45, gravStar: 0.9,
    trailing: tr(E.comet.trailing, { grain: 1.1, lifeMul: 2.2 }) }),
  // ŒUFS DE DRAGON (20-30 mm) : éclat discret puis chaque étoile crépite (délai ramené à l'échelle de la bombette)
  fa_oeuf: Object.assign({}, E.dragonEgg, BOMBETTE, { cal: 20, apex: 25, stars: 46, starSize: 0.75, speedMul: 0.62,
    lifeBase75: 3.6, lifeJitter: 0.12, core: null, crackleStars: { delay: 0.55, jitter: 0.45, snaps: 4 },
    trailing: tr(E.dragonEgg.trailing, { grain: 0.8, lifeMul: 1.6 }) }),
};
// ── recettes PrevoFX ramenées au calibre (comme avant), avec la traîne de montée ──
const FR = {
  fa_saule: Object.assign({}, E.willow, { risingTail: "gold" }),                         // saule or titane, ascension saule
  fa_brocart: Object.assign({}, E.willow, { risingTail: "gold" }),                       // brocart, ascension brocart
  fa_brocartCrep: Object.assign({}, E.willow, { risingTail: "gold",                      // brocart avec crépitants
    core: { stars: 18, radiusMul: 0.55, color: C.GOLD, eggSplode: true, crackleAt: 0.45, jitter: 0.5 } }),
  fa_brocartPuis: Object.assign({}, E.willowTips),                                       // brocart puis <couleur>
  fa_sauleCli: Object.assign({}, E.willowStrobe, { lifeBase75: 3.6, trailing: tr(E.willowStrobe.trailing, { bright: 1.0 }) }),                   // saule or (puis couleur), clignotant
};
for (const [k, v] of Object.entries(FA)) { v._natif = true; E[k] = v; }
// bombettes : pas de boule de flash à l'ouverture (elle n'est pas réduite au calibre et faisait une tache ronde)
for (const [k, v] of Object.entries(FR)) { v.noFlash = true; v.burstSparks = false; E[k] = v; }

// ── couleurs lues dans la désignation ──
const MOTS = [["vert d'eau", "cyan"], ["rouge", "rouge"], ["sang", "rouge"], ["vert", "vert"], ["bleu", "bleu"], ["blanc", "blanc"],
              ["argent", "argent"], ["citron", "citron"], ["rose", "rose"], ["violet", "violet"], ["orange", "orange"], ["pêche", "peche"],
              ["peche", "peche"], ["or", "or"]];
function couleursDe(txt) {
  const r = []; let t = " " + (txt || "").toLowerCase() + " ";
  for (;;) {   // dans l'ordre d'apparition
    let best = null;
    for (const [m, k] of MOTS) {
      const re = new RegExp("[^a-zà-ÿ]" + m.replace(/'/g, "'") + "(e|es|s|te|tes|he|hes)?[^a-zà-ÿ]");
      const x = re.exec(t); if (x && (!best || x.index < best.i)) best = { i: x.index, k, n: x[0].length };
    }
    if (!best) return r;
    r.push(best.k); t = t.slice(0, best.i) + " " + t.slice(best.i + best.n - 1);
  }
}
const coul = k => _COUL_FEU[k];

// ── traduction ──
function effetNouveau(s) {
  const d = (s.des || "").toLowerCase();
  const [corps, asc] = d.split(/ ascension /);
  const ascC = couleursDe(asc || "")[0];
  const ascTraine = asc && /saule|brocart|crépit|crepit|^or\b|argent/.test(asc);
  const o = {};
  // ascension : traîne de comète (or/brocart/argent/crépitante) ou tête colorée
  if (asc) {
    if (ascTraine) o.risingTail = /argent/.test(asc) ? "silver" : "gold";
    else if (ascC && ascC !== "or") { o.riseColor = K(coul(ascC), 1.6); o.headSize = 1.6; }
  }
  let arch, c = couleursDe(corps);
  if (/^sifflant/.test(d)) arch = "fa_sifflant";
  else if (/^bombe titane|titane avec/.test(corps)) { arch = "fa_titane"; if (c.length) o.color = coul(c[0]); }
  else if (/^t[eê]te /.test(d)) { arch = "fa_comete"; const t = couleursDe(corps.split(",")[0])[0]; if (t) { o.color = K(coul(t), 1.2); o.riseColor = K(coul(t), 1.7); } }
  else if (/feuilles? tomb|feuille morte/.test(corps)) { arch = "fa_feuilles"; if (c.length) o.color = K(coul(c[0]), 1.15); }
  else if (/^chrysanth/.test(corps)) { arch = "fa_chrys"; if (c.length) o.pair = c.map(coul); }
  else if (/mosa/.test(corps)) { arch = "fa_mosaique"; if (c.length) o.color = K(coul(c[0]), c[0] === "or" ? 1.0 : 1.15); }
  else if (/oeuf|œuf/.test(corps)) { arch = "fa_oeuf"; }
  else if (/clignotant|scintill/.test(corps)) {
    arch = "fa_sauleCli";
    const puis = /puis ([^,]+)/.exec(corps), cli = /clignotant ([^,]+)/.exec(corps), et = /étoiles? ([^,]+)|, ([^,]+)$/.exec(corps);
    const a = puis ? couleursDe(puis[1])[0] : null, b = cli ? couleursDe(cli[1])[0] : null, e = et ? couleursDe(et[1] || et[2])[0] : null;
    const p = [a || e || b || "or", b || e || a || "or"].map(coul);
    o.pair = p;
  }
  else if (/^brocart puis|^saule or puis/.test(corps)) { arch = "fa_brocartPuis"; const p = couleursDe(corps.split("puis")[1])[0]; if (p) o.pair = [coul(p)]; }
  else if (/crépit|crepit/.test(corps) && /brocart|saule/.test(corps)) arch = "fa_brocartCrep";
  else if (/^saule/.test(corps)) arch = "fa_saule";
  else if (/^brocart|kamuro/.test(corps)) arch = "fa_brocart";
  else return null;   // désignation inconnue : ancienne traduction
  return { arch, o };
}

effetFeu = function (s) {
  if (ANCIEN()) return _effetAncien(s);
  const n = effetNouveau(s);
  return n ? { arch: n.arch, nouveau: n } : _effetAncien(s);
};
tirerUnCoup = function (s) {
  if (ANCIEN()) return _tirerAncien(s);
  const ef = effetFeu(s);
  if (!ef.nouveau) return _tirerAncien(s);
  const arch = ef.arch, cfg = E[arch], o = ef.nouveau.o;
  const calRef = cfg._natif ? s.cal : (cfg.cal || 75);
  const h = s.h > 0 ? s.h : hauteurCalibre(s.cal);
  const apexMul = h / (cfg.apex || 95);                     // hauteur du catalogue (×0,89 comme toutes les hauteurs du moteur)
  const apexS = (cfg.apex || 95) * PFX.APEX_SCALE * apexMul;
  const opts = { apexMul, lean: [-Math.tan(s.a * Math.PI / 180) * apexS, 0] };
  if (!cfg._natif) opts.envMul = PFX.calScale(s.cal) / PFX.calScale(calRef);
  if (o.color) opts.color = o.color;
  if (o.pair) opts.pair = o.pair;
  if (o.riseColor) opts.riseColor = o.riseColor;
  // traîne / tête de montée : réglées sur une copie de l'effet propre à ce tir
  let a = arch;
  if (o.risingTail !== undefined || o.headSize) {
    const key = arch + "|" + (o.risingTail || "") + "|" + (o.headSize || "");
    if (!E[key]) { E[key] = Object.assign({}, cfg); if (o.risingTail) E[key].risingTail = o.risingTail; if (o.headSize) { E[key].headSize = o.headSize; E[key].risingTail = undefined; } }
    a = key;
  }
  const ox = (_BAT_FEU[s.bat] ?? 0) + (s.tube - 6) * 0.035, oz = (s.rang - 4) * 0.035;
  _feu.obus.push(new PFX.Shell(a, ox, oz, s.cal, opts));
};
window._feuxAuto = { effetNouveau, couleursDe };
})();
