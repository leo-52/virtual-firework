// ── SURFACE D'EAU (v145) ─────────────────────────────────────────────────────
// L'eau est une CARTE de cases de 50 cm posée sur le terrain ; chaque case connaît son niveau.
//  - « Niveau » : on touche le fond d'un étang, d'un lac ou d'une rivière ; l'eau remplit tout
//    ce qui est plus bas que le niveau choisi et relié au point touché (le curseur « Niveau de
//    l'eau » la fait monter ou descendre, les berges suivent le relief).
//  - « Pinceau » / « Gomme » : on peint ou on efface de l'eau en glissant (taille réglable).
//    L'eau peinte suit le sol (rivière en pente, fossé, étang déjà plat dans le relief).
//  - Les plans d'eau connus du site (IGN, OpenStreetMap) sont mis dans la carte au chargement :
//    on peut les gommer ou les agrandir. Les objets du site ne sont pas modifiés ni masqués (exports
//    FWsim et Finale identiques) ; la carte est gardée dans le fichier du site.
// Rendu : surface animée (vagues réglables, de « aucune » à « fortes »), reflet du DÉCOR par une
// vue miroir (bâtiments, arbres, berges, ciel), reflet du soleil, couleur selon la profondeur
// (bords clairs et transparents, fond sombre), et REFLETS DES FEUX dans le calque des feux.
(function () {
"use strict";
const CASE = 0.5, NT = 64, TUILE = CASE * NT;            // tuiles de 32 m, cases de 50 cm
const RAYON_MAX = 400, CASES_MAX = 2500000;               // garde-fou du remplissage
const VIDE = 0, NIVEAU = 1, PEINT = 2, SITE = 3, GOMME = 9;
const POIDS4 = [1 / 8, 3 / 8, 3 / 8, 1 / 8];
const EAU = {
  actif: true, vagues: 0.2, decor: true, anim: true,
  outil: null, pinceau: 5, niveauRel: 0.5,
  corps: new Map(), prochainId: 1, selection: null,
  tuiles: new Map(), site: null, siteImport: null, aImporter: null,
  t0: performance.now(), vu: 0,
  rt: null, reflCam: null, matRefl: null,                 // reflets des feux
  rtDecor: null, camDecor: null, imageDecor: -1           // reflet du décor
};
window._eau = EAU;
const sol = (x, z) => { try { const f = solAfficheOu(typeof _dernierSolEn === "function" ? _dernierSolEn : (() => 0)); const y = f(x, z); return isFinite(y) ? y : 0; } catch (e) { return 0; } };

// ── 1. La carte ─────────────────────────────────────────────────────────────
const cleT = (tx, tz) => tx + "," + tz;
function tuile(tx, tz, creer) {
  const k = cleT(tx, tz); let T = EAU.tuiles.get(k);
  if (!T && creer) {
    T = { tx, tz, lvl: new Float32Array(NT * NT).fill(NaN), id: new Uint16Array(NT * NT), etat: new Uint8Array(NT * NT), cou: new Float32Array(NT * NT * 2),
          sol: null, n: 0, mesh: null, ov: null, sale: true, yMoy: 0, bb: new THREE.Box3() };
    EAU.tuiles.set(k, T);
  }
  return T;
}
function hauteurs(T) {
  if (T.sol) return T.sol;
  const h = new Float32Array(NT * NT), x0 = T.tx * TUILE, z0 = T.tz * TUILE;
  for (let b = 0; b < NT; b++) for (let a = 0; a < NT; a++) h[b * NT + a] = sol(x0 + (a + 0.5) * CASE, z0 + (b + 0.5) * CASE);
  return (T.sol = h);
}
// case globale (i, j) -> [tuile, indice]
function ou(i, j, creer) {
  const tx = Math.floor(i / NT), tz = Math.floor(j / NT), T = tuile(tx, tz, creer);
  return T ? [T, (j - tz * NT) * NT + (i - tx * NT)] : null;
}
const estEau = e => e === NIVEAU || e === PEINT || e === SITE;
function poser(T, k, etat, id, lvl) {
  const avant = estEau(T.etat[k]), apres = estEau(etat);
  T.etat[k] = etat; T.id[k] = apres ? id : 0; T.lvl[k] = apres ? lvl : NaN; T.cou[2 * k] = 0; T.cou[2 * k + 1] = 0;
  T.n += (apres ? 1 : 0) - (avant ? 1 : 0); T.sale = true;
  // les voisines partagent les bords (fondu) : à refaire aussi
  const a = k % NT, b = (k / NT) | 0;
  if (a === 0 || b === 0 || a === NT - 1 || b === NT - 1)
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) { const V = EAU.tuiles.get(cleT(T.tx + dx, T.tz + dz)); if (V) V.sale = true; }
}
function nouveauCorps(type, o) {
  const c = Object.assign({ id: EAU.prochainId++, type, niveau: 0, sol0: 0, seed: null }, o || {});
  EAU.corps.set(c.id, c); return c;
}

// Remplissage au niveau du corps c depuis sa graine : tout ce qui est plus bas et relié.
function remplir(c) {
  for (const T of EAU.tuiles.values()) if (T.n) for (let k = 0; k < NT * NT; k++) if (T.id[k] === c.id && T.etat[k] === NIVEAU) poser(T, k, VIDE, 0, NaN);
  const L = c.niveau, i0 = Math.floor(c.seed.x / CASE), j0 = Math.floor(c.seed.z / CASE), R = RAYON_MAX / CASE;
  let qi = new Int32Array(1 << 16), qj = new Int32Array(1 << 16), tete = 0, fin = 0, n = 0, deborde = false;
  const pousser = (i, j) => {
    if (fin >= qi.length) {
      if (tete > 0) { qi.copyWithin(0, tete, fin); qj.copyWithin(0, tete, fin); fin -= tete; tete = 0; }
      if (fin >= qi.length) { const a = new Int32Array(qi.length * 2), b = new Int32Array(qj.length * 2); a.set(qi); b.set(qj); qi = a; qj = b; }
    }
    qi[fin] = i; qj[fin] = j; fin++;
  };
  const vus = new Set();
  const prendre = (i, j) => {
    if ((i - i0) * (i - i0) + (j - j0) * (j - j0) > R * R) { deborde = true; return false; }
    const r = ou(i, j, true), T = r[0], k = r[1], e = T.etat[k];
    if (e === GOMME) return false;
    if (estEau(e)) {   // eau peinte du même corps : on la traverse (une seule fois)
      if (T.id[k] !== c.id || e === NIVEAU) return false;
      const cle = i + "," + j; if (vus.has(cle)) return false; vus.add(cle); return true;
    }
    if (hauteurs(T)[k] >= L) return false;
    poser(T, k, NIVEAU, c.id, L); n++; return true;
  };
  if (prendre(i0, j0)) pousser(i0, j0);
  while (tete < fin && n < CASES_MAX) {
    const i = qi[tete], j = qj[tete]; tete++;
    if (prendre(i + 1, j)) pousser(i + 1, j);
    if (prendre(i - 1, j)) pousser(i - 1, j);
    if (prendre(i, j + 1)) pousser(i, j + 1);
    if (prendre(i, j - 1)) pousser(i, j - 1);
  }
  return { n, deborde: deborde || n >= CASES_MAX };
}
// Pinceau / gomme : disque de rayon r (m) autour de (x, z)
function peindre(x, z, r, ajouter, c) {
  const i0 = Math.floor((x - r) / CASE), i1 = Math.floor((x + r) / CASE), j0 = Math.floor((z - r) / CASE), j1 = Math.floor((z + r) / CASE);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const cx = (i + 0.5) * CASE - x, cz = (j + 0.5) * CASE - z;
    if (cx * cx + cz * cz > r * r) continue;
    const res = ou(i, j, ajouter); if (!res) continue;
    const T = res[0], k = res[1];
    if (ajouter) { if (!estEau(T.etat[k])) poser(T, k, PEINT, c.id, hauteurs(T)[k] + 0.10); }
    else if (T.etat[k] !== GOMME) poser(T, k, GOMME, 0, NaN);
  }
}
// Eau peinte : niveau = sol moyen sur ~4 m (plat en travers d'une rivière, qui suit la pente dans
// son axe ; les berges plus hautes que l'eau la bordent d'elles-mêmes) + 10 cm.
function lisserPeint(c, R = 8) {
  const cases = [];
  for (const T of EAU.tuiles.values()) if (T.n) { const h = hauteurs(T);
    for (let k = 0; k < NT * NT; k++) if (T.id[k] === c.id && T.etat[k] === PEINT) cases.push([T.tx * NT + (k % NT), T.tz * NT + ((k / NT) | 0), h[k], T, k]); }
  if (!cases.length) return;
  let i0 = Infinity, j0 = Infinity, i1 = -Infinity, j1 = -Infinity;
  for (const q of cases) { i0 = Math.min(i0, q[0]); i1 = Math.max(i1, q[0]); j0 = Math.min(j0, q[1]); j1 = Math.max(j1, q[1]); }
  const w = i1 - i0 + 1, hgt = j1 - j0 + 1; if (w * hgt > 9e6) return;
  const S = new Float64Array(w * hgt), M = new Float64Array(w * hgt);
  for (const q of cases) { const p = (q[1] - j0) * w + (q[0] - i0); S[p] = q[2]; M[p] = 1; }
  const flou = (A) => {   // moyenne glissante séparable (rayon R)
    const B = new Float64Array(w * hgt), C = new Float64Array(w * hgt);
    for (let j = 0; j < hgt; j++) { let acc = 0; const L = j * w;
      for (let i = -R; i < w; i++) { if (i + R < w) acc += A[L + i + R]; if (i - R - 1 >= 0) acc -= A[L + i - R - 1]; if (i >= 0) B[L + i] = acc; } }
    for (let i = 0; i < w; i++) { let acc = 0;
      for (let j = -R; j < hgt; j++) { if (j + R < hgt) acc += B[(j + R) * w + i]; if (j - R - 1 >= 0) acc -= B[(j - R - 1) * w + i]; if (j >= 0) C[j * w + i] = acc; } }
    return C;
  };
  const fS = flou(S), fM = flou(M), N = new Float64Array(w * hgt);
  for (let p = 0; p < w * hgt; p++) N[p] = fM[p] > 0 ? fS[p] / fM[p] : NaN;
  for (const q of cases) {
    const i = q[0] - i0, j = q[1] - j0, p = j * w + i, T = q[3], k = q[4];
    T.lvl[k] = N[p] + 0.10; T.sale = true;
    // courant : pente du niveau lissé (différences sur ±3 cases), nul sous 0,2 %, plein à 2 %
    const at = (ii, jj) => (ii >= 0 && jj >= 0 && ii < w && jj < hgt) ? N[jj * w + ii] : NaN;
    let gx = at(i + 3, j) - at(i - 3, j), gz = at(i, j + 3) - at(i, j - 3);
    if (!(gx === gx)) gx = 0; if (!(gz === gz)) gz = 0;
    gx /= 6 * CASE; gz /= 6 * CASE;
    const gl = Math.hypot(gx, gz), f = Math.min(1, Math.max(0, (gl - 0.002) / 0.018));
    T.cou[2 * k] = gl > 1e-6 ? -gx / gl * f : 0; T.cou[2 * k + 1] = gl > 1e-6 ? -gz / gl * f : 0;
  }
}
// Triangles -> cases (plans d'eau du site, anciennes surfaces tracées)
function dansTri(px, pz, a, b, c) {
  const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z); if (Math.abs(d) < 1e-9) return null;
  const u = ((b.z - c.z) * (px - c.x) + (c.x - b.x) * (pz - c.z)) / d, v = ((c.z - a.z) * (px - c.x) + (a.x - c.x) * (pz - c.z)) / d, w = 1 - u - v;
  return (u >= -1e-6 && v >= -1e-6 && w >= -1e-6) ? [u, v, w] : null;
}
function rasterTriangles(pos, M, etat, c) {
  const v = new THREE.Vector3(), P = [];
  for (let t = 0; t + 2 < pos.count; t += 3) {
    for (let s = 0; s < 3; s++) { v.fromBufferAttribute(pos, t + s).applyMatrix4(M); P[s] = { x: v.x, y: v.y, z: v.z }; }
    const [a, b, d] = P;
    const i0 = Math.floor(Math.min(a.x, b.x, d.x) / CASE), i1 = Math.floor(Math.max(a.x, b.x, d.x) / CASE);
    const j0 = Math.floor(Math.min(a.z, b.z, d.z) / CASE), j1 = Math.floor(Math.max(a.z, b.z, d.z) / CASE);
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > 4e6) continue;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const w = dansTri((i + 0.5) * CASE, (j + 0.5) * CASE, a, b, d); if (!w) continue;
      const r = ou(i, j, true), T = r[0], k = r[1];
      if (T.etat[k] === GOMME || estEau(T.etat[k])) continue;
      const y = etat === SITE ? w[0] * a.y + w[1] * b.y + w[2] * d.y + 0.04 : hauteurs(T)[k] + 0.10;
      poser(T, k, etat, c.id, y);
    }
  }
}

