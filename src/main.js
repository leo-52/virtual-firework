// PrevoFX Web — point d'entrée. Globe Cesium + couche de feux + démo pivoine.
// (Cesium est chargé en global via le <script> CDN dans index.html.)

import { Firework } from './sim/firework.js';
import { FireworksLayer } from './render/fireworksLayer.js';
import { FpsCameraController } from './cameraController.js';

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
      // AMBIANCE NUIT : assombrit le terrain (les tuiles Google sont en plein jour). Le
      // mode HIGHLIGHT (défaut) MULTIPLIE la texture par cette couleur -> sombre, bleuté.
      tileset.style = new Cesium.Cesium3DTileStyle({ color: "color('#4f4f5e')" });
      // CALER LE TIR SUR LE SOL RÉEL (tuiles les plus détaillées au lieu de tir) -> les
      // feux partent du sol. Marche pour n'importe quel lieu.
      try {
        const carto = Cesium.Cartographic.fromDegrees(FIRE.lon, FIRE.lat);
        const r = await viewer.scene.sampleHeightMostDetailed([carto]);
        const h = (r && r[0]) ? r[0].height : NaN;
        if (Number.isFinite(h) && h > -500 && h < 6000){
          FIRE.height = h;
          layer.setOrigin({ lon: FIRE.lon, lat: FIRE.lat, height: h });
          cam.setFromLocal(CAM_LOCAL, CAM_TARGET);
        }
      } catch (e2) { console.warn('[PrevoFX] calage sol impossible.', e2); }
    } catch (e) {
      console.warn('[PrevoFX] Google 3D Tiles via ion indisponible — feux sans décor.', e);
    }
  })();
}

// Bloom (le halo des feux la nuit) — post-process intégré de Cesium.
const bloom = viewer.scene.postProcessStages.bloom;
bloom.enabled = true;
bloom.uniforms.glowOnly = false;
bloom.uniforms.contrast = 110;     // un peu plus bas -> plus de zones qui rayonnent
bloom.uniforms.brightness = 0.0;   // plus lumineux
bloom.uniforms.delta = 1.5;
bloom.uniforms.sigma = 4.5;        // halo plus large
bloom.uniforms.stepSize = 2.0;     // glow plus étendu

// Couche de feux ancrée au lieu de tir.
const layer = new FireworksLayer(viewer, FIRE);

// Caméra "public" (spectateur FPS) : hauteur d'homme, 150 m, dans l'axe de tir.
// Contrôles : QZSD (déplacement), clic gauche + glisser (rotation), pas de molette, sol dur.
const cam = new FpsCameraController(viewer, layer);
const CAM_LOCAL = [0, -150, 1.75];   // 150 m derrière, hauteur d'homme
const CAM_TARGET = [0, 0, 55];       // vise le cœur du show
cam.setFromLocal(CAM_LOCAL, CAM_TARGET);

// DÉMO = L'EFFET EN COURS DE RÉGLAGE, EN BOUCLE (comme l'app UE) -> on itère sur UN seul
// effet. Pour bosser un autre effet, on changera FOCUS ci-dessous.
const FOCUS = {
  archetype: 'peony',
  colors: [[1.0, 0.45, 0.1]],   // pivoine orange
  starCount: 60,
  burstRadius: 11,              // m
  burstHeight: 80,             // m
  riseTime: 2.2,
  minLife: 1.1, maxLife: 1.6,
  starSize: 0.35               // m
};
function fireFocus(){ layer.add(new Firework({ ...FOCUS })); }
fireFocus();
setInterval(fireFocus, 4500);

// Boucle de simulation, calée sur le rendu Cesium.
let last = performance.now();
viewer.scene.preUpdate.addEventListener(() => {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  cam.update(dt);     // caméra spectateur (QZSD + clic-glisser + sol dur)
  layer.update(dt);
});

window.PrevoFX = { viewer, layer, cam, fireFocus }; // debug console
