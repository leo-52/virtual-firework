// PrevoFX Web — point d'entrée. Globe Cesium + couche de feux + démo pivoine.
// (Cesium est chargé en global via le <script> CDN dans index.html.)

// Imports DYNAMIQUES avec propagation du ?v=... (horodatage anti-cache d'index.html) : sinon
// le navigateur garderait l'ANCIEN threeFireworks.js en cache malgré un nouveau déploiement.
const _v = new URL(import.meta.url).search;   // ex "?v=1719..." (vide si chargé sans query)
const { ThreeFireworks, LABELS, __setMarronPop, LOOK } = await import('./render/threeFireworks.js' + _v);
const { FpsCameraController } = await import('./cameraController.js' + _v);
const { Timeline } = await import('./timeline.js' + _v);
const { PyroAudio } = await import('./audio.js' + _v);

// DÉCOR = Google Photorealistic 3D Tiles, mais VIA CESIUM ION (token gratuit), PAS la
// clé Google directe. Raison (vérifiée) : Google BLOQUE les 3D tiles en accès direct par
// clé pour les comptes européens (EEA) -> erreur 403. Cesium ion les relaie via son compte
// US -> ça passe en Europe. (C'est aussi pour ça que le décor d'Unreal, qui utilise la clé
// Google directe, ne charge pas correctement.)
// >>> Crée un token GRATUIT sur ion.cesium.com -> "Access Tokens", colle-le ci-dessous.
const ION_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2N2NlZDQxNS1iYTEyLTQ5NDctYWVlZS1jNTA3OTE4OTBlMzEiLCJpZCI6NDQ3MjU0LCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODIwNTgwMzV9.CmAwwB3X65ivEQbYxAtFg6uRNYnsk4Vp--3-LEn1enY';
const HAS_ION = ION_TOKEN && !ION_TOKEN.startsWith('METTRE'); // token ion renseigné ?

// Lieu de tir par défaut (sera choisi par le client). lat/lon fournis par l'user.
// height = altitude PROVISOIRE ; recalée sur le SOL RÉEL au chargement du terrain (cf plus bas).
const FIRE = { lon: 5.419384258257399, lat: 48.012806134659186, height: HAS_ION ? 350 : 0 };

if (HAS_ION) Cesium.Ion.defaultAccessToken = ION_TOKEN;