// ── 2. Maillages (un par tuile) ─────────────────────────────────────────────
function construire(T) {
  T.sale = false;
  if (T.mesh) { scene.remove(T.mesh); T.mesh.geometry.dispose(); T.mesh = null; }
  if (T.ov) { if (T.ov.parent) T.ov.parent.remove(T.ov); T.ov = null; }
  const I0 = T.tx * NT, J0 = T.tz * NT, x0 = T.tx * TUILE, z0 = T.tz * TUILE;
  // grille élargie de deux cases (les voisines comptent pour le fondu arrondi des bords)
  const E2 = 2, W = NT + 2 * E2, L = new Float32Array(W * W).fill(NaN), D = new Float32Array(W * W), F = new Uint8Array(W * W);
  let quelque = false;
  for (let b = -E2; b < NT + E2; b++) for (let a = -E2; a < NT + E2; a++) {
    let TT = T, k;
    if (a < 0 || b < 0 || a >= NT || b >= NT) { const r = ou(I0 + a, J0 + b, false); if (!r) continue; TT = r[0]; k = r[1]; }
    else k = b * NT + a;
    if (!estEau(TT.etat[k])) continue;
    const q = (b + E2) * W + (a + E2);
    L[q] = TT.lvl[k]; F[q] = TT.etat[k] === PEINT ? 0 : 1;
    D[q] = TT.etat[k] === NIVEAU ? Math.max(0, TT.lvl[k] - hauteurs(TT)[k]) : TT.etat[k] === SITE ? 3.0 : 1.6;   // plan d'eau du site : opaque (il recouvre la nappe d'origine, laissée intacte pour les exports)
    if (a >= 0 && b >= 0 && a < NT && b < NT) quelque = true;
  }
  if (!quelque && !T.n) {
    // tuile sans eau : seulement le bord fondu d'une voisine (rien à dessiner de propre ici)
    let bord = false; for (let q = 0; q < W * W && !bord; q++) if (L[q] === L[q]) bord = true;
    if (!bord) return;
  }
  // sol des cases de la grille élargie (coins secs drapés sur la berge : ligne mouillée)
  const G = new Float32Array(W * W);
  for (let b = -E2; b < NT + E2; b++) for (let a = -E2; a < NT + E2; a++) {
    const q = (b + E2) * W + (a + E2);
    if (a >= 0 && b >= 0 && a < NT && b < NT) { G[q] = hauteurs(T)[b * NT + a]; continue; }
    const r = ou(I0 + a, J0 + b, false);
    G[q] = r ? hauteurs(r[0])[r[1]] : sol(x0 + (a + 0.5) * CASE, z0 + (b + 0.5) * CASE);
  }
  const NV = NT + 1, vM = new Float32Array(NV * NV), vY = new Float32Array(NV * NV), vD = new Float32Array(NV * NV), vPlat = new Uint8Array(NV * NV), vEau = new Uint8Array(NV * NV);
  for (let b = 0; b <= NT; b++) for (let a = 0; a <= NT; a++) {
    let m = 0, y = 0, d = 0, plat = 1, l0 = NaN, gs = 0;
    for (let db = 0; db < 2; db++) for (let da = 0; da < 2; da++) {
      const q = (b + E2 - 1 + db) * W + (a + E2 - 1 + da), l = L[q]; gs += G[q];
      if (l === l) { m++; y += l; d += D[q]; if (!F[q]) plat = 0; if (l0 === l0 && Math.abs(l - l0) > 1e-3) plat = 0; l0 = l; }
    }
    // part d'eau lissée sur 4 x 4 cases (1-3-3-1) : bords arrondis, pas d'escalier de cases
    let mm = 0;
    for (let db = 0; db < 4; db++) for (let da = 0; da < 4; da++) { const l = L[(b + E2 - 2 + db) * W + (a + E2 - 2 + da)]; if (l === l) mm += POIDS4[da] * POIDS4[db]; }
    const v = b * NV + a;
    vM[v] = mm; vEau[v] = m ? 1 : 0;
    if (!m && mm > 0.3) vM[v] = 0.3;   // coin sec : jamais dans l'eau pleine
    if (m) { vY[v] = y / m; vD[v] = d / m; vPlat[v] = plat; }
    else {   // coin sec : posé sur la berge, juste au-dessus du sol (bande mouillée) ou au niveau de l'eau voisine
      let s2 = 0, ns = 0;
      for (let db = -2; db < 2; db++) for (let da = -2; da < 2; da++) { const aa = a + E2 + da, bb = b + E2 + db; if (aa < 0 || bb < 0 || aa >= W || bb >= W) continue; const l = L[bb * W + aa]; if (l === l) { s2 += l; ns++; } }
      const nl = ns ? s2 / ns : NaN;
      vY[v] = ns ? Math.max(nl, gs / 4 + 0.03) : NaN; vD[v] = 0; vPlat[v] = 0;
    }
  }
  // courant des sommets : moyenne des 4 cases voisines (calculé sur toute la rivière, sans couture de tuile)
  const vC = new Float32Array(NV * NV * 2);
  for (let b = 0; b <= NT; b++) for (let a = 0; a <= NT; a++) {
    let cx = 0, cz = 0, n = 0;
    for (let db = -1; db <= 0; db++) for (let da = -1; da <= 0; da++) {
      const r = (a + da >= 0 && b + db >= 0 && a + da < NT && b + db < NT) ? [T, (b + db) * NT + a + da] : ou(I0 + a + da, J0 + b + db, false);
      if (!r || r[0].etat[r[1]] !== PEINT) continue;
      cx += r[0].cou[2 * r[1]]; cz += r[0].cou[2 * r[1] + 1]; n++;
    }
    if (n) { vC[2 * (b * NV + a)] = cx / n; vC[2 * (b * NV + a) + 1] = cz / n; }
  }
  const pos = [], att = [], cou = [], idx = [], ids = new Int32Array(NV * NV).fill(-1);
  const sommet = (a, b) => { const v = b * NV + a; if (ids[v] < 0) { ids[v] = pos.length / 3; pos.push(x0 + a * CASE, vY[v], z0 + b * CASE); att.push(vM[v], vD[v]); cou.push(vC[2 * v], vC[2 * v + 1]); } return ids[v]; };
  const pris = new Uint8Array(NT * NT);
  // blocs de 8x8 cases pleines et plates (grands lacs) : un seul quadrilatère
  for (let B = 0; B < NT; B += 8) for (let A = 0; A < NT; A += 8) {
    let ok = true; const y0 = vY[B * NV + A];
    for (let b = B; b <= B + 8 && ok; b++) for (let a = A; a <= A + 8 && ok; a++) { const v = b * NV + a; if (vM[v] < 1 || !vPlat[v] || Math.abs(vY[v] - y0) > 1e-3 || vD[v] < 3.0) ok = false; }
    if (!ok) continue;
    const p0 = sommet(A, B), p1 = sommet(A + 8, B), p2 = sommet(A + 8, B + 8), p3 = sommet(A, B + 8);
    idx.push(p0, p3, p1, p1, p3, p2);
    for (let b = B; b < B + 8; b++) for (let a = A; a < A + 8; a++) pris[b * NT + a] = 1;
  }
  for (let b = 0; b < NT; b++) for (let a = 0; a < NT; a++) {
    if (pris[b * NT + a]) continue;
    const v0 = b * NV + a, v1 = v0 + 1, v2 = v0 + NV + 1, v3 = v0 + NV;
    if (vM[v0] + vM[v1] + vM[v2] + vM[v3] === 0) continue;
    if (!(vY[v0] === vY[v0] && vY[v1] === vY[v1] && vY[v2] === vY[v2] && vY[v3] === vY[v3])) continue;
    const p0 = sommet(a, b), p1 = sommet(a + 1, b), p2 = sommet(a + 1, b + 1), p3 = sommet(a, b + 1);
    idx.push(p0, p3, p1, p1, p3, p2);
  }
  if (!idx.length) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("eau", new THREE.Float32BufferAttribute(att, 2));
  g.setAttribute("cours", new THREE.Float32BufferAttribute(cou, 2));
  g.setIndex(idx); g.computeBoundingBox(); g.computeBoundingSphere();
  T.bb.copy(g.boundingBox);
  let s = 0, ns = 0; for (let k = 0; k < NT * NT; k++) if (estEau(T.etat[k])) { s += T.lvl[k]; ns++; }
  T.yMoy = ns ? s / ns : (T.bb.min.y + T.bb.max.y) / 2;
  const m = new THREE.Mesh(g, matScene);
  m.userData.interface = true; m.userData.eauAffichage = true; m.renderOrder = 2;
  m.onBeforeRender = avantRendu;
  m.visible = EAU.actif;
  T.mesh = m; scene.add(m);
}
function toutConstruire() {
  for (const [k, T] of EAU.tuiles) if (T.sale) construire(T);
  _vueSale = true;
}
let _attente = 0;
function construireBientot() { if (_attente) return; _attente = setTimeout(() => { _attente = 0; toutConstruire(); }, 50); }

