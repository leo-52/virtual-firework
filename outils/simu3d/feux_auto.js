// ── FEUX AUTOMATIQUES : DÉSIGNATION -> EFFET PREVOFX (simulateur de site 3D) ───────────────
// Chaque tir d'un feu automatique (FEUX_AUTO) est traduit d'après sa désignation en un effet du
// moteur PrevoFX, réglé à l'échelle des bombettes (20 à 30 mm, sphère de ~15 à 25 m) :
//  - bombe titane à étoiles : éclair blanc qui crépite au cœur + étoiles de couleur saturée ;
//  - saules / brocarts : ouverture sans boule de lumière, brins qui retombent en arc ;
//  - « saule or puis <couleur>, clignotant <couleur> » / « brocart puis <couleur> » : phase or,
//    bascule nette vers la couleur, puis clignotement ;
//  - feuilles tombantes : paillettes qui scintillent et descendent lentement en zigzag ;
//  - chrysanthème : sphère pleine à queues radiales ; mosaïque : rupture simultanée en petites
//    gerbes régulières ; œufs de dragon : gerbe porteuse puis crépitements décalés ;
//  - comètes « tête <couleur>, queue or » et sifflants : comète traçante (recette PrevoFX des
//    chandelles 30 mm : tête colorée, traîne dorée pailletée, extinction au sommet) ;
//  - « ascension <couleur> » : la montée a la couleur ; « ascension or / brocart / argent /
//    crépitante » : vraie traîne de comète à la montée.
// Les effets ajoutés sont des copies des effets PrevoFX (même rendu) complétées de comportements
// propres aux bombettes. Le moteur n'est pas modifié : PrevoFX ne change pas.
// Retour à l'ancienne traduction : ?feux=ancien dans l'adresse, ou window.FEUX_AUTO_ANCIEN = true.
(function () {
"use strict";
if (typeof PFX === "undefined" || typeof effetFeu !== "function" || typeof tirerUnCoup !== "function") return;
const ANCIEN = () => window.FEUX_AUTO_ANCIEN === true || /[?&]feux=ancien\b/.test(location.search);
const _effetAncien = effetFeu, _tirerAncien = tirerUnCoup;
const E = PFX.EFFECTS, C = PFX.C;
const K = (c, k) => new THREE.Color(c.r * k, c.g * k, c.b * k);
const NOIR = new THREE.Color(0, 0, 0), MECHE = new THREE.Color(0.55, 0.40, 0.20);
const tr = (t, o) => Object.assign({}, t, o);
// base commune des bombettes : ouverture discrète (pas de boule de flash), montée discrète
const BOMBETTE = { heat: false, riseLean: 1.2, noFlash: true, burstSparks: false, riseTrail: false, headSize: 0.8, riseColor: MECHE };

// ── comportements propres aux bombettes (crochets behave / onStar du moteur) ──
// Bascule or -> couleur -> clignotement (saule or puis X clignotant Y, brocart puis X)
function behaveBascule(d, A, dt, ctx) {
  const f = ctx.cfg._fa;
  if (d._t1 === undefined) {
    d._t1 = f.t1 * (0.85 + Math.random() * 0.3); d._t2 = f.cli ? d._t1 + f.t2 * (0.8 + Math.random() * 0.4) : 1e9;
    d.coreColor = C.GOLD;
  }
  const cs = ctx.cfg.colors || [ctx.cfg.color];
  if (!d._on && d.age >= d._t1) { d._on = true; d.coreColor = cs[0]; }
  if (d._on && d.age >= d._t2) {
    d._cl = true; const ph = (d.age * f.hz * (0.85 + d.phase * 0.3) + d.phase) % 1;
    d._hi = ph < 0.45; d._meme = !cs[1] || cs[1] === cs[0]; d.coreColor = d._hi ? (cs[1] || cs[0]) : cs[0];
  }
}
function onBascule(d) {
  if (!d._on) return { intenMul: 0.30 };                       // phase or : on voit surtout les brins
  if (d._cl) return { intenMul: d._hi ? 2.1 : (d._meme ? 0.0 : 0.35) };
  return { intenMul: 1.7 };
}
// Plusieurs couleurs dans la même bombette (chrysanthème pêche/citron/vert d'eau) : réparties étoile par étoile
function behaveMulti(d, A, dt, ctx) {
  if (d._mc === undefined) { const cs = ctx.cfg.colors; if (cs && cs.length > 1) d.coreColor = cs[(d._i || 0) % cs.length]; d._mc = 1; }
}
// Feuilles : paillettes qui scintillent doucement, avec de brefs reflets
function onFeuille(d) {
  const s = 0.5 + 0.5 * Math.sin(d.age * (4 + d.strobeF * 1.6) + d.phase2);
  return { intenMul: (0.25 + 1.45 * s * s) * (Math.random() < 0.05 ? 1.9 : 1) };
}
// Éclair de titane : grains blancs qui crépitent (allumés / éteints au hasard)
function onTitane() { return Math.random() < 0.5 ? { intenMul: 0.1 } : { intenMul: 2.6, whiteMix: 0.7 }; }
// Mosaïque : toutes les comètes d'une même bombette se rompent ENSEMBLE en petites gerbes régulières
function behaveMosaique(d, A, dt, ctx) {
  if (d._split) return;
  const f = ctx.cfg._fa;
  if (ctx._rupt === undefined) ctx._rupt = f.rupt * (0.92 + Math.random() * 0.16);
  if (d.age < ctx._rupt) return;
  d._split = true;
  const px = ctx.pos[d._i * 3], py = ctx.pos[d._i * 3 + 1], pz = ctx.pos[d._i * 3 + 2];
  const n = ctx.cfg.coreSplit, off = Math.random() * 6.283;
  for (let c = 0; c < n && ctx.nAlive < ctx.nMax; c++) {          // directions régulières (spirale de Fibonacci)
    const y = 1 - 2 * (c + 0.5) / n, r = Math.sqrt(1 - y * y), th = c * 2.39996 + off;
    ctx.addStar(px, py, pz, Math.cos(th) * r * f.sp + d.vx * 0.2, y * f.sp + d.vy * 0.2, Math.sin(th) * r * f.sp + d.vz * 0.2,
                f.vie * (0.9 + Math.random() * 0.2), d.comp, true, d.coreColor);
  }
  d.age = d.life;
}

// ── effets « bombette » écrits au calibre (aucune réduction d'échelle par-dessus) ──
const FA = {
  fa_titane: Object.assign({}, E.bombRouge, BOMBETTE, { cal: 30, apex: 39, color: new THREE.Color(0.12, 1.25, 0.22),
    stars: 72, starSize: 1.35, speedMul: 0.80, speedJit: 0.08, lifeBase75: 3.0, lifeJitter: 0.15, risingTail: "silver", _apexBurst: true }),
  fa_titaneEclair: Object.assign({}, BOMBETTE, { cal: 30, apex: 39, color: K(C.WHITE, 1.4), stars: 90, starSize: 0.6,
    speedMul: 0.42, speedJit: 0.5, dragStar: 1.1, gravStar: 0.3, lifeBase75: 1.3, lifeJitter: 0.5, onStar: onTitane,
    flashBig: true, noFlash: false, headSize: 0.01, riseColor: NOIR, _apexBurst: true }),
  fa_sifflant: Object.assign({}, E.candle30, { cal: 20, apex: 25, headSize: 1.8, riseLean: 1.0,
    riseSparks: { n: 7, size: 0.5, life: 0.7, jit: 0.5, color: C.WARMSILVER } }),
  fa_comete: Object.assign({}, E.candle30, { cal: 20, apex: 25, headSize: 3.4, riseLean: 1.0,
    riseSparks: { n: 9, size: 0.7, life: 1.6, jit: 0.45, color: C.COPPER } }),
  fa_feuilles: Object.assign({}, E.fallingLeaves, BOMBETTE, { cal: 25, apex: 32, stars: 30, starSize: 1.5, speedMul: 0.85,
    lifeBase75: 11.5, lifeJitter: 0.15, gravStar: 0.30, gravJit: 0.3, dragStar: 0.8, sway: 3.2, wind: 1.0, onStar: onFeuille }),
  fa_chrys: Object.assign({}, E.chrysanthemum, BOMBETTE, { cal: 25, apex: 32, stars: 72, starSize: 1.15, speedMul: 0.62, speedJit: 0.06,
    lifeBase75: 4.6, lifeJitter: 0.12, gravStar: 0.6, dragStar: 0.55, _apexBurst: true, behave: behaveMulti,
    trailing: { emitUntil: 0.92, period: 0.006, grain: 0.8, gF: 0.13, lifeMul: 1.7, spark: true, jit: 0.25, bright: 0.85 } }),
  fa_mosaique: Object.assign({}, E.mosaic, BOMBETTE, { cal: 20, apex: 25, stars: 7, nMax: 7 + 7 * 7, coreSplit: 7, burstRadius: 6.5,
    starSize: 2.2, splitStarSize: 1.5, speedMul: 1.0, lifeBase75: 3.2, lifeJitter: 0.05, behave: behaveMosaique,
    _fa: { rupt: 0.85, sp: 5.5, vie: 1.25 }, _apexBurst: true,
    trailing: tr(E.mosaic.trailing, { grain: 0.85, lifeMul: 1.4 }) }),
  fa_oeuf: Object.assign({}, E.dragonEgg, BOMBETTE, { cal: 20, apex: 25, stars: 52, starSize: 0.75, speedMul: 0.62, speedJit: 0.55,
    lifeBase75: 4.4, lifeJitter: 0.10, core: null, crackleStars: { delay: 0.45, jitter: 0.95, snaps: 4 }, _apexBurst: true,
    trailing: tr(E.dragonEgg.trailing, { grain: 0.9, lifeMul: 2.6 }) }),
};
// ── recettes PrevoFX ramenées au calibre de la bombette, retombée en saule ──
const SAULE = { noFlash: true, burstSparks: false, lifeBase75: 5.5, gravStar: 0.45, dragStar: 0.32, speedMul: 0.85, _apexBurst: true };
const BASCULE = { pureColor: true, behave: behaveBascule, onStar: onBascule, gravStar: 0.45, dragStar: 0.30, speedMul: 0.85, _apexBurst: true, noFlash: true, burstSparks: false };
const FR = {
  fa_saule: Object.assign({}, E.willow, SAULE, { risingTail: "gold" }),
  fa_brocart: Object.assign({}, E.willow, SAULE, { risingTail: "gold" }),
  fa_brocartCrep: Object.assign({}, E.willow, SAULE, { risingTail: "gold",
    core: { stars: 18, radiusMul: 0.55, color: C.GOLD, eggSplode: true, crackleAt: 0.45, jitter: 0.6 } }),
  fa_brocartPuis: Object.assign({}, E.willowTips, BASCULE, { stars: 48, lifeBase75: 5.5, _fa: { t1: 0.85, cli: false },
    trailing: tr(E.willowTips.trailing, { fixedColor: false, bright: 0.9, lifeMul: 12 }) }),
  fa_sauleCli: Object.assign({}, E.willowStrobe, BASCULE, { stars: 48, lifeBase75: 5.4, _fa: { t1: 0.9, cli: true, t2: 0.45, hz: 9 },
    trailing: tr(E.willowStrobe.trailing, { fixedColor: false, bright: 0.95 }) }),
};
for (const [k, v] of Object.entries(FA)) { v._natif = true; E[k] = v; }
for (const [k, v] of Object.entries(FR)) E[k] = v;

// ── couleurs lues dans la désignation ──
const MOTS = [["vert d'eau", "cyan"], ["rouge", "rouge"], ["sang", "rouge"], ["vert", "vert"], ["bleu", "bleu"], ["blanc", "blanc"],
              ["argent", "argent"], ["citron", "citron"], ["rose", "rose"], ["violet", "violet"], ["orange", "orange"], ["pêche", "peche"],
              ["peche", "peche"], ["or", "or"]];
function couleursDe(txt) {
  const r = []; let t = " " + (txt || "").toLowerCase() + " ";
  for (;;) {   // dans l'ordre d'apparition
    let best = null;
    for (const [m, k] of MOTS) {
      const x = new RegExp("[^a-zà-ÿ]" + m + "(e|es|s|te|tes|he|hes)?[^a-zà-ÿ]").exec(t);
      if (x && (!best || x.index < best.i)) best = { i: x.index, k, n: x[0].length };
    }
    if (!best) return r;
    r.push(best.k); t = t.slice(0, best.i) + " " + t.slice(best.i + best.n - 1);
  }
}
// couleurs vives (un peu plus saturées que la palette commune, lisibles en petit calibre)
const VIF = { vert: new THREE.Color(0.12, 1.25, 0.22), rouge: new THREE.Color(1.30, 0.08, 0.10), bleu: new THREE.Color(0.30, 0.45, 1.35) };
const coul = k => VIF[k] || _COUL_FEU[k];

// ── traduction ──
function effetNouveau(s) {
  const d = (s.des || "").toLowerCase();
  const [corps, asc] = d.split(/ ascension /);
  const ascC = couleursDe(asc || "")[0];
  const o = {};
  if (asc) {   // ascension : traîne de comète (or / brocart / argent / crépitante) ou tête colorée
    if (/saule|brocart|crépit|crepit|^or\b|argent/.test(asc)) o.risingTail = /argent/.test(asc) ? "silver" : "gold";
    else if (ascC) { o.riseColor = K(coul(ascC), 1.6); o.headSize = 1.6; }
  }
  let arch; const c = couleursDe(corps);
  if (/^sifflant/.test(d)) { arch = "fa_sifflant"; o.pair = [K(C.WARMSILVER, 1.3)]; }
  else if (/^bombe titane|titane avec/.test(corps)) { arch = "fa_titane"; if (c.length) o.color = coul(c[0]); o.eclair = true; }
  else if (/^t[eê]te /.test(d)) { arch = "fa_comete"; const t = couleursDe(corps.split(",")[0])[0]; o.pair = [K(coul(t || "or"), 1.7)]; }
  else if (/feuilles? tomb|feuille morte/.test(corps)) { arch = "fa_feuilles"; if (c.length) o.color = K(coul(c[0]), 1.2); }
  else if (/^chrysanth/.test(corps)) { arch = "fa_chrys"; if (c.length) o.pair = c.map(coul); }
  else if (/mosa/.test(corps)) { arch = "fa_mosaique"; if (c.length) o.color = K(coul(c[0]), c[0] === "or" ? 1.0 : 1.15); }
  else if (/oeuf|œuf/.test(corps)) arch = "fa_oeuf";
  else if (/clignotant|scintill/.test(corps)) {
    arch = "fa_sauleCli";
    const puis = /puis ([^,]+)/.exec(corps), cli = /clignotant ([^,]+)/.exec(corps), et = /étoiles? ([^,]+)|, ([^,]+)$/.exec(corps);
    const a = puis ? couleursDe(puis[1])[0] : null, b = cli ? couleursDe(cli[1])[0] : null, e = et ? couleursDe(et[1] || et[2])[0] : null;
    o.pair = [a || e || b || "or", b || e || a || "or"].map(coul);
  }
  else if (/^brocart puis|^saule or puis/.test(corps)) { arch = "fa_brocartPuis"; const p = couleursDe(corps.split("puis")[1])[0]; o.pair = [coul(p || "or")]; }
  else if (/crépit|crepit/.test(corps) && /brocart|saule/.test(corps)) arch = "fa_brocartCrep";
  else if (/^saule/.test(corps)) arch = "fa_saule";
  else if (/^brocart|kamuro/.test(corps)) arch = "fa_brocart";
  else return null;   // désignation inconnue : ancienne traduction
  return { arch, o };
}

// Bombettes : l'élan de montée n'est presque pas transmis aux étoiles (la gerbe s'ouvre en boule
// et retombe, au lieu de filer en pinceau vers le haut) ; on garde 20 % de l'élan.
function sansElan(sh, garde) {
  const B = sh._bal; if (!B) return;
  const brut = sh.burst;
  sh.burst = function () {
    const n0 = this.nAlive; brut.apply(this, arguments);
    const vA = Math.sqrt(9.8 / B.k) * Math.tan(Math.max(0, B.phi - B.a * B.tb)) * (1 - garde);
    const ix = vA * this.muTX, iy = vA, iz = vA * this.muTZ;
    for (let i = n0; i < this.nAlive; i++) { const d = this.data[i]; if (d) { d.vx -= ix; d.vy -= iy; d.vz -= iz; } }
  };
}
function copieMontee(dst, src) {   // deux charges de la même bombette : même trajectoire, même instant
  for (const k of ["bx", "bz", "_bal", "riseTime", "_bowX", "_bowZ", "muTX", "muTZ", "_spin"]) dst[k] = src[k];
  dst.hasMuzzle = false;
}

// B391 : les désignations que la traduction « feu automatique » ne connaît pas passent par le
// CATALOGUE complet (PFX_CATALOGUE = src/render/catalogue.js, injecté par le générateur) : tout
// produit Prévot a un effet fidèle. ?catalogue=0 = sans.
const CATALOGUE_OK = () => typeof PFX_CATALOGUE !== "undefined" && typeof PFX.defDepuisCatalogue === "function" && !/[?&]catalogue=0\b/.test(location.search);
function effetCatalogue(s) {
  if (!CATALOGUE_OK()) return null;
  try {
    const r = PFX_CATALOGUE.effetPour(s.des || s.eff || "", s.cal, { hauteur_m: s.h > 0 ? s.h : null });
    if (!r || !r.arch) return null;
    const def = PFX.defDepuisCatalogue(r); if (!def) return null;
    return { arch: def.arch, def, res: r };
  } catch (e) { console.warn("[feux_auto] catalogue", e); return null; }
}
effetFeu = function (s) {
  if (ANCIEN()) return _effetAncien(s);
  const n = effetNouveau(s);
  if (n) return { arch: n.arch, nouveau: n };
  const c = effetCatalogue(s);
  return c ? { arch: c.arch, catalogue: c } : _effetAncien(s);
};
tirerUnCoup = function (s) {
  if (ANCIEN()) return _tirerAncien(s);
  const ef = effetFeu(s);
  if (ef.catalogue) {   // B391 : tir traduit par le catalogue complet (bombe seule ou 1er coup d'une séquence)
    const def = ef.catalogue.def, cfg = E[def.arch] || {};
    const h = s.h > 0 ? s.h : hauteurCalibre(s.cal), apexMul = (def.shot && def.shot.apexMul) || (cfg.apex ? h / cfg.apex : 1);
    const apexS = (cfg.apex || 95) * PFX.APEX_SCALE * apexMul;
    const arch = def.mix ? def.mix[(Math.random() * def.mix.length) | 0] : def.arch;
    const opts = Object.assign({}, def.shot || {}, { apexMul, lean: [-Math.tan(s.a * Math.PI / 180) * apexS, 0] });
    const ox = (_BAT_FEU[s.bat] ?? 0) + (s.tube - 6) * 0.035, oz = (s.rang - 4) * 0.035;
    _feu.obus.push(new PFX.Shell(arch, ox, oz, s.cal, opts));
    if (def.mine && E[def.mine]) _feu.obus.push(new PFX.Shell(def.mine, ox, oz, s.cal, def.mineColored && def.shot && def.shot.pair ? { pair: def.shot.pair } : {}));
    return;
  }
  if (!ef.nouveau) return _tirerAncien(s);
  const arch = ef.arch, cfg = E[arch], o = ef.nouveau.o;
  const h = s.h > 0 ? s.h : hauteurCalibre(s.cal);
  const apexMul = h / (cfg.apex || 95);                     // hauteur du catalogue (×0,89 comme toutes les hauteurs du moteur)
  const apexS = (cfg.apex || 95) * PFX.APEX_SCALE * apexMul;
  const opts = { apexMul, lean: [-Math.tan(s.a * Math.PI / 180) * apexS, 0] };
  if (!cfg._natif) opts.envMul = PFX.calScale(s.cal) / PFX.calScale(cfg.cal || 75);
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
  const sh = new PFX.Shell(a, ox, oz, s.cal, opts);
  if (cfg._apexBurst) sansElan(sh, 0.2);
  _feu.obus.push(sh);
  if (o.eclair) {   // bombe titane : l'éclair blanc crépitant part avec les étoiles
    const ec = new PFX.Shell("fa_titaneEclair", ox, oz, s.cal, { apexMul: h / E.fa_titaneEclair.apex });
    copieMontee(ec, sh);
    _feu.obus.push(ec);
  }
};
window._feuxAuto = { effetNouveau, couleursDe };
})();