// ÉCLAIRAGE DU DÉCOR PAR LES FEUX (B381, objectif « comme FWsim ») — CustomShader Cesium sur les
// Google 3D Tiles. Les tuiles sont des photos de JOUR : on les ramène à une nuit bleutée (ambiance
// lune), puis on AJOUTE la lumière des sources du moteur de feux (étoiles de chaque bombe, flash de
// gueule des mortiers, traînées) : couleur réelle de la bombe, atténuation en 1/d², orientation des
// surfaces (normales calculées à l'écran). Les positions passent en repère CAMÉRA (précision float).
const GROUND_NL = 8;                     // nb de lumières simultanées (les plus fortes)
const _solQ = (/[?&]sol=([0-9.]+),?([0-9.]*)/.exec(location.search) || []);
const GROUND_K = _solQ[1] ? +_solQ[1] : 18.0;                   // lumière émise -> éclairement du sol (relectures à l aveugle : l éclairage ne se remarquait pas)
const GROUND_AMB = [0.007, 0.009, 0.016].map(v => v * (_solQ[2] ? +_solQ[2] : 1)); // ambiance nuit LINÉAIRE : décor quasi noir sans feux -> les feux deviennent LA lumière de la scène
function makeGroundShader(){
  const U = Cesium.UniformType, uniforms = { u_amb:{ type:U.VEC3, value:new Cesium.Cartesian3(...GROUND_AMB) } };
  let somme = '';
  for (let i=0;i<GROUND_NL;i++){
    uniforms['u_p'+i] = { type:U.VEC3, value:new Cesium.Cartesian3(0,0,0) };
    uniforms['u_c'+i] = { type:U.VEC3, value:new Cesium.Cartesian3(0,0,0) };
    somme += `L += fwLight(p, n, u_p${i}, u_c${i});\n`;
  }
  return new Cesium.CustomShader({
    lightingModel: Cesium.LightingModel.UNLIT, uniforms,
    fragmentShaderText: `
      vec3 fwLight(vec3 p, vec3 n, vec3 lp, vec3 lc){
        vec3 d = lp - p; float d2 = dot(d, d);
        float ndl = clamp(dot(n, d * inversesqrt(d2 + 1e-6)) * 0.7 + 0.3, 0.0, 1.0);   // « wrap » : pas d'arête dure sur les facettes
        return lc * (ndl / (d2 + 25.0));                                                  // 1/d², adouci sous 5 m
      }
      void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material){
        vec3 p = fsInput.attributes.positionEC;
        vec3 n = normalize(cross(dFdx(p), dFdy(p)));
        if (dot(n, -p) < 0.0) n = -n;
        vec3 L = u_amb;
        ${somme}
        material.diffuse *= L;
      }`
  });
}
const groundShader = (LOOK && LOOK.groundLight && HAS_ION) ? makeGroundShader() : null;
const _gW = new Cesium.Cartesian3(), _gE = new Cesium.Cartesian3();
function updateGroundLights(){
  if (!groundShader) return;
  const ls = layer.lights(GROUND_NL), vm = viewer.camera.viewMatrix;
  for (let i=0;i<GROUND_NL;i++){
    const l = ls[i];
    if (l){
      layer.sceneToWorld(l.x, l.y, l.z, _gW);
      Cesium.Matrix4.multiplyByPoint(vm, _gW, _gE);
      groundShader.setUniform('u_p'+i, Cesium.Cartesian3.clone(_gE));
      groundShader.setUniform('u_c'+i, new Cesium.Cartesian3(l.r*GROUND_K, l.g*GROUND_K, l.b*GROUND_K));
    } else groundShader.setUniform('u_c'+i, new Cesium.Cartesian3(0,0,0));
  }
}

// DÉCOR :
//  - SANS token (test immédiat) -> carte OpenStreetMap drapée sur le globe (GRATUIT, sans clé).
//  - AVEC un token ion -> Google Photorealistic 3D Tiles (photoréaliste).
const osmLayer = new Cesium.ImageryLayer(new Cesium.UrlTemplateImageryProvider({
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  maximumLevel: 19, credit: '© OpenStreetMap contributors'
}));
osmLayer.brightness = 0.28; // assombrit la carte OSM -> effet NUIT (pas une feuille blanche)