// ── 3. Matériau de l'eau ────────────────────────────────────────────────────
// v146 : houle en 16 trains d'ondes + rides capillaires, reflet du décor déformé/flouté par les
// vagues, ciel « HDR », soleil en traînée, corps de l'eau par absorption. ?eau=v145 = rendu d'avant.
const EAU_V145 = !/[?&]eau=v146\b/.test(location.search);   // jury à l'aveugle : v146 notée 4,9 contre 5,8 -> v145 reste le rendu par défaut ; ?eau=v146 = nouveau rendu (en cours)
const BRUIT_GLSL_V145 = `
uniform float uT, uV;
vec2 h22(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return -1.0 + 2.0 * fract(sin(p) * 43758.5453); }
vec3 bruitD(vec2 p){
  vec2 i = floor(p), f = fract(p), u = f*f*f*(f*(f*6.0-15.0)+10.0), du = 30.0*f*f*(f*(f-2.0)+1.0);
  vec2 ga = h22(i), gb = h22(i + vec2(1.0,0.0)), gc = h22(i + vec2(0.0,1.0)), gd = h22(i + vec2(1.0,1.0));
  float va = dot(ga, f), vb = dot(gb, f - vec2(1.0,0.0)), vc = dot(gc, f - vec2(0.0,1.0)), vd = dot(gd, f - vec2(1.0,1.0));
  float v = va + u.x*(vb-va) + u.y*(vc-va) + u.x*u.y*(va-vb-vc+vd);
  vec2 d = ga + u.x*(gb-ga) + u.y*(gc-ga) + u.x*u.y*(ga-gb-gc+gd) + du*(u.yx*(va-vb-vc+vd) + vec2(vb,vc) - va);
  return vec3(v, d);
}
float h11(float n){ return fract(sin(n * 12.9898) * 43758.5453); }
// Rides : 4 couches de bruit (non périodique) qui défilent chacune dans sa direction autour du
// vent, crêtes allongées, de ~35 cm à ~5 m ; chaque couche s'efface quand elle devient plus fine
// que quelques pixels (pas de moiré ni de grille au loin).
vec2 couche(vec2 p, float lambda, float ang, vec2 vent, float flou, float graine){
  float att = smoothstep(4.0, 12.0, lambda / max(flou, 1e-4));
  if (att <= 0.0) return vec2(0.0);
  vec2 d = vec2(cos(ang) * vent.x - sin(ang) * vent.y, sin(ang) * vent.x + cos(ang) * vent.y), t = vec2(-d.y, d.x);
  float c = sqrt(9.81 * lambda / 6.2832) * 0.6;                         // vitesse d'une ride de cette taille
  vec2 q = vec2(dot(p, d) - c * uT, dot(p, t) * 0.55) / lambda + graine;  // crêtes allongées en travers
  vec3 n1 = bruitD(q), n2 = bruitD(q * 2.03 + 5.7);
  vec2 gq = n1.yz + n2.yz * 0.5 * smoothstep(4.0, 12.0, 0.49 * lambda / max(flou, 1e-4));
  return (d * gq.x + t * gq.y * 0.55) * att;                            // retour au repère du terrain
}
vec2 rides(vec2 p, vec2 vent, float flou){
  float lm = mix(1.0, 4.0, smoothstep(0.15, 0.85, uV));                 // vent faible : rides courtes ; eau agitée : longues
  vec2 g = couche(p, lm * 1.30, 0.00, vent, flou, 0.0) * 0.85
         + couche(p, lm * 0.62, 0.45, vent, flou, 11.3)
         + couche(p, lm * 0.33, -0.55, vent, flou, 23.7)
         + couche(p, lm * 0.17, 0.95, vent, flou, 37.1) * 0.9;
  return g * 0.55;
}
vec2 penteEau(vec2 p, vec2 cours, float flou){
  float fs = clamp(length(cours), 0.0, 1.0);
  vec2 vent = vec2(0.6, 0.8);
  float raf = 0.65 + 0.7 * clamp(0.5 + 0.9 * bruitD(p * 0.022 + vec2(uT * 0.03, 0.0)).x, 0.0, 1.0);   // rafales : zones plus ou moins ridées
  if (fs < 0.02) return rides(p, vent, flou) * raf;
  // rivière : le courant emporte les rides (deux phases fondues, sans déformation qui s'accumule)
  float t0 = fract(uT * 0.4), t1 = fract(uT * 0.4 + 0.5), m = abs(0.5 - t0) / 0.5;
  vec2 g0 = rides(p - cours * t0 * 1.6, vent, flou), g1 = rides(p - cours * t1 * 1.6 + vec2(5.3, 2.9), vent, flou);
  // traînées de courant : rides allongées dans l'axe de la rivière, emportées vers l'aval
  vec2 fd = cours / max(length(cours), 1e-4), ft = vec2(-fd.y, fd.x);
  vec2 qf = vec2(dot(p, fd) - uT * 0.9, dot(p, ft) * 3.2) / 1.6;
  vec3 nf = bruitD(qf);
  vec2 gf = (fd * nf.y + ft * nf.z * 3.2) * 0.45 * smoothstep(4.0, 12.0, 0.5 / max(flou, 1e-4));
  return mix(g0, g1, m) * mix(raf, 1.0, fs) * (1.0 - 0.35 * fs) + gf * fs;
}
vec3 normaleEau(vec2 p, vec2 cours, float flou){
  float amp = mix(0.012, 0.13, smoothstep(0.02, 0.2, uV)) + 0.28 * smoothstep(0.2, 0.7, uV) + 0.12 * smoothstep(0.7, 1.0, uV);
  amp = max(amp, 0.09 * clamp(length(cours), 0.0, 1.0));            // une rivière ride toujours un peu
  vec2 g = penteEau(p, cours, flou) * amp;
  return normalize(vec3(-g.x, 1.0, -g.y));
}
float fresnelEau(vec3 N, vec3 V){ float c = clamp(dot(N, V), 0.0, 1.0); return 0.02 + 0.98 * pow(1.0 - c, 5.0); }
`;
const FRAG_SCENE_V145 = `
uniform vec3 uFond, uClair, uCielH, uCielZ, uSol, uSolCoul; uniform sampler2D uRefl; uniform float uReflOn, uReflY, uJour; uniform mat4 uVP;
varying vec3 vW; varying float vMasque, vProf; varying vec2 vCours;
void main(){
  float eauB = smoothstep(0.40, 0.52, vMasque);                        // bord de l'eau : fondu court
  float mouille = smoothstep(0.15, 0.40, vMasque) * (1.0 - eauB);      // ligne mouillée sur la berge
  if (eauB + mouille <= 0.001) discard;
  vec3 V = normalize(cameraPosition - vW);
  float dist = length(cameraPosition - vW);
  float flou = max(length(dFdx(vW.xz)), length(dFdy(vW.xz)));          // taille d'un pixel sur l'eau (m)
  vec3 N = normaleEau(vW.xz, vCours, flou);
  float F = fresnelEau(N, V) * smoothstep(0.35, 0.8, vMasque);         // pas de liseré clair au contact de la berge
  vec3 R = reflect(-V, N); R.y = abs(R.y);
  vec3 ciel = mix(uCielH, uCielZ, pow(clamp(R.y, 0.0, 1.0), 0.45));
  // ciel un peu nuageux dans le reflet (jamais un aplat) : de jour seulement
  vec3 Rp = reflect(-V, vec3(0.0, 1.0, 0.0));
  vec2 qn = Rp.xz / (Rp.y + 0.35) * 0.9 + N.xz * 0.6 + vec2(uT * 0.004, 0.0);
  float nu = 0.5 + 0.5 * (bruitD(qn).x * 0.7 + bruitD(qn * 2.1 + 4.1).x * 0.3);
  ciel *= mix(1.0, 0.88 + 0.26 * nu, smoothstep(0.3, 0.7, uJour) * smoothstep(0.05, 0.3, Rp.y));
  ciel = max(ciel, vec3(0.0025, 0.0032, 0.0055));                      // nuit : le ciel garde une faible lueur
  vec3 refl = ciel;
  float pr = smoothstep(0.0, 0.15, vProf);                             // pas de reflet net sur 2 cm d'eau
  if (uReflOn > 0.5){                                                  // reflet du décor (vue miroir), déformé surtout à la verticale
    vec4 c = uVP * vec4(vW.x, uReflY, vW.z, 1.0);
    vec2 uv = c.xy / c.w * 0.5 + 0.5;
    vec2 dec = N.xz * vec2(0.22, 2.4) * (0.14 + 0.55 * uV);             // les rides cassent le reflet (surtout à la verticale)
    float lg = (0.0012 + 0.004 * uV) * (1.0 + dist * 0.006);            // léger flou vertical, plus fort au loin
    vec4 d = texture2D(uRefl, uv + dec) * 0.30
           + (texture2D(uRefl, uv + dec + vec2(0.0, lg)) + texture2D(uRefl, uv + dec - vec2(0.0, lg))) * 0.22
           + (texture2D(uRefl, uv + dec + vec2(0.0, 2.3 * lg)) + texture2D(uRefl, uv + dec - vec2(0.0, 2.3 * lg))) * 0.13;
    float memeNiveau = 1.0 - smoothstep(1.0, 3.0, abs(vW.y - uReflY));
    refl = mix(ciel, d.rgb * 0.80, d.a * memeNiveau * pr);
  }
  refl *= 0.88;                                                        // un reflet est toujours un peu plus sombre que l'objet
  float sp = pow(max(dot(R, normalize(uSol)), 0.0), mix(1400.0, 180.0, clamp(uV * 1.3, 0.0, 1.0)));
  vec3 soleil = uSolCoul * min(sp * mix(2.0, 1.0, uV), 0.5) * smoothstep(0.25, 0.6, uJour);
  // eau trouble : la lumière s'éteint avec la profondeur (le rouge d'abord)
  vec3 Tr = exp(-vec3(1.9, 1.25, 1.05) * vProf * 2.6);
  float opac = 1.0 - (Tr.r + Tr.g + Tr.b) / 3.0;
  vec3 corps = mix(uClair, uFond, smoothstep(0.0, 1.0, vProf));
  vec3 eau = mix(corps, refl, clamp(F, 0.0, 1.0)) + soleil * smoothstep(0.35, 0.8, vMasque);
  float aE = clamp(max(opac, F) + 0.22, 0.0, 1.0) * eauB;
  float aM = 0.24 * mouille;
  float a = aE + aM * (1.0 - aE);
  vec3 col = (eau * aE + uFond * 0.25 * aM * (1.0 - aE)) / max(a, 1e-4);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>`;
