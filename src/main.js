// PrevoFX Web — point d'entrée. Globe Cesium + couche de feux + démo pivoine.
// (Cesium est chargé en global via le <script> CDN dans index.html.)

import { Firework } from './sim/firework.js';
import { FireworksLayer } from './render/fireworksLayer.js';

// ⚠️ METS TON TOKEN CESIUM ION ICI (compte gratuit cesium.com). Sans token, les feux
//    s'affichent mais le terrain (Google 3D Tiles) reste vide.
const ION_TOKEN = 'METTRE_VOTRE_TOKEN_CESIUM_ION_ICI';

// Lieu de tir par défaut (sera choisi par le client). Ici : un champ près de Paris.
const FIRE = { lon: 2.3522, lat: 48.8566, height: 35 };

Cesium.Ion.defaultAccessToken = ION_TOKEN;

const viewer = new Cesium.Viewer('cesiumContainer', {
  animation: false, timeline: false, baseLayerPicker: false, geocoder: true,
  homeButton: false, sceneModePicker: false, navigationHelpButton: false,
  fullscreenButton: false, infoBox: false, selectionIndicator: false
});
viewer.scene.debugShowFramesPerSecond = false;

// Nuit : éclairage solaire + heure de nuit (le décor s'assombrit).
viewer.scene.globe.enableLighting = true;
try { viewer.clock.currentTime = Cesium.JulianDate.fromIso8601('2025-07-14T21:30:00Z'); } catch (e) {}

// Terrain photoréaliste (Google 3D Tiles via Cesium ion).
(async () => {
  try {
    const tileset = await Cesium.createGooglePhotorealistic3DTileset();
    viewer.scene.primitives.add(tileset);
  } catch (e) {
    console.warn('[PrevoFX] Google 3D Tiles indisponible (token ion ?) — feux affichés sans décor.', e);
  }
})();

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
  const tgtW = layer.localToWorld([0, 0, 40]);
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

// DÉMO : une pivoine 75 orange en boucle (mêmes règles visuelles que l'app UE).
function fireDemoPeony(){
  layer.add(new Firework({
    archetype: 'peony',
    colors: [[1.0, 0.45, 0.1]],
    starCount: 60,
    burstRadius: 11,   // m
    burstHeight: 80,   // m
    riseTime: 2.2,
    minLife: 1.1,
    maxLife: 1.6,
    starSize: 0.35     // m
  }));
}
fireDemoPeony();
setInterval(fireDemoPeony, 4500);

// Boucle de simulation, calée sur le rendu Cesium.
let last = performance.now();
viewer.scene.preUpdate.addEventListener(() => {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  layer.update(dt);
});

window.PrevoFX = { viewer, layer, fireDemoPeony, setPublicCamera }; // debug console