const viewer = new Cesium.Viewer('cesiumContainer', {
  baseLayer: HAS_ION ? false : osmLayer,
  animation: false, timeline: false, baseLayerPicker: false, geocoder: false,
  homeButton: false, sceneModePicker: false, navigationHelpButton: false,
  fullscreenButton: false, infoBox: false, selectionIndicator: false
});
viewer.scene.debugShowFramesPerSecond = false;
viewer.scene.globe.show = !HAS_ION;        // OSM sur le globe (sans ion) ; caché si Google 3D Tiles
viewer.scene.skyAtmosphere.show = false;   // pas de voile bleu : ciel sombre -> les feux ressortent
viewer.scene.globe.enableLighting = false; // décor à pleine luminosité (réalisme nuit -> plus tard)
// B381 : CIEL « HEURE BLEUE » (relectures à l'aveugle : le dégradé bleu profond est ce qui rend les
// images FWsim photographiques). Post-traitement Cesium : peint UNIQUEMENT les pixels sans décor
// (profondeur = fond), donc les collines masquent le ciel. Dégradé selon l'élévation du regard
// (horizon bleu, zénith presque noir) + étoiles clairsemées fixes dans le ciel. On masque le fond
// d'étoiles Cesium (grain sur toute l'image), le soleil et la lune (position = horloge réelle).
// OBJECTIF plus large (76° horizontal, ~47° vertical en 16:9) : l'HORIZON et le décor entrent dans
// le cadre, les bombes au-dessus — c'est le cadrage de FWsim. ?look=b379 -> ciel et objectif d'avant.
const _upW = new Cesium.Cartesian3();
// Teintes du ciel (?ciel=bleu par défaut | nuit | noir) — horizon, milieu, zénith
const _cielQ = (/[?&]ciel=(\w+)/.exec(location.search) || [])[1] || 'bleu';
const CIEL = ({
  bleu: [[0.070,0.105,0.215],[0.022,0.035,0.085],[0.006,0.009,0.024]],
  nuit: [[0.030,0.040,0.085],[0.010,0.014,0.034],[0.003,0.004,0.010]],
  noir: [[0.006,0.007,0.012],[0.002,0.002,0.004],[0.000,0.000,0.001]],
}[_cielQ] || [[0.070,0.105,0.215],[0.022,0.035,0.085],[0.006,0.009,0.024]]).map(c => new Cesium.Cartesian3(...c));
if (LOOK && !LOOK.old){
  viewer.scene.skyBox.show = false; viewer.scene.sun.show = false; viewer.scene.moon.show = false;
  viewer.camera.frustum.fov = Cesium.Math.toRadians(76);
  Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(Cesium.Cartesian3.fromDegrees(FIRE.lon, FIRE.lat, 0), _upW);   // « haut » local du site
  viewer.scene.postProcessStages.add(new Cesium.PostProcessStage({
    name: 'prevofx_ciel',
    uniforms: {   // rayon de chaque pixel reconstruit à partir de la caméra (repère monde)
      u_upW: () => _upW,
      u_fwd: () => viewer.camera.directionWC,
      u_right: () => viewer.camera.rightWC,
      u_camUp: () => viewer.camera.upWC,
      u_tan: () => { const f = viewer.camera.frustum, ty = Math.tan(f.fovy / 2); return new Cesium.Cartesian2(ty * f.aspectRatio, ty); },
      u_t: () => performance.now() / 1000,
      u_hor: CIEL[0], u_mid: CIEL[1], u_zen: CIEL[2],
    },
    fragmentShader: `
      uniform sampler2D colorTexture;
      uniform sampler2D depthTexture;
      uniform vec3 u_upW, u_fwd, u_right, u_camUp;
      uniform vec2 u_tan;
      uniform vec3 u_hor, u_mid, u_zen;
      uniform float u_t;
      in vec2 v_textureCoordinates;
      float h1(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main(){
        vec4 col = texture(colorTexture, v_textureCoordinates);
        float depth = czm_readDepth(depthTexture, v_textureCoordinates);
        if (depth < 1.0) { out_FragColor = col; return; }          // du décor : on n'y touche pas
        vec2 nd = v_textureCoordinates * 2.0 - 1.0;
        vec3 dW = normalize(u_fwd + nd.x * u_tan.x * u_right + nd.y * u_tan.y * u_camUp);   // rayon du pixel (monde)
        float el = dot(dW, normalize(u_upW));                        // sinus de l'élévation du regard
        vec3 hor = u_hor, mid = u_mid, zen = u_zen;
        float a = clamp(el, 0.0, 1.0);
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, a));
        c = mix(c, zen, smoothstep(0.18, 0.75, a));
        vec3 q = dW * 760.0, g = floor(q); float r = h1(g);
        if (r > 0.99945){
          vec3 f = fract(q) - 0.5; float s = exp(-dot(f, f) * 16.0);
          float mag = pow(h1(g + 7.1), 4.0);
          float tw = 0.85 + 0.15 * sin(u_t * (1.5 + 3.0 * h1(g + 3.3)) + 6.28 * r);
          c += vec3(0.80, 0.86, 1.0) * s * (0.10 + 0.90 * mag) * 0.55 * tw * smoothstep(0.06, 0.25, a);
        }
        out_FragColor = vec4(col.rgb + c, 1.0);
      }`
  }));
}

