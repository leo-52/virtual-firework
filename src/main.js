// PrevoFX Web — point d'entrée. Globe Cesium + couche de feux + démo pivoine.
// (Cesium est chargé en global via le <script> CDN dans index.html.)

import { Firework } from './sim/firework.js';
import { FireworksLayer } from './render/fireworksLayer.js';

// DÉCOR = Google Photorealistic 3D Tiles, mais VIA CESIUM ION (token gratuit), PAS la
// clé Google directe. Raison (vérifiée) : Google BLOQUE les 3D tiles en accès direct par
// clé pour les comptes européens (EEA) -> erreur 403. Cesium ion les relaie via son compte
// US -> ça passe en Europe. (C'est aussi pour ça que le décor d'Unreal, qui utilise la clé
// Google directe, ne charge pas correctement.)
// >>> Crée un token GRATUIT sur ion.cesium.com -> "Access Tokens", colle-le ci-dessous.
const ION_TOKEN = 'METTRE_VOTRE_TOKEN_CESIUM_ION_ICI';
const HAS_ION = ION_TOKEN && !ION_TOKEN.startsWith('METTRE'); // token ion renseigné ?

// Lieu de tir par défaut (sera choisi par le client). Ici : près de Paris.
const FIRE = { lon: 2.3522, lat: 48.8566, height: HAS_ION ? 35 : 0 };

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
    } catch (e) {
      console.warn('[PrevoFX] Google 3D Tiles via ion indisponible — feux sans décor.', e);
    }
  })();
}

// Bloom (le halo des feux la nuit) — post-process intégré de Cesium.
const bloom = viewer.scene.postProcessStages.bloom;
bloom.enabled = true;
bloom.uniforms.glowOnly = false;
bloom.uniforms.contrast = 128;
bloom.uniforms.brightness = -0.2;
bloom.uniforms.delta = 1.2;
bloom.uniforms.sigma = 3.0;
bloom.uniforms.stepSize = 1.0;

// Couche de feux ancrée au lieu de tir.
const layer = new FireworksLayer(viewer, FIRE);

// Caméra "public" : hauteur d'homme (~1,75 m), à 150 m, dans l'axe de tir.
function setPublicCamera(){
  const camW = layer.localToWorld([0, -150, 1.75]);
  const tgtW = layer.localToWorld([0, 0, 55]); // vise le cœur du show (plus de ciel, moins de sol)
  const dir = Cesium.Cartesian3.normalize(
    Cesium.Cartesian3.subtract(tgtW, camW, new Cesium.Cartesian3()), new Cesium.Cartesian3());
  let up = Cesium.Cartesian3.normalize(camW, new Cesium.Cartesian3()); // up géographique
  const right = Cesium.Cartesian3.normalize(
    Cesium.Cartesian3.cross(dir, up, new Cesium.Cartesian3()), new Cesium.Cartesian3());
  up = Cesium.Cartesian3.normalize(
    Cesium.Cartesian3.cross(right, dir, new Cesium.Cartesian3()), new Cesium.Cartesian3());
  viewer.camera.setView({ destination: camW, orientation: { direction: dir, up } });
}
setPublicCamera();

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
  layer.update(dt);
});

window.PrevoFX = { viewer, layer, fireDemoPeony, setPublicCamera }; // debug console
