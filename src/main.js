// PrevoFX Web — point d'entrée. Globe Cesium + couche de feux + démo pivoine.
// (Cesium est chargé en global via le <script> CDN dans index.html.)

import { ThreeFireworks, LABELS } from './render/threeFireworks.js';
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
pick.value = 'peony';
pick.addEventListener('change', e => layer.setFocus(e.target.value));
document.body.appendChild(pick);

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
    cam.update(dt);          // caméra spectateur (QZSD + clic-glisser + sol dur)
    layer.update(dt);        // simulation des feux (mètres locaux)
    viewer.scene.render();   // décor Cesium
    layer.render();          // overlay feux (caméra synchronisée, par-dessus)
  } catch (e) { console.warn('[PrevoFX] frame error (loop continue)', e); }
}
requestAnimationFrame(frame);

// debug console : PrevoFX.focus('willow') change l'effet joué en boucle ; PrevoFX.fire('ring') tire une fois.
window.PrevoFX = { viewer, layer, cam, fire: (a) => layer.fire(a), focus: (a) => layer.setFocus(a) };