// Terrain photoréaliste (Google 3D Tiles via Cesium ion) — uniquement si token ion.
if (HAS_ION) {
  (async () => {
    try {
      const tileset = await Cesium.createGooglePhotorealistic3DTileset();
      viewer.scene.primitives.add(tileset);
      // AMBIANCE NUIT : assombrit le terrain. + ALLÈGE la charge (anti-freeze) : tuiles plus
      // grossières (mSSE haut) = bien moins de tuiles à charger/afficher, et moins de 503.
      // B381 : la NUIT et la LUMIÈRE DES FEUX sont faites par un shader sur les tuiles (le décor
      // s'éclaire là où tirent les bombes). ?look=b379 ou ?sol=0 -> l'ancien assombrissement uniforme.
      if (groundShader) tileset.customShader = groundShader;
      else tileset.style = new Cesium.Cesium3DTileStyle({ color: "color('#4f4f5e')" });
      tileset.maximumScreenSpaceError = 24;     // (défaut 16) -> beaucoup moins de tuiles
      tileset.cacheBytes = 256 * 1024 * 1024;   // cache plus petit -> moins de mémoire
      // CALER LE SOL de façon ROBUSTE (sinon la vue par défaut marchait "pas tout le temps") :
      // on échantillonne une GRILLE de 9 points (±15 m) autour du tir et on prend la MÉDIANE
      // (ignore les artefacts de tuiles), avec RETRY jusqu'à une médiane STABLE. Tant que le sol
      // n'est pas calé, la caméra reste haute -> énorme zone -> FIGE.
      const base = Cesium.Cartographic.fromDegrees(FIRE.lon, FIRE.lat);
      const mLat = 15/111320, mLon = 15/(111320*Math.cos(FIRE.lat*Math.PI/180));
      const gridPts = [];
      for (let gx=-1; gx<=1; gx++) for (let gy=-1; gy<=1; gy++)
        gridPts.push(Cesium.Cartographic.fromRadians(base.longitude+gx*mLon, base.latitude+gy*mLat));
      let lastMed = null, stable = 0;
      for (let attempt = 0; attempt < 16 && stable < 2; attempt++){
        await new Promise(res => setTimeout(res, 700));   // laisser des tuiles charger
        if (cam.userMoved && lastMed !== null) break;      // l'user a pris la main APRÈS un calage -> on ne recale plus
        try {
          const r = await viewer.scene.sampleHeightMostDetailed(gridPts.map(p => Cesium.Cartographic.clone(p)));
          const hs = r.map(c => c.height).filter(h => Number.isFinite(h) && h > -500 && h < 6000).sort((a,b)=>a-b);
          if (hs.length >= 5){
            const med = hs[Math.floor(hs.length/2)];
            stable = (lastMed !== null && Math.abs(med - lastMed) < 2) ? stable+1 : 0;
            lastMed = med;
            FIRE.height = med;
            layer.setOrigin({ lon: FIRE.lon, lat: FIRE.lat, height: med });
            cam.setFromLocal(CAM_LOCAL, CAM_TARGET);   // caméra recalée AU RAS DU SOL (vue public)
          }
        } catch (e2) { /* tuiles pas prêtes -> on réessaie */ }
      }
    } catch (e) {
      console.warn('[PrevoFX] Google 3D Tiles via ion indisponible — feux sans décor.', e);
    }
  })();
}

// Le bloom des feux est désormais géré par l'OVERLAY Three.js (UnrealBloomPass), pas par
// Cesium. On coupe le bloom Cesium (il ne servait qu'aux anciens billboards).
viewer.scene.postProcessStages.bloom.enabled = false;

// Overlay de feux Three.js (canvas transparent "screen" par-dessus le décor), ancré au tir.
const layer = new ThreeFireworks(viewer, FIRE);

