// PrevoFX Web — point d'entrée. Globe Cesium + couche de feux + démo pivoine.
// (Cesium est chargé en global via le <script> CDN dans index.html.)

// Imports DYNAMIQUES avec propagation du ?v=... (horodatage anti-cache d'index.html) : sinon
// le navigateur garderait l'ANCIEN threeFireworks.js en cache malgré un nouveau déploiement.
const _v = new URL(import.meta.url).search;   // ex "?v=1719..." (vide si chargé sans query)
const { ThreeFireworks, LABELS, __setMarronPop } = await import('./render/threeFireworks.js' + _v);
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

// Terrain photoréaliste (Google 3D Tiles via Cesium ion) — uniquement si token ion.
if (HAS_ION) {
  (async () => {
    try {
      const tileset = await Cesium.createGooglePhotorealistic3DTileset();
      viewer.scene.primitives.add(tileset);
      // AMBIANCE NUIT : assombrit le terrain. + ALLÈGE la charge (anti-freeze) : tuiles plus
      // grossières (mSSE haut) = bien moins de tuiles à charger/afficher, et moins de 503.
      tileset.style = new Cesium.Cesium3DTileStyle({ color: "color('#4f4f5e')" });
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
const CAM_TARGET = [0, 0, 60];       // vise vers le burst (apex ~90 m)
cam.setFromLocal(CAM_LOCAL, CAM_TARGET);

// DÉMO : l'effet choisi tourne EN BOUCLE (focus). Sélecteur d'effet en haut à droite pour réviser.
const pick = document.createElement('select');
Object.assign(pick.style, { position:'fixed', top:'10px', right:'10px', zIndex:'10',
  background:'rgba(0,0,0,.55)', color:'#fff', border:'1px solid #555', borderRadius:'6px',
  padding:'6px 8px', fontFamily:'system-ui, sans-serif', fontSize:'13px' });
for (const [k, label] of Object.entries(LABELS)){
  const o = document.createElement('option'); o.value = k; o.textContent = label; pick.appendChild(o);
}
pick.value = 'ch30pot';
// changer d'effet dans le menu -> couleur PAR DÉFAUT de l'effet (null annule l'override de la démo)
pick.addEventListener('change', e => layer.setFocus(e.target.value, null));
document.body.appendChild(pick);

// DÉMO (réglage en cours) : CHANDELLE 30 mm 8 TIRS POT À FEU + COMÈTE TRAÇANTE (réfs 501314000
// & co, B376) : la sœur de la queue de cheval — à chaque coup, une gerbe au sol de la couleur de
// la référence et une comète traçante qui monte, mais SANS pointe à l'arrivée.
layer.setFocus('ch30pot');

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
    viewer.scene.render();                   // décor Cesium
    layer.render();                          // overlay feux (caméra synchronisée, par-dessus)
  } catch (e) { console.warn('[PrevoFX] frame error (loop continue)', e); }
}
requestAnimationFrame(frame);

// debug console : PrevoFX.focus('willow') change l'effet joué en boucle ; PrevoFX.fire('peony') tire une fois.
window.PrevoFX = { viewer, layer, cam, timeline, audio, fire: (a) => layer.fire(a), focus: (a) => layer.setFocus(a) };