const FRAG_REFLET_V145 = `
uniform sampler2D uRefl; uniform mat4 uVP; varying vec3 vW; varying float vMasque, vProf; varying vec2 vCours;
void main(){
  float bord = smoothstep(0.40, 0.52, vMasque); if (bord <= 0.001) discard;
  vec3 V = normalize(cameraPosition - vW);
  float dist = length(cameraPosition - vW);
  vec3 N = normaleEau(vW.xz, vCours, max(length(dFdx(vW.xz)), length(dFdy(vW.xz))));
  float F = fresnelEau(N, V);
  vec4 c = uVP * vec4(vW, 1.0); vec2 uv = c.xy / c.w * 0.5 + 0.5;
  // les rides renvoient la lumière plus haut ou plus bas : colonnes de paillettes (une facette = un éclat)
  vec2 d = N.xz * vec2(0.16, 1.7) * (0.15 + 1.2 * uV);
  float L = 0.002 + 0.03 * smoothstep(0.02, 0.2, uV) + 0.03 * uV;                                        // chaque éclat s'étire à la verticale : les éclats forment des colonnes
  vec3 s = vec3(0.0); float ws = 0.0;
  float o = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  for (int i = -4; i <= 4; i++){ float fi = (float(i) + o) / 4.0, w = exp(-fi * fi * 1.2); s += texture2D(uRefl, uv + d + vec2(0.0, fi * L)).rgb * w; ws += w; }
  s = s / ws * (1.0 + 2.2 * uV);
  float casse = 1.0;
  float k = clamp(F * 0.3 + 0.01, 0.0, 0.22) * smoothstep(0.0, 0.15, vProf);
  gl_FragColor = vec4(s * casse * k * bord, 1.0);
`;
const BRUIT_GLSL_V146 = `
uniform float uT, uV; uniform vec2 uVent;
vec2 h22(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return -1.0 + 2.0 * fract(sin(p) * 43758.5453); }
vec3 bruitD(vec2 p){
  vec2 i = floor(p), f = fract(p), u = f*f*f*(f*(f*6.0-15.0)+10.0), du = 30.0*f*f*(f*(f-2.0)+1.0);
  vec2 ga = h22(i), gb = h22(i + vec2(1.0,0.0)), gc = h22(i + vec2(0.0,1.0)), gd = h22(i + vec2(1.0,1.0));
  float va = dot(ga, f), vb = dot(gb, f - vec2(1.0,0.0)), vc = dot(gc, f - vec2(0.0,1.0)), vd = dot(gd, f - vec2(1.0,1.0));
  float v = va + u.x*(vb-va) + u.y*(vc-va) + u.x*u.y*(va-vb-vc+vd);
  vec2 d = ga + u.x*(gb-ga) + u.y*(gc-ga) + u.x*u.y*(ga-gb-gc+gd) + du*(u.yx*(va-vb-vc+vd) + vec2(vb,vc) - va);
  return vec3(v, d);
}
float h11(float n){ return fract(sin(n * 12.9898) * 43758.5453); }
float g_sig = 0.0;   // rugosité sous le pixel (pente RMS), posée par normaleEau
// v146 — HOULE : 16 trains d'ondes autour du vent (angle, longueur et phase tirés au sort, spectre
// de pente à peu près plat, vitesse de phase physique en eau profonde), crêtes un peu pincées
// quand l'eau s'agite. Chaque train s'efface quand il fait moins de ~8 pixels (aucun moiré).
// raf1/raf2 : rafales = amplitude modulée par zones (eau plus ou moins ridée selon l'endroit).
vec2 trains(vec2 p, vec2 vent, float flou, float lmax, float ouv, float pince, float raf1, float raf2, inout float perdu){
  vec2 g = vec2(0.0);
  for (int i = 0; i < 16; i++){
    float fi = float(i);
    float lam = lmax * pow(0.78, fi + 0.5 * (h11(fi * 3.1 + 7.7) - 0.5));
    float att = smoothstep(6.0, 16.0, lam / max(flou, 1e-5));
    float amp0 = 0.7 + 0.6 * h11(fi * 5.3 + 2.2);
    perdu += (1.0 - att) * amp0 * amp0 * 0.5;                            // ce que l'oeil ne résout plus devient de la rugosité
    if (att <= 0.0) continue;
    float ang = (h11(fi * 7.13 + 1.7) - 0.5) * ouv;
    vec2 d = vec2(cos(ang) * vent.x - sin(ang) * vent.y, sin(ang) * vent.x + cos(ang) * vent.y);
    float k = 6.2832 / lam, w = sqrt(9.81 * k);
    vec3 env = bruitD(p / (lam * 4.5) + vec2(h11(fi * 1.7) * 37.0, h11(fi * 2.9) * 53.0) + uT * 0.03);   // paquets d'ondes : chaque train vit par zones
    float ph = dot(d, p) * k - w * uT + h11(fi * 3.7 + 0.3) * 6.2832 + 2.4 * env.x;
    float amp = amp0 * mix(raf1, raf2, fract(fi * 0.381)) * (0.35 + 1.3 * smoothstep(-0.5, 0.5, env.x));
    g += d * cos(ph) * (1.0 + pince * sin(ph)) * att * amp;
  }
  return g;
}
// rides capillaires (~25 cm et ~12 cm) : le grain fin du premier plan, effacé vite avec la distance
vec2 rides(vec2 p, vec2 vent, float flou){
  float px = 0.25 / max(flou, 1e-5);
  float a0 = smoothstep(6.0, 16.0, px * 4.4), a1 = smoothstep(6.0, 16.0, px), a2 = smoothstep(6.0, 16.0, px * 0.48);
  vec2 g = vec2(0.0);
  if (a0 > 0.0) { vec2 q0 = p * 0.9 + vent * uT * 0.35; float a0b = smoothstep(6.0, 16.0, px * 2.2);
    g += (bruitD(q0).yz * a0 + 0.5 * bruitD(q0 * 2.0 + 7.1 - vent * uT * 0.1).yz * a0b) * 0.22; }   // clapot moyen (~1 m et ~0,5 m), chaque octave filtrée
  if (a1 <= 0.0) return g;
  vec2 q = p * 4.0 + vent * uT * 0.7;
  g += bruitD(q).yz * a1;
  if (a2 > 0.0) g += bruitD(q * 2.1 + 3.3 + vent * uT * 0.4).yz * 0.6 * a2;
  return g;
}
// traînées de courant : bruit étiré dans l'axe de la rivière (×3), évalué dans 4 repères ancrés aux
// coins de la maille de 16 m et fondu bilinéairement (coordonnées bornées -> pas de dérive de phase)
vec2 stries(vec2 p, vec2 fd, vec2 ft, vec2 dv, float t0, float t1, float m, float flou){
  float att = smoothstep(6.0, 16.0, 0.9 / max(flou, 1e-5));
  if (att <= 0.0) return vec2(0.0);
  vec2 cel = floor(p / 16.0), f = fract(p / 16.0);
  vec2 g = vec2(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++){
    vec2 c = (cel + vec2(float(i), float(j))) * 16.0;
    float w = (i == 0 ? 1.0 - f.x : f.x) * (j == 0 ? 1.0 - f.y : f.y);
    vec2 r0 = p - c - dv * t0, r1 = p - c - dv * t1;
    vec2 qa = vec2(dot(r0, fd) * 0.35, dot(r0, ft) * 1.1) + c * 0.013;
    vec2 qb = vec2(dot(r1, fd) * 0.35, dot(r1, ft) * 1.1) + c * 0.013 + 5.0;
    vec2 gl = mix(bruitD(qa).yz, bruitD(qb).yz, m);
    g += w * (fd * gl.x * 0.35 + ft * gl.y * 1.1);
  }
  return g * att * 0.25;
}
vec3 normaleEau(vec2 p, vec2 cours, float flou){
  float fs = clamp(length(cours), 0.0, 1.0);
  float r1 = 0.5 + 1.0 * clamp(0.5 + 0.9 * bruitD(p * 0.02 + vec2(uT * 0.025, 0.0)).x, 0.0, 1.0);
  float r2 = 0.5 + 1.0 * clamp(0.5 + 0.9 * bruitD(p * 0.031 + vec2(3.7, uT * 0.02)).x, 0.0, 1.0);
  float lmax = mix(0.9, 5.0, smoothstep(0.1, 0.9, uV));                 // vent faible : rides courtes ; eau agitée : houle longue
  float ouv = mix(2.4, 1.1, smoothstep(0.3, 0.9, uV));                  // calme : directions très mêlées ; agitée : alignées au vent
  float rms = 0.010 + 0.024 * smoothstep(0.0, 0.25, uV) + 0.12 * smoothstep(0.25, 0.7, uV) + 0.09 * smoothstep(0.7, 1.0, uV);   // pente RMS : miroir 0,01 ; légères ~0,03 ; agitées ~0,15
  float pince = 0.4 * smoothstep(0.3, 1.0, uV);
  vec2 g; float perdu = 0.0;
  if (fs < 0.02) g = trains(p, uVent, flou, lmax, ouv, pince, r1, r2, perdu);
  else {
    // RIVIÈRE : les mêmes trains (repère du monde, jamais tourné : un repère qui tourne avec le
    // courant fait dériver la phase et moire), emportés vers l'aval (deux phases fondues, aucune
    // déformation ne s'accumule), + des traînées étirées dans l'axe (bruit en repères ancrés par
    // mailles de 16 m, fondu bilinéaire) ; une rivière ride toujours un peu
    vec2 fd = cours / max(length(cours), 1e-4), ft = vec2(-fd.y, fd.x);
    float t0 = fract(uT * 0.3), t1 = fract(uT * 0.3 + 0.5), m = abs(0.5 - t0) / 0.5;
    vec2 dv = fd * (1.2 * fs / 0.3);
    float p0 = 0.0, p1 = 0.0;
    vec2 g0 = trains(p - dv * t0, uVent, flou, max(lmax, 1.2), ouv, pince, r1, r2, p0);
    vec2 g1 = trains(p - dv * t1 + vec2(7.3, 3.1), uVent, flou, max(lmax, 1.2), ouv, pince, r1, r2, p1);
    g = mix(g0, g1, m); perdu = mix(p0, p1, m);
    g += stries(p, fd, ft, dv, t0, t1, m, flou) * (0.6 + 0.4 * fs) * 2.8;
    rms = max(rms, 0.03 + 0.03 * fs);
  }
  g *= rms / 2.8;
  g += rides(p, uVent, flou) * (0.010 + 0.025 * uV);
  // rugosité résiduelle : les rides que le pixel ne résout plus ne font pas de relief mais un FLOU
  // (et des paillettes sous une source vive) -> transmise au reflet par g_sig
  g_sig = sqrt(max(perdu, 0.0)) * rms / 2.8;
  return normalize(vec3(-g.x, 1.0, -g.y));
}
float fresnelEau(vec3 N, vec3 V){ float c = clamp(dot(N, V), 0.0, 1.0); return 0.02 + 0.98 * pow(1.0 - c, 5.0); }
`;
const FRAG_SCENE_V146 = `
uniform vec3 uFond, uClair, uCielH, uCielZ, uSol, uSolCoul; uniform sampler2D uRefl; uniform float uReflOn, uReflY, uJour, uGainCiel; uniform mat4 uVP;
varying vec3 vW; varying float vMasque, vProf; varying vec2 vCours;
void main(){
  float eauB = smoothstep(0.40, 0.50, vMasque);                        // ligne d'eau (fondu court)
  float mouille = smoothstep(0.26, 0.40, vMasque) * (1.0 - eauB);      // berge mouillée (~35 cm), sombre
  if (eauB + mouille <= 0.001) discard;
  vec3 V = normalize(cameraPosition - vW);
  float dist = length(cameraPosition - vW);
  float flou = max(length(dFdx(vW.xz)), length(dFdy(vW.xz)));          // taille d'un pixel sur l'eau (m)
  vec3 N = normaleEau(vW.xz, vCours, flou);
  float F = fresnelEau(N, V);
  vec3 R = reflect(-V, N); float Ry = max(R.y, 0.0);
  // CIEL reflété : dégradé horizon -> zénith, un peu nuageux de jour ; en « HDR » (uGainCiel) car le
  // ciel est bien plus lumineux que l'eau : son reflet reste visible même vu d'en haut
  vec3 ciel = mix(uCielH, uCielZ, pow(Ry, 0.5));
  vec3 Rp = reflect(-V, vec3(0.0, 1.0, 0.0));
  vec2 qn = Rp.xz / (Rp.y + 0.35) * 0.9 + N.xz * 0.8 + vec2(uT * 0.004, 0.0);
  float nu = 0.5 + 0.5 * (bruitD(qn).x * 0.7 + bruitD(qn * 2.1 + 4.1).x * 0.3);
  ciel *= mix(1.0, 0.86 + 0.30 * nu, smoothstep(0.3, 0.7, uJour) * smoothstep(0.05, 0.3, Rp.y));
  ciel = max(ciel * uGainCiel, vec3(0.0025, 0.0032, 0.0055));         // nuit : le ciel garde une faible lueur
  vec3 refl = ciel;
  float pr = smoothstep(0.0, 0.12, vProf);                             // pas de reflet net sur 2 cm d'eau
  float pres = smoothstep(0.0, 30.0, dist);                            // tout près de l'oeil, le décor reflété est loin derrière : décalage réduit
  if (uReflOn > 0.5){
    // DÉCOR reflété (vue miroir) : la pente de la vague déplace le reflet d'environ 2x la pente
    // (surtout en hauteur), et le floute à la verticale d'autant plus que l'eau est rugueuse
    vec4 c = uVP * vec4(vW.x, uReflY, vW.z, 1.0);
    vec2 uv = c.xy / c.w * 0.5 + 0.5;
    vec2 dec = vec2(N.x * 0.9, N.z * 2.0) * (0.45 + 0.55 * pres);
    float lg = (0.0015 + 0.08 * (0.012 + 0.09 * uV) + 0.9 * g_sig) * (0.5 + 0.5 * pres);
    float o = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.6;
    vec4 d = vec4(0.0); float ws = 0.0;
    for (int i = -4; i <= 4; i++){ float fi = (float(i) + o) / 4.0, w = exp(-fi * fi * 1.8); d += texture2D(uRefl, uv + dec + vec2(0.0, fi * lg)) * w; ws += w; }
    d /= ws;
    float memeNiveau = 1.0 - smoothstep(1.0, 3.0, abs(vW.y - uReflY));
    refl = mix(ciel, d.rgb * 0.86, d.a * memeNiveau * pr);              // un reflet est un peu plus sombre que l'objet
  }
  refl *= 1.0 / (1.0 + 0.35 * max(max(refl.r, refl.g), refl.b));        // genou doux : pas de nappe blanche au loin
  // SOLEIL : traînée de reflets (seules les facettes tournées vers lui brillent)
  vec3 Ls = normalize(uSol), Hs = normalize(Ls + V);
  float shin = mix(900.0, 90.0, smoothstep(0.0, 1.0, uV));
  float sp = pow(max(dot(N, Hs), 0.0), shin) * (shin + 2.0) * 0.02;
  float Fs = 0.02 + 0.98 * pow(1.0 - max(dot(Hs, V), 0.0), 5.0);
  vec3 soleil = uSolCoul * sp * Fs * smoothstep(0.25, 0.6, uJour);
  soleil = soleil / (1.0 + soleil);
  // CORPS de l'eau : la lumière s'éteint le long du chemin aller + retour (eau trouble d'étang)
  float chemin = vProf * (1.0 + 1.0 / max(V.y, 0.25));
  vec3 Tr = exp(-vec3(1.5, 0.75, 1.0) * chemin);
  float aCorps = 1.0 - (Tr.r + Tr.g + Tr.b) / 3.0;
  vec3 corps = mix(uClair, uFond, smoothstep(0.0, 1.5, chemin));
  float Fb = F * smoothstep(0.35, 0.75, vMasque);                      // pas de liseré clair au contact de la berge
  // composition : surface (reflet, Fb) + corps (aCorps) + fond visible au travers (alpha)
  float a = Fb + aCorps - Fb * aCorps;
  vec3 col = ((1.0 - Fb) * aCorps * corps + Fb * refl + soleil * eauB) / max(a, 1e-4);
  a *= eauB;
  float aM = 0.32 * mouille;
  float at = a + aM * (1.0 - a);
  col = (col * a + uFond * 0.3 * aM * (1.0 - a)) / max(at, 1e-4);
  gl_FragColor = vec4(col, at);
  #include <colorspace_fragment>
}`;
const FRAG_REFLET_V146 = `
uniform sampler2D uRefl; uniform mat4 uVP; varying vec3 vW; varying float vMasque, vProf; varying vec2 vCours;
void main(){
  float bord = smoothstep(0.40, 0.50, vMasque); if (bord <= 0.001) discard;
  vec3 V = normalize(cameraPosition - vW);
  float dist = length(cameraPosition - vW);
  vec3 N = normaleEau(vW.xz, vCours, max(length(dFdx(vW.xz)), length(dFdy(vW.xz))));
  float F = fresnelEau(N, V);
  vec4 c = uVP * vec4(vW, 1.0); vec2 uv = c.xy / c.w * 0.5 + 0.5;
  float pres = smoothstep(0.0, 30.0, dist);
  float rug = 0.015 + 0.10 * uV;
  // la pente de chaque facette déplace l'éclat (surtout en hauteur) : les bouquets se reflètent en
  // COLONNES de paillettes, d'autant plus longues que l'eau est rugueuse
  vec2 dec = vec2(N.x * 0.5, N.z * 2.0) * (0.45 + 0.55 * pres);
  float L = (0.003 + 1.2 * rug + 1.0 * g_sig) * (0.5 + 0.5 * pres);
  float o = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.6;
  vec3 s = vec3(0.0); float ws = 0.0;
  for (int i = -6; i <= 6; i++){ float fi = (float(i) + o) / 6.0, w = exp(-fi * fi * 1.3); s += texture2D(uRefl, uv + dec + vec2(0.0, fi * L)).rgb * w; ws += w; }
  s /= ws;
  float gain = mix(1.0, 2.6, smoothstep(0.0, 0.6, uV));                 // la colonne dilue la lumière ; les crêtes la concentrent
  vec2 cel = floor(gl_FragCoord.xy / 3.0) + floor(uT * 6.0) * 17.0;      // paillettes : facettes au sort sous le pixel, scintillent à ~6 Hz
  gain *= 1.0 + smoothstep(0.0, 0.03, g_sig) * 0.35 * h22(cel).x;
  float k = clamp(F * 0.55 + 0.02, 0.0, 0.55) * smoothstep(0.0, 0.12, vProf) * bord;
  gl_FragColor = vec4(s * gain * k, 1.0);
}
`;
const BRUIT_GLSL = EAU_V145 ? BRUIT_GLSL_V145 : BRUIT_GLSL_V146;
const VS_EAU = `attribute vec2 eau; attribute vec2 cours; varying vec3 vW; varying float vMasque, vProf; varying vec2 vCours;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vMasque = eau.x; vProf = eau.y; vCours = cours; gl_Position = projectionMatrix * viewMatrix * w; }`;
const matScene = new THREE.ShaderMaterial({
  uniforms: { uT: { value: 0 }, uV: { value: EAU.vagues }, uVent: { value: new THREE.Vector2(0.6, 0.8) }, uGainCiel: { value: 1.0 },
              uFond: { value: new THREE.Color() }, uClair: { value: new THREE.Color() },
              uCielH: { value: new THREE.Color() }, uCielZ: { value: new THREE.Color() },
              uSol: { value: new THREE.Vector3(0.5, 0.7, 0.3) }, uSolCoul: { value: new THREE.Color() },
              uRefl: { value: null }, uReflOn: { value: 0 }, uReflY: { value: 0 }, uVP: { value: new THREE.Matrix4() }, uJour: { value: 0.5 } },
  vertexShader: VS_EAU,
  fragmentShader: BRUIT_GLSL + (EAU_V145 ? FRAG_SCENE_V145 : FRAG_SCENE_V146),
  transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  extensions: { derivatives: true } });