// Caméra "public" (spectateur FPS) : hauteur d'homme, 150 m, dans l'axe de tir.
// Contrôles : QZSD (déplacement), clic gauche + glisser (rotation), pas de molette, sol dur.
const cam = new FpsCameraController(viewer, layer);
const CAM_LOCAL = [0, -150, 1.75];   // 150 m derrière (axe de tir), hauteur d'homme
// vise vers le burst (apex ~90 m). B381 : avec l'objectif 85°, on vise un peu plus bas (48 m) -> regard
// ~+16°, l horizon tombe à ~1/6 du bas de l image, une 75 mm entière dans le cadre.
const CAM_TARGET = (LOOK && !LOOK.old) ? [0, 0, 46] : [0, 0, 60];
cam.setFromLocal(CAM_LOCAL, CAM_TARGET);

// DÉMO : l'effet choisi tourne EN BOUCLE (focus). Sélecteur d'effet en haut à droite pour réviser.
const pick = document.createElement('select');
Object.assign(pick.style, { position:'fixed', top:'10px', right:'10px', zIndex:'10',
  background:'rgba(0,0,0,.55)', color:'#fff', border:'1px solid #555', borderRadius:'6px',
  padding:'6px 8px', fontFamily:'system-ui, sans-serif', fontSize:'13px' });
for (const [k, label] of Object.entries(LABELS)){
  const o = document.createElement('option'); o.value = k; o.textContent = label; pick.appendChild(o);
}
pick.value = 'ch30potk';
// changer d'effet dans le menu -> couleur PAR DÉFAUT de l'effet (null annule l'override de la démo)
pick.addEventListener('change', e => layer.setFocus(e.target.value, null));
// CATALOGUE PRÉVOT (B391, user : « tout le catalogue ») : champ de recherche (référence ou mots de
// la désignation) sous le sélecteur d'effets ; la référence choisie est traduite par
// src/render/catalogue.js et jouée en boucle (bombe seule ou séquence complète).
(async () => {
  try {
    const { effetPour } = await import('./render/catalogue.js' + _v);
    const refs = await (await fetch(new URL('../data/effets.json', import.meta.url))).json();
    const HORS = new Set(['accessoires','FORMATION','fil','montage','service','allumeurs','composant de chaînes pyrotechniques','batteries de mortiers et mortiers','scene','lampions','']);
    const utiles = refs.filter(e => !HORS.has(e.type));
    const plat = s => String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
    const box = document.createElement('div');
    Object.assign(box.style, { position:'fixed', top:'94px', right:'10px', zIndex:'10', width:'min(360px, 80vw)', fontFamily:'system-ui, sans-serif', fontSize:'13px' });
    const inp = document.createElement('input'); inp.placeholder = 'Catalogue Prévot : réf. ou mots (ex. 575116000, saule or pointes)';
    Object.assign(inp.style, { width:'100%', boxSizing:'border-box', background:'rgba(0,0,0,.55)', color:'#fff', border:'1px solid #555', borderRadius:'6px', padding:'6px 8px' });
    const list = document.createElement('div');
    Object.assign(list.style, { display:'none', maxHeight:'46vh', overflowY:'auto', background:'rgba(0,0,0,.8)', border:'1px solid #555', borderRadius:'6px', marginTop:'4px' });
    const info = document.createElement('div'); Object.assign(info.style, { color:'#ffd27a', marginTop:'4px', textShadow:'0 1px 2px #000', fontSize:'12px' });
    box.append(inp, list, info); document.body.appendChild(box);
    const jouer = e => {
      const r = effetPour(e.designation, e.calibre, { hauteur_m:e.hauteur_m, duree_s:e.duree_s });
      if (layer.setCatalogue(r)){ pick.value = ''; info.textContent = e.reference + ' · ' + e.designation + '  →  ' + r.type + ' (' + (r.arch||'—') + ')'; }
      list.style.display = 'none';
    };
    inp.addEventListener('input', () => {
      const q = plat(inp.value).trim(); list.innerHTML = ''; if (q.length < 2){ list.style.display='none'; return; }
      const mots = q.split(/\s+/), hits = utiles.filter(e => { const d = plat(e.reference + ' ' + e.designation); return mots.every(m => d.includes(m)); }).slice(0, 40);
      for (const e of hits){ const o = document.createElement('div'); o.textContent = e.reference + ' — ' + e.designation;
        Object.assign(o.style, { padding:'4px 8px', cursor:'pointer', borderBottom:'1px solid #333', color:'#eee' });
        o.addEventListener('mouseenter', () => o.style.background='#333'); o.addEventListener('mouseleave', () => o.style.background='');
        o.addEventListener('click', () => jouer(e)); list.appendChild(o); }
      list.style.display = hits.length ? 'block' : 'none';
    });
    inp.addEventListener('keydown', ev => { if (ev.key === 'Enter' && list.firstChild) list.firstChild.click(); });
    pick.addEventListener('change', () => { info.textContent = ''; });
    // console : PrevoFX.catalogue('575116000') ou PrevoFX.catalogue('saule or pointes')
    if (window.PrevoFX) window.PrevoFX.catalogue = (q) => { const e = utiles.find(x => String(x.reference)===String(q)) || utiles.find(x => plat(x.designation).includes(plat(q))); if (e) jouer(e); return e; };
  } catch (e) { console.warn('[PrevoFX] catalogue indisponible', e); }
})();
document.body.appendChild(pick);

