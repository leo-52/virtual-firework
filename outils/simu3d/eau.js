// ── SURFACE D'EAU (v144) ─────────────────────────────────────────────────────
// Eau « vivante » sur les lacs, rivières, étangs et piscines (BD TOPO, OpenStreetMap) et sur
// les surfaces tracées à la main, avec les REFLETS DES FEUX qui tremblent sur les vagues.
//  - Scène : une nappe d'eau d'AFFICHAGE est posée sur chaque plan d'eau du site (les objets
//    du site ne sont pas modifiés : les exports FWsim et Finale ne changent pas). Vagues
//    animées, reflet du ciel selon l'angle (Fresnel), plus sombre de nuit.
//  - Feux : dans le calque des feux, les feux sont rendus une 2e fois vus EN MIROIR sous le
//    niveau de l'eau ; ce reflet est plaqué sur l'eau, déformé par les vagues et étiré à la
//    verticale (colonnes de lumière qui tremblent), dosé par Fresnel (eau vue de loin, presque
//    rasante : ~15 à 60 % de la lumière renvoyée — docs/physique PrevoFX).
//  - Tracer : « Tracer une surface d'eau » -> toucher les coins sur le terrain -> « Terminer ».
//    Les surfaces tracées sont gardées dans le fichier du site (site.zip) et hors export.
(function () {
"use strict";
const EAU = { actif: true, vagues: 0.35, trace: null, tracees: [], aImporter: null, site: null,
              surfaces: [], t0: performance.now(), rt: null, reflCam: null, matRefl: null, provisoire: null };
window._eau = EAU;

// Vagues : somme de quelques trains d'ondes qui avancent (gradient analytique -> normale).
const VAGUES_GLSL = `
uniform float uT, uV;
vec2 pente(vec2 p){
  vec2 g = vec2(0.0);
  g += vec2( 0.80, 0.60) * cos(dot(p, vec2( 0.80, 0.60)) * 0.55 + uT * 1.05) * 1.00;
  g += vec2(-0.50, 0.86) * cos(dot(p, vec2(-0.50, 0.86)) * 1.10 + uT * 1.55) * 0.55;
  g += vec2( 0.96,-0.28) * cos(dot(p, vec2( 0.96,-0.28)) * 2.30 + uT * 2.25) * 0.30;
  g += vec2( 0.18, 0.98) * cos(dot(p, vec2( 0.18, 0.98)) * 4.70 + uT * 3.20) * 0.16;
  g += vec2(-0.85,-0.53) * cos(dot(p, vec2(-0.85,-0.53)) * 8.90 + uT * 4.60) * 0.08;
  return g;
}
vec3 normaleEau(vec3 w){ vec2 g = pente(w.xz) * (0.04 + 0.30 * uV); return normalize(vec3(-g.x, 1.0, -g.y)); }
float fresnel(vec3 N, vec3 V){ float c = clamp(dot(N, V), 0.0, 1.0); return 0.02 + 0.98 * pow(1.0 - c, 5.0); }
`;
const VS_EAU = `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;

// 1. Eau de la SCÈNE (couleur, ciel reflété, transparence légère)
const matScene = new THREE.ShaderMaterial({
  uniforms: { uT: { value: 0 }, uV: { value: EAU.vagues }, uFond: { value: new THREE.Color() }, uCielH: { value: new THREE.Color() }, uCielZ: { value: new THREE.Color() } },
  vertexShader: VS_EAU,
  fragmentShader: VAGUES_GLSL + `
uniform vec3 uFond, uCielH, uCielZ; varying vec3 vW;
void main(){
  vec3 V = normalize(cameraPosition - vW), N = normaleEau(vW);
  float F = fresnel(N, V);
  vec3 R = reflect(-V, N);
  vec3 ciel = mix(uCielH, uCielZ, sqrt(clamp(R.y, 0.0, 1.0)));
  vec3 c = mix(uFond, ciel, F);
  gl_FragColor = vec4(c, mix(0.80, 0.96, F));
}`,
  transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
function majTeintes() {
  const j = typeof _jour === "number" ? _jour : 0.15, k = Math.min(1, Math.max(0, (j - 0.03) / 0.5));
  const L = (a, b) => new THREE.Color(a).lerp(new THREE.Color(b), k);
  matScene.uniforms.uFond.value.copy(L(0x020608, 0x1b3a46));
  matScene.uniforms.uCielH.value.copy(L(0x0b1220, 0x9fb2c2));
  matScene.uniforms.uCielZ.value.copy(L(0x020409, 0x5d7fa8));
}

// 2. Reflet des FEUX (calque des feux)
function matReflet() {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uV: { value: EAU.vagues }, uRefl: { value: null }, uVP: { value: new THREE.Matrix4() } },
    vertexShader: VS_EAU,
    fragmentShader: VAGUES_GLSL + `
uniform sampler2D uRefl; uniform mat4 uVP; varying vec3 vW;
void main(){
  vec3 V = normalize(cameraPosition - vW), N = normaleEau(vW);
  float F = fresnel(N, V);
  vec4 c = uVP * vec4(vW, 1.0); vec2 uv = c.xy / c.w * 0.5 + 0.5;
  vec2 d = vec2(N.x * 0.012, N.z * 0.045) * (0.15 + uV);            // vagues : déformation, plus forte à la verticale
  float L = 0.0015 + 0.030 * uV * uV + 0.006 * uV;                    // longueur des colonnes de reflet (eau ridée = traînées)
  vec3 s = vec3(0.0); float ws = 0.0;
  float o = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;   // tramage : pas de copies en escalier
  for (int i = -6; i <= 6; i++){
    float fi = (float(i) + o) / 6.0, w = exp(-fi * fi * 2.2);
    s += texture2D(uRefl, uv + d + vec2(0.0, fi * L)).rgb * w; ws += w;
  }
  s /= ws;
  // morcellement : seules les facettes bien tournées renvoient la lumière (bandes qui scintillent),
  // effacé au loin où les rides deviennent plus fines qu'un pixel
  float ph = vW.z * 1.7 + 2.6 * sin(vW.x * 0.31 + uT * 0.6) + uT * 2.1;
  float aa = 1.0 - smoothstep(0.6, 2.2, fwidth(ph));
  float m = smoothstep(-0.35, 0.75, sin(ph) + 0.6 * sin(ph * 2.3 + vW.x * 0.9 - uT * 1.3));
  float casse = mix(1.0, 0.30 + 1.25 * m, smoothstep(0.12, 0.55, uV) * aa);
  float k = clamp(F * 0.85 + 0.03, 0.0, 0.7);   // le reflet repasse dans la lueur du calque : dosé un peu sous Fresnel
  gl_FragColor = vec4(s * k * casse, 1.0);
}`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
}

// 3. Les surfaces : celles du site (exp.nom « eau ») + les tracées
function niveauDe(geo, M) {
  const p = geo.attributes.position, v = new THREE.Vector3(), ys = [], bb = new THREE.Box3();
  for (let i = 0; i < p.count; i += Math.max(1, Math.floor(p.count / 400))) { v.fromBufferAttribute(p, i).applyMatrix4(M); ys.push(v.y); bb.expandByPoint(v); }
  ys.sort((a, b) => a - b);
  return { y: ys.length ? ys[Math.floor(ys.length / 2)] : 0, bb };
}
function ajouterSurface(geo, M, src) {
  const Mo = new THREE.Matrix4().makeTranslation(0, 0.04, 0).multiply(M);
  const m = new THREE.Mesh(geo, matScene);
  m.matrixAutoUpdate = false; m.matrix.copy(Mo); m.matrixWorld.copy(Mo);
  m.userData.interface = true; m.userData.eauAffichage = true; m.renderOrder = 2; m.frustumCulled = false;
  m.onBeforeRender = () => { matScene.uniforms.uT.value = (performance.now() - EAU.t0) / 1000; };
  m.visible = EAU.actif;
  scene.add(m);
  const n = niveauDe(geo, M);
  const S = { src, geo, M: Mo, mesh: m, ov: null, y: n.y + 0.04, bb: n.bb };
  EAU.surfaces.push(S);
  return S;
}
function retirerSurface(S) {
  scene.remove(S.mesh);
  if (S.ov && S.ov.parent) S.ov.parent.remove(S.ov);
  if (!S.src) S.geo.dispose();
}
function balayer() {
  // nouveau site : on repart de zéro (les tracées de l'ancien site partent, sauf à importer)
  if (typeof dernier !== "undefined" && dernier !== EAU.site) {
    EAU.site = dernier;
    for (const S of EAU.surfaces.filter(S => !S.src)) retirerSurface(S);
    EAU.surfaces = EAU.surfaces.filter(S => S.src);
    EAU.tracees = [];
  }
  for (const S of EAU.surfaces.filter(S => S.src && S.src.parent !== monde)) retirerSurface(S);
  EAU.surfaces = EAU.surfaces.filter(S => !S.src || S.src.parent === monde);
  const deja = new Set(EAU.surfaces.map(S => S.src).filter(Boolean));
  for (const o of monde.children) {
    if (!o.isMesh || o.userData?.exp?.nom !== "eau" || deja.has(o) || !o.geometry?.attributes?.position) continue;
    o.updateMatrixWorld(true);
    ajouterSurface(o.geometry, o.matrixWorld.clone(), o);
  }
  if (EAU.aImporter && typeof _dernierSolEn === "function" && dernier && dernier !== EAU.siteImport) {
    const liste = EAU.aImporter; EAU.aImporter = null;
    for (const anneau of liste) creerTracee(anneau);
  }
  majTeintes();
}
setInterval(() => { try { balayer(); } catch (e) { console.warn("[eau]", e); } }, 1500);

// 4. Rendu du reflet des feux, juste avant le rendu du calque des feux
const _rendreFeuOrig = window._feuRendre;
function niveauReflet() {
  const p = PFX.scene.position; let best = null, d = Infinity;
  for (const S of EAU.surfaces) {
    const c = S.bb.getCenter(new THREE.Vector3()), dd = Math.hypot(c.x - p.x, c.z - p.z);
    if (dd < d) { d = dd; best = S; }
  }
  return best ? best.y : null;
}
window._feuRendre = function () {
  try {
    if (EAU.actif && EAU.surfaces.length && _rendFeu.r) {
      const r = _rendFeu.r, sc = _rendFeu.scene;
      if (!EAU.matRefl) EAU.matRefl = matReflet();
      const W = r.domElement.width, H = r.domElement.height;
      if (!EAU.rt || EAU.rt.width !== Math.round(W / 2) || EAU.rt.height !== Math.round(H / 2)) {
        if (EAU.rt) EAU.rt.dispose();
        EAU.rt = new THREE.WebGLRenderTarget(Math.round(W / 2), Math.round(H / 2), { type: THREE.HalfFloatType });
      }
      const h = niveauReflet();
      for (const S of EAU.surfaces) {
        if (!S.ov) { S.ov = new THREE.Mesh(S.geo, EAU.matRefl); S.ov.matrixAutoUpdate = false; S.ov.matrix.copy(S.M); S.ov.matrixWorld.copy(S.M); S.ov.frustumCulled = false; }
        if (S.ov.parent !== sc) sc.add(S.ov);
        S.ov.visible = h !== null && Math.abs(S.y - h) < 3;   // une surface à un autre niveau ne prend pas ce miroir
      }
      if (h !== null) {
        // caméra miroir : symétrie par rapport au plan y = h
        if (!EAU.reflCam) { EAU.reflCam = new THREE.PerspectiveCamera(); EAU.reflCam.matrixAutoUpdate = false; EAU.reflCam.matrixWorldAutoUpdate = false; }
        const C = EAU.reflCam, Rm = new THREE.Matrix4().set(1, 0, 0, 0, 0, -1, 0, 2 * h, 0, 0, 1, 0, 0, 0, 0, 1);
        camera.updateMatrixWorld();
        C.matrixWorld.multiplyMatrices(Rm, camera.matrixWorld); C.matrixWorldInverse.copy(C.matrixWorld).invert();
        C.projectionMatrix.copy(camera.projectionMatrix); C.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
        for (const S of EAU.surfaces) if (S.ov) S.ov.userData._vis = S.ov.visible, S.ov.visible = false;
        const avant = r.getRenderTarget();
        r.setRenderTarget(EAU.rt); r.setClearColor(0x000000, 1); r.clear(); r.render(sc, C); r.setRenderTarget(avant);
        for (const S of EAU.surfaces) if (S.ov) S.ov.visible = S.ov.userData._vis;
        const U = EAU.matRefl.uniforms;
        U.uRefl.value = EAU.rt.texture; U.uVP.value.multiplyMatrices(C.projectionMatrix, C.matrixWorldInverse);
        U.uT.value = (performance.now() - EAU.t0) / 1000; U.uV.value = EAU.vagues;
      }
    } else if (EAU.surfaces.length) {
      for (const S of EAU.surfaces) if (S.ov) S.ov.visible = false;
    }
  } catch (e) { console.warn("[eau] reflet", e); }
  return _rendreFeuOrig();
};

// 5. Tracer une surface d'eau
function creerTracee(anneau) {
  if (!anneau || anneau.length < 3) return null;
  const sol = solAfficheOu(typeof _dernierSolEn === "function" ? _dernierSolEn : (() => 0));
  const ferme = anneau.map(q => ({ x: q.x, z: q.z }));
  const geo = draperPolygone([ferme], sol, 0.12);
  if (!geo) return null;
  EAU.tracees.push(ferme);
  return ajouterSurface(geo, new THREE.Matrix4(), null);
}
function finirTrace() {
  if (!EAU.trace) return;
  const t = EAU.trace; EAU.trace = null;
  if (EAU.provisoire) { scene.remove(EAU.provisoire); EAU.provisoire = null; }
  vue.classList.remove("trace"); $("consigne").style.display = "none"; $("terminerEau").style.display = "none";
  $("consigne").textContent = _consigneAvant;
  if (t.length < 3) { dire("Surface d'eau annulée : il faut au moins 3 coins.", "err"); return; }
  const S = creerTracee(t);
  if (S) { majTeintes(); _vueSale = true; dire(`Surface d'eau ajoutée (${EAU.tracees.length} tracée(s)). Elle reflète les feux pendant le tir.`, "ok"); }
}
let _consigneAvant = "";
$("eauTracer").addEventListener("click", () => {
  if (bloqueParChargement()) return;
  if (!dernier) { dire("Charge d'abord un site.", "err"); return; }
  if (typeof _tracePublic !== "undefined" && _tracePublic) return;
  EAU.trace = [];
  _consigneAvant = $("consigne").textContent;
  $("consigne").textContent = "Touche les coins de la surface d'eau sur le terrain, puis « Terminer l'eau ».";
  vue.classList.add("trace"); $("consigne").style.display = "block"; $("terminerEau").style.display = "block";
  $("panneau").classList.add("replie");
});
$("terminerEau").addEventListener("click", finirTrace);
let _px = 0, _py = 0;
renderer.domElement.addEventListener("pointerdown", e => { _px = e.clientX; _py = e.clientY; });
renderer.domElement.addEventListener("click", e => {
  if (!EAU.trace || Math.hypot(e.clientX - _px, e.clientY - _py) > 4) return;
  const q = pointSousSouris(e); if (!q) return;
  EAU.trace.push(q);
  const sol = typeof _dernierSolEn === "function" ? _dernierSolEn : (() => 0);
  const pts = [...EAU.trace, EAU.trace[0]].map(p => new THREE.Vector3(p.x, sol(p.x, p.z) + 0.6, p.z));
  if (EAU.provisoire) scene.remove(EAU.provisoire);
  EAU.provisoire = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x5fc8ff }));
  EAU.provisoire.userData.interface = true; scene.add(EAU.provisoire); _vueSale = true;
});
renderer.domElement.addEventListener("dblclick", () => { if (EAU.trace) finirTrace(); });
$("eauEffacer").addEventListener("click", () => {
  for (const S of EAU.surfaces.filter(S => !S.src)) retirerSurface(S);
  EAU.surfaces = EAU.surfaces.filter(S => S.src); EAU.tracees = []; _vueSale = true;
  dire("Surfaces d'eau tracées effacées (les plans d'eau du site restent).", "ok");
});
$("eauReflets").addEventListener("change", () => {
  EAU.actif = $("eauReflets").checked;
  for (const S of EAU.surfaces) S.mesh.visible = EAU.actif;
  _vueSale = true;
});
const NOMS_VAGUES = [[0.1, "miroir"], [0.3, "calme"], [0.55, "ridée"], [0.8, "agitée"], [1.01, "forte houle"]];
function majVagues() {
  EAU.vagues = Number($("eauVagues").value);
  matScene.uniforms.uV.value = EAU.vagues;
  $("eauVaguesTxt").textContent = NOMS_VAGUES.find(([s]) => EAU.vagues < s)[1];
  _vueSale = true;
}
$("eauVagues").addEventListener("input", majVagues); majVagues();