function majTeintes() {
  const j = typeof _jour === "number" ? _jour : 0.15, k = Math.min(1, Math.max(0, (j - 0.03) / 0.55));
  const L = (a, b) => new THREE.Color(a).lerp(new THREE.Color(b), k);
  const U = matScene.uniforms;
  if (EAU_V145) { U.uFond.value.copy(L(0x010205, 0x1a2b29)); U.uClair.value.copy(L(0x030506, 0x26241d)); }
  else { U.uFond.value.copy(L(0x010204, 0x15251c)); U.uClair.value.copy(L(0x030505, 0x3b3a26)); }   // eau d'étang : vert sombre ; bas-fonds : vase claire
  const fond = scene.background && scene.background.isColor ? scene.background : new THREE.Color(0x9FB4C8);
  U.uCielH.value.copy(fond).lerp(new THREE.Color(0xf4f6f8), (EAU_V145 ? 0.42 : 0.28) * k);   // horizon : plus clair
  U.uCielZ.value.copy(fond).lerp(new THREE.Color(0x3d6da8), 0.45 * k).multiplyScalar(0.85);   // zénith : bleu plus profond
  U.uGainCiel.value = EAU_V145 ? 1.0 : 1.0 + 0.45 * k;                               // de jour le ciel est bien plus lumineux que l'eau
  try { U.uSol.value.copy(soleil.position).sub(soleil.target.position).normalize(); U.uSolCoul.value.copy(soleil.color).multiplyScalar(soleil.intensity); } catch (e) {}
  U.uJour.value = j;
}