// DÉMO (réglage en cours) : CHANDELLE 30 mm 8 TIRS POT À FEU + COMÈTE TRAÇANTE (réfs 501314000
// & co, B376) : la sœur de la queue de cheval — à chaque coup, une gerbe au sol de la couleur de
// la référence et une comète traçante qui monte, mais SANS pointe à l'arrivée.
// B379 : démo -> la version KAMURO (501315000) — dépôt or persistant, rideau qui s'éteint par le bas.
layer.setFocus('ch30potk');

// TIMELINE de lecture (barre en bas) + ESPACE = pause/play (fige les feux, caméra libre).
const timeline = new Timeline(layer, LABELS);

// SON pyro synthétisé (1er clic/touche active l'audio). Crépitement œuf de dragon + BOOMS des
// marrons d'air (B154). (Web Audio, 100% synthétisé — aucun fichier/licence.)
const audio = new PyroAudio();
// BOUTON SON (B169, user) : active/désactive — et DÉBLOQUE l'audio au clic (geste explicite,
// plus fiable que d'attendre un clic quelconque, surtout sur téléphone).
const sndBtn = document.createElement('button');
Object.assign(sndBtn.style, { position:'fixed', top:'52px', right:'10px', zIndex:'10',
  background:'rgba(0,0,0,.55)', color:'#fff', border:'1px solid #555', borderRadius:'6px',
  padding:'6px 10px', fontFamily:'system-ui, sans-serif', fontSize:'13px', cursor:'pointer' });
// B259 (user : « le bouton son bug ») : l'ancien label dépendait de l'état du ctx (asynchrone),
// et le pointerdown GLOBAL débloquait l'audio juste avant le clic -> le 1er appui sur le bouton
// COUPAIT le son au lieu de l'activer. Désormais : le son est ON par défaut (il démarre au 1er
// geste, politique navigateur), le bouton ne fait que BASCULER enabled, le label suit enabled.
function updateSndBtn(){ sndBtn.textContent = audio.enabled ? '🔊 Son ON' : '🔇 Son OFF'; }
sndBtn.addEventListener('click', () => {
  audio.unlock();
  audio.enabled = !audio.enabled;
  updateSndBtn();
});
document.body.appendChild(sndBtn);
updateSndBtn();