// 6. Fichier du site : les surfaces tracées sont gardées
const _etatSiteOrig = etatSite;
etatSite = function () { const e = _etatSiteOrig.apply(this, arguments);
  e.eauxTracees = EAU.tracees.map(a => a.map(q => [+q.x.toFixed(2), +q.z.toFixed(2)]));
  e.eau = { reflets: EAU.actif, vagues: EAU.vagues }; return e; };
const _appliquerOrig = appliquerEtatSite;
appliquerEtatSite = async function (brut, paquet) {
  try {
    const l = Array.isArray(brut?.eauxTracees) ? brut.eauxTracees : [];
    EAU.aImporter = l.map(a => (Array.isArray(a) ? a : []).map(q => ({ x: Number(q[0]), z: Number(q[1]) })).filter(q => isFinite(q.x) && isFinite(q.z))).filter(a => a.length >= 3);
    if (brut?.eau) { if (typeof brut.eau.reflets === "boolean") { $("eauReflets").checked = brut.eau.reflets; EAU.actif = brut.eau.reflets; }
                     if (isFinite(Number(brut.eau.vagues))) { $("eauVagues").value = brut.eau.vagues; majVagues(); } }
  } catch (e) { EAU.aImporter = null; }
  EAU.siteImport = typeof dernier !== "undefined" ? dernier : null;   // on attend le NOUVEAU site pour recréer les surfaces tracées
  try { return await _appliquerOrig.apply(this, arguments); }
  catch (e) { EAU.aImporter = null; throw e; }   // fichier refusé : rien à recréer plus tard
};
majTeintes();
})();