// ── 4. Reflet du décor : vue miroir rendue avant la première nappe visible de l'image ──
// niveau du miroir : la nappe visible la plus proche de l'oeil (là où l'on voit les reflets)
function niveauMiroir() {
  const vise = (typeof orbite !== "undefined" && orbite.cible) ? orbite.cible : camera.position;
  const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  let best = null, dmin = Infinity;
  for (const T of EAU.tuiles.values()) {
    if (!T.mesh) continue;
    const cx = Math.max(T.bb.min.x, Math.min(T.bb.max.x, camera.position.x)), cz = Math.max(T.bb.min.z, Math.min(T.bb.max.z, camera.position.z));
    const d = Math.hypot(cx - camera.position.x, cz - camera.position.z) + 0.15 * Math.hypot((T.bb.min.x + T.bb.max.x) / 2 - vise.x, (T.bb.min.z + T.bb.max.z) / 2 - vise.z) + (fr.intersectsBox(T.bb) ? 0 : 1e4);
    if (d < dmin) { dmin = d; best = T; }
  }
  return best ? best.yMoy : null;
}
function avantRendu(r, sc, cam) {
  EAU.vu = performance.now();
  const U = matScene.uniforms;
  U.uT.value = (EAU.vu - EAU.t0) / 1000; U.uV.value = EAU.vagues;
  if (cam !== camera || r !== renderer) return;
  const image = r.info.render.frame;
  if (EAU.imageDecor === image) return;
  EAU.imageDecor = image;
  majTeintes();
  let leger = false; try { leger = !!_leger; } catch (e) {}
  if (!EAU.decor || leger) { U.uReflOn.value = 0; return; }
  const h = niveauMiroir();
  if (h === null) { U.uReflOn.value = 0; return; }
  const ech = EAU_V145 ? 0.75 : 1.0;
  const W = Math.max(2, Math.round(r.domElement.width * ech)), H = Math.max(2, Math.round(r.domElement.height * ech));
  if (!EAU.rtDecor || EAU.rtDecor.width !== W || EAU.rtDecor.height !== H) {
    if (EAU.rtDecor) EAU.rtDecor.dispose();
    EAU.rtDecor = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: EAU_V145 ? 0 : 4 });
  }
  if (!EAU.camDecor) { EAU.camDecor = new THREE.PerspectiveCamera(); EAU.camDecor.matrixAutoUpdate = false; EAU.camDecor.matrixWorldAutoUpdate = false; }
  const C = EAU.camDecor, Rm = new THREE.Matrix4().set(1, 0, 0, 0, 0, -1, 0, 2 * h, 0, 0, 1, 0, 0, 0, 0, 1);
  // la vue miroir ne change que si la caméra (ou le niveau) bouge : sinon on la garde jusqu'à 1 s
  const cle = camera.matrixWorld.elements.join(",") + "|" + camera.projectionMatrix.elements.join(",") + "|" + h + "|" + W + "x" + H;
  const maint = performance.now();
  if (EAU.cleDecor === cle && maint - EAU.tDecor < 1000 && U.uRefl.value === EAU.rtDecor.texture) { U.uReflOn.value = 1; return; }
  EAU.cleDecor = cle; EAU.tDecor = maint;
  C.matrixWorld.multiplyMatrices(Rm, camera.matrixWorld); C.matrixWorldInverse.copy(C.matrixWorld).invert();
  C.projectionMatrix.copy(camera.projectionMatrix); C.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
  const caches = [];
  for (const T of EAU.tuiles.values()) if (T.mesh && T.mesh.visible) { caches.push(T.mesh); T.mesh.visible = false; }
  if (curseur && curseur.visible) { caches.push(curseur); curseur.visible = false; }
  let etoiles = null;
  try {
    if (_cielFeu && _cielFeu.visible) {
      if (EAU_V145) { if (EAU.vagues > 0.03) { caches.push(_cielFeu); _cielFeu.visible = false; } }
      else { const m = _cielFeu.material; etoiles = [m, m.transparent, m.opacity, m.size]; m.transparent = true; m.opacity = 0.65; m.size = Math.max(0.8, m.size * 0.75); }   // étoiles reflétées, plus discrètes (le flou des vagues les étale)
    }
  } catch (e) {}
  const avantRT = r.getRenderTarget(), fondAvant = sc.background, plans = r.clippingPlanes, autoOmbre = r.shadowMap.autoUpdate, besoinOmbre = r.shadowMap.needsUpdate;
  const cc = new THREE.Color(); r.getClearColor(cc); const ca = r.getClearAlpha();
  try {
    sc.background = null; r.shadowMap.autoUpdate = false; r.shadowMap.needsUpdate = false;
    r.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -h + 0.35)];   // un peu sous l'eau : le pied des berges se reflète aussi
    r.setRenderTarget(EAU.rtDecor); r.setClearColor(0x000000, 0); r.clear(); rendreMiroir(r, sc, C);
  } finally {
    r.setRenderTarget(avantRT); sc.background = fondAvant; r.clippingPlanes = plans; r.shadowMap.autoUpdate = autoOmbre; r.shadowMap.needsUpdate = besoinOmbre; r.setClearColor(cc, ca);
    for (const o of caches) o.visible = true;
    if (etoiles) { const [m, t, op, sz] = etoiles; m.transparent = t; m.opacity = op; m.size = sz; }
  }
  U.uRefl.value = EAU.rtDecor.texture; U.uReflOn.value = 1; U.uReflY.value = h;
  U.uVP.value.multiplyMatrices(C.projectionMatrix, C.matrixWorldInverse);
}
// Rendu miroir : la symétrie inverse le sens des faces (on verrait l'arrière des objets) -> on le rétablit
function rendreMiroir(r, sc, C) {
  const st = r.state, sm = st.setMaterial;
  st.setMaterial = function (m, cw) { return sm.call(this, m, !cw); };
  try { r.render(sc, C); } finally { st.setMaterial = sm; }
}
// l'eau bouge : une image de plus tant qu'elle est à l'écran
(function animer() {
  requestAnimationFrame(animer);
  if (EAU.actif && EAU.anim && EAU.tuiles.size && performance.now() - EAU.vu < 600) _vueSale = true;
})();