layer.onLaunch = (arch, cal, dist) => {                          // B254 : DÉPART calibré. B256 : atténué/retardé par la DISTANCE caméra
  if (arch === 'candle10' || arch === 'candle10egg') audio.candle(dist);   // B356 (user) : une chandelle 10 mm fait un POUF sourd, pas le départ d'une 75 mm
  else audio.launch(cal, dist);
};
layer.onBurst = (arch, cal, dist) => {
  if (arch === 'dragonEgg') audio.dragonEgg(cal, dist);
  else if (arch === 'crackling') audio.crackling(cal, dist);     // B255 : texture étalée (chaque étoile crépite)
  else if (arch === 'salute') audio.marron(0.03, dist, cal);     // marron simple : boom quasi immédiat, calibré
  else if (arch === 'saluteMulti') audio.breakOpen(40, dist);    // revue B254 : petit pop d'ouverture — les 5 BOOMS des marrons portent le son
  else if (arch === 'spinner') audio.hibou(0, dist);             // B254 : tourbillon = hululement (réf « Hibou » de l'user)
  else if (arch === 'tourbBomb') {}                              // B338 (user) : quasi SILENCIEUX (« pétard mouillé ») — pas de break
  else if (arch === 'candle10') {}                               // B355 (user) : chandelle — « pas de déto ni de flash à la fin », l'étoile s'éteint, c'est tout
  else if (arch === 'candle10egg') audio.candleEgg(dist);        // B360 : la bille claque au sommet — crépitement discret, PAS le break d'une 75 mm (bug : elle tombait dans le cas par défaut)
  else if (arch === 'candle30') {}                               // B368 : la comète traçante s'éteint sans bruit
  else if (arch === 'candle30k') {}                              // B379 : kamuro — aucun break mesuré sur la vidéo, le rideau s'éteint en silence
  else if (arch === 'candle30qc') audio.candleTip(dist);         // B369 (user) : « elle éclate mais d'un bruit sourd, presque comme une botte de chandelle à la sortie du tube »
  else if (arch === 'd8'){ audio.breakOpen(cal, dist);           // B262 : D8 = break, puis les étoiles finissent en ŒUF DE DRAGON
    audio.crackle(cal, dist, 4.1); audio.crackle(cal, dist, 4.75, 0.7); }   //        B266 : crépitement visuel ~4,0-5,2 s -> 2 couches calées dessus + trajet
  else audio.breakOpen(cal, dist);                               // = « Bombe 75mm.mp3 »
};
// MULTI marron d'air : le BOOM part PILE au moment où chaque mini marron détone (hook moteur,
// plus fiable que des délais programmés — timing 1,0→3,0 s géré par behaveMarron).
__setMarronPop((x, y, z) => audio.marron(0, layer.distTo(x, y, z), 40, 0.7));   // B256 : chaque détonation à SA distance ; B263 : MINI-marrons du multi = plus petits (cal 40, ×0.7)

// BOUCLE DE RENDU UNIQUE — on PREND LA MAIN sur Cesium (sinon il s'endort quand la scène
// est stable et tout se fige). On pilote nous-mêmes : sim -> décor Cesium -> overlay feux.
viewer.useDefaultRenderLoop = false;        // Cesium ne gère plus sa propre boucle
viewer.scene.requestRenderMode = false;     // (au cas où) pas de rendu "à la demande"
let last = performance.now();
function frame(){
  requestAnimationFrame(frame);
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  try {
    cam.update(dt);                          // caméra TOUJOURS active (même en pause → inspecter)
    layer.update(timeline.paused ? 0 : dt);  // sim des feux FIGÉE en pause (artifices suspendus)
    timeline.update(dt);                     // barre/horloge (n'avance que si lecture)
    updateGroundLights();                    // B381 : les feux éclairent le décor
    viewer.scene.render();                   // décor Cesium
    layer.render();                          // overlay feux (caméra synchronisée, par-dessus)
  } catch (e) { console.warn('[PrevoFX] frame error (loop continue)', e); }
}
requestAnimationFrame(frame);

// debug console : PrevoFX.focus('willow') change l'effet joué en boucle ; PrevoFX.fire('peony') tire une fois.
window.PrevoFX = { viewer, layer, cam, timeline, audio, fire: (a) => layer.fire(a), focus: (a) => layer.setFocus(a),
  groundShader, updateGroundLights };