// ── 5. Reflets des FEUX (calque des feux) ────────────────────────────────────
function matReflet() {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uV: { value: EAU.vagues }, uVent: matScene.uniforms.uVent, uRefl: { value: null }, uVP: { value: new THREE.Matrix4() } },
    vertexShader: VS_EAU,
    fragmentShader: BRUIT_GLSL + (EAU_V145 ? FRAG_REFLET_V145 : FRAG_REFLET_V146),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, extensions: { derivatives: true } });
}
const _rendreFeuOrig = window._feuRendre;
window._feuRendre = function () {
  try {
    const nappes = [...EAU.tuiles.values()].filter(T => T.mesh);
    if (EAU.actif && nappes.length && _rendFeu.r) {
      const r = _rendFeu.r, sc = _rendFeu.scene;
      if (!EAU.matRefl) EAU.matRefl = matReflet();
      const ech = EAU_V145 ? 0.5 : 0.75;
      const W = Math.max(2, Math.round(r.domElement.width * ech)), H = Math.max(2, Math.round(r.domElement.height * ech));
      if (!EAU.rt || EAU.rt.width !== W || EAU.rt.height !== H) { if (EAU.rt) EAU.rt.dispose(); EAU.rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: EAU_V145 ? 0 : 4 }); }
      camera.updateMatrixWorld();
      const h = niveauMiroir(); if (h === null) throw new Error("pas d'eau");
      for (const T of nappes) {
        if (!T.ov || T.ov.geometry !== T.mesh.geometry) { if (T.ov && T.ov.parent) T.ov.parent.remove(T.ov); T.ov = new THREE.Mesh(T.mesh.geometry, EAU.matRefl); T.ov.frustumCulled = false; }
        if (T.ov.parent !== sc) sc.add(T.ov);
        T.ov.visible = Math.abs(T.yMoy - h) < 3;
      }
      for (const T of EAU.tuiles.values()) if (T.ov && !T.mesh && T.ov.parent) T.ov.parent.remove(T.ov);
      if (!EAU.reflCam) { EAU.reflCam = new THREE.PerspectiveCamera(); EAU.reflCam.matrixAutoUpdate = false; EAU.reflCam.matrixWorldAutoUpdate = false; }
      const C = EAU.reflCam, Rm = new THREE.Matrix4().set(1, 0, 0, 0, 0, -1, 0, 2 * h, 0, 0, 1, 0, 0, 0, 0, 1);
      camera.updateMatrixWorld();
      C.matrixWorld.multiplyMatrices(Rm, camera.matrixWorld); C.matrixWorldInverse.copy(C.matrixWorld).invert();
      C.projectionMatrix.copy(camera.projectionMatrix); C.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
      const vis = nappes.map(T => T.ov.visible); for (const T of nappes) T.ov.visible = false;
      const avant = r.getRenderTarget();
      r.setRenderTarget(EAU.rt); r.setClearColor(0x000000, 1); r.clear(); try { rendreMiroir(r, sc, C); } finally { r.setRenderTarget(avant); }
      nappes.forEach((T, i) => { T.ov.visible = vis[i]; });
      const U = EAU.matRefl.uniforms;
      U.uRefl.value = EAU.rt.texture; U.uVP.value.multiplyMatrices(C.projectionMatrix, C.matrixWorldInverse);
      U.uT.value = (performance.now() - EAU.t0) / 1000; U.uV.value = EAU.vagues;
    } else for (const T of EAU.tuiles.values()) if (T.ov) T.ov.visible = false;
  } catch (e) { console.warn("[eau] reflet des feux", e); }
  return _rendreFeuOrig();
};

// ── 6. Plans d'eau du site, changement de site ───────────────────────────────
function viderCarte() {
  for (const T of EAU.tuiles.values()) { if (T.mesh) { scene.remove(T.mesh); T.mesh.geometry.dispose(); } if (T.ov && T.ov.parent) T.ov.parent.remove(T.ov); }
  EAU.tuiles.clear(); EAU.corps.clear(); EAU.prochainId = 1; EAU.selection = null;
}
function balayer() {
  if (typeof dernier !== "undefined" && dernier !== EAU.site) { EAU.site = dernier; viderCarte(); majNiveauTxt(); }
  if (typeof _dernierSolEn !== "function" || !dernier) return;
  if (EAU.aImporter && dernier !== EAU.siteImport) { const a = EAU.aImporter; EAU.aImporter = null; importer(a); }
  // plans d'eau du site disparus (suppression, nouveau site) : leur eau part
  for (const c of [...EAU.corps.values()]) if (c.src && c.src.parent !== monde) {
    for (const T of EAU.tuiles.values()) if (T.n) for (let k = 0; k < NT * NT; k++) if (T.id[k] === c.id && T.etat[k] === SITE) poser(T, k, VIDE, 0, NaN);
    EAU.corps.delete(c.id);
  }
  const deja = new Set([...EAU.corps.values()].filter(c => c.src).map(c => c.src));
  for (const o of monde.children) {
    if (!o.isMesh || o.userData?.exp?.nom !== "eau" || deja.has(o) || !o.geometry?.attributes?.position) continue;
    o.updateMatrixWorld(true);
    const c = nouveauCorps("site", { src: o });
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    rasterTriangles(g.attributes.position, o.matrixWorld, SITE, c);
    if (g !== o.geometry) g.dispose();
  }
  if ([...EAU.tuiles.values()].some(T => T.sale)) toutConstruire();
  majTeintes();
}
setInterval(() => { try { balayer(); } catch (e) { console.warn("[eau]", e); } }, 1500);

// ── 7. Outils : niveau, pinceau, gomme ───────────────────────────────────────
let curseur = null;
function majCurseur(q) {
  if (!q || (EAU.outil !== "pinceau" && EAU.outil !== "gomme")) { if (curseur && curseur.visible) { curseur.visible = false; _vueSale = true; } return; }
  if (!curseur) {
    curseur = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x5fc8ff, depthTest: false, transparent: true }));
    curseur.userData.interface = true; curseur.renderOrder = 10; curseur.frustumCulled = false; scene.add(curseur);
  }
  const r = EAU.pinceau, pts = [];
  for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2, x = q.x + Math.cos(a) * r, z = q.z + Math.sin(a) * r; pts.push(new THREE.Vector3(x, sol(x, z) + 0.3, z)); }
  curseur.geometry.dispose(); curseur.geometry = new THREE.BufferGeometry().setFromPoints(pts);
  curseur.material.color.set(EAU.outil === "gomme" ? 0xff8a5c : 0x5fc8ff);
  curseur.visible = true; _vueSale = true;
}
function eauSous(q) {
  const r = ou(Math.floor(q.x / CASE), Math.floor(q.z / CASE), false); if (!r) return null;
  const T = r[0], k = r[1]; return estEau(T.etat[k]) ? EAU.corps.get(T.id[k]) || null : null;
}
const CONSIGNES = {
  niveau: "Touche le fond du plan d'eau : il se remplit jusqu'au niveau choisi. Clic droit ou molette : bouger la vue.",
  pinceau: "Glisse pour peindre de l'eau. Clic droit ou molette : bouger la vue. Re-touche « Pinceau » (ou Échap) pour finir.",
  gomme: "Glisse pour effacer de l'eau. Clic droit ou molette : bouger la vue. Re-touche « Gomme » (ou Échap) pour finir."
};
let _consigneAvant = "";
function choisirOutil(o) {
  const avant = EAU.outil;
  EAU.outil = EAU.outil === o ? null : o;
  for (const [id, n] of [["eauOutilNiveau", "niveau"], ["eauOutilPinceau", "pinceau"], ["eauOutilGomme", "gomme"]]) $(id).classList.toggle("actif", EAU.outil === n);
  if (!avant && EAU.outil) _consigneAvant = $("consigne").textContent;
  vue.classList.toggle("trace", !!EAU.outil);
  $("consigne").style.display = EAU.outil ? "block" : "none";
  $("consigne").textContent = EAU.outil ? CONSIGNES[EAU.outil] : _consigneAvant;
  if (!EAU.outil) majCurseur(null);
}
function majNiveauTxt() {
  const c = EAU.selection && EAU.corps.get(EAU.selection), ok = !!(c && c.type === "niveau");
  $("eauNiveauTxt").textContent = ok ? ((c.niveau - c.sol0) >= 0 ? "+" : "−") + Math.abs(c.niveau - c.sol0).toFixed(2).replace(".", ",") + " m" : "touche un plan d'eau";
  $("eauNiveau").disabled = !ok;
}
let _pinceauCorps = null, _peint = false, _dernierPoint = null;
function appliquerPinceau(q) {
  const ajouter = EAU.outil === "pinceau";
  if (ajouter && !_pinceauCorps) { const sous = eauSous(q); _pinceauCorps = sous && sous.type !== "site" ? sous : nouveauCorps("peint"); }
  const a = _dernierPoint || q, d = Math.hypot(q.x - a.x, q.z - a.z), n = Math.max(1, Math.ceil(d / (EAU.pinceau / 3)));
  for (let s = 1; s <= n; s++) peindre(a.x + (q.x - a.x) * s / n, a.z + (q.z - a.z) * s / n, EAU.pinceau, ajouter, _pinceauCorps);
  _dernierPoint = q; construireBientot();
}
function clicNiveau(q) {
  const sous = eauSous(q);
  if (sous && sous.type === "niveau") {
    EAU.selection = sous.id; $("eauNiveau").value = (sous.niveau - sous.sol0).toFixed(2); majNiveauTxt();
    dire("Plan d'eau choisi : règle son niveau avec le curseur « Niveau de l'eau ».", "ok"); return;
  }
  const s0 = sol(q.x, q.z);
  const c = nouveauCorps("niveau", { seed: { x: q.x, z: q.z }, sol0: s0, niveau: s0 + EAU.niveauRel });
  EAU.selection = c.id; $("eauNiveau").value = EAU.niveauRel.toFixed(2);
  const r = remplir(c); majNiveauTxt(); toutConstruire();
  if (!r.n) { EAU.corps.delete(c.id); EAU.selection = null; majNiveauTxt(); dire("Rien à remplir ici : monte le niveau ou touche un point plus bas.", "err"); }
  else dire(r.deborde ? "L'eau déborde très loin : baisse le niveau." : `Plan d'eau rempli (${Math.round(r.n * CASE * CASE).toLocaleString("fr-FR")} m²). Ajuste son niveau avec le curseur.`, r.deborde ? "err" : "ok");
}
vue.addEventListener("pointerdown", e => {
  if (!EAU.outil || e.target !== renderer.domElement || e.button !== 0 || !e.isPrimary) return;
  e.stopPropagation(); e.preventDefault();
  const q = pointSousSouris(e); if (!q) return;
  if (EAU.outil === "niveau") { clicNiveau(q); return; }
  _peint = true; _pinceauCorps = null; _dernierPoint = null;
  try { renderer.domElement.setPointerCapture(e.pointerId); } catch (er) {}
  appliquerPinceau(q); majCurseur(q);
}, true);
renderer.domElement.addEventListener("pointermove", e => {
  if (!EAU.outil) return;
  const q = pointSousSouris(e); majCurseur(q);
  if (_peint && q) appliquerPinceau(q);
});
const finPeint = () => { if (_peint) { _peint = false; _dernierPoint = null; if (_pinceauCorps) lisserPeint(_pinceauCorps); toutConstruire(); } };
renderer.domElement.addEventListener("pointerup", finPeint);
renderer.domElement.addEventListener("pointercancel", finPeint);
let _niveauAttente = 0;
$("eauNiveau").addEventListener("input", () => {
  const c = EAU.selection && EAU.corps.get(EAU.selection);
  EAU.niveauRel = Number($("eauNiveau").value);
  if (!c || c.type !== "niveau") return;
  c.niveau = c.sol0 + EAU.niveauRel; majNiveauTxt();
  if (_niveauAttente) return;
  _niveauAttente = setTimeout(() => { _niveauAttente = 0; const r = remplir(c); toutConstruire(); if (r.deborde) dire("L'eau déborde très loin : baisse le niveau.", "err"); }, 80);
});
for (const [id, n] of [["eauOutilNiveau", "niveau"], ["eauOutilPinceau", "pinceau"], ["eauOutilGomme", "gomme"]])
  $(id).addEventListener("click", () => { if (bloqueParChargement()) return; if (!dernier) { dire("Charge d'abord un site.", "err"); return; } choisirOutil(n); });
$("eauPinceau").addEventListener("input", () => { EAU.pinceau = Number($("eauPinceau").value); $("eauPinceauTxt").textContent = String(EAU.pinceau).replace(".", ",") + " m"; });
$("eauEffacer").addEventListener("click", () => {
  viderCarte(); EAU.site = dernier; balayer(); toutConstruire(); majNiveauTxt();
  dire("Eau ajoutée ou gommée à la main effacée (les plans d'eau du site reviennent).", "ok");
});
$("eauReflets").addEventListener("change", () => {
  EAU.actif = $("eauReflets").checked;
  for (const T of EAU.tuiles.values()) if (T.mesh) T.mesh.visible = EAU.actif;
  _vueSale = true; memoriser();
});
$("eauDecor").addEventListener("change", () => { EAU.decor = $("eauDecor").checked; _vueSale = true; memoriser(); });
const NOMS_VAGUES = [[0.03, "aucune (miroir)"], [0.3, "légères"], [0.55, "moyennes"], [0.8, "agitées"], [1.01, "fortes"]];
function majVagues() {
  EAU.vagues = Number($("eauVagues").value);
  $("eauVaguesTxt").textContent = NOMS_VAGUES.find(([s]) => EAU.vagues < s)[1];
  _vueSale = true;
}
$("eauVagues").addEventListener("input", () => { majVagues(); memoriser(); });
function memoriser() { try { localStorage.setItem("eau", JSON.stringify({ reflets: EAU.actif, decor: EAU.decor, vagues: EAU.vagues })); } catch (e) {} }
try { const m = JSON.parse(localStorage.getItem("eau") || "null"); if (m) { if (typeof m.reflets === "boolean") { EAU.actif = m.reflets; $("eauReflets").checked = m.reflets; } if (typeof m.decor === "boolean") { EAU.decor = m.decor; $("eauDecor").checked = m.decor; } if (isFinite(m.vagues)) $("eauVagues").value = m.vagues; } } catch (e) {}
majVagues(); majNiveauTxt();
document.addEventListener("keydown", e => { if (e.key === "Escape" && EAU.outil) choisirOutil(EAU.outil); });

// ── 8. Fichier du site ───────────────────────────────────────────────────────
// Carte gardée par tuile, en plages [valeur, longueur] (valeur = état × 65536 + corps). Les plans
// d'eau du site ne sont pas recopiés (ils reviennent avec le site) ; leurs parties gommées, si.
function exporter() {
  const corps = [...EAU.corps.values()].filter(c => c.type !== "site").map(c => ({ id: c.id, type: c.type, niveau: +c.niveau.toFixed(3), sol0: +c.sol0.toFixed(3), seed: c.seed ? [+c.seed.x.toFixed(2), +c.seed.z.toFixed(2)] : null }));
  const tuiles = [];
  for (const T of EAU.tuiles.values()) {
    const p = []; let v0 = -1, n = 0, utile = false;
    for (let k = 0; k < NT * NT; k++) {
      const e = T.etat[k], v = (e === NIVEAU || e === PEINT) ? e * 65536 + T.id[k] : e === GOMME ? GOMME * 65536 : 0;
      if (v) utile = true;
      if (v === v0) n++; else { if (n) p.push(v0, n); v0 = v; n = 1; }
    }
    if (n) p.push(v0, n);
    if (utile) tuiles.push([T.tx, T.tz, p]);
  }
  return { v: 2, case: CASE, corps, tuiles };
}
function importer(d) {
  if (!d) return;
  if (Array.isArray(d.anciens)) {   // surfaces tracées de la v144 (polygones)
    for (const anneau of d.anciens) {
      const c = nouveauCorps("peint");
      const g = new THREE.ShapeGeometry(new THREE.Shape(anneau.map(q => new THREE.Vector2(q.x, q.z)))).toNonIndexed();
      const P = g.attributes.position; for (let i = 0; i < P.count; i++) P.setXYZ(i, P.getX(i), 0, P.getY(i));
      rasterTriangles(P, new THREE.Matrix4(), PEINT, c); g.dispose(); lisserPeint(c);
    }
  }
  if (d.v === 2 && d.case === CASE) {
    const ren = new Map();
    for (const c of d.corps || []) { const n = nouveauCorps(c.type === "niveau" ? "niveau" : "peint", { niveau: Number(c.niveau) || 0, sol0: Number(c.sol0) || 0, seed: Array.isArray(c.seed) ? { x: Number(c.seed[0]), z: Number(c.seed[1]) } : null }); ren.set(c.id, n); }
    for (const [tx, tz, p] of d.tuiles || []) {
      if (!Array.isArray(p)) continue;
      const T = tuile(Number(tx), Number(tz), true); let k = 0;
      for (let q = 0; q + 1 < p.length; q += 2) {
        const v = Number(p[q]), n = Number(p[q + 1]), e = Math.floor(v / 65536), c = ren.get(v % 65536);
        for (let s = 0; s < n && k < NT * NT; s++, k++) {
          if (e === GOMME) poser(T, k, GOMME, 0, NaN);
          else if (e === NIVEAU && c) poser(T, k, NIVEAU, c.id, c.niveau);
          else if (e === PEINT && c) poser(T, k, PEINT, c.id, hauteurs(T)[k] + 0.10);
        }
      }
    }
    for (const c of ren.values()) if (c.type === "peint") lisserPeint(c);
  }
  toutConstruire();
}
const _etatSiteOrig = etatSite;
etatSite = function () {
  const e = _etatSiteOrig.apply(this, arguments);
  e.eau = Object.assign({ reflets: EAU.actif, decor: EAU.decor, vagues: EAU.vagues }, exporter());
  return e;
};
const _appliquerOrig = appliquerEtatSite;
appliquerEtatSite = async function (brut, paquet) {
  try {
    const d = brut && brut.eau && typeof brut.eau === "object" ? Object.assign({}, brut.eau) : {};
    if (Array.isArray(brut?.eauxTracees)) d.anciens = brut.eauxTracees.map(a => (Array.isArray(a) ? a : []).map(q => ({ x: Number(q[0]), z: Number(q[1]) })).filter(q => isFinite(q.x) && isFinite(q.z))).filter(a => a.length >= 3);
    EAU.aImporter = (d.v === 2 || d.anciens?.length) ? d : null;
    if (typeof d.reflets === "boolean") { $("eauReflets").checked = d.reflets; EAU.actif = d.reflets; }
    if (typeof d.decor === "boolean") { $("eauDecor").checked = d.decor; EAU.decor = d.decor; }
    if (isFinite(Number(d.vagues))) { $("eauVagues").value = d.vagues; majVagues(); }
  } catch (e) { EAU.aImporter = null; }
  EAU.siteImport = typeof dernier !== "undefined" ? dernier : null;   // on attend le NOUVEAU site pour recréer l'eau
  try { return await _appliquerOrig.apply(this, arguments); }
  catch (e) { EAU.aImporter = null; throw e; }   // fichier refusé : rien à recréer plus tard
};
// pour les bancs d'essai
EAU._api = { remplir, peindre, lisserPeint, nouveauCorps, toutConstruire, exporter, importer, balayer, viderCarte, sol, clicNiveau };
majTeintes();
})();
