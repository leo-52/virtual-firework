// Overlay de feux Three.js par-dessus le décor Cesium — MOTEUR MULTI-ARCHÉTYPES.
// Canvas transparent (mix-blend screen) + caméra synchronisée sur Cesium (repère ENU).
// 1 classe Shell générique + table EFFECTS. Mécanismes opt-in par flag cfg (absent =
// comportement BASE pivoine) : dist2D (formes face public), gerbe (mine sol), behave
// (mouvements/forks), colors (multi-couleurs), flashBig (salut). Specs portées de l'UE.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const scene = new THREE.Scene();
const BUILD = 'B313';  // tampon de version affiché dans le HUD -> permet de voir si le navigateur sert du CACHE

function makeStarTexture(){
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32,32,0, 32,32,32);
  g.addColorStop(0.0,'rgba(255,255,255,1)'); g.addColorStop(0.18,'rgba(255,200,120,0.95)');
  g.addColorStop(0.45,'rgba(255,120,30,0.5)'); g.addColorStop(1.0,'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0,0,64,64);
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}
const starTex = makeStarTexture();
// Texture NEUTRE (blanc -> transparent, SANS dégradé orange) : pour que la COULEUR du grain décide
// vraiment de la teinte (blanc=blanc, or=or). La texture étoile, elle, teinte tout en orange.
function makeNeutralTexture(){
  const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d');
  const g=x.createRadialGradient(32,32,0, 32,32,32);
  g.addColorStop(0.0,'rgba(255,255,255,1)'); g.addColorStop(0.4,'rgba(255,255,255,0.55)'); g.addColorStop(1.0,'rgba(255,255,255,0)');
  x.fillStyle=g; x.fillRect(0,0,64,64);
  const t=new THREE.CanvasTexture(c); t.needsUpdate=true; return t;
}
const neutralTex = makeNeutralTexture();

// Matériau des ÉTOILES : ShaderMaterial avec TAILLE PAR POINT (attribut `size`) — PointsMaterial
// ne sait appliquer qu'une taille globale. `uH = 0.5·hauteurBuffer` reproduit exactement la
// "sizeAttenuation" de PointsMaterial -> même rendu qu'avant pour une taille uniforme.
// FLOU DE MOUVEMENT = DÉFORMATION (B77, photo user) : l'étoile elle-même est étirée en OVALE le long
// de sa vitesse projetée à l'écran (attribut aVel) ; plus elle freine, plus l'ovale redevient un ROND.
// La LARGEUR reste celle de la boule, seule la LONGUEUR suit la vitesse. aVel absent (traînées) -> rond.
const STAR_VS = `
  attribute float size;
  attribute vec3 aColor;
  attribute vec3 aVel;
  uniform float uH;
  uniform vec2 uVp;
  varying vec3 vCol;
  varying vec2 vDir;
  varying float vStretch;
  void main(){
    vCol = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec4 p1 = projectionMatrix * mv;
    float basePx = size * (uH / -mv.z);
    vec4 mv2 = modelViewMatrix * vec4(position - aVel*0.07, 1.0);   // où était l'étoile il y a ~70ms
    vec4 p2 = projectionMatrix * mv2;
    vec2 dpx = (p1.xy/p1.w - p2.xy/p2.w) * uVp;                     // déplacement écran en px
    float lenPx = length(dpx);
    float st = 1.0 + 1.1 * lenPx / max(basePx, 0.001);   // ×1.1 : goutte ~10% plus étirée (user B84)
    vStretch = min(st, 3.3);
    vDir = lenPx > 0.0001 ? dpx/lenPx : vec2(1.0, 0.0);
    gl_PointSize = basePx * vStretch;                               // le sprite s'agrandit pour contenir l'ovale
    gl_Position = p1;
  }`;
const STAR_FS = `
  uniform sampler2D uTex;
  varying vec3 vCol;
  varying vec2 vDir;
  varying float vStretch;
  void main(){
    vec2 pc = vec2(gl_PointCoord.x, 1.0-gl_PointCoord.y)*2.0 - 1.0;  // y remis vers le HAUT (même repère que la vitesse écran)
    vec2 q = vec2(dot(pc, vDir), pc.x*(-vDir.y) + pc.y*vDir.x);      // repère aligné sur la vitesse (x+ = sens du mouvement)
    float m = 1.0 - 1.0/vStretch;                                    // position de la TÊTE vers l'avant (0 si à l'arrêt)
    // TÊTE : boule RONDE à pleine taille (croquis user : le rond)
    vec2 relH = vec2(q.x - m, q.y) * vStretch;
    vec4 tH = texture2D(uTex, relH*0.5 + 0.5) * step(length(relH), 1.0);   // step : ZÉRO hors de la boule (le clamp de texture laissait ~1% d'alpha -> bandes en CROIX avec HDR+bloom)
    // QUEUE : CÔNE effilé derrière — part aussi LARGE que la boule et finit en POINTE (croquis user)
    float f = clamp((q.x + 1.0) / max(m + 1.0, 0.001), 0.0, 1.0);    // 1 à la boule -> 0 à la pointe arrière
    float w = f / vStretch;                                          // demi-largeur locale du cône
    float dy = abs(q.y) / max(w, 0.0001);                            // 0 = axe, 1 = bord du cône
    vec4 tT = texture2D(uTex, vec2(0.5, 0.5 + dy*0.5)) * step(dy, 1.0);    // step : ZÉRO hors du cône (même piège de clamp)
    float tailMask = (q.x < m ? 1.0 : 0.0) * f * f * 0.85;           // fondu vers la pointe, un peu plus faible que la tête
    vec4 t = max(tH, tT * tailMask);                                  // rond seul à l'arrêt (la queue rentre dans la boule)
    gl_FragColor = vec4(vCol * t.rgb, t.a);                          // additif : couleur HDR × alpha du sprite
  }`;
function makeStarMat(tex){
  const k=Math.min(devicePixelRatio,2);
  return new THREE.ShaderMaterial({
    uniforms:{ uTex:{value:tex||starTex}, uH:{value:0.5*(innerHeight||800)*k},
               uVp:{value:new THREE.Vector2(0.5*(innerWidth||1280)*k, 0.5*(innerHeight||800)*k)} },
    vertexShader:STAR_VS, fragmentShader:STAR_FS,
    transparent:true, blending:THREE.AdditiveBlending, depthWrite:false });
}

// --- pool de traînées (comète, gerbe mine, grains des effets traînants) ---
const TRAIL_MAX = 45000;   // agrandi B98 (cascade ~20k) puis B136 (saule kamuro photo : brins denses period 0.008 ET longs lifeMul 18 -> ~26k grains vivants) — sinon le ring buffer écraserait la queue des brins en vol
const trailPos  = new Float32Array(TRAIL_MAX * 3);
const trailCol  = new Float32Array(TRAIL_MAX * 3);
const trailSize = new Float32Array(TRAIL_MAX);
const trail = [];
for (let i = 0; i < TRAIL_MAX; i++){
  trail.push({ x:0,y:0,z:0, vx:0,vy:0,vz:0, age:0, life:0, size:0, r:0,g:0,b:0, gF:0.4, alive:false });
  trailSize[i] = 0;
}
let trailHead = 0;
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
trailGeo.setAttribute('aColor',   new THREE.BufferAttribute(trailCol, 3));
trailGeo.setAttribute('size',     new THREE.BufferAttribute(trailSize, 1));
trailGeo.setAttribute('aVel',     new THREE.BufferAttribute(new Float32Array(TRAIL_MAX*3), 3));   // zéro = grains RONDS (pas d'étirement sur les traînées)
// TAILLE PAR GRAIN (ShaderMaterial) : avant, PointsMaterial forçait 0.8 px pour TOUS -> à la
// distance de la vue public les traînées étaient sous-pixel (invisibles). Maintenant chaque grain
// a sa taille (grosses frondes/traînées visibles, muzzle fin).
const trailMat = makeStarMat(neutralTex);   // traînées/points : texture NEUTRE -> la couleur du grain décide (blanc reste blanc, or reste or)
const trailPoints = new THREE.Points(trailGeo, trailMat);
trailPoints.frustumCulled = false;   // CRITIQUE : sa bounding sphere reste à l'origine (grains nés à 0,0,0) ->
scene.add(trailPoints);              // sinon Three.js CULL tout le pool quand la caméra vise le burst (origine hors champ) = "pas de traînées"

function spawnTrail(x,y,z, r,g,b, size, gF=0.4, lifeMul=1, vx0=0, vy0=0, vz0=0, jit=0.8, drag=0.42, flatLife=false, rin=0){
  const i = trailHead; trailHead = (trailHead + 1) % TRAIL_MAX;
  const t = trail[i];
  t.x=x; t.y=y; t.z=z;
  t.vx=vx0*0.25+(Math.random()-0.5)*jit; t.vy=vy0*0.25-Math.random()*(jit*0.75); t.vz=vz0*0.25+(Math.random()-0.5)*jit;   // jit bas = pas de "nage" aléatoire (poissons/feuilles)
  t.age=0; t.life = lifeMul * 0.26 * (flatLife ? (0.85+Math.random()*0.3)                       // flatLife : vies QUASI ÉGALES (±15%) -> la nappe tombe d'un bloc et s'éteint ensemble
                                              : (0.35 + 1.45*Math.pow(Math.random(),1.6)));    // sinon : vies très inégales (fondu organique) — MAIS les profondes meurent d'abord => enveloppe qui "bute sur un sol"
  t.size = size*(0.7+Math.random()*0.6); t.r=r; t.g=g; t.b=b; t.gF=gF; t.drag=drag; t.rin=rin; t.alive=true;   // rin : FONDU d'apparition (s) -> les grains frais empilés près de la tête ne crament plus en blanc
}
// VENT DES ÉTINCELLES (B177, user : « les étincelles bougent légèrement avec le vent, emportées
// toutes en même temps ») : brise COMMUNE (posée par le burst des effets à cfg.wind) qui dérive
// tout le pool ensemble — c'est ce qui rend la nappe VIVANTE au lieu de figée.
let trailWindX = 0, trailWindZ = 0;
function updateTrails(dt){
  for (let i = 0; i < TRAIL_MAX; i++){
    const t = trail[i];
    // BUG "la sortie du tube ne disparaît jamais" : PointsMaterial IGNORE l'attribut `size`
    // (taille unique globale), donc mettre size=0 ne CACHE PAS un grain mort -> il restait
    // affiché pour toujours à sa DERNIÈRE couleur (faible mais non nulle), surtout l'amas
    // dense d'étincelles muzzle au-dessus du tube. FIX : on met la COULEUR à 0 (invisible en additif).
    if (!t.alive){ trailCol[i*3]=trailCol[i*3+1]=trailCol[i*3+2]=0; trailSize[i]=0; continue; }
    t.age += dt; if (t.age >= t.life){ t.alive=false;
      trailCol[i*3]=trailCol[i*3+1]=trailCol[i*3+2]=0; trailSize[i]=0; continue; }
    t.x += trailWindX * dt; t.z += trailWindZ * dt;   // la brise emporte TOUS les grains ensemble (B177)
    t.vy -= 9.8 * t.gF * dt;
    const kd = Math.max(0, 1 - (t.drag||0.42)*dt); t.vx*=kd; t.vy*=kd; t.vz*=kd;
    t.x+=t.vx*dt; t.y+=t.vy*dt; t.z+=t.vz*dt;
    let a = 1 - t.age/t.life;
    if (t.rin>0 && t.age<t.rin) a *= t.age/t.rin;   // fondu d'apparition (cascade : anti "blanc cramé" près des têtes)
    trailPos[i*3]=t.x; trailPos[i*3+1]=t.y; trailPos[i*3+2]=t.z;
    trailCol[i*3]=t.r*a*0.85; trailCol[i*3+1]=t.g*a*0.85; trailCol[i*3+2]=t.b*a*0.85;
    trailSize[i]=t.size*a;
  }
  trailGeo.attributes.position.needsUpdate = true;
  trailGeo.attributes.aColor.needsUpdate = true;
  trailGeo.attributes.size.needsUpdate = true;
}

// --- pool de BOUFFÉES (sortie de tube : flamme + fumée) ---
// Sprites (PAS des points) car une bouffée doit GROSSIR : PointsMaterial ne gère pas la taille
// par particule, un Sprite a son propre scale/opacity/couleur. Additif -> sur ciel sombre, la
// flamme brille et la fumée chaude se lit ; le fondu se fait par la couleur/opacité (=0 invisible).
function makeSmokeTexture(){
  const c=document.createElement('canvas'); c.width=c.height=64;
  const x=c.getContext('2d');
  const g=x.createRadialGradient(32,32,0, 32,32,32);
  g.addColorStop(0.0,'rgba(255,255,255,1)');
  g.addColorStop(0.5,'rgba(255,255,255,0.32)');
  g.addColorStop(1.0,'rgba(255,255,255,0)');
  x.fillStyle=g; x.fillRect(0,0,64,64);
  const t=new THREE.CanvasTexture(c); t.needsUpdate=true; return t;
}
const smokeTex = makeSmokeTexture();
const PUFF_MAX = 512;   // B126 : le trio de formes tire 3 bombes la MÊME frame -> ~330 bouffées de gueule
                        // simultanées ; à 320 le ring buffer recyclait des flammes encore vivantes
const puffs = [];
for (let i=0;i<PUFF_MAX;i++){
  const m=new THREE.SpriteMaterial({ map:smokeTex, transparent:true, blending:THREE.AdditiveBlending,
    depthWrite:false, opacity:0 });
  const s=new THREE.Sprite(m); s.visible=false; s.frustumCulled=false; scene.add(s);
  puffs.push({ spr:s, x:0,y:0,z:0, vx:0,vy:0,vz:0, age:0,life:1, s0:1,s1:1, r:1,g:1,b:1, op0:1, buoy:0, drag:1, alive:false });
}
let puffHead=0;
function spawnPuff(x,y,z, vx,vy,vz, life, s0,s1, r,g,b, op0, buoy, drag){
  const p=puffs[puffHead]; puffHead=(puffHead+1)%PUFF_MAX;
  p.x=x; p.y=y; p.z=z; p.vx=vx; p.vy=vy; p.vz=vz; p.age=0; p.life=life;
  p.s0=s0; p.s1=s1; p.r=r; p.g=g; p.b=b; p.op0=op0; p.buoy=buoy; p.drag=drag; p.alive=true; p.spr.visible=true;
}
function updatePuffs(dt){
  for (let i=0;i<PUFF_MAX;i++){
    const p=puffs[i]; if(!p.alive) continue;
    p.age+=dt;
    if(p.age>=p.life){ p.alive=false; p.spr.visible=false; continue; }
    p.vy+=p.buoy*dt;                                   // flottabilité (le chaud monte)
    const kd=Math.max(0,1-p.drag*dt); p.vx*=kd; p.vy*=kd; p.vz*=kd;
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt;
    const a=p.age/p.life, sz=p.s0+(p.s1-p.s0)*a;       // grossit sur sa vie
    const fade=Math.min(1,a*5)*(1-a);                  // fondu entrant rapide puis sortant
    p.spr.position.set(p.x,p.y,p.z); p.spr.scale.set(sz,sz,1);
    p.spr.material.color.setRGB(p.r,p.g,p.b); p.spr.material.opacity=p.op0*fade;
  }
}

// --- helpers vecteurs ---
function vrand(rnd){ const z=rnd()*2-1, t=rnd()*Math.PI*2, r=Math.sqrt(Math.max(0,1-z*z));
  return [Math.cos(t)*r, Math.sin(t)*r, z]; }
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const len2=a=>a[0]*a[0]+a[1]*a[1]+a[2]*a[2];
const norm=a=>{const L=Math.sqrt(len2(a))||1;return[a[0]/L,a[1]/L,a[2]/L];};
const rnd=(a,b)=>a+Math.random()*(b-a);
const rndI=(a,b)=>Math.floor(rnd(a,b+1));
const lerp=(a,b,t)=>a+(b-a)*t;

// --- couleurs ---
const GOLD=new THREE.Color(1.0,0.72,0.32), DIMGOLD=new THREE.Color(0.55,0.40,0.14),
  SILVER=new THREE.Color(0.82,0.88,1.0), PINK=new THREE.Color(1.0,0.30,0.55),
  CYAN=new THREE.Color(0.25,0.9,1.0), YEL=new THREE.Color(1.0,0.92,0.30),
  GRN=new THREE.Color(0.3,1.0,0.45), BLU=new THREE.Color(0.4,0.55,1.0),
  RED=new THREE.Color(1.0,0.14,0.18), PURP=new THREE.Color(0.6,0.35,1.0), WHITE=new THREE.Color(1.0,1.0,1.0),
  BRIGHTGOLD=new THREE.Color(1.4,1.0,0.45),   // or HDR (traînées bien visibles à distance, ex saule kamuro)
  COPPER=new THREE.Color(1.22,0.60,0.16),     // orange CUIVRÉ braise (photos user B136, saule kamuro réel — plus chaud que GOLD, un peu plus doré qu'EMBER)
  PALEGOLD=new THREE.Color(1.0,0.88,0.68),    // or PÂLE pour autres usages
  EGGWHITE=new THREE.Color(1.0,0.95,0.92),    // BLANC (ancien œuf de dragon, trop froid)
  EGGGOLD=new THREE.Color(1.4,1.18,0.88),     // BLANC CHAUD / champagne, HDR (œuf de dragon, retour B61 ; réf photo = amas blancs à reflets chauds). MÊME couleur traînée + points + cœur
  CKGRN=new THREE.Color(0.24,1.22,0.38),      // VERT FLASHY (crackling vert : un poil + saturé/punchy que GRN, sans toucher couronne/marguerite)
  EMBER=new THREE.Color(1.25,0.60,0.15),      // ORANGÉ/DORÉ CHAUD (braise HDR) — étincelles de la palme multicolore (plus chaud que GOLD, bleu bas -> reste orange en additif)
  SCINTW=new THREE.Color(1.15,1.18,1.28);     // BLANC SCINTILLANT légèrement HDR (même blanc que la palme or scintillant) — paquets pot-à-feu de l'atome

// ============================================================================
// DISTRIBUTIONS 3D : dist(i,n,rnd) -> {dx,dy,dz, spMul, comp?}
// ============================================================================
function distFibonacci(i,n,rnd){
  const off=2/n, inc=2.399963229728653;
  const yy=i*off-1+off/2, rr=Math.sqrt(Math.max(0,1-yy*yy)), a=i*inc;
  let dx=Math.cos(a)*rr+(rnd()-0.5)*0.05, dy=yy+(rnd()-0.5)*0.05, dz=Math.sin(a)*rr+(rnd()-0.5)*0.05;
  const L=Math.hypot(dx,dy,dz)||1; return {dx:dx/L,dy:dy/L,dz:dz/L,spMul:1};
}
function distComet(i,n,rnd){ let dx=(rnd()-0.5)*0.2,dy=1.0,dz=(rnd()-0.5)*0.2;
  const L=Math.hypot(dx,dy,dz)||1; return {dx:dx/L,dy:dy/L,dz:dz/L,spMul:0.45}; }
// PALME : BOUQUET vers le HAUT, IRRÉGULIER. Directions aléatoires (jamais vers le bas), à des
// élévations VARIÉES (de l'horizontale à la verticale) et des LONGUEURS variées (spMul) -> éventail
// organique de frondes. (Avant : même élévation sur 360° = un cône dont le bord = un CERCLE parfait.)
function distPalm(i,n,rnd){
  const az=rnd()*Math.PI*2;                      // azimut ALÉATOIRE (pas régulier -> pas d'anneau)
  const elev=(35+rnd()*35)*Math.PI/180;          // élévation VARIÉE 35-70° par fronde (casse le cône)
  const ce=Math.cos(elev), se=Math.sin(elev);
  return {dx:Math.cos(az)*ce, dy:se, dz:Math.sin(az)*ce, spMul:0.85+rnd()*0.5}; }   // frondes longues, longueurs variées
function distLeaves(i,n,rnd){ const v=vrand(rnd); return {dx:v[0],dy:v[1],dz:v[2],spMul:0.45+rnd()*0.45}; }
// MÉDUSE (B235, correction user) : la QUEUE DE CHEVAL = ~17 étoiles PETITES en cône serré,
// SENS ALÉATOIRE par tir (à l'endroit, à l'envers, sur le côté — randomAxis) ; 4 d'entre elles
// (comp 1) survivent et deviennent les SPERMATOZOÏDES qui dandinent.
function distMedusa(i,n,rnd){
  const dx=(rnd()-0.5)*0.32, dz=(rnd()-0.5)*0.32, dy=1, L=Math.hypot(dx,dy,dz)||1;
  return {dx:dx/L,dy:dy/L,dz:dz/L, spMul:0.32+rnd()*0.22, comp:(i<n-4)?0:1};
}
function distHorsetail(i,n,rnd){ const dx=(rnd()-0.5)*0.18, dz=(rnd()-0.5)*0.18, dy=1.0;
  const L=Math.hypot(dx,dy,dz)||1; return {dx:dx/L,dy:dy/L,dz:dz/L,spMul:0.33}; }
function distCascade(i,n,rnd){ const dx=(rnd()-0.5)*0.9, dz=(rnd()-0.5)*0.9, dy=1.0;    // CASCADE (B112/B113, user) : ÉCLAT PETIT — les boules s'écartent de ~7 m MAX du centre (B113 « un peu
  const L=Math.hypot(dx,dy,dz)||1;                                                      // plus gros »), puis c'est la CHUTE CONTINUE qui fait la cascade (même si l'éclat pointe vers le haut).
  return {dx:dx/L,dy:dy/L,dz:dz/L,spMul:0.155}; }
function distFish(i,n,rnd){ const v=vrand(rnd); return {dx:v[0],dy:v[1],dz:v[2],spMul:0.28}; }
function distSalute(i,n,rnd){ const v=vrand(rnd); return {dx:v[0],dy:v[1],dz:v[2],spMul:0.33}; }
function distMosaic(i,n,rnd){ const v=vrand(rnd); return {dx:v[0],dy:v[1],dz:v[2],spMul:1.0}; }
function distSaucer(i,n,rnd){ const dx=rnd(-0.07,0.07),dz=rnd(-0.07,0.07);
  const L=Math.hypot(dx,1,dz); return {dx:dx/L,dy:1/L,dz:dz/L,spMul:0.6}; }
// ATOME 150mm (B191, réécrit — l'ancien modèle « anneaux d'électrons » était FAUX ; étapes de la
// vidéo catalogue GTIeDTIQl-0 disséquées par l'user) : n = pivoine + 17 brins + 17×7 paquets.
// comp 0 = PIVOINE (sphère centrale, vie courte — elle meurt pendant que les brins vivent encore) ;
// comp 1 = 17 BRINS comètes or, ~×1,75 plus loin que la pivoine, longueurs légèrement inégales ;
// comp 2 = PAQUETS POT-À-FEU : points blancs SCINTILLANTS expulsés AU BREAK dans la direction de
// LEUR brin (cône serré) mais ~2× plus lents -> ils se retrouvent au MILIEU/BAS de la traînée
// pendant que la comète file vers la pointe (correction user : rien n'est semé en route).
const ATOM_BRINS=17, ATOM_PK=7;
let _atomDirs=null;   // directions des brins mémorisées le temps d'UN burst (la boucle est synchrone)
function distAtom(i,n,rnd){
  if (i===0) _atomDirs=[];
  const nPiv=Math.max(0, n-ATOM_BRINS*(1+ATOM_PK));
  if (i<nPiv){ const d=distFibonacci(i,nPiv,rnd);   // B193 (user : « comme une pivoine ») : sphère RÉGULIÈRE Fibonacci, pas un tirage épars
    return {dx:d.dx,dy:d.dy,dz:d.dz,spMul:0.57,comp:0}; }   // B195 (user) : pivoine ENCORE plus petite (~50 m), bien sous les pots à feu
  const j=i-nPiv;
  if (j<ATOM_BRINS){ const v=vrand(rnd), sp=1.37+rnd()*0.21;   // B192 (user) : envergure brins 160 -> 140 m (recalé B194 : 140 mesuré sur 12 tirs)
    _atomDirs[j]={v,sp};
    return {dx:v[0],dy:v[1],dz:v[2],spMul:sp,comp:1}; }
  const b=_atomDirs[(j-ATOM_BRINS)%ATOM_BRINS];   // chaque paquet suit SON brin
  const dx=b.v[0]+(rnd()-0.5)*0.14, dy=b.v[1]+(rnd()-0.5)*0.14, dz=b.v[2]+(rnd()-0.5)*0.14;
  const L=Math.hypot(dx,dy,dz)||1;
  return {dx:dx/L, dy:dy/L, dz:dz/L, spMul:b.sp*(0.58+rnd()*0.20), comp:2};   // B195 (user) : pots à feu encore un peu plus loin (~105 m)
}
// (distHalfHalf supprimé en B132 : la demi-demi = distFibonacci pur + coupe `splitFacing` dans burst())
// MARRONS (B159, user) : les 5 mini marrons partent dans la MÊME DIRECTION (chargés du même côté,
// randomAxis oriente ce côté au hasard par tir) mais PAS ENSEMBLE : cône ±19° + vitesses très
// inégales (×0.6-1.4) -> ils s'échelonnent sur ~4-9 m, chacun bien distinct.
function distMarron(i,n,rnd){ const dx=(rnd()-0.5)*0.7, dz=(rnd()-0.5)*0.7, dy=1, L=Math.hypot(dx,dy,dz)||1;
  return {dx:dx/L, dy:dy/L, dz:dz/L, spMul:0.55+(i/Math.max(1,n-1))*0.88+(rnd()-0.5)*0.10}; }   // vitesses ÉCHELONNÉES par index (0.55->1.43) : ~1,3-1,7 m d'écart radial mini entre voisins ; + les détonations à des INSTANTS différents = jamais deux pops confondus
// ENVELOPPE + CENTRE CLI. (B215 dahlia, généralisé B218 pour le kamuro centre) :
// comp 0 = ENVELOPPE (sphère Fibonacci, nEnv étoiles) ; comp 1 = PISTIL cli. blanc chargé en
// **2 DEMI-COQUILLES opposées** (photo + croquis user : deux « D » face à face) -> deux LOBES
// le long d'un axe aléatoire par tir, BANDE VIDE à l'équateur (« sur certains côtés il n'y a
// pas d'étoiles clignotantes »).
function makeDistEnvCli(nEnv, pistilComp){
  let W=null; const pc=pistilComp||1;
  return function(i,n,rnd){
    if (i===0) W=vrand(rnd);
    if (i<nEnv){ const d=distFibonacci(i,nEnv,rnd);
      return {dx:d.dx,dy:d.dy,dz:d.dz,spMul:1.0,comp:0}; }
    const side=(i%2)?1:-1;
    const c=(0.32+rnd()*0.68)*side;                 // gap |cos|<0.32 (~±19°) à l'équateur
    const a=rnd()*Math.PI*2, s=Math.sqrt(Math.max(0,1-c*c));
    let u=cross(W,[0,1,0]); if(len2(u)<0.01)u=cross(W,[1,0,0]); u=norm(u);
    const v2=norm(cross(W,u));
    return {dx:W[0]*c+(u[0]*Math.cos(a)+v2[0]*Math.sin(a))*s,
            dy:W[1]*c+(u[1]*Math.cos(a)+v2[1]*Math.sin(a))*s,
            dz:W[2]*c+(u[2]*Math.cos(a)+v2[2]*Math.sin(a))*s,
            spMul:0.28+rnd()*0.12, comp:pc};
  };
}
const distDahliaCli=makeDistEnvCli(28);        // B215 (user) : 28 brins de dahlia
const distKamuroCli=makeDistEnvCli(64);        // B218 : extérieur kamuro (saule) + centre cli.
const distHalfSwapCli=makeDistEnvCli(80, 2);   // B223 : moitié-moitié changeante (coupe splitFacing sur comps 0/1) + pistil comp 2

function distSpinner(i,n,rnd){ const a0=Math.random()*Math.PI*2, rH=rnd(11,16), vUp=rnd(2.5,4.2);
  const dx=Math.cos(a0)*rH, dy=vUp, dz=Math.sin(a0)*rH, L=Math.hypot(dx,dy,dz)||1;
  return {dx:dx/L,dy:dy/L,dz:dz/L, spMul:(L/(13.5*1.8))}; }

// ============================================================================
// DISTRIBUTIONS 2D (formes face public) : dist2D(rnd,cal,nc) -> [{x,y,comp}] dans le disque unité
// ============================================================================
function shapeHeart(){ const pts=[]; for(let k=0;k<21;k++){ const t=2*Math.PI*k/21;   // 21 étoiles (user B127, catalogue : bombe 100mm à effet cœur)
  const x=16*Math.pow(Math.sin(t),3);
  const y=13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t);
  pts.push({x:x/16,y:y/16,comp:0}); } return pts; }
// PAPILLON (B247, définition user après la vidéo gWYWk3yN4pQ) : « deux DEMI-CERCLES envoyés de
// chaque côté + 2 étoiles COMÈTES qui partent dans la MÊME direction à ~10° d'écart ». Un
// CERCLE d'étoiles coupé en deux : chaque demi-cercle est POUSSÉ vers son côté (vitesse =
// radiale du cercle + poussée latérale commune) -> les deux ARCS s'écartent dos à dos en
// gardant leur forme = les ailes. Orientation du plan/coupe : règle habituelle (~55 % lisible
// face public, sinon aléatoire). Comètes : direction aléatoire (biais haut) par tir, la 2e à
// 8-11°, arcs doux (behaveButterflyComet), elles survivent aux ailes.
let _bB=null;
function distButterfly3D(i,n,rnd){
  if (i===0){
    let N;
    if (Math.random()>=0.55) N=vrand(rnd);
    else { const F=norm([0,0.12,-1]), tp=0.35;
      N=norm([F[0]+(rnd()*2-1)*tp, F[1]+(rnd()*2-1)*tp, F[2]+(rnd()*2-1)*tp]); }
    let U=cross(N,[0,1,0]); if(len2(U)<0.01)U=cross(N,[1,0,0]); U=norm(U);
    const V=norm(cross(N,U));
    const psi=rnd()*Math.PI*2, cp=Math.cos(psi), sp=Math.sin(psi);
    const P=[-U[0]*sp+V[0]*cp, -U[1]*sp+V[1]*cp, -U[2]*sp+V[2]*cp];   // poussée : dans le plan, ⊥ à la coupe
    // ANTENNES (B251, user : « il faut que ça fasse un V dans le bon sens ») : elles suivent
    // l'AXE DU CORPS (la ligne de coupe, ⊥ à la poussée des ailes), vers la TÊTE (le haut),
    // et divergent symétriquement dans le plan du papillon -> le V.
    const C=[U[0]*cp+V[0]*sp, U[1]*cp+V[1]*sp, U[2]*cp+V[2]*sp];
    if (C[1]<0){ C[0]=-C[0]; C[1]=-C[1]; C[2]=-C[2]; }                // la tête = le côté haut
    const a=0.07+rnd()*0.03, ca=Math.cos(a), sa=Math.sin(a);          // demi-angle du V (total 8-11,5°)
    const D =norm([C[0]*ca+P[0]*sa, C[1]*ca+P[1]*sa, C[2]*ca+P[2]*sa]);
    const D2=norm([C[0]*ca-P[0]*sa, C[1]*ca-P[1]*sa, C[2]*ca-P[2]*sa]);
    _bB={U,V,P,D,D2};
  }
  const B=_bB;
  if (i<n-2){
    // B249 (user) : demi-cercles PLEINS — les étoiles remplissent toute la SURFACE du
    // demi-disque (rayon en √rnd = uniforme en aire), pas seulement le contour.
    const th=2*Math.PI*i/(n-2)+(rnd()-0.5)*0.10, ct=Math.cos(th), st=Math.sin(th);
    const r=Math.sqrt(rnd());
    const q=[(B.U[0]*ct+B.V[0]*st)*r, (B.U[1]*ct+B.V[1]*st)*r, (B.U[2]*ct+B.V[2]*st)*r];
    const side=(q[0]*B.P[0]+q[1]*B.P[1]+q[2]*B.P[2])>=0?1:-1, k=0.68;  // B252 (user) : ailes MOINS écartées à la fin (0.9 -> 0.68)
    const v=vrand(rnd);
    const dx=q[0]+B.P[0]*side*k+v[0]*0.05, dy=q[1]+B.P[1]*side*k+v[1]*0.05, dz=q[2]+B.P[2]*side*k+v[2]*0.05;
    const L=Math.hypot(dx,dy,dz)||1;
    return {dx:dx/L,dy:dy/L,dz:dz/L, spMul:L*0.62*(0.96+rnd()*0.08), comp:0};   // vitesse ∝ |position+poussée| : le demi-disque reste un demi-disque
  }
  const D=(i===n-2)?B.D:B.D2;
  return {dx:D[0],dy:D[1],dz:D[2], spMul:1.3, comp:1};
}
function shapeSmiley(_r,_c,nc){ const CE=Math.min(1,nc-1), CB=Math.min(2,nc-1), pts=[];   // 15 + 2 + 5 = 22 étoiles (user B127), 3 GROUPES de couleur (user B128)
  for(let k=0;k<15;k++){const t=2*Math.PI*k/15; pts.push({x:Math.cos(t),y:Math.sin(t),comp:0});}   // 15 = le cercle du visage (couleur 0 = orange)
  pts.push({x:-0.35,y:0.32,comp:CE}); pts.push({x:0.35,y:0.32,comp:CE});                           //  2 = les yeux (couleur 1 = vert)
  for(let k=0;k<=4;k++){const a=(205+(335-205)*k/4)*Math.PI/180; pts.push({x:Math.cos(a)*0.55,y:Math.sin(a)*0.55,comp:CB});}   //  5 = la bouche (couleur 2 = rouge)
  return pts; }
// MARGUERITE (B150, dissection user des photos) : 11-12 pétales = UNE GROSSE PORTEUSE chacun,
// ASYMÉTRIQUES (angles/longueurs inégaux — pas un cadran de montre) ; CŒUR = ~30 billes de la
// couleur variante, si brillantes qu'elles FUSIONNENT (HDR -> ACES les blanchit au centre =
// les « points blancs » de la photo), et DÉCENTRÉ (la chasse a poussé le pistil d'un côté).
function shapeDaisy(_r,cal,nc){ const nPet=11, pts=[];   // 11 pétales EXACTEMENT (vidéo Prévot, B152)
  for(let p=0;p<nPet;p++){ const aPet=2*Math.PI*p/nPet+rnd(-0.12,0.12);          // intervalles IRRÉGULIERS
    const R=rnd(0.88,1.12);                                                       // longueurs INÉGALES
    pts.push({x:Math.cos(aPet)*R,y:Math.sin(aPet)*R,comp:0}); }
  const nCoeur=rndI(28,32), offA=Math.random()*Math.PI*2, offR=0.07+Math.random()*0.07;
  const offX=Math.cos(offA)*offR, offY=Math.sin(offA)*offR;                       // pistil DÉCENTRÉ (par tir)
  for(let k=0;k<nCoeur;k++){ const a=Math.random()*Math.PI*2, R=Math.sqrt(Math.random())*0.17;
    pts.push({x:offX+Math.cos(a)*R,y:offY+Math.sin(a)*R,comp:Math.min(1,nc-1)}); }   // cœur RESSERRÉ (B153 : ~25-30% du rayon, les pétales dominent)
  return pts; }
// CERCLE (B245 — brique RESSUSCITÉE pour les COMPOSÉS : « centre cascade cercle », 150 mm
// D8-D10 « cercle traçant/kamuro »… ; la bombe cercle SEULE reste arrêtée, cf B127. Décision
// user 2026-07-10 : « oui il faut quand même l'effet cercle ».) Anneau de 24 étoiles, mêmes
// règles que les formes 2D (défauts ±0.05, orientation aléatoire ~55 % bon sens, vitesse ∝ rayon).
// D8 (B262 vidéo sTkNxTRs1F8, REFAIT B264 sur la définition user) : « bombe 150 mm D8 »
// (515088000, 183 m) — composé, tout en même temps au break :
//  1) CENTRE BLEU : 55 étoiles (~2 s) ;
//  2) CERCLE de 22 TRAÇANTES « comme des COMÈTES SANS TÊTE » : on ne voit QUE les rayons
//     traçants cuivre (recette B211), sens aléatoire par tir ; à 1,5 s les TÊTES ROUGES
//     apparaissent ;
//  3) ~0,5 s après (≈2 s) : PIVOINE DE LA TAILLE DU CERCLE, étoiles invisibles au début, qui
//     APPARAISSENT EN ROUGE d'UN CÔTÉ VERS L'AUTRE (balayage ~0,8 s le long d'un axe aléatoire),
//     puis chaque étoile passe ROUGE -> ORANGE -> JAUNE (fondus 0,2 s, règle B228) et se
//     TRANSFORME EN ŒUF DE DRAGON (amas doré, ~1,6 s après son apparition).
//  ⚠️ eggSplode rend l'étoile invisible hors crépitement -> posé SEULEMENT à l'instant du crackle.
let _d8B=null;
const D8_ORG=new THREE.Color(1.0,0.45,0.08);
function distD8(i,n,rnd){
  if (i===0){
    const F=vrand(rnd);
    let U=cross(F,[0,1,0]); if(len2(U)<0.01)U=cross(F,[1,0,0]); U=norm(U);
    _d8B={F, U, V:norm(cross(F,U))};
  }
  if (i<55){ const v=vrand(rnd); return {dx:v[0],dy:v[1],dz:v[2], spMul:0.20+rnd()*0.10, comp:0}; }
  if (i<77){ const B=_d8B, th=2*Math.PI*(i-55)/22+(rnd()-0.5)*0.16, ct=Math.cos(th), st=Math.sin(th);   // B268 (user) : DÉFAUTS — angle ±4,5°,
    const w=(rnd()-0.5)*0.16;                                                                           // sortie de plan ±4,5°, vitesse/distance ±10 %
    const dx=B.U[0]*ct+B.V[0]*st+B.F[0]*w, dy=B.U[1]*ct+B.V[1]*st+B.F[1]*w, dz=B.U[2]*ct+B.V[2]*st+B.F[2]*w;
    const L=Math.hypot(dx,dy,dz)||1;
    return {dx:dx/L, dy:dy/L, dz:dz/L, spMul:0.75*(0.90+rnd()*0.20), comp:1}; }   // B265 (user) : cercle PLUS PETIT (1.0 -> 0.75)
  const v=vrand(rnd); return {dx:v[0],dy:v[1],dz:v[2], spMul:0.71+rnd()*0.08, comp:2};   // pivoine DE LA TAILLE DU CERCLE — 130 étoiles (B267, comptées ~135 sur la photo user)
}
function behaveD8(d,A,dt,ctx){
  if (d.comp===1){                                                 // tête rouge à 1,5 s (léger jeu)
    if (d.tipAt===undefined){ d.tipAt=1.5+(Math.random()-0.5)*0.3;
      d._sz=(ctx.cfg.compSize&&ctx.cfg.compSize[1])||ctx.cfg.starSize; }
    if (!d._lit && d.age>=d.tipAt) d._lit=true;
    // B266 (user : « pas par magie, je veux que ça GROSSISSE ») : la tête enfle en ~0,45 s
    // (taille 25 % -> 100 % + intensité qui suit, via d._gk lu par d8Fn).
    if (d._lit && (d._gk===undefined || d._gk<1)){
      d._gk=Math.min(1,(d.age-d.tipAt)/0.45);
      ctx.size[d._i]=d._sz*STAR_SCALE*(0.25+0.75*d._gk);
      ctx.geo.attributes.size.needsUpdate=true;
    }
    return;
  }
  if (d.comp!==2) return;
  if (d._apAt===undefined){
    if (!ctx._d8W) ctx._d8W=vrand(Math.random);                    // axe du balayage, par tir
    const L=Math.hypot(d.vx,d.vy,d.vz)||1, W=ctx._d8W;
    const u=((d.vx*W[0]+d.vy*W[1]+d.vz*W[2])/L+1)/2;               // 0 = côté de départ, 1 = côté opposé
    d._apAt=2.0+u*0.8+Math.random()*0.08;
    d._ckAt=d._apAt+2.0+Math.random()*0.35;                        // œuf de dragon ~2,0-2,35 s après l'apparition (le NOIR s'intercale)
    d.life=Math.max(d.life, d._ckAt+0.5);
  }
  if (!d.crackle && d.age>=d._ckAt){ d.crackle=true; d.eggSplode=true; d.crackleAt=d._ckAt; return; }
  if (d.age<d._apAt) return;
  d._on=true;
  // B265/B266 (user) : le NOIR dure 0,5 s EN TOUT avant l'œuf — fondu 0,2 s puis vraiment
  // ÉTEINT 0,3 s (via d._fade, lu par d8Fn).
  const tb=d._ckAt-0.5;
  d._fade = d.age<tb ? 1 : Math.max(0, 1-(d.age-tb)/0.2);
  const tt=d.age-d._apAt;                                          // chaîne ROUGE -> ORANGE -> JAUNE
  let c0=null, c1=null, f=0;
  if (tt<0.55){ d.coreColor=RED; return; }
  else if (tt<0.75){ c0=RED; c1=D8_ORG; f=(tt-0.55)/0.2; }
  else if (tt<1.05){ d.coreColor=D8_ORG; return; }
  else if (tt<1.25){ c0=D8_ORG; c1=YEL; f=(tt-1.05)/0.2; }
  else { d.coreColor=YEL; return; }
  if (!d._mix) d._mix=new THREE.Color();
  d._mix.setRGB(c0.r+(c1.r-c0.r)*f, c0.g+(c1.g-c0.g)*f, c0.b+(c1.b-c0.b)*f);
  d.coreColor=d._mix;
}
function d8Fn(d,A,dt){
  if (d.comp===1) return d._lit ? {intenMul:1.3*Math.pow(d._gk||0,0.7)} : {intenMul:0};   // comète SANS TÊTE puis tête rouge qui GROSSIT
  if (d.comp===2) return d._on ? {intenMul:1.15*(d._fade!=null?d._fade:1)} : {intenMul:0};   // invisible avant le balayage, NOIR avant l'œuf
  return null;
}
// D9 (B271, définition user + 2 captures vidéo) : « bombe 150 mm D9 » (515089000, 183 m) :
//  1) au break : CERCLE JAUNE de 17 étoiles VISIBLES (sens aléatoire, défauts B268) + PIVOINE
//     SANS ÉTOILE : ~80 brins aux étoiles invisibles, traînées kamuro BRONZE (chaudes) qui
//     partent TOUTES DU CENTRE, vitesses variées -> boule PLEINE, pas de trou ;
//  2) quand les traînées sont assez grandes (~1,9 s) : les MÊMES étoiles du cercle passent
//     JAUNE -> NOIR (fondu ~1,2 s, éteintes 0,3-1 s) -> puis NOIR -> ROUGE en PROGRESSIF
//     (balayage du tour, têtes qui regrossissent — même plan que le jaune, mêmes étoiles) ;
//  3) à la fin (~3,3 s) : le CENTRE clignote TRÈS LÉGÈREMENT (plume) dans les traînées.
let _d9B=null;
const D9_BRONZE=new THREE.Color(0.78,0.34,0.15);                   // B288 (photo user) : CUIVRE SOMBRE rouille, à peine au-dessus du noir — pas d'or
function distD9(i,n,rnd){
  if (i===0){
    const F=vrand(rnd);
    let U=cross(F,[0,1,0]); if(len2(U)<0.01)U=cross(F,[1,0,0]); U=norm(U);
    _d9B={F, U, V:norm(cross(F,U))};
  }
  if (i<19){ const B=_d9B, th=2*Math.PI*i/19+(rnd()-0.5)*0.14, ct=Math.cos(th), st=Math.sin(th);   // CERCLE 19 étoiles (défauts B268)
    const w=(rnd()-0.5)*0.14;
    const dx=B.U[0]*ct+B.V[0]*st+B.F[0]*w, dy=B.U[1]*ct+B.V[1]*st+B.F[1]*w, dz=B.U[2]*ct+B.V[2]*st+B.F[2]*w;
    const L=Math.hypot(dx,dy,dz)||1;
    return {dx:dx/L, dy:dy/L, dz:dz/L, spMul:0.75*(0.91+rnd()*0.18), comp:0}; }   // B275 (user) : MÊME VITESSE que la pivoine (le cercle reste au bord de la boule)
  if (i<39){ const v=vrand(rnd); return {dx:v[0],dy:v[1],dz:v[2], spMul:0.11+rnd()*0.08, comp:2}; }   // centre discret
  const v=vrand(rnd); return {dx:v[0],dy:v[1],dz:v[2], spMul:0.82+rnd()*0.28, comp:1};   // PIVOINE de traînées : pleine depuis le centre, enveloppe SPHÉRIQUE ±15 % (B286, user)
}
function behaveD9(d,A,dt,ctx){
  if (d.comp===0){
    if (d._bkAt===undefined){
      if (!ctx._d9S) ctx._d9S={k0:(Math.random()*19)|0, dir:Math.random()<0.5?1:-1};
      const S=ctx._d9S, order=(((d._i-S.k0)*S.dir)%19+19)%19;
      d._bkAt=0.48+Math.random()*0.06;                             // B276 (user) : JAUNE 0,5 s -> NOIR 0,5 s -> le rouge commence à 1 s
      // ROUGE en CHENILLE : le tour se fait en 1,5 s (apparitions 1,0 -> 2,5 s), vies ~0,65 s
      // -> quand la DERNIÈRE s'allume, la 10ᵉ est déjà éteinte.
      d._redAt=Math.max(d._bkAt+0.30, 1.0+order*0.083+(Math.random()-0.5)*0.10);
      d.life=d._redAt+0.60+Math.random()*0.12;
      d._sz=(ctx.cfg.compSize&&ctx.cfg.compSize[0])||ctx.cfg.starSize;
      d.gMul=0.08;                                                 // B281 : le cercle reste solidaire de la nappe (rien ne tombe)
    }
    if (!d._lit && d.age>=d._redAt){ d._lit=true; d.coreColor=RED; }
    if (d._lit && (d._gk===undefined || d._gk<1)){                 // la tête ROUGE regrossit (B266)
      d._gk=Math.min(1,(d.age-d._redAt)/0.30);
      ctx.size[d._i]=d._sz*STAR_SCALE*(0.25+0.75*d._gk);
      ctx.geo.attributes.size.needsUpdate=true;
    }
    return;
  }
  if (d.comp===1){
    // Les POINTES de la pivoine clignotent À LA TOUTE FIN (2 clignotements rapides ~0,45 s).
    if (d._t1===undefined){
      // B287 (user : « trop précis, on dirait des boules de Noël ») : chaque pointe a SON
      // départ (fenêtre 0,45 s) et SES durées/écarts de pulsations.
      d._t1=4.0+Math.random()*0.45;
      d._a1=0.02+Math.random()*0.08; d._d1=0.30+Math.random()*0.16;   // B288 (user) : UN SEUL scintillement doux puis extinction
      d.life=Math.max(d.life, d._t1+d._a1+d._d1+0.05);
      d.gMul=0.04; }                                               // B281 (user : « le centre on dirait un saule ») : SANS gravité les brins lents ne tombent plus pendant l'émission — rayons droits partout, pas de queues qui pendent au cœur
    // B285 (vidéo user) : les brins CONTINUENT DE GRANDIR — plus de coupure à 1,4 s (la
    // trajectoire reste droite : gravité ~0 + pas de vent) ; l'émission ne s'arrête qu'au final.
    if (!d._rl && d.age>=d._t1){ d._rl=true; d.coreColor=RED; d.trailing=false; }
    return;
  }
  if (d.comp!==2) return;
  if (d._t0===undefined){                                          // B276 (user) : le centre clignote DIRECT après la fin du cercle rouge (2,5 s)
    d._t0=2.5+Math.random()*0.40; d.coreColor=RED;                 // B287 : départs ÉTALÉS, propres à chaque étoile (anti « boules de Noël »)
    d._a1=0.04+Math.random()*0.12; d._d1=0.45+Math.random()*0.20;  // B288 (user) : UN SEUL scintillement doux puis extinction
    d.life=d._t0+d._a1+d._d1+0.05;
    d.gMul=0.03; }                                                 // B280 (user) : le centre cli reste VRAIMENT AU CENTRE — pas de chute (la nappe de grains ne tombe pas non plus, tout dérive ensemble au vent)
}
// B272 (user) : plume = DEUX clignotements seulement. B284 : clignotement DOUX (enveloppe en
// cloche sinus, montée/descente progressives) et MOINS RAPIDE.
const d9Bump=(p,a,dur)=> (p>a&&p<a+dur) ? Math.sin(Math.PI*(p-a)/dur) : 0;
function d9Fn(d,A,dt){
  if (d.comp===1){                                                 // pivoine SANS étoile… jusqu'au final
    if (!d._rl) return {intenMul:0};
    const p=d.age-d._t1;                                           // UN scintillement doux, propre à CHAQUE étoile (B288)
    return {intenMul: 0.95*d9Bump(p,d._a1,d._d1)};
  }
  if (d.comp===0){
    if (d._lit) return {intenMul:1.7*Math.pow(d._gk||0,0.7)};      // ROUGE qui grossit — VIF (B274)
    if (d._bkAt===undefined || d.age<d._bkAt) return {intenMul:1.7};   // JAUNE VIF, ultra court
    return {intenMul:1.7*Math.max(0,1-(d.age-d._bkAt)/0.15)};      // fondu vers le NOIR
  }
  const p=d.age-(d._t0||9);                                        // centre : UN scintillement ROUGE doux, désynchronisé (B288)
  return {intenMul: d._a1!==undefined ? 0.75*d9Bump(p,d._a1,d._d1) : 0};
}
// COROLLE À POINTES (B307, vidéo R9CxUBmsER0 décomposée) : « bombe 100 mm corolle à pointes
// argent/rouge/multicolore » (510463/468/469, 130 m) + « 75 mm corolle or pointes rouge »
// (575524000, 90 m). ~8 FAISCEAUX de 2-4 comètes orange épaisses, directions asymétriques,
// qui retombent en pétales (corolle) ; à +0,55-1,05 s la POINTE de chaque comète s'allume
// dans sa couleur (argent/multicolore = couleurs au hasard par pointe), ~1,2 s, le tout ~2,5 s.
let _corB=null;
const COR_MULTI=[RED, GRN, BLU, YEL, PINK, PURP, SILVER];
function distCorolle(i,n,rnd){
  const v=vrand(rnd);                                              // B311 (user) : 8 PORTEURS dans des directions TOTALEMENT aléatoires (avant/arrière/côtés/diago…)
  return {dx:v[0], dy:v[1], dz:v[2], spMul:0.9+rnd()*0.2, comp:0};
}
function behaveCorolle(d,A,dt,ctx){
  if (d._split){                                                   // BRIN : la pointe s'allume peu après sa naissance
    if (d.tipAt===undefined){
      d.tipAt=0.25+Math.random()*0.40;
      d.life=Math.min(d.life, d.tipAt+0.95+Math.random()*0.15);    // B312 (user) : l'étoile rouge n'est visible que ~1 s
      const tc=ctx.cfg.colors[1];
      d._tip = (tc && tc.isColor) ? tc : COR_MULTI[(Math.random()*COR_MULTI.length)|0];
    }
    if (!d._lit && d.age>=d.tipAt){ d._lit=true; d.coreColor=d._tip; }
    return;
  }
  // PORTEUR (bombette) : vole ~0,3-0,45 s avec sa traînée kamuro puis crache ses 4 brins
  if (d._splitAt===undefined) d._splitAt=0.30+Math.random()*0.15;
  if (d.age<d._splitAt) return;
  const px=ctx.pos[d._i*3], py=ctx.pos[d._i*3+1], pz=ctx.pos[d._i*3+2];
  const vL=Math.hypot(d.vx,d.vy,d.vz)||1, ux=d.vx/vL, uy=d.vy/vL, uz=d.vz/vL;
  const base=ctx.cfg.burstRadius;
  for (let c=0;c<4 && ctx.nAlive<ctx.nMax;c++){
    const v=vrand(Math.random);
    const ix=ux+v[0]*0.30, iy=uy+v[1]*0.30, iz=uz+v[2]*0.30;       // éventail autour de l'élan du porteur (B310, user : moins serré)
    const L=Math.hypot(ix,iy,iz)||1, esp=base*(1.0+Math.random()*0.35);
    // B313 (user) : brins SÉPARÉS dès la base — chacun naît un peu décalé latéralement
    const ox=(ix/L-ux)*1.5, oy=(iy/L-uy)*1.5, oz=(iz/L-uz)*1.5;
    ctx.addStar(px+ox,py+oy,pz+oz, ix/L*esp, iy/L*esp, iz/L*esp, 2.0+Math.random()*0.4, 0, true, null);
  }
  d.age=d.life;                                                    // le porteur meurt au fork
}
function corolleFn(d,A,dt){ return d._lit ? {intenMul:1.6} : {intenMul:0.5}; }   // tête discrète (la traînée domine) puis POINTE colorée vive
// D10 (B290, vidéo S0MK2jOLu4g + définition user) : « bombe 150 mm D10 » (515090000, 183 m) —
// tout en même temps au break :
//  1) MINI PIVOINE BLEUE : ~30 étoiles en petite boule ronde (~1,7 s) ;
//  2) 20 COMÈTES KAMURO en cercle (plan aléatoire, défauts B268), recette traçante B211 en or —
//     gros rayons pointus qui durent (~4-4,5 s) et retombent doucement ;
//  3) CERCLE ROUGE PROGRESSIF (son propre plan) : les 19 étoiles apparaissent une à une
//     (balayage ~1,8 s, têtes qui grossissent B266) puis chacune DEVIENT UN SCINTILLANT BLANC
//     à la fin (strobe blanc ~0,7-0,95 s) et s'éteint.
let _d10B=null;
function distD10(i,n,rnd){
  if (i===0){
    const mk=()=>{ const F=vrand(rnd);
      let U=cross(F,[0,1,0]); if(len2(U)<0.01)U=cross(F,[1,0,0]); U=norm(U);
      return {F, U, V:norm(cross(F,U))}; };
    _d10B={A:mk(), B:mk()};                                        // deux plans indépendants
  }
  const ring=(P,k,nn,sp)=>{ const th=2*Math.PI*k/nn+(rnd()-0.5)*0.14, ct=Math.cos(th), st=Math.sin(th);
    const w=(rnd()-0.5)*0.14;
    const dx=P.U[0]*ct+P.V[0]*st+P.F[0]*w, dy=P.U[1]*ct+P.V[1]*st+P.F[1]*w, dz=P.U[2]*ct+P.V[2]*st+P.F[2]*w;
    const L=Math.hypot(dx,dy,dz)||1;
    return {dx:dx/L, dy:dy/L, dz:dz/L, spMul:sp*(0.91+rnd()*0.18)}; };
  if (i<65){ const v=vrand(rnd); return {dx:v[0],dy:v[1],dz:v[2], spMul:0.24+rnd()*0.08, comp:0}; }   // MINI PIVOINE bleue — 65 étoiles (B296) ; retour B294 (B297, user)
  if (i<85){ const r=ring(_d10B.A, i-65, 20, 1.0); r.comp=1; return r; }                              // B297 (user) : comètes À PLAT en cercle, comme en B294
  const r=ring(_d10B.A, i-85, 19, 0.80); r.comp=2; return r;                                          // cercle rouge progressif — même plan que les comètes
}
function behaveD10(d,A,dt,ctx){
  if (d.comp!==2) return;
  if (d._redAt===undefined){
    if (!ctx._d10S) ctx._d10S={k0:(Math.random()*19)|0, dir:Math.random()<0.5?1:-1};
    const S=ctx._d10S, order=(((d._i-85-S.k0)*S.dir)%19+19)%19;
    d._bkAt=0.22+Math.random()*0.06;                               // B300 (user) : JAUNE encore plus bref (~0,25 s), puis extinction brève
    // B294 (user) : PROGRESSIF une par une, mais vie ≈ 4-5 étoiles -> un ARC COURANT de 4-5
    // rouges qui fait le tour (droite -> bas -> gauche -> haut sur les photos).
    d._redAt=Math.max(d._bkAt+0.25, 0.65+order*0.10+(Math.random()-0.5)*0.08);   // B301 : décalé de -0,25 s (suit la pivoine raccourcie)
    d._redDur=0.42+Math.random()*0.14;                             // ≈ 4-5 pas de balayage allumés à la fois
    d._whAt=3.0+Math.random()*0.28;                                // BLANC quasi EN MÊME TEMPS, après le tour complet
    d._wd=0.30+Math.random()*0.15;                                 // B298 (user) : blanc UNE FOIS (cloche douce) puis extinction — pas de clignotement
    d.life=d._whAt+d._wd+0.05;
    d._sz=(ctx.cfg.compSize&&ctx.cfg.compSize[2])||ctx.cfg.starSize;
  }
  if (!d._lit && d.age>=d._redAt){ d._lit=true; d.coreColor=RED; }
  if (d._lit && (d._gk===undefined || d._gk<1)){                   // la tête rouge grossit (B266)
    d._gk=Math.min(1,(d.age-d._redAt)/0.30);
    ctx.size[d._i]=d._sz*STAR_SCALE*(0.25+0.75*d._gk);
    ctx.geo.attributes.size.needsUpdate=true;
  }
}
function d10Fn(d,A,dt){
  if (d.comp===1) return {intenMul:0};                             // B291 (user) : PAS de boule — la POINTE de la traînée fait la comète
  if (d.comp!==2) return null;
  if (d._bkAt===undefined) return {intenMul:0};
  if (d.age<d._bkAt) return {intenMul:1.5};                        // JAUNE très bref au break
  if (!d._lit){                                                    // fondu rapide puis NOIR bref
    const f=(d.age-d._bkAt)/0.15;
    return {intenMul: f<1 ? 1.5*(1-f) : 0};
  }
  if (d.age>=d._whAt)                                              // BLANC UNE FOIS (B298) : cloche douce puis extinction
    return {intenMul: 1.7*d9Bump(d.age-d._whAt, 0, d._wd||0.4), whiteMix:0.95};
  if (d.age>=d._redAt+d._redDur) return {intenMul:0};              // B293 : la salve s'éteint avant la suivante
  return {intenMul:1.25*Math.pow(d._gk||0,0.7)};                   // phase ROUGE (salve)
}
// CERCLE PROGRESSIF FEUILLE MORTE (B257, vidéo 6uYWtp3o_T8 décomposée + définition user :
// « une feuille morte, entourée de 16 étoiles, qui s'allument les unes après les autres ») :
// au break, les 16 étoiles du cercle partent ÉTEINTES dans un plan debout face public
// (vitesse unique = cercle qui reste rond) ; l'allumage BALAYE le tour en ~1,15 s depuis un
// point de départ aléatoire (vidéo : ~3 allumées à +0,25 s, cercle complet à +1,15 s), chaque
// étoile brûle ~2,1 s avec une petite queue vers l'extérieur (couleur de l'étoile). Au centre,
// la FEUILLE MORTE (nuage lent qui tombe en tanguant, ~4 s — recette fallingLeaves B125).
let _fmB=null;
function distFmRing(i,n,rnd){
  if (i===0){
    const F=vrand(rnd);                                            // B260 (user) : SENS ALÉATOIRE par tir (à plat, de biais, face…), comme les cercles
    let U=cross(F,[0,1,0]); if(len2(U)<0.01)U=cross(F,[1,0,0]); U=norm(U);
    const V=norm(cross(F,U));
    _fmB={U,V};
  }
  const B=_fmB;
  if (i<16){
    const th=2*Math.PI*i/16+(rnd()-0.5)*0.06, ct=Math.cos(th), st=Math.sin(th);
    return {dx:B.U[0]*ct+B.V[0]*st, dy:B.U[1]*ct+B.V[1]*st, dz:B.U[2]*ct+B.V[2]*st, spMul:1.0, comp:0};
  }
  const v=vrand(rnd);                                              // FM : nuage 3D lent, biaisé vers le bas
  return {dx:v[0], dy:v[1]*0.6-0.15, dz:v[2], spMul:0.14+rnd()*0.38, comp:1};
}
function behaveFmRing(d,A,dt,ctx){
  if (d.comp!==0) return;
  if (d.tipAt===undefined){
    // B259 (user : « trop parfait ») : PETITS DÉFAUTS de mèche — le balayage est pré-tiré pour
    // tout le cercle : ~15 % des pas sont quasi NULS (2 étoiles s'allument ensemble), les autres
    // varient, et chaque instant a son propre jeu (l'ordre peut localement s'inverser).
    if (!ctx._fmSched){
      const k0=(Math.random()*16)|0, dir=Math.random()<0.5?1:-1, sched=new Array(16);
      let t=0.12;
      for (let o=0;o<16;o++){ sched[o]=t+(Math.random()-0.5)*0.05;
        t += (Math.random()<0.15) ? 0.008 : 0.060+Math.random()*0.032; }
      ctx._fmSched={k0,dir,sched};
    }
    const S=ctx._fmSched, order=(((d._i-S.k0)*S.dir)%16+16)%16;    // ordre du balayage autour du cercle
    d.tipAt=Math.max(0.05, S.sched[order]);
    d.life=d.tipAt+1.05+Math.random()*0.9;                         // B260 (user) : combustion plus courte, toujours INÉGALE (1,05-1,95 s)
    d.trailing=false;                                              // pas de queue avant l'allumage
    d.gMul=(d.gMul||1)*0.6;                                        // le cercle retombe moins vite que la FM
    d.swF=0; d.phase=0; d.swF2=0; d.phase2=Math.PI/2;              // annule le tangage (réservé à la FM)
  }
  if (!d._lit && d.age>=d.tipAt){ d._lit=true; d.trailing=true; }
}
function fmRingFn(d,A,dt){ return d.comp===0 ? (d._lit?{intenMul:1.25}:{intenMul:0}) : null; }
function shapeRing(){ const pts=[], n=24;
  for (let k=0;k<n;k++){ const t=2*Math.PI*k/n; pts.push({x:Math.cos(t),y:Math.sin(t),comp:0}); }
  return pts; }

// ============================================================================
// HOOKS onStar(d,A,dt) -> {intenMul?,whiteMix?} (visuel)  /  behave(d,A,dt,ctx) (physique)
// ============================================================================
function strobeFn(d){ const ph=(d.age*d.strobeF+d.phase)%1; return {intenMul: ph<0.18?1.4:0.4}; }
// SCINTILLANT (B170, définition user en mémoire) : « entre-deux — ni noir ni éclairé, pulse
// DOUX (sombre↔clair), lent/irrégulier » — sinus adouci, fréquence et phase propres par étoile.
function scintFn(d){ const ph=Math.sin(6.283*(d.age*d.strobeF*0.9)+d.phase2)*0.5+0.5;
  const v=1.9*Math.pow(ph,2.4); return {intenMul: v<0.15?0:v}; }   // B189 (user) : dans le creux, l'étoile DISPARAÎT COMPLÈTEMENT (fenêtre noire ~30% du cycle), pic 1.9
// ATOME (B191) : seuls les PAQUETS pot-à-feu (comp 2) scintillent ; pivoine (0) et brins (1) = combustion normale.
function atomStarFn(d,A,dt){ return d.comp===2 ? scintFn(d) : null; }
// SAULE OR POINTES 100mm (B199, user) : ALLUMAGE DIFFÉRÉ de la pointe — l'étoile brûle OR pendant
// ~2 s (les traînées dominent), puis la pointe S'ILLUMINE dans la couleur de la réf (colors[1]),
// brûle 1-1,5 s (B201, aléatoire par étoile) et s'éteint. tipAt = vie−durée couleur.
function behaveTipsLate(d,A,dt,ctx){
  if (d.tipAt===undefined) d.tipAt=Math.max(0.3, d.life-(1.0+Math.random()*0.5));
  if (!d._lit && d.age>=d.tipAt){ d._lit=true; d.coreColor=ctx.cfg.colors[1]||ctx.cfg.colors[0]; }
}
function tipsLateFn(d,A,dt){ return d._lit ? {intenMul:1.4} : {intenMul:0}; }   // B202 (user) : étoile INVISIBLE avant l'allumage — on ne voit que la POINTE de la traînée ; puis l'étoile APPARAÎT dans sa couleur
// GOUTTES SCINTILLANTES (B187, point essentiel user) : l'étoile qui scintille PERD des
// étincelles qui SCINTILLENT elles aussi — 1 à 5 max par traînée, semées en route (elles
// restent quasi sur place -> se retrouvent à 1-10 m derrière la tête). Ce sont de vraies
// mini-étoiles (addStar) : le scintFn de l'effet s'applique à elles aussi.
function behaveScintDrops(d,A,dt,ctx){
  if (d._split) return;   // les gouttes ne re-lâchent pas
  if (d._drops===undefined) d._drops=0;
  if (d._drops<5 && A>0.08 && A<0.9 && Math.random()<2.0*dt && ctx.nAlive<ctx.nMax){
    d._drops++;
    const px=ctx.pos[d._i*3], py=ctx.pos[d._i*3+1], pz=ctx.pos[d._i*3+2];
    ctx.addStar(px,py,pz, d.vx*0.18, d.vy*0.18, d.vz*0.18, 0.5+Math.random()*0.7, d.comp, false);
  }
}
// FINAL CLI. BLANC (catalogue « bombe à final cli. blanc <couleur> ») — cycle réel (user) :
// la poudre EXTÉRIEURE (couleur) crame pendant la course ; ~0,3s avant l'arrêt de l'étoile elle
// est FINIE -> l'étoile DISPARAÎT ; puis, une fois arrêtée, l'INTÉRIEUR clignote BLANC franc.
function finalCliFn(d,A){
  const t1=0.36+d.phase*0.06;                                  // fin de combustion couleur (~0,85-1,0s = ~0,3s avant l'arrêt ; léger décalage par étoile)
  if (A<t1) return null;                                       // 1) COULEUR pendant la course
  if (d.cliEnd===undefined) d.cliEnd=0.72+Math.random()*0.28;  // chaque étoile FINIT de clignoter à SON moment (72-100% de la vie -> fins bien étalées/aléatoires, user B84)
  if (A>=d.cliEnd) return { intenMul:0 };                      // plus de poudre cli. : éteinte
  const ph=(d.age*d.strobeF*3+d.phase)%1;                      // 2) DÈS l'extinction de la couleur : l'INTÉRIEUR clignote BLANC ~6-13 Hz (pas de pause — le "trou noir" = les creux du clignotement)
  return { intenMul: ph<0.25?1.7:0.12, whiteMix:1 };           // flash blanc vif / quasi éteint entre les flashs
}
// CLI. <blanc|rouge> (B212, user) : clignotant FRANC dès le break et jusqu'à l'extinction —
// flash vif / quasi éteint ~6-13 Hz, rythme propre par étoile (le MÊME clignotant que la fin
// du final cli., mais dans la COULEUR de l'étoile et pendant TOUTE la vie).
function cliFn(d,A){ const ph=(d.age*d.strobeF*3+d.phase)%1;
  return { intenMul: ph<0.25?1.7:0.12 }; }
// DAHLIA CENTRE CLI. BLANC (B214) : seul le PISTIL (comp 1) clignote ; l'enveloppe brûle normalement.
function dahliaCliFn(d,A,dt){ return d.comp===1 ? cliFn(d,A) : null; }
// MOITIÉ CHANGEANTE CENTRE CLI. (B223, réf 512064000 « moitié vert à violet moitié violet à
// vert centre cli. blanc ») : pistil = comp 2 (comps 0/1 = les moitiés de la coupe).
function cli2Fn(d,A,dt){ return d.comp===2 ? cliFn(d,A) : null; }
// CHANGEMENT DE COULEUR CROISÉ : à ~mi-vie, chaque moitié BASCULE vers la couleur de l'autre
// (vert -> violet, violet -> vert). Le pistil (comp 2) ne change pas. ⚠️ B225 (user : « ça rend
// pas bien ») : la bascule doit être quasi SYNCHRONE (couche de poudre d'épaisseur régulière) —
// mon étalement ±14 % donnait ~0,8 s de mélange vert/violet illisible dans chaque moitié.
function behaveColorSwap(d,A,dt,ctx){
  if (d.comp===2 || d._swapped) return;
  if (d._sw===undefined) d._sw=0.44+Math.random()*0.16;   // B226-B227 (user) : fenêtre de bascule 0,5 s (recalée B229 pour la vie réduite à 2,4 s)
  if (A<d._sw) return;
  // B228 (user : « le changement est trop propre ») : FONDU de 0,2 s à travers la couleur
  // intermédiaire (jaune -> ORANGE -> rouge), pas un interrupteur.
  const c0=ctx.cfg.colors[d.comp], c1=ctx.cfg.colors[(d.comp+1)%2];
  const f=Math.min(1, (d.age-d._sw*d.life)/0.2);
  if (f>=1){ d._swapped=true; d.coreColor=c1; return; }
  if (!d._mix) d._mix=new THREE.Color();
  d._mix.setRGB(c0.r+(c1.r-c0.r)*f, c0.g+(c1.g-c0.g)*f, c0.b+(c1.b-c0.b)*f);
  d.coreColor=d._mix;
}
// ZIGZAG (B229, définition user : « 53 étoiles, genre pivoine, qui vont DROIT, et entre 2 s et
// 2,5 s après, partent dans une AUTRE direction aléatoire ») : chaque étoile file tout droit
// puis BIFURQUE à son instant (2,0-2,5 s) vers une direction au hasard (relance ~8-13 m/s —
// la composition secondaire pousse l'étoile). Une seule bifurcation.
function behaveZigzag(d,A,dt,ctx){
  if (d._zz===undefined){ d._zz=2.0+Math.random()*0.5;
    // B232 (user) : après la bifurcation, la trajectoire n'est PAS linéaire — au hasard par
    // étoile : DROIT (~30 %), petite COURBE, ou jusqu'au DEMI-CERCLE (rotation continue de la
    // vitesse autour d'un axe propre, 0,6-3,0 rad/s).
    d._turn=(Math.random()<0.30)?0:(0.6+Math.random()*2.4)*(Math.random()<0.5?-1:1);
    d._ax=vrand(Math.random); }
  if (!d._zzd && d.age>=d._zz){ d._zzd=true;
    const v=vrand(Math.random), sp=8+Math.random()*5;
    d.vx=v[0]*sp; d.vy=v[1]*sp; d.vz=v[2]*sp; }
  if (d._zzd && d._turn){   // rotation de Rodrigues autour de l'axe de l'étoile
    const ang=d._turn*dt, c=Math.cos(ang), s=Math.sin(ang), ax=d._ax;
    const dot=ax[0]*d.vx+ax[1]*d.vy+ax[2]*d.vz;
    const rx=ax[1]*d.vz-ax[2]*d.vy, ry=ax[2]*d.vx-ax[0]*d.vz, rz=ax[0]*d.vy-ax[1]*d.vx;
    d.vx=d.vx*c+rx*s+ax[0]*dot*(1-c);
    d.vy=d.vy*c+ry*s+ax[1]*dot*(1-c);
    d.vz=d.vz*c+rz*s+ax[2]*dot*(1-c);
  }
}
function crackleFn(d,A,dt){ d.popOn=(d.popOn||0)-dt;
  if (d.popOn<=0 && Math.random()<7*dt) d.popOn=0.045;
  if (d.popOn>0) return {intenMul:2.3,whiteMix:0.9}; return null; }
function glitterFn(d){ return {intenMul: Math.random()<0.45?0.4:1.6}; }

// (behaveButterflyComet supprimé en B249 : les antennes vont DROIT — « pas de mouvement bizarre », user)
// PAPILLON (B250, user) : les ANTENNES n'ont PAS d'étoile visible — on ne voit que la POINTE
// de la traînée (les grains frais), comme la cascade et la règle famille dorée.
function butterflyFn(d,A,dt){ return d.comp===1 ? {intenMul:0} : null; }
// MÉDUSE (B235) : les 4 spermatozoïdes (comp 1) — montent avec la queue de cheval, puis
// DANDINENT (oscillation latérale, axe et rythme propres). Pendant le dandinement, la traînée
// normale S'ARRÊTE et l'étoile lâche des étincelles MINUSCULES (grain 0.35) et ÉPHÉMÈRES
// (~0,23 s) = la queue de spermatozoïde qui frétille.
function behaveMeduse(d,A,dt,ctx){
  if (d.comp!==1) return;
  if (d._wg===undefined){ d._wg=1.1+Math.random()*0.4; d._wf=4.5+Math.random()*3;
    d._wa=5.5+Math.random()*3; d._wp=Math.random()*6.28; }   // B239 (user) : TRÈS LÉGER (« c'est pas un poisson ») — ±0,5-1 m, pas 3-5 m
  if (d.age<d._wg) return;
  // B239 (user) : le spermatozoïde SUIT la direction de la queue de cheval (il garde son élan) ;
  // le dandinement = petite oscillation PERPENDICULAIRE à sa direction de vol, axe fixé à l'activation.
  if (d._wax2===undefined){ const L=Math.hypot(d.vx,d.vy,d.vz)||1;
    const u=[d.vx/L,d.vy/L,d.vz/L], w=cross(u,vrand(Math.random)), Lw=Math.hypot(w[0],w[1],w[2])||1;
    d._wax2=[w[0]/Lw,w[1]/Lw,w[2]/Lw]; }
  const s=Math.sin(d.age*d._wf+d._wp);                       // le frétillement
  d.vx += d._wax2[0]*s*d._wa*dt; d.vy += d._wax2[1]*s*d._wa*dt; d.vz += d._wax2[2]*s*d._wa*dt;
  d._sp=(d._sp||0)+dt*110;                                   // ~110 micro-étincelles/s
  const c=ctx.cfg.colors[1]||SILVER;                         // B236 (user) : queue de spermatozoïde BLANC ARGENTÉ, quelle que soit la couleur de la volée
  const px=ctx.pos[d._i*3], py=ctx.pos[d._i*3+1], pz=ctx.pos[d._i*3+2];
  while (d._sp>=1){ d._sp-=1;
    spawnTrail(px+(Math.random()-0.5)*0.2, py+(Math.random()-0.5)*0.2, pz+(Math.random()-0.5)*0.2,
      c.r,c.g,c.b, 0.28, 0.13, 0.6, d.vx,d.vy,d.vz, 0.25, 0.42, true); }   // B238 (user) : queue plus PETITE (grains 0.28, vie ~0,16 s)
}
function behaveFish(d,A,dt,ctx){
  const sp=Math.hypot(d.vx,d.vy,d.vz)||1, cx=d.vx/sp,cy=d.vy/sp,cz=d.vz/sp;
  const w=vrand(Math.random), dot=w[0]*cx+w[1]*cy+w[2]*cz;
  d.vx+=(w[0]-cx*dot)*15*dt; d.vy+=(w[1]-cy*dot)*15*dt; d.vz+=(w[2]-cz*dot)*15*dt;
  const keep=Math.max(Math.hypot(d.vx,d.vy,d.vz), ctx.cfg.burstRadius*0.55);
  const s2=Math.hypot(d.vx,d.vy,d.vz)||1; d.vx=d.vx/s2*keep; d.vy=d.vy/s2*keep; d.vz=d.vz/s2*keep;
}
function behaveSpinner(d,A,dt,ctx){
  const ang=6.63*dt, c=Math.cos(ang), s=Math.sin(ang);      // ~380°/s autour de Y
  const nx=d.vx*c-d.vz*s, nz=d.vx*s+d.vz*c; d.vx=nx; d.vz=nz; d.vy+=6.5*dt;
  if (A<0.9 && Math.random()<25*dt){
    const px=ctx.pos[d._i*3],py=ctx.pos[d._i*3+1],pz=ctx.pos[d._i*3+2];
    let s2=vrand(Math.random);
    spawnTrail(px,py,pz, SILVER.r,SILVER.g,SILVER.b, 0.9,0.4,0.9, s2[0]*4,-Math.abs(s2[2])*4-2,s2[1]*4);
  }
}
function behaveSaucer(d,A,dt,ctx){
  if (!d._reb && A>0.45){ d._reb=true; d.vy=Math.abs(d.vy)*0.3+rnd(9,12); }
  if (A<0.9 && Math.random()<28*dt){ const s=vrand(Math.random);
    const px=ctx.pos[d._i*3],py=ctx.pos[d._i*3+1],pz=ctx.pos[d._i*3+2];
    spawnTrail(px,py,pz, GOLD.r,GOLD.g,GOLD.b, 0.9,0.4,0.8, s[0]*4,s[1]*4,s[2]*4); }
}
// MARRON D'AIR MULTI (B157, user) : la bombe éclate et libère 5 MINI MARRONS **INVISIBLES**
// (un marron = juste du BRUIT — de la poudre de titane qui explose). Après 1,5 s d'attente,
// les 5 détonent à des instants ALÉATOIRES dans une fourchette de 0,5 s. La détonation =
// bouffée GRANULAIRE d'étincelles blanc-argent très brèves (PAS de halo lisse « simulé »).
// Le BOOM part au MÊME instant (hook audio).
let _onMarronPop = null;
function __setMarronPop(f){ _onMarronPop = f; }
function behaveMarron(d,A,dt,ctx){
  if (d._split || d._det) return;   // _split : garde (comme behaveMosaic)
  if (d._detAt===undefined){ d._detAt = 1.5 + Math.random()*0.7; d.hideStar=true; }   // B160 user : 1,5 s d'attente + instant ALÉATOIRE dans une fourchette de 0,7 s ; porteur INVISIBLE
  if (d.age < d._detAt) return;
  d._det=true;
  const px=ctx.pos[d._i*3], py=ctx.pos[d._i*3+1], pz=ctx.pos[d._i*3+2];
  // B167 (user) : UNE SEULE MATIÈRE QUI S'ÉCARTE — pas un halo remplacé par des étincelles.
  // Au départ tous les grains sont SUPERPOSÉS = « une étoile de 1 cm bien argentée »
  // (l'empilement additif la rend blanche-argent), puis LE MÊME PAQUET s'ouvre en CERCLE
  // jusqu'à ~4 m d'envergure ; l'argent (bref) s'éteint en route -> il reste l'orange chaud.
  // B168 (user + photo) : des CENTAINES d'étincelles par détonation (~300), envergure finale
  // 10 m. Vitesses SERRÉES (10,5-14 m/s) pour que le paquet reste circulaire et cohérent.
  for (let c=0;c<90;c++){ const v=vrand(Math.random), sp=10.5+Math.random()*3.5;   // grains ARGENT (brefs, 0,10-0,20 s)
    spawnTrail(px,py,pz, 1.40,1.44,1.55, 1.0, 0.35, (0.10+Math.random()*0.10)/0.26, v[0]*sp*4, v[1]*sp*4, v[2]*sp*4, 0.4, 0.42, true); }
  for (let c=0;c<220;c++){ const v=vrand(Math.random), sp=10.5+Math.random()*3.5;  // grains ORANGE fins (0,28-0,52 s -> le cercle final de ~10 m)
    spawnTrail(px,py,pz, 1.25,0.58,0.16, 0.7, 0.35, (0.28+Math.random()*0.24)/0.26, v[0]*sp*4, v[1]*sp*4, v[2]*sp*4, 0.5, 0.42, true); }
  if (_onMarronPop) _onMarronPop(px, py, pz);   // BOOM synchronisé pile sur la détonation visuelle (B256 : + position pour la distance)
  d.age=d.life;   // le porteur meurt à la détonation
}

function behaveMosaic(d,A,dt,ctx){
  if (d._split) return;                                                 // secondaires : ne re-forkent jamais
  if (d._splitAt===undefined) d._splitAt = 1.5 + Math.random()*0.5;     // DÉLAI burst->division : 1.5..2.0s ALÉATOIRE par comète
  if (d.age < d._splitAt) return;
  d._split=true;                                                        // chaque comète primaire = une VRAIE MINI-EXPLOSION
  const px=ctx.pos[d._i*3],py=ctx.pos[d._i*3+1],pz=ctx.pos[d._i*3+2];
  const base=ctx.cfg.burstRadius, n=ctx.cfg.coreSplit||12;
  // petit flash d'éclatement (la "détonation" du 2e étage)
  spawnTrail(px,py,pz, 1.0,0.85,0.6, 1.6, 0.2, 0.5);
  spawnTrail(px,py,pz, 1.0,0.85,0.6, 1.6, 0.2, 0.5);
  for(let c=0;c<n && ctx.nAlive<ctx.nMax;c++){
    const v=vrand(Math.random), esp=base*(0.95+Math.random()*0.85);          // spray SPHÉRIQUE + PUNCH (accélération)
    const ix=v[0]+d.vx/base*0.12, iy=v[1]+d.vy/base*0.12, iz=v[2]+d.vz/base*0.12; // garde un peu l'élan de la comète
    const L=Math.hypot(ix,iy,iz)||1;
    ctx.addStar(px,py,pz, ix/L*esp, iy/L*esp, iz/L*esp, 2.8+Math.random()*0.4, d.comp, true, d.coreColor);   // étoiles divisées : durée 2.8..3.2s (aléatoire/étoile)
  }
  d.age=d.life;
}

// ============================================================================
// TABLE DES EFFETS (clé absente -> BASE = profil pivoine)
// ============================================================================
const CAL_SCALE = { 30:0.50, 50:0.67, 75:1.0, 100:1.44, 125:1.87, 150:2.30, 200:2.58 };   // 30 mm ajouté B233 (bombettes de compact)
const STAR_SCALE = 1.0;   // taille globale des étoiles (user 2026-07-02 : 1.2 -> 1.1 ("un tout petit peu") puis -> 1.0 ("baisse encore").
                          //  Les effets à GROSSES étoiles — comète, palme, toupie, soucoupe, mosaïques — sont COMPENSÉS à chaque baisse pour ne pas changer.)
const BURST_PUNCH = 2.0;  // PUNCH d'explosion (user, vidéos réelles) : vitesse initiale ×2 ET freinage ×2 -> même envergure
                          // finale (distance ≈ v/drag), mais l'expansion se fait VITE au début (flou de mouvement fort à
                          // l'ouverture, proportionnel à la vitesse) puis les étoiles FREINENT -> boule quasi figée à l'extinction.
const APEX_SCALE = 0.89;  // pivoine 75mm -> ~80m (90×0.89, valeur voulue par l'user) — knob global de hauteur
const BASE = {
  stars:80, nMax:0, burstRadius:13.5, speedMul:1.8, speedJit:0.05,
  apex:90, riseTime:2.5, riseLean:12, G:9.8, gravStar:1.0, dragStar:0.70,
  color:new THREE.Color(1.0,0.22,0.015), riseColor:new THREE.Color(1.0,0.72,0.35),
  colors:null, heat:true, headSize:1.0, sway:0, starSize:2.2, lifeBase75:1.55, lifeJitter:0.13,
  dist:distFibonacci, dist2D:null, orient:'face', trailing:false, onStar:null, behave:null,
  gerbe:null, flashBig:false,
  // B158 (user) : TOUTES les bombes ont une PETITE EXPLOSION AU CENTRE — « vraiment une CENTAINE
  // de grains de riz qui S'ÉCARTENT et qui poussent les effets vers l'extérieur ». Grains FINS
  // (0.55) et nombreux (100) qui se dispersent -> PAS de boule orange fusionnée (le défaut B157).
  // Vies 0,2-0,5 s aléatoires. Dosable par effet (override) ; false = pas d'explosion (ex cascade).
  burstSparks:{ n:100, sp:4.0, grain:0.55 }
};
const EFFECTS = {
  // === EXISTANTS (intacts ; ring/couronne supprimé en B127, cf note plus bas) ===
  peony: {},
  // CHRYSANTHÈME (B196, définition user : « une pivoine plus petite (40 étoiles) avec des étoiles
  // + petites ») : « bombe 50 mm chrysanthème <couleur> », 10 réfs TOUTES en 50 mm, 74 m — bleu/
  // citron/multicolore/rose/verte/violette/rouge/blanche/orange. Couleur au sort par tir.
  // ⚠️ SANS traînée (la définition user n'en parle pas — l'ancienne recette or est retirée ; à
  // remettre s'il corrige, vidéos catalogue dispo, ex rouge kGuGolLIipY).
  chrysanthemum: { apex:74, cal:50, heat:false, pureColor:true, stars:40, starSize:1.4, speedMul:1.15, speedJit:0.05,   // B197 (user) : étoiles un peu plus petites (1.6 -> 1.4)
                   colorPairs:[[BLU],[YEL],[PINK],[GRN],[PURP],[RED],[WHITE],[new THREE.Color(1.0,0.45,0.08)]] },
  willow: { apex:95, heat:false, color:DIMGOLD, gravStar:0.5, dragStar:0.25, lifeBase75:2.7, lifeJitter:0.28, restExtra:4,   // B139 (user : « le haut ne monte pas, le bas baisse trop vite ») : gravStar 0.92->0.5 — le haut MONTE encore à t=1.5s, chute terminale 18->10 m/s, envergure INTACTE (la gravité ne joue pas sur l'horizontal)   // « bombe 75 mm à effet saule kamuro » (catalogue 95 m). B136 (photos user) : vies d'étoiles PLUS VARIABLES (±28% -> branches inégales, extinction échelonnée) ; restExtra 4 = laisser s'éteindre les longs brins (~1.9k grains résiduels au tir suivant, mesuré)
            starSize:0.9, speedMul:0.8, trailing:{emitUntil:0.95, period:0.008, grain:1.4, gF:0.13, lifeMul:18, color:COPPER, spark:true, jit:0.22} },  // ⚠️ B138 : RETOUR EXACT au B136 (user : « beaucoup trop gros ») — le "B137" déployé était un ÉDIT RATÉ (speedMul 1.5 passé SANS le dragStar 0.55 compensateur -> envergure ~118 m). B136 (photos) : brin = COLLIER DE PERLES fines/serrées (grain 1.4, period 0.008), très long (lifeMul 18), couleur CUIVRE, jit 0.22 = zéro poussière. SAULE = forme qui PEND ; KAMURO = or pailleté (spark) ; tête = POINTE (user B94)
  // KAMURO LONGUE DURÉE (B302, user : « comme le kamuro normal 75/100 ») : la recette willow
  // VALIDÉE déclinée — 550014000 (50 mm, 74 m) et 515007000 (150 mm, 200 m). Les brins du 150
  // durent naturellement bien plus longtemps (échelle des étoiles) = la « longue durée ».
  willowLong50: { apex:74, cal:50, heat:false, color:DIMGOLD, gravStar:0.28, dragStar:0.18, lifeBase75:3.3, lifeJitter:0.28, restExtra:4, wind:1.2,   // B306 (user) : dure + longtemps, et du MOUVEMENT (drag bas + brise B177) — plus de surplace
            starSize:0.9, speedMul:0.55, trailing:{emitUntil:0.95, period:0.008, grain:1.4, gF:0.13, lifeMul:18, color:COPPER, spark:true, jit:0.22} },
  willowLong150: { apex:200, cal:150, heat:false, color:DIMGOLD, gravStar:0.28, dragStar:0.18, lifeBase75:2.7, lifeJitter:0.28, restExtra:6, wind:1.2,   // B306 : idem mouvement
            starSize:0.9, speedMul:1.5, trailing:{emitUntil:0.95, period:0.008, grain:1.4, gF:0.13, lifeMul:18, color:COPPER, spark:true, jit:0.22} },
  // À TRONC SAULE KAMURO (B253, user : « saule kamuro avec le tronc de la zigzag ») :
  // « bombe 75/100 mm à tronc saule kamuro » (575165000 95 m / 510156000 116 m) = le saule
  // kamuro VALIDÉ ci-dessus, à l'identique, + la queue de fusée de RÉFÉRENCE (B232) à la montée.
  willowTrunk: { apex:95, heat:false, color:DIMGOLD, gravStar:0.5, dragStar:0.25, lifeBase75:2.7, lifeJitter:0.28, restExtra:4,
            starSize:0.9, speedMul:0.8, trunk:true, trailing:{emitUntil:0.95, period:0.008, grain:1.4, gF:0.13, lifeMul:18, color:COPPER, spark:true, jit:0.22} },
  willowStrobe: { apex:95, heat:false, pureColor:true, gravStar:0.5, dragStar:0.25, lifeBase75:1.7, lifeJitter:0.28, restExtra:4, stars:40, nMax:240,   // « bombe 75 mm SAULE OR POINTES SCINTILLANT rouge/vert » (575452000/575453000, 95 m). B187 (user) : 40 ÉTOILES, envergure -22% (speedMul 0.62), durée -1 s (1.7)
            starSize:2.0, splitStarSize:1.0, speedMul:0.62, onStar:scintFn, behave:behaveScintDrops, colorPairs:[[RED],[GRN]],   // étoiles 2.2 + GOUTTES SCINTILLANTES : chaque pointe sème 1-5 mini-étoiles qui pulsent aussi, à 1-10 m derrière
            trailing:{emitUntil:0.95, period:0.006, grain:0.9, gF:0.13, lifeMul:11, color:COPPER, spark:true, jit:0.22, bright:0.7} },   // traînée FINE (« des myriades de points », grain 0.9 dense) et MOINS LUMINEUSE (bright 0.7), cuivre
  // SAULE OR POINTES <couleur> (B198, user : « c'est pareil que le scintillant, sans le
  // scintillement ») : « bombe 75 mm saule or pointes <c> », 8 réfs 95 m (argent/roses/violettes/
  // rouge/bleues/or/vertes/multicolore, 575116000-575290000 ; existe aussi en 100 mm 116 m).
  // = willowStrobe SANS scintFn ni gouttes : pointes de couleur FIXE au sort par tir sur saule or.
  // (variante MULTICOLORE 575290000 = pointes mélangées, à décliner via assorted plus tard)
  willowTips: { apex:95, heat:false, pureColor:true, gravStar:0.5, dragStar:0.25, lifeBase75:1.7, lifeJitter:0.28, restExtra:4, stars:40,
            starSize:2.0, speedMul:0.62, colorPairs:[[GOLD],[SILVER],[RED],[GRN],[BLU],[PINK],[PURP]],
            trailing:{emitUntil:0.95, period:0.006, grain:0.9, gF:0.13, lifeMul:11, color:COPPER, spark:true, jit:0.22, bright:0.7} },
  // SAULE OR POINTES 100mm (B199, définition user — PAS une mise à l'échelle du 75 !) :
  // « comme une PIVOINE normale avec des traînées un peu plus marquées et longues. 4 s de temps
  // d'ascension, 2 s après l'explosion la POINTE des étoiles S'ILLUMINE (couleur de la réf),
  // dure 1-1,5 s (B201) et s'éteint. » Réfs 510047/049/050/051/052/053 (or/argent/violet/bleu/
  // rouge/vert, 116 m). Pivoine 100mm = 130 étoiles ; vie 3-3,5 s = ~2 s or + 1-1,5 s couleur.
  willowTips100: { apex:116, cal:100, heat:false, pureColor:true, stars:65, starSize:2.5, riseTime:3.96,   // 3.96×0.89×√(103.2/80) ≈ 4,0 s de montée. B203 : 2× moins d'étoiles (65). B206 (user) : étoiles allumées légèrement + grosses (2.2 -> 2.5 ; invisibles avant l'allumage donc n'affecte QUE les étoiles colorées)
            gravStar:0.6, dragStar:0.70, lifeBase75:2.26, lifeJitter:0.08, shrink:1.0, shrinkPow:2.2, restExtra:3,   // B201 (user) : vie 3,0-3,5 s = ~2 s d'or + 1-1,5 s de couleur
            behave:behaveTipsLate, onStar:tipsLateFn,
            colorPairs:[[GOLD,GOLD],[GOLD,SILVER],[GOLD,PURP],[GOLD,BLU],[GOLD,RED],[GOLD,GRN]],   // [or de base, couleur de POINTE] au sort par tir
            trailing:{emitUntil:0.95, period:0.006, grain:0.9, gF:0.13, lifeMul:2.0, color:COPPER, fixedColor:true, spark:true, jit:0.22, bright:0.85, fadeToStar:true, litBoost:1.7} },   // B203 : grains 0.9, longueur RÉGULIÈRE. B204 : fixedColor (traînée cuivre, étoile colorée). B205 (user) : litBoost 1.7 = traînées + longues et extinction + lente PENDANT la phase allumée
  comet: { apex:96, stars:1, dist:distComet, heat:false, color:GOLD, gravStar:0.90, dragStar:0.30,
           lifeBase75:3.0, starSize:5.4, speedMul:1.0, headSize:4.0, riseColor:GOLD,   // compensé (STAR_SCALE 1.2->1.0), taille inchangée (4.5×1.2)
           trailing:{emitUntil:0.97, period:0.012, grain:1.3, gF:0.35, lifeMul:1.8, color:GOLD} },
  sphere: { speedJit:0.02 },
  // (cercle/couronne SUPPRIMÉ en B127 — catalogue vérifié : plus AUCUNE bombe « effet cercle » seule
  //  en production (le 75mm est arrêté ; seuls restent des effets composés « centre cascade cercle », etc.))
  crackling: { apex:95, heat:false, color:CKGRN, pureColor:true, stars:83,                            // crackling VERT 75mm = pivoine VERT FLASHY 83 étoiles (texture neutre = vert franc) ; décliner via override {color}
    core:{ stars:20, radiusMul:0.42, color:GOLD, eggSplode:true, crackleAt:0.9, jitter:0.6 } },       // + pistil = ~20 étoiles ŒUF DE DRAGON INVISIBLES (on ne voit QUE le crépitement) : explosent étalées 0,9→1,5s après l'éclatement
  dragonEgg: { apex:95, heat:false, color:GOLD, stars:84, lifeBase75:2.4, starSize:0.7, arrow:true, speedMul:1.25, gravStar:0.5,  // ŒUF DE DRAGON (~40m, retombe peu = pivoine, pas saule) — 3 TEMPS :
    trailing:{emitUntil:0.95, period:0.013, grain:1.0, gF:0.12, lifeMul:2.0, color:EGGGOLD},          //  1) T=0 : éclate comme une pivoine mais étoiles TRÈS PETITES/DISCRÈTES (à peine une boule, on voit surtout la traînée : starSize 0.7 + arrow=dim 0.45)
    core:{ stars:30, radiusMul:0.30, color:GOLD, minCal:75, crackleAt:0.5, jitter:0.15 },             //  2) T≈0,5s : le CŒUR crépite (explose en boules) PENDANT que les étoiles se dispersent. 84+30 amas -> REMPLIT la sphère. PAS en 50mm
    crackleStars:{ delay:1.3, jitter:0.6, snaps:5 } },                                                //  3) chaque ÉTOILE explose entre 1,3 s et 1,9 s (jitter 0,6 = très étalé/aléatoire) en BOULE qui S'ÉTEINT sur place
  strobe: { apex:112, heat:false, color:SILVER, onStar:strobeFn, lifeBase75:2.4, gravStar:0.55 },
  // CLI. <blanc|rouge> (B212, user : « pivoine dont chaque étoile clignote dans sa couleur, de
  // l'éclatement à l'extinction ») : « bombe à effet cli. blanc/rouge » — 50 mm (74-85 m),
  // 75 mm (95 m), 100 mm (116 m), 125 mm (158 m), 150 mm « pivoine cli. » (200 m). Blanc OU
  // rouge au sort par tir. ⚠️ les « centre cli. blanc » (dahlia/moitié-moitié/kamuro) = effets
  // COMPOSÉS distincts, pas cet effet-ci.
  cli: { apex:95, heat:false, pureColor:true, onStar:cliFn, lifeBase75:2.2, lifeJitter:0.12, gravStar:0.6, starSize:2.1,   // B213 (user) : étoiles un poil moins grosses (2.2 -> 2.1)
         colorPairs:[[WHITE],[RED]] },
  // DAHLIA CENTRE CLI. BLANC (B214, premier jet) : « bombe 100 mm dahlia <couleur> centre cli.
  // blanc », 10 réfs à 122 m (blanc/citron/rouge/violette/bleu/rose/vert/orange/multicolore/aqua).
  // ENVELOPPE dahlia = PEU d'étoiles GROSSES qui vont LOIN et brûlent longtemps (déf UE « grosses
  // étoiles, plus long » + vidéos) ; PISTIL = cœur compact BLANC CLIGNOTANT (le cli. validé B212).
  // Le dahlia PUR 75 mm existe aussi (575578000+, vidéos K7jCppP90hY…) — variante à décliner.
  dahliaCli: { apex:122, cal:100, heat:false, pureColor:true, stars:64, starSize:3.2, speedMul:1.7, speedJit:0.06,   // B215 : 28 brins + 36 étoiles de pistil (2 lobes de 18)
             gravStar:0.55, dragStar:0.5, lifeBase75:2.4, lifeJitter:0.12, shrink:1.0, shrinkPow:2.2,
             dist:distDahliaCli, onStar:dahliaCliFn, compLife:{1:0.8}, compSize:{1:1.9},
             // PAS de traînée (B216-B217, user) : les lignes de la photo = la FUMÉE réelle des brins,
             // « mais t'en occupe pas » — on ne la simule pas.
             colorPairs:[[WHITE,WHITE],[YEL,WHITE],[RED,WHITE],[PURP,WHITE],[BLU,WHITE],[PINK,WHITE],[GRN,WHITE],
                         [new THREE.Color(1.0,0.45,0.08),WHITE],[CYAN,WHITE]] },   // [couleur enveloppe, pistil BLANC] au sort — blanc/citron/rouge/violette/bleu/rose/vert/orange/aqua
  // EXT. KAMURO CENTRE CLI. BLANC (B218) : « bombe 100 mm extérieur kamuro centre cli. blanc »
  // (510510000, 122 m ; existe en 125 mm 512062000, 157 m). ENVELOPPE = le saule kamuro VALIDÉ
  // (têtes-pointes 0.9, traînées cuivre collier de perles qui PENDENT) + PISTIL cli. blanc en
  // 2 demi-coquilles (le mécanisme du dahlia B215). Traînées sur l'enveloppe SEULE (trailComps).
  // MOITIÉ CHANGEANTE CENTRE CLI. BLANC (B223) : « bombe 125 mm moitié vert à violet moitié
  // violet à vert centre cli. blanc » (512064000, 157 m — famille 512063000-512068000 : citron/
  // bleu, rouge/bleu, citron/rose, orange/vert à décliner). Demi-demi splitFacing (la coupe se
  // lit dans le ciel) dont chaque moitié BASCULE vers la couleur de l'autre à ~mi-vie (croisé),
  // + pistil cli. blanc 40 petites étoiles en 2 demi-coquilles (comp 2, hors coupe).
  halfSwapCli: { apex:157, cal:125, heat:false, pureColor:true, stars:120, splitFacing:true, gravStar:0.6, lifeBase75:1.28, lifeJitter:0.06,   // B229 (user) : étoiles des moitiés −0,5 s (2,9 -> 2,4 s) ; B225 : vies resserrées (±6 %) pour une bascule lisible
             dist:distHalfSwapCli, onStar:cli2Fn, behave:behaveColorSwap, compLife:{2:1.46}, compSize:{2:1.6},   // B224 (user) : le cli. blanc dure ~3-4 s (compLife recalé 1.46 pour compenser la vie réduite des moitiés)
             colors:[GRN, PURP, WHITE] },   // [moitié A, moitié B, pistil] — vert/violet (512064000)
  // ZIGZAG (B229, définition user) : « bombe 100 mm zigzag rouge/argent » (510460000/510462000,
  // 130 m ; 125 mm rouge 512043000, 158 m). 53 étoiles genre pivoine qui vont DROIT puis
  // bifurquent chacune à 2,0-2,5 s vers une direction aléatoire ; BOMBE À TRONC : la montée
  // laisse une trace kamuro (flag trunk). Rouge ou argent au sort.
  zigzag: { apex:130, cal:100, heat:false, pureColor:true, stars:45, starsByCal:{100:45, 125:53}, starSize:2.1, speedMul:0.95,   // B230 (user) : 53 étoiles = le 125 mm ; le 100 mm en a un peu moins (45)
            gravStar:0.45, dragStar:0.30, lifeBase75:2.43, lifeJitter:0.10, trunk:true, behave:behaveZigzag,
            colorPairs:[[RED],[SILVER]] },
  kamuroCli: { apex:122, cal:100, heat:false, pureColor:true, stars:104, starSize:0.9, speedMul:0.8,   // B219 (user) : centre = 40 PETITES étoiles (2 lobes de 20)
             gravStar:0.25, dragStar:0.25, lifeBase75:2.7, lifeJitter:0.28, restExtra:4,   // B220 (user) : « la vitesse est bonne mais la physique est trop puissante » -> gravité 0.5 -> 0.15, recalée 0.25 (B221, user)
             dist:distKamuroCli, onStar:dahliaCliFn, compLife:{1:0.39}, compSize:{1:1.6}, trailComps:[0],   // B220 (user) : le centre dure 1,5 s
             colors:[DIMGOLD, WHITE],
             trailing:{emitUntil:0.95, period:0.008, grain:1.4, gF:0.13, lifeMul:8.5, color:COPPER, spark:true, jit:0.22} },   // B221 : 18 -> 10 (étincelles trop longues). B222 (user) : -> 8.5, traînées un peu moins longues pour que le CLI du centre ressorte
  finalCli: { apex:95, heat:false, color:PINK, pureColor:true, onStar:finalCliFn, lifeBase75:2.3, gravStar:0.7 },  // FINAL CLI. BLANC ROSE 75mm (catalogue, 95m) : pivoine rose -> les étoiles finissent en CLIGNOTANT BLANC ; décliner via {color} (citron/rouge/verte/bleue/violette)
  fallingLeaves: { apex:95, stars:75, dist:distLeaves, heat:false, color:new THREE.Color(1.0,0.45,0.55),
                   gravStar:0.75, gravJit:0.2, dragStar:0.5, lifeBase75:5.3, speedMul:0.5, sway:1.5, wind:1.8, noRise:true, starSize:2.1 },   // B125 (user) : durée -0,7s (5,3s) ; éclat compact, 75 étoiles, chute ~7 m/s ±20%, vent commun, jamais vers le haut
  palm: { apex:105, stars:15, dist:distFibonacci, heat:false, color:WHITE, onStar:glitterFn, gravStar:1.0, dragStar:0.6,   // PIVOINE (sphère, bien écartée) + traînée, 15 étoiles ; blanc scintillant + traînée OR
          lifeBase75:2.8, starSize:4.1, trailing:{emitUntil:0.97, period:0.006, grain:1.3, gF:0.45, lifeMul:9.0, color:GOLD} },  // FRONDES = TRÈS LONGUES queues dorées = la palme (compensé, taille inchangée = 3.4×1.2)
  palmStrobe: { apex:95, stars:15, dist:distFibonacci, heat:false, pureColor:true, onStar:scintFn, gravStar:0.85, dragStar:0.30, speedMul:0.62, wind:1.2, randomAxis:true,   // « bombe 75 mm PALME OR SCINTILLANT blanc/or » (575292000/575291000, 95 m). B177 (user : « on dirait figé ») : VENT commun par tir — les étincelles dérivent toutes ensemble, légèrement -> la nappe VIT
          lifeBase75:1.7, lifeJitter:0.18, starSize:2.0, shrink:1.0, shrinkPow:2.2, colors:[new THREE.Color(1.15,1.18,1.28)],   // B187 (user) : étoiles scintillantes à 2.2 (harmonisé avec le saule scintillant) ; blanches, FONDENT jusqu'à 0
          trailing:{emitUntil:0.97, period:0.006, grain:1.1, gF:0.05, lifeMul:8.5, color:new THREE.Color(1.12,0.60,0.20), longLaw:{p0:0.2, p1:0.5, min:2.8, max:7, pow:1.8}} },   // B181 (loi user) : proba d'étincelle LONGUE graduelle 2/10 (centre) -> 5/10 (bout) ; longues = 2,8-7 s biaisées bas (les ~7 s restent rares)
  palmMulti: { apex:105, stars:15, dist:distFibonacci, heat:false, pureColor:true, assorted:[GRN,RED,BLU], gravStar:1.0, dragStar:0.6, shrink:true,   // PALME MULTICOLORE 75mm (catalogue, user : 15 étoiles vertes/rouges/bleues)
          lifeBase75:3.0, starSize:2.6, trailing:{emitUntil:0.97, period:0.0022, grain:0.8, gF:0.45, lifeMul:8.15, color:EMBER, fixedColor:true, spark:true} },  // étincelles CHAUDES orangé/doré (EMBER) + DENSES (period 0.0022, B91) ; vie moy 1,9s ; étoiles réduites + shrink ; pointe verte/rouge/bleue

  // === FORMES 2D (face public) — chiffres catalogue vérifiés (web/data/effets.json, B127) ===
  heart:     { apex:116, cal:100, heat:false, stars:21, starSize:2.4, dist2D:shapeHeart, colors:[RED] },   // « bombe 100 mm à effet coeur » (510455/510456, rose ou rouge, 116 m) — N'EXISTE QU'EN 100mm, 21 étoiles (user)
  // PAPILLON (B246, vidéo décomposée) : « bombe 75 mm à effet papillon » (575525000, 90 m ;
  // existe en 100 mm 510461000, 130 m). 2 ailes de 16 points ROSES qui s'écartent + 2 comètes
  // or arquées à traînée qui survivent aux ailes (~×1,5 de vie).
  butterfly: { apex:90, heat:false, pureColor:true, stars:62, starSize:1.75, speedMul:1.1, speedJit:0.08,   // B248 (user) : ~30 étoiles PAR demi-cercle (+2 comètes). B252 : étoiles d'aile un poil plus petites (1.9 -> 1.75)
               gravStar:0.45, dragStar:0.5, lifeBase75:1.5, lifeJitter:0.12, compLife:{1:1.5},   // B249 (user) : antennes DROITES (plus de virage)
               dist:distButterfly3D, onStar:butterflyFn, trailComps:[1], colors:[PINK, GOLD],
               // B250 (user) : traînée d'antenne = LA RÉFÉRENCE queue du zigzag (B232) — grains FINS
               // cuivre 0.65 le long du trajet, vies ÉTAGÉES ~72 % brèves / 22 % moyennes / 6 % longues
               // (longLaw p constant 0.28, tirage biaisé bas) ; étoile invisible, la POINTE = les grains frais.
               trailing:{emitUntil:0.97, period:0.002, grain:0.85, gF:0.13, lifeMul:1.3, color:COPPER, fixedColor:true, spark:true, jit:0.4, bright:0.9,   // B252 (user) : traînée d'antenne un peu plus grosse (grain 0.65 -> 0.85)
                 longLaw:{p0:0.28, p1:0.28, min:0.65, max:2.9, pow:2}} },
  smiley:    { apex:95, heat:false, stars:22, starSize:2.4, dist2D:shapeSmiley, pureColor:true,
               colors:[new THREE.Color(1.0,0.45,0.08), GRN, RED] },   // « bombe 75 mm à effet sourire » (575547000, 95 m) — 15 cercle ORANGE + 2 yeux VERTS + 5 bouche ROUGE (user B128) ; texture neutre pour un vert franc
  daisy:     { apex:116, cal:100, heat:false, stars:45, starSize:2.3, dist2D:shapeDaisy, pureColor:true, speedJit:0.09, speedMul:0.9, dragStar:0.42, gravStar:0.10, lifeBase75:1.74, compLife:{1:0.6},
               trailing:{emitUntil:0.95, period:0.0018, grain:2.8, gF:0.12, lifeMul:3.2, color:new THREE.Color(1.15,0.66,0.24), spark:true, jit:3, rateFloor:0.55, bright:0.6}, trailComps:[0],   // B153 (user) : bande = MATIÈRE DENSE aux bords NETS. B244 (photo user : « halos dégueu ») : bright 0.6 — la bande redevient de la MATIÈRE, la lumière ne bave plus en halo autour des pétales
               colorPairs:[[GOLD,new THREE.Color(1.45,0.20,0.26)],[GOLD,new THREE.Color(0.36,1.45,0.56)],[GOLD,new THREE.Color(0.90,0.49,1.45)]] },   // B244 : HDR du cœur 1.7 -> 1.45 (la boule blanche saturée au centre = le halo « dégueu » du centre) ; rouge/verte/violette au sort

  // CERCLE (B245, brique) : au menu pour le RÉGLAGE — dans les produits réels il n'apparaît
  // qu'en COMPOSÉ. Couleur au sort par tir.
  ring:      { apex:95, heat:false, pureColor:true, stars:24, starSize:2.2, dist2D:shapeRing,
               colorPairs:[[RED],[GRN],[BLU],[YEL],[PINK],[PURP]] },

  // CERCLE PROGRESSIF FEUILLE MORTE — « bombe 100 mm cercle progressif <c1> feuille morte <c2> »
  // (510517000-510522000, 129 m, vidéos). [couleur du CERCLE, couleur de la FM] au sort par tir :
  // citron/bleu, vert/violet, bleu/rouge, rose/citron, orange/vert, rouge/argent.
  fmRing: { apex:129, cal:100, heat:false, pureColor:true, stars:61, starSize:2.2, speedMul:1.15, speedJit:0.04,
            gravStar:0.75, gravJit:0.2, dragStar:0.5, lifeBase75:3.5, lifeJitter:0.12, compLife:{1:0.82}, compSize:{1:0.95},
            sway:1.5, wind:1.8, restExtra:2,
            dist:distFmRing, behave:behaveFmRing, onStar:fmRingFn, trailComps:[0],
            trailing:{emitUntil:0.97, period:0.006, grain:0.8, gF:0.13, lifeMul:1.1, spark:true, jit:0.3, bright:0.85},   // queue héritée de la COULEUR de l'étoile (pas de fixedColor)
            colorPairs:[[YEL,BLU],[GRN,PURP],[BLU,RED],[PINK,YEL],[new THREE.Color(1.0,0.45,0.08),GRN],[RED,SILVER]] },

  // D8 — composé 150 mm (515088000, 183 m), définition user B264 : 55 centre bleu + 22 comètes
  // traçantes sans tête (têtes rouges à 1,5 s) + pivoine de la taille du cercle qui apparaît en
  // rouge par balayage à ~2 s puis rouge->orange->jaune->œuf de dragon.
  d8: { apex:183, cal:150, heat:false, pureColor:true, stars:207, starSize:2.2, speedMul:1.85, speedJit:0.05,   // B267 : 55 centre + 22 cercle + 130 pivoine (photo user ~135 étoiles visibles)
        gravStar:0.5, dragStar:0.45, lifeBase75:0.9, lifeJitter:0.10, compLife:{1:1.25, 2:1.6}, compSize:{0:1.8, 1:2.6},
        restExtra:3, dist:distD8, behave:behaveD8, onStar:d8Fn, trailComps:[1], colors:[BLU, RED, RED],
        trailing:{emitUntil:0.97, period:0.010, grain:0.9, gF:0.13, lifeMul:4.0, color:COPPER, fixedColor:true, spark:true, jit:0.16, bright:0.85} },   // B265 (user) : traînées plus longues (2.8 -> 4.0)

  // COROLLE À POINTES — 100 mm (510463/468/469, 130 m) + 75 mm or/rouge (575524000, 90 m).
  // [tête avant allumage, couleur de POINTE] au sort par tir ('multi' = couleur au hasard PAR pointe).
  corolle: { apex:130, cal:100, heat:false, pureColor:true, stars:8, nMax:44, starSize:2.6, speedMul:1.35, speedJit:0.06,   // B309 : 8 PORTEURS qui forkent en 4 brins chacun (photo user : bombettes distinctes)
             gravStar:0.2, dragStar:0.5, lifeBase75:1.75, lifeJitter:0.15, restExtra:3,   // B312 (user) : ca ne retombe quasiment pas
             dist:distCorolle, behave:behaveCorolle, onStar:corolleFn, trailComps:[0],
             colorPairs:[[SILVER,'multi'], [SILVER,RED], [SILVER,'multi']],
             trailing:{emitUntil:0.95, period:0.008, grain:1.4, gF:0.13, lifeMul:15, color:COPPER, fixedColor:true, spark:true, jit:0.22, backOff:0.35} },   // B308 (user) : chaque brin = TRAÎNÉE DE KAMURO (collier de perles cuivre), qui démarre ~30 cm derrière l'étoile de pointe
  // 75 mm COROLLE OR POINTES ROUGE (575524000, 90 m) : même mécanique, traînée or, étoiles rouges.
  corolleOr: { apex:90, cal:75, heat:false, pureColor:true, stars:8, nMax:44, starSize:2.6, speedMul:1.35, speedJit:0.06,
             gravStar:0.2, dragStar:0.5, lifeBase75:1.75, lifeJitter:0.15, restExtra:3,   // B312 (user) : ca ne retombe quasiment pas
             dist:distCorolle, behave:behaveCorolle, onStar:corolleFn, trailComps:[0],
             colorPairs:[[GOLD,RED]],
             trailing:{emitUntil:0.95, period:0.008, grain:1.4, gF:0.13, lifeMul:15, color:COPPER, fixedColor:true, spark:true, jit:0.22, backOff:0.35} },

  // D10 — composé 150 mm (515090000, 183 m), définition user : mini pivoine bleue + 20 comètes
  // kamuro (recette traçante B211 en or) + cercle ROUGE PROGRESSIF -> scintillant BLANC final.
  d10: { apex:183, cal:150, heat:false, pureColor:true, stars:104, starSize:2.1, speedMul:1.5, speedJit:0.05,   // B296 : 65 bleues + 20 comètes + 19 cercle
         gravStar:0.5, dragStar:0.45, lifeBase75:1.85, lifeJitter:0.12, compLife:{0:0.59}, compSize:{0:1.8, 1:2.6, 2:2.3},   // B301 (user) : pivoine bleue -0,1 de taille et -0,3 s (~2,5 s), toujours calée sur la fin du rouge
         restExtra:3, dist:distD10, behave:behaveD10, onStar:d10Fn, trailComps:[1], colors:[BLU, DIMGOLD, YEL],   // B292 : le cercle naît JAUNE (rouge posé par behave au balayage)
         // B297 : queues FUSÉE (référence zigzag/papillon). B303 (photo user) : vies des grains
         // ~×2,5 — les queues bronze restent LONGUES jusqu'à la fin du cercle rouge (~3 s).
         trailing:{emitUntil:0.97, period:0.0025, grain:0.8, gF:0.13, lifeMul:3.0, color:COPPER, fixedColor:true, spark:true, jit:0.4, bright:0.9,
           longLaw:{p0:0.30, p1:0.30, min:1.2, max:3.6, pow:2}} },

  // D9 — composé 150 mm (515089000, 183 m), définition user B271 : cercle JAUNE->NOIR->ROUGE
  // (mêmes étoiles) + pivoine sans étoile (traînées bronze pleines depuis le centre) + centre
  // qui clignote à peine. Traînées comp 1 seul.
  d9: { apex:183, cal:150, heat:false, pureColor:true, stars:199, starSize:2.1, speedMul:0.95, speedJit:0.05,   // B285 : croissance CONTINUE (drag 0.35) — vitesse recalée pour garder la taille finale B282
        gravStar:1.0, dragStar:0.35, lifeBase75:1.6, lifeJitter:0.10, compSize:{0:2.3, 2:1.7},   // B289 (user) : toutes les étoiles +0,2
        noFlash:true, burstSparks:false,                           // B281 : traînées BIEN DROITES jusqu'au bout (sway ET vent supprimés — le vent courbait les brins lents de ~5 m) ; pas de cœur brillant
        restExtra:5, dist:distD9, behave:behaveD9, onStar:d9Fn, trailComps:[1], colors:[YEL, DIMGOLD, RED],
        trailing:{emitUntil:0.97, period:0.013, grain:1.0, gF:0.005, lifeMul:24, color:D9_BRONZE, fixedColor:true, spark:true, jit:0.28, bright:0.62, rampIn:true} },   // B288 (photo user) : MOINS VISIBLE (bright 0.62), cuivre sombre — traînée dense/large (period 0.013, jit 0.28)

  // === MOTIFS 3D multi-couleurs ===
  // ATOME (B191, « bombe 150 mm atome <couleur> », 12 réfs, 165 m — N'EXISTE QU'EN 150mm ; étapes
  // vidéo GTIeDTIQl-0 disséquées par l'user) : PIVOINE couleur (vie courte, ×0.6 — elle meurt à
  // l'étape 3 pendant que les brins vivent) + 17 BRINS comètes or ~×1,75 plus loin (traînée cuivre
  // fine qui s'émiette en points, tête pointue qui file jusqu'au bout) + PAQUETS pot-à-feu blancs
  // SCINTILLANTS (7/brin, expulsés AU BREAK, ~2× plus lents -> milieu/bas de traînée) + résidu
  // orange central (afterGlow). Démo = réf MULTICOLORE (515081000) : couleur de pivoine au sort par tir.
  atom:    { apex:165, cal:150, heat:false, pureColor:true, stars:246, starSize:2.2, speedMul:2.45, speedJit:0.04,   // B195 (user) : pivoine 110 étoiles (83 en B193, 55 avant) et MOINS ÉPARSE (vitesses ±4%)
             riseTime:3.32,   // B194 (chrono user) : la bombe éclate à ~4 s de montée (3.32×0.89×√(146.8/80) ≈ 4,0 s)
             gravStar:0.45, dragStar:0.70, lifeBase75:1.5, lifeJitter:0.14, shrink:1.0, shrinkPow:2.2, restExtra:6,   // restExtra : les étincelles longues vivent jusqu'à ~10 s après le break
             dist:distAtom, onStar:atomStarFn, compLife:{0:0.46, 2:1.16}, compSize:{1:0.9, 2:1.9}, trailComps:[1],   // B194 (chrono user) : pivoine 1,6 s ; pots à feu 4,0 s ; brins ~3,4 s. B192 : brins = POINTE 0.9 (règle famille dorée B94)
             afterGlow:{dur:1.6, sc:2.6, op:0.30},
             trailing:{emitUntil:0.95, period:0.006, grain:1.6, gF:0.05, lifeMul:9, color:COPPER, spark:true, jit:1.0, bright:0.85,   // B194 (user) : brins plus LARGES (grain 1.6, dispersion jit 1.0)
               longLaw:{p0:0.04, p1:0.12, min:4.5, max:8.5, pow:1.8}},   // B194 (chrono user) : « seulement quelques étincelles, comme la palme, entre 7 et 10 s » — rares longues (4,5-8,5 s), extinction ~6,5-10,5 s après le break
             colorPairs:[[RED,GOLD,SCINTW],[GRN,GOLD,SCINTW],[BLU,GOLD,SCINTW],[YEL,GOLD,SCINTW],[new THREE.Color(1.0,0.45,0.08),GOLD,SCINTW],
                         [PINK,GOLD,SCINTW],[PURP,GOLD,SCINTW],[CYAN,GOLD,SCINTW],[WHITE,GOLD,SCINTW]] },   // rouge/verte/bleue/citron/orange/rose/violette/aqua/blanche (les 9 unies, 515077000-515086000) — VALIDÉ B195 sur la rouge, multicolore réactivé B196
  // DEMI-DEMI (user B131-B132 : « comme une pivoine normale mais avec deux couleurs différentes »,
  // et la séparation DOIT SE LIRE dans le ciel : moitié gauche/droite, ou haut/bas, ou diagonale,
  // ou inversé — au hasard). Catalogue : 7 réfs 75mm à 95 m. Profil PIVOINE intact (distFibonacci,
  // 80 étoiles), coupe `splitFacing` calculée au tir, paire du catalogue tirée au sort par volée.
  halfHalf:{ apex:95, heat:false, pureColor:true, stars:80, splitFacing:true,
             colorPairs:[[BLU,YEL],[RED,WHITE],[RED,BLU],[PINK,YEL],[GOLD,GRN],[YEL,PURP]] },   // bleu/citron · rouge/blanc · rouge/bleu · rose/jaune · or/vert · citron/violet
  // TRAÇANTE <couleur> (B208, définition user : « comme une pivoine mais avec les traînées de tout
  // à l'heure ») = PIVOINE (étoiles colorées, profil BASE) + la TRAÎNÉE CUIVRE du saule or pointes
  // (fadeToStar : elle se consume avec l'étoile). « bombe 75 mm traçante <c> » 100 m (10 réfs) ;
  // existe en 100 mm (130 m) et 125 mm tronc blanc (140 m). Couleur au sort par tir.
  tracer: { apex:100, heat:false, pureColor:true, stars:70, starSize:1.9, lifeBase75:1.5, lifeJitter:0.10, speedMul:1.60, gravStar:0.7, dragStar:0.55,   // B211 (user) : envergure -13% (speedMul 1.60), effet PLUS COURT (1.5 s) = les étoiles s'éteignent AVANT de retomber (gravStar 0.7)
            colorPairs:[[RED],[GRN],[BLU],[YEL],[new THREE.Color(1.0,0.45,0.08)],[PINK],[PURP],[CYAN],[WHITE]],   // rouge/vert/bleu/citron/orange/rose/violet/aqua/blanc
            trailing:{emitUntil:0.97, period:0.010, grain:0.9, gF:0.13, lifeMul:2.8, color:COPPER, fixedColor:true, spark:true, jit:0.16, bright:0.85} },   // B210 (photo user) : PAS collées — RAYONS RADIAUX fins/DISTINCTS, espacés (period 0.010), qui S'ESTOMPENT vers le centre ; bronze doré des saules (COPPER) ; PAS de fadeToStar. B211 : lifeMul 3.4->2.8 (tail réduit)

  // === MOUVEMENT / TRAÎNE (hooks existants) ===
  // MÉDUSE (B234, définition user — compact 30 mm uniquement) : la bombette lâche 4 MÉDUSES =
  // 4 étoiles en cône serré, chacune traîne (les 4 traînées = la « queue de cheval ») puis
  // DANDINE comme un spermatozoïde jusqu'à l'extinction. Couleur au sort (10 réfs) ; traînée =
  // couleur de la volée (trailColorFromStar).
  medusa:    { apex:42, cal:30, heat:false, pureColor:true, stars:17, starSize:0.8, speedMul:0.55, riseLean:2.5,   // B236 (user) : étoiles ENCORE plus petites — tout tient dans 30 mm. riseLean court (B241) : les tubes d'un compact sont précis, le motif de mèche doit se lire
               riseTrail:false, headSize:0.7, riseColor:new THREE.Color(0.55,0.40,0.20),   // B243 (user, compacts) : pas de traînée de montée — juste l'étoile qui monte, TRÈS discrète
               gravStar:0.55, dragStar:0.42, lifeBase75:6.0, lifeJitter:0.12, compLife:{0:0.55}, restExtra:3,   // B237 (user) : spermatozoïdes = MÊME taille que les autres (0.8, plus de compSize)
               randomAxis:true,   // B235 (user) : le sens de la queue de cheval est ALÉATOIRE (endroit/envers/côté)
               noFlash:true, burstSparks:false,   // B240 (user) : PAS de grosse explosion en l'air — ouverture discrète, « comme une queue de cheval » (idem cascade)
               dist:distMedusa, behave:behaveMeduse,
               // B236 (user) : PAS de traînée arrière sur la queue de cheval ; spermatozoïdes (comp 1)
               // BLANC ARGENTÉ quelle que soit la couleur de la volée.
               colorPairs:[[PINK,SILVER],[GRN,SILVER],[RED,SILVER],[PURP,SILVER],[YEL,SILVER],
                           [new THREE.Color(1.0,0.45,0.08),SILVER],[BLU,SILVER],[SILVER,SILVER],[CYAN,SILVER]] },
  horsetail: { apex:80, heat:false, stars:11, starSize:0.9, lifeBase75:3.2, gravStar:0.78, dragStar:0.55,   // tête = POINTE, pas une boule (user B94, effets dorés)
               color:GOLD, dist:distHorsetail, onStar:glitterFn,
               trailing:{emitUntil:0.95, period:0.014, grain:1.0, gF:0.55, lifeMul:3.0, color:GOLD} },
  cascade:   { apex:110, heat:false, stars:30, starSize:0.9, lifeBase75:5.5, lifeJitter:0.30, speedJit:0.45, gravStar:1.0, dragStar:0.55, randomAxis:true, restExtra:3.5, noFlash:true, hideStars:true, burstSparks:false,   // CASCADE (B118) : « quasiment pas d'explosion » (user) -> ni flash ni explosion centrale ; encore + d'ESPACE entre boules (vitesses ±45%) ; gouttes invisibles ; morts aléatoires
               color:GOLD, dist:distCascade, trailing:{emitUntil:0.96, period:0.004, grain:1.05, gF:0.37, lifeMul:12, color:EMBER, spark:true, jit:0.5, bright:0.5, fall:0.9, flatLife:true, rampIn:true, grainRampIn:0.18} },   // traînées ENCORE + LONGUES (vie ~3,1s -> sillage ~26m) + fondu d'apparition (anti blanc-cramé)

  // === BEHAVE (mouvement/forks) ===
  fish:    { apex:85, heat:false, stars:40, starSize:2.0, lifeBase75:0.95, gravStar:0.20, dragStar:0.30,
             color:GRN, dist:distFish, behave:behaveFish, trailing:{emitUntil:0.6,period:0.02,grain:0.7,gF:0.3,lifeMul:0.7,color:GRN} },
  spinner: { apex:70, heat:false, stars:3, starSize:5.3, lifeBase75:2.2, gravStar:0.30, dragStar:0.18,   // compensé, taille inchangée (4.4×1.2)
             color:SILVER, dist:distSpinner, behave:behaveSpinner },
  saucer:  { apex:60, heat:false, stars:1, starSize:5.5, lifeBase75:3.5, gravStar:0.85, dragStar:0.22,   // compensé, taille inchangée (4.6×1.2)
             color:GOLD, headSize:3.0, riseColor:GOLD, dist:distSaucer, behave:behaveSaucer,
             trailing:{emitUntil:0.9, period:0.012, grain:1.1, gF:0.4, lifeMul:1.4, color:GOLD} },
  mosaic:  { apex:100, heat:false, stars:7, nMax:36, coreSplit:4, starSize:5.3, splitStarSize:3.35, lifeBase75:3.0, color:SILVER, speedMul:1.8,   // compensé, taille inchangée (×1.2)
             dist:distMosaic, behave:behaveMosaic, trailing:{emitUntil:0.9, period:0.012, grain:1.2, gF:0.45, lifeMul:1.9, color:SILVER} },  // 75mm = 7 comètes, chacune se redivise en 4
  mosaicMix:{ apex:100, heat:false, stars:7, nMax:36, coreSplit:4, starSize:5.3, splitStarSize:3.35, lifeBase75:3.0, speedMul:1.8, assorted:true,   // compensé, taille inchangée (×1.2)
             dist:distMosaic, behave:behaveMosaic, trailing:{emitUntil:0.9, period:0.012, grain:1.2, gF:0.45, lifeMul:1.9, color:SILVER} },  // ASSORTIE : 2 rose, 2 citron, 2 aqua, 1 aléatoire

  // === SOL / SPÉCIAUX ===
  mine:   { color:RED, heat:false, pureColor:true, starSize:1.8, stars:55, gravStar:1.0, dragStar:0.21, shrink:true,   // POT À FEU (B145-146, définition user) : « bombe 75 mm pot à feu ROUGE » (575477000). EXPULSION INSTANTANÉE (bouchon de micro-billes) ; chaque bille = COMÈTE qui SE CONSUME (shrink) et s'éteint
            trailing:{emitUntil:0.95, period:0.008, grain:1.0, gF:0.05, lifeMul:7, color:new THREE.Color(0.30,0.17,0.14), jit:0.15},   // B146 (photo user) : la ligne derrière l'étoile = SA FUMÉE (mate, sous le seuil du bloom, quasi immobile, persistante) — PAS des étincelles qui brûlent. ⚠️ emitUntil OBLIGATOIRE sinon aucune émission (bug silencieux des B143-145)
            gerbe:{ dur:0.1, cometRate:420, cone:0.11, speedMul:2.0 } },                                    // ~42 billes en 0,1 s (75mm pur : nb à confirmer par l'user — règle : 40mm pur = 40 étoiles ; +comète = moins) ; vitesses 0.72-1.30 -> BAS DE COLONNE VIDE, pointe ~30 m. Variante « cli. rouge » (575488000)
  salute: { apex:62, cal:50, heat:false, stars:14, starSize:2.0, lifeBase75:0.22, color:SILVER, dist:distSalute, flashBig:true },   // « bombe 50 mm espagnole marron d'air » (62 m) : flash argenté MINIME — l'effet principal = le BRUIT (boom grave, audio.js)
  saluteMulti: { apex:77, heat:false, stars:5, nMax:5, starSize:1.1, lifeBase75:2.5, lifeJitter:0.05, speedMul:0.35, speedJit:0.15, gravStar:0.45,   // « bombe 75 mm CYLINDRIQUE espagnole MULTI marron d'air » (77 m, B160 user) : vie porteur 2.5 > détonation max 2.2 (sinon un marron mourait sans claquer)
    flashMini:true,                                                                                                                                   // break = mini flash + les 100 grains de riz universels (plus l'override orange fusionné)
    color:new THREE.Color(0.30,0.32,0.36), dist:distMarron, randomAxis:true, behave:behaveMarron },                                                   // les 5 MARRONS sont DU MÊME CÔTÉ de la bombe -> l'explosion les pousse TOUS dans la même direction (cône serré, orientation aléatoire par tir) ; invisibles ; 1,5 s puis détonations aléatoires dans 0,5 s
};

export const LABELS = { peony:'pivoine', chrysanthemum:'chrysanthème', willow:'saule (kamuro)', willowLong50:'kamuro longue durée 50 mm', willowLong150:'kamuro longue durée 150 mm', willowTrunk:'à tronc saule kamuro', willowStrobe:'saule or pointes scintillant', willowTips:'saule or pointes', willowTips100:'saule or pointes 100 mm', comet:'comète',
  sphere:'sphère', crackling:'crackling', dragonEgg:'œuf de dragon', strobe:'scintillant', cli:'cli. blanc/rouge', dahliaCli:'dahlia centre cli. blanc', kamuroCli:'ext. kamuro centre cli. blanc', halfSwapCli:'moitié changeante centre cli.', finalCli:'final cli. blanc rose', palmMulti:'palme multicolore', palmStrobe:'palme or scintillant',
  fallingLeaves:'feuille morte', palm:'palme', heart:'cœur', butterfly:'papillon', smiley:'smiley',
  daisy:'marguerite', atom:'atome', halfHalf:'demi-demi', tracer:'traçante', zigzag:'zigzag', ring:'cercle (brique)', fmRing:'cercle progressif feuille morte', d8:'150 mm D8 (composé)', d9:'150 mm D9 (composé)', d10:'150 mm D10 (composé)', corolle:'corolle à pointes 100 mm', corolleOr:'corolle or pointes rouge 75 mm', medusa:'méduse', horsetail:'queue de cheval',
  cascade:'cascade', fish:'poisson', spinner:'tourbillon', saucer:'soucoupe', mosaic:'mosaïque', mosaicMix:'mosaïque assortie',
  mine:'pot à feu', salute:"salut (marron d'air)", saluteMulti:"multi marron d'air",
  zMeduse:'compact 40 tirs z méduse' };

// ============================================================================
// SHELL
// ============================================================================
class Shell {
  constructor(arch, ox, oz, cal, opts){
    this.arch = EFFECTS[arch] ? arch : 'peony';
    this.cfg = Object.assign({}, BASE, EFFECTS[this.arch]);
    this.cfg.apex *= APEX_SCALE;   // abaisse TOUTES les hauteurs d'un coup (cfg est une copie -> safe)
    if (opts && opts.color) this.cfg.color = opts.color;   // override couleur (ex "crackling aqua", "mosaïque rouge")
    // PAIRES du catalogue (demi-demi) : chaque TIR pioche sa paire de couleurs (cfg = copie -> safe)
    if (this.cfg.colorPairs) this.cfg.colors = this.cfg.colorPairs[Math.floor(Math.random()*this.cfg.colorPairs.length)];
    // COMPACT (B241) : toutes les bombettes d'une séquence ont LA MÊME couleur (« z méduse citron »
    // = 40 bombettes citron) -> la paire est imposée par la séquence, pas tirée par bombette.
    if (opts && opts.pair) this.cfg.colors = opts.pair;
    // TRAÇANTE (B207) : la TRAÎNÉE prend la COULEUR de la volée (traçante rouge -> traînée rouge).
    // cfg.trailing est partagé avec le littéral EFFECTS -> CLONER avant d'écraser sa couleur.
    if (this.cfg.trailColorFromStar && this.cfg.trailing && this.cfg.colors)
      this.cfg.trailing = Object.assign({}, this.cfg.trailing, { color: this.cfg.colors[0], fixedColor:true });
    this.cal = cal || this.cfg.cal || 75;   // cfg.cal = calibre PAR DÉFAUT de l'effet (ex cœur : n'existe qu'en 100mm)
    // starsByCal (B230, zigzag — user : « 53 étoiles c'est le 125, le 100 en a un peu moins ») :
    // nombre d'étoiles PAR CALIBRE quand le catalogue le précise.
    if (this.cfg.starsByCal && this.cfg.starsByCal[this.cal]) this.cfg.stars = this.cfg.starsByCal[this.cal];
    this.ox = ox||0; this.oz = oz||0;
    this.bx = this.ox + (Math.random()-0.5)*this.cfg.riseLean;
    this.bz = this.oz + (Math.random()-0.5)*this.cfg.riseLean;
    // ANGLE DE TIR (démo formes B126) : mortier INCLINÉ -> la montée penche et la bombe éclate
    // décalée de [dx,dz] mètres (la trajectoire interpolée ox->bx dessine déjà la pente).
    if (opts && opts.lean){ this.bx += opts.lean[0]; this.bz += opts.lean[1]; }
    // direction du TUBE (≈ tangente de la pente de tir) : la SORTIE DE GUEULE (flamme/fumée/débris)
    // doit jaillir DANS L'AXE du mortier, pas à la verticale, sinon l'inclinaison ne se lit pas au sol.
    this.muTX=(this.bx-this.ox)/this.cfg.apex; this.muTZ=(this.bz-this.oz)/this.cfg.apex;
    this.dead = false; this.age = 0;
    // riseTime suit l'apex (×APEX_SCALE) -> la vitesse de montée reste identique (pas de comète molle)
    // B192 (user : « les 75 mm et les 150 mm éclatent au même endroit ») : la hauteur se LIT au TEMPS
    // de montée, pas qu'à l'altitude — balistique v0 ∝ √h => durée ∝ √h. Référence 80 m (pivoine 75) :
    // les 75 mm ne bougent pas (~2,2 s), cœur/marguerite 100 mm +10 %, atome 150 mm ~3,0 s.
    this.riseTime = this.cfg.riseTime * APEX_SCALE * Math.sqrt(this.cfg.apex/80) * (0.95 + Math.random()*0.10);
    this.headLastX=this.ox; this.headLastY=0; this.headLastZ=this.oz; this.headTimer=0;
    this.nMax = (this.cfg.nMax || this.cfg.stars) + (this.cfg.core ? this.cfg.core.stars : 0); this.nAlive = 0;
    this.data = []; this.flash=null; this.hasMuzzle=false;

    if (this.cfg.gerbe){               // POT À FEU : pas de montée ni burst, EXPULSION au sol
      this.phase='gerbe'; this.gerbeLeft=this.cfg.gerbe.dur;
      this.emitAcc=0; this.glowAcc=0; this.head=null;
      this.muzzleScale=this.cal/75; this.gerbeFlashDone=false;   // la CHASSE fait un vrai flash de gueule (B144)
    } else {
      this.phase='rise';
      // SORTIE DU TUBE (réf vidéo tir 150mm) : JET vertical -> CHAMPIGNON jaune-blanc/orange à la
      // gueule (lumière en bas), FLAMME BRÈVE + COLONNE DE FUMÉE qui monte + DÉBRIS. Échelle ∝ calibre.
      this.muzzleScale = this.cal/75;          // 75mm=1 · 150mm=2 · 50mm=0.67
      this.muAge=0; this.muFlameWin=0.15*Math.sqrt(this.muzzleScale); this.muSmokeWin=0.55;
      this.muFlameAcc=0; this.muSmokeAcc=0; this.muDebrisDone=false; this.hasMuzzle=true;
      this.headGeo=new THREE.BufferGeometry();
      this.headGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([this.ox,0,this.oz]),3));
      this.headMat=new THREE.PointsMaterial({ size:this.cfg.headSize, map:starTex, color:this.cfg.riseColor,
        transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, sizeAttenuation:true });
      this.head=new THREE.Points(this.headGeo,this.headMat); this.head.frustumCulled=false; scene.add(this.head);
    }

    const m=this.nMax;
    this.pos=new Float32Array(m*3); this.col=new Float32Array(m*3);
    this.size=new Float32Array(m).fill(this.cfg.starSize*STAR_SCALE);   // taille PAR étoile (défaut = taille de l'effet)
    this.lpos=new Float32Array(m*2*3); this.lcol=new Float32Array(m*2*3);
    this.geo=new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos,3));
    this.geo.setAttribute('aColor',   new THREE.BufferAttribute(this.col,3));
    this.geo.setAttribute('size',     new THREE.BufferAttribute(this.size,1));
    this.mat=makeStarMat(this.cfg.pureColor ? neutralTex : null);   // pureColor -> texture NEUTRE (la texture orange par défaut salit les couleurs franches, ex vert du crackling)
    this.points=new THREE.Points(this.geo,this.mat); this.points.visible=false; this.points.frustumCulled=false; scene.add(this.points);
    this.lgeo=new THREE.BufferGeometry();
    this.lgeo.setAttribute('position', new THREE.BufferAttribute(this.lpos,3));
    this.lgeo.setAttribute('color',    new THREE.BufferAttribute(this.lcol,3));
    this.lmat=new THREE.LineBasicMaterial({ vertexColors:true, transparent:true,
      blending:THREE.AdditiveBlending, depthWrite:false });
    this.lines=new THREE.LineSegments(this.lgeo,this.lmat); this.lines.visible=false; this.lines.frustumCulled=false; scene.add(this.lines);
    // (B76 "fantômes" retirés — remplacés en B77 par la déformation OVALE dans le shader, cf STAR_VS/STAR_FS.)
    this.vel=new Float32Array(m*3);   // vitesse par étoile -> attribut aVel (étirement ovale au shader)
    this.geo.setAttribute('aVel', new THREE.BufferAttribute(this.vel,3));
  }

  _numColors(){ return this.cfg.colors ? this.cfg.colors.length : 1; }
  faceNormal(){ return norm([0,0.12,-1]); } // face public (vers -nord, légèrement haut)
  life(){ const s=CAL_SCALE[this.cal]||1, j=this.cfg.lifeJitter;
    return this.cfg.lifeBase75*s*(1+(Math.random()*2-1)*j); }

  _newStar(vx,vy,vz, comp, trailing){
    return { vx,vy,vz, age:0, life:this.life(), dimVar:0.95+Math.random()*0.10,
      gMul:this.cfg.gravJit ? 1+(Math.random()*2-1)*this.cfg.gravJit : 1,   // gravité PAR ÉTOILE (feuilles mortes B123 : chute ±20%)
      phase:Math.random(), strobeF:2+Math.random()*2.5, swF:1.5+Math.random()*1.5,
      swF2:1.5+Math.random()*1.5, phase2:Math.random()*6.28, comp:comp||0,
      trailing:!!trailing, since:0, lastX:this.bx, lastY:this.cfg.apex, lastZ:this.bz };
  }

  addStar(px,py,pz, vx,vy,vz, life, comp, trailing, coreColor){
    if (this.nAlive>=this.nMax) return; const i=this.nAlive++;
    this.pos[i*3]=px; this.pos[i*3+1]=py; this.pos[i*3+2]=pz;
    this.size[i]=(this.cfg.splitStarSize||this.cfg.starSize)*STAR_SCALE;   // étoiles issues d'une division = + petites
    this.geo.attributes.size.needsUpdate=true;
    const s=this._newStar(vx,vy,vz, comp, trailing);
    s.life=life; s._i=i; s._split=true; s.lastX=px; s.lastY=py; s.lastZ=pz;
    if (coreColor) s.coreColor=coreColor;   // les secondaires héritent de la couleur de leur comète (mosaïque assortie)
    this.data[i]=s;
  }

  burst(){
    const apex=this.cfg.apex, bx=this.bx, bz=this.bz;
    const speed=this.cfg.burstRadius*this.cfg.speedMul*BURST_PUNCH, jit=this.cfg.speedJit;   // ×PUNCH : l'explosion PROPULSE (le drag ×PUNCH compense -> même envergure)
    let plane=null, pts=null, n;
    if (this.cfg.dist2D){
      pts=this.cfg.dist2D(Math.random, this.cal, this._numColors());
      n=Math.min(pts.length, this.nMax);
      // SENS ALÉATOIRE (user B130) : la bombe tourne sur elle-même, le plan du dessin part comme
      // il veut — mais avec une proba de « BON SENS » LÉGÈREMENT supérieure : ~55% face public
      // (±~25°) et dessin DEBOUT (±20°), sinon plan ET roulis complètement aléatoires (profil,
      // penché, tête en bas…). orient:'random' = toujours aléatoire complet.
      let N, roll;
      if (this.cfg.orient==='random' || Math.random()>=0.55){
        N=vrand(Math.random); roll=Math.random()*Math.PI*2;
      } else {
        const F=this.faceNormal(), tp=0.35;   // perturbation ≈ tan(19°) : un tir « bon sens » reste VRAIMENT lisible
        N=norm([F[0]+(Math.random()*2-1)*tp, F[1]+(Math.random()*2-1)*tp, F[2]+(Math.random()*2-1)*tp]);
        roll=Math.PI+(Math.random()-0.5)*0.7;   // π = debout avec la base aU/aV ci-dessous
      }
      let aU=cross(N,[0,1,0]); if(len2(aU)<0.01)aU=cross(N,[1,0,0]); aU=norm(aU);
      const aV=cross(N,aU);
      plane={aU,aV,CR:Math.cos(roll),SR:Math.sin(roll)};
    } else n=this.cfg.stars;
    // COULEURS ASSORTIES par étoile (coreColor -> étoile ET traînée de la même couleur) :
    // - assorted:true  = palette MOSAÏQUE (2 rose, 2 citron, 2 aqua, 1 aléatoire)
    // - assorted:[...] = palette de l'effet, répartie équitablement (ex palme multicolore [vert,rouge,bleu])
    let assorted=null;
    if (this.cfg.assorted){
      if (Array.isArray(this.cfg.assorted)){
        const src=this.cfg.assorted; assorted=[];
        for (let k=0;k<n;k++) assorted.push(src[k%src.length]);
      } else {
        const C3=[PINK,YEL,CYAN];   // "aléatoire" = au hasard PARMI les 3 (rose / citron / aqua)
        assorted=[PINK,PINK,YEL,YEL,CYAN,CYAN, C3[Math.floor(Math.random()*3)]];
      }
      for (let k=assorted.length-1;k>0;k--){ const j=Math.floor(Math.random()*(k+1));
        const t=assorted[k]; assorted[k]=assorted[j]; assorted[j]=t; }
    }
    // SENS ALÉATOIRE de la gerbe (B97, cascade) : un AXE au hasard par bombe (haut/bas/gauche/droite…),
    // toute la queue part dans ce sens (base orthonormée U/axe/V appliquée aux directions du dist).
    this._rAxis=null;
    if (this.cfg.randomAxis){ this._rAxis=vrand(Math.random);
      let u=cross(this._rAxis,[0,1,0]); if(len2(u)<0.01)u=cross(this._rAxis,[1,0,0]);
      this._rU=norm(u); this._rV=norm(cross(this._rAxis,this._rU)); }
    // COUPE FACE PUBLIC (B132, demi-demi) : la séparation doit SE LIRE dans le ciel — moitié
    // gauche/droite, haut/bas, diagonale ou inversée, au hasard. La normale de coupe est donc
    // tirée DANS LE PLAN ÉCRAN (⊥ axe public, angle uniforme) ± léger biais hors-plan (±~14°).
    // (Une coupe 3D uniforme mettait souvent un hémisphère DEVANT l'autre -> couleurs mélangées.)
    this._splitN=null;
    if (this.cfg.splitFacing){
      const F=this.faceNormal();
      const R=norm(cross(F,[0,1,0])), U=norm(cross(R,F));
      const phi=Math.random()*Math.PI*2, cp=Math.cos(phi), sp2=Math.sin(phi), tl=(Math.random()-0.5)*0.5;
      this._splitN=norm([R[0]*cp+U[0]*sp2+F[0]*tl, R[1]*cp+U[1]*sp2+F[1]*tl, R[2]*cp+U[2]*sp2+F[2]*tl]);
    }
    // VENT commun par tir (B120, feuilles mortes) : toutes les étoiles dérivent dans la MÊME direction
    // horizontale (un minimum de sens), le tangage individuel ne fait que broder autour.
    this._windX=0; this._windZ=0;
    if (this.cfg.wind){ const wa=Math.random()*Math.PI*2;
      this._windX=Math.cos(wa)*this.cfg.wind; this._windZ=Math.sin(wa)*this.cfg.wind;
      trailWindX=this._windX*0.55; trailWindZ=this._windZ*0.55; }   // B177 : la MÊME brise dérive les étincelles du pool (toutes ensemble, légèrement)
    this.nAlive=n;
    for (let i=0;i<n;i++){
      this.pos[i*3]=bx; this.pos[i*3+1]=apex; this.pos[i*3+2]=bz;
      let dir, comp=0;
      if (plane){ const p=pts[i];
        // DÉFAUTS légers (user B130) : les étoiles ne sont PAS exactement sur la courbe idéale
        // (±0.05 du rayon unité ≈ ±1,2 m à l'échelle) — une vraie bombe à motif est imparfaite.
        const ix=p.x+(Math.random()-0.5)*0.10, iy=p.y+(Math.random()-0.5)*0.10;
        const px=ix*plane.CR-iy*plane.SR, py=ix*plane.SR+iy*plane.CR;
        let dx=plane.aU[0]*px+plane.aV[0]*py, dy=plane.aU[1]*px+plane.aV[1]*py, dz=plane.aU[2]*px+plane.aV[2]*py;
        const v=vrand(Math.random); dx+=v[0]*0.08; dy+=v[1]*0.08; dz+=v[2]*0.08;   // + un peu d'ÉPAISSEUR hors-plan
        const L=Math.hypot(dx,dy,dz)||1;
        // vitesse ∝ RAYON du point dans la forme (L) : un point intérieur (œil/bouche du smiley,
        // creux du cœur) doit finir PLUS PRÈS du centre. Sans ce ×L, toutes les étoiles partaient
        // à la même vitesse -> tout finissait sur un CERCLE (la forme était détruite).
        dir={dx:dx/L,dy:dy/L,dz:dz/L,spMul:L*0.9*(0.94+Math.random()*0.12)}; comp=p.comp||0;
      } else { dir=this.cfg.dist(i,n,Math.random); comp=dir.comp||0;
        if (this._rAxis){ const A2=this._rAxis, U=this._rU, V=this._rV;   // AXE ALÉATOIRE (B97, cascade) : la gerbe "haut" est réorientée vers l'axe tiré au sort pour CETTE bombe
          dir={ dx:U[0]*dir.dx+A2[0]*dir.dy+V[0]*dir.dz, dy:U[1]*dir.dx+A2[1]*dir.dy+V[1]*dir.dz, dz:U[2]*dir.dx+A2[2]*dir.dy+V[2]*dir.dz, spMul:dir.spMul, comp:dir.comp }; }
        // COUPE demi-demi : couleur selon le CÔTÉ de la direction finale (+ BAVURE ±0.06 à la couture)
        // B223 : la coupe ne s'applique QU'À l'enveloppe (comps 0/1) — un PISTIL comp 2 (ex moitié
        // changeante centre cli.) garde son groupe.
        if (this._splitN && (dir.comp||0)<2) comp=(dir.dx*this._splitN[0]+dir.dy*this._splitN[1]+dir.dz*this._splitN[2]+(Math.random()-0.5)*0.12)>=0?0:1; }
      const sp=speed*(dir.spMul||1)*(1-jit+Math.random()*2*jit);
      // trailComps (B148, marguerite) : la traînée seulement pour certains GROUPES de couleur
      // (ex pétales OR avec bande d'étincelles, cœur/perles = points nets sans traînée)
      const trOK=!this.cfg.trailComps || this.cfg.trailComps.indexOf(comp)>=0;
      const s=this._newStar(dir.dx*sp, dir.dy*sp, dir.dz*sp, comp, trOK ? this.cfg.trailing : false);
      // compLife (B152, marguerite) : vie multipliée PAR GROUPE (ex le CŒUR rouge meurt EN PREMIER, ×0.6)
      if (this.cfg.compLife && this.cfg.compLife[comp]) s.life*=this.cfg.compLife[comp];
      // compSize (B191, atome) : taille PAR GROUPE (ex têtes de brins 3.3, paquets scintillants 1.9)
      if (this.cfg.compSize && this.cfg.compSize[comp]!=null){
        this.size[i]=this.cfg.compSize[comp]*STAR_SCALE; s.size0=this.cfg.compSize[comp];
        this.geo.attributes.size.needsUpdate=true; }
      s._i=i; s._split=false; if (assorted) s.coreColor=assorted[i%assorted.length];
      if (this.cfg.crackleStars){ s.crackle=true; s.crackleAt=this.cfg.crackleStars.delay+Math.random()*this.cfg.crackleStars.jitter; }  // crépite après délai (œuf de dragon)
      this.data[i]=s;
    }
    // PISTIL : un cœur d'étoiles plus petit (ex CRACKLING <couleur> = pivoine couleur + pistil
    // doré qui CRÉPITE). Les étoiles du cœur (d.crackle) poppent en blanc, surtout vers la fin.
    if (this.cfg.core && this.cal >= (this.cfg.core.minCal||0)){   // pas de cœur central sous minCal (ex 50mm = juste les étoiles)
      const co=this.cfg.core, cn=co.stars, csp=speed*co.radiusMul;
      for (let j=0;j<cn && this.nAlive<this.nMax;j++){
        const i=this.nAlive++, dir=distFibonacci(j,cn,Math.random), sp2=csp*(0.8+Math.random()*0.45);
        this.pos[i*3]=bx; this.pos[i*3+1]=apex; this.pos[i*3+2]=bz;
        // ŒUF DE DRAGON : les étoiles du cœur reçoivent la MÊME traînée que la coquille ; sinon (crackling) pas de traînée.
        const s=this._newStar(dir.dx*sp2, dir.dy*sp2, dir.dz*sp2, 0, this.cfg.crackleStars?this.cfg.trailing:false);
        s._i=i; s._split=false; s.crackle=true; s.coreColor=co.color;
        if (this.cfg.crackleStars || co.eggSplode){   // ŒUF DE DRAGON (cœur) OU pistil "étoiles œuf de dragon" (crackling <couleur>) : explosent en boule d'étincelles
          s.crackleAt=(co.crackleAt||0)+Math.random()*(co.jitter||0); s.isCore=true;   // tag : explosion taille "cœur" (params isCore), timing propre au cœur
          if (co.eggSplode) s.eggSplode=true;
        } else {                           // pistil doré à pops simples (autres effets à pistil)
          s.crackleAt=co.crackleAt||0;
          if (co.popOnly) s.popOnly=true;  // pops (pas d'étoile, pas de scintillement)
          if (co.life) s.life=co.life;     // le cœur s'arrête avant les étoiles
        }
        this.data[i]=s;
      }
    }
    this.points.visible=true;   // la queue-cône est dessinée par le shader (B82) ; lignes 1px éteintes
    if (!this.cfg.noFlash){   // cascade : PAS de flash d'ouverture (« quasiment pas d'explosion » -> pas de boule lumineuse au break)
      // B161 (photo user) : l'ancienne SPHÈRE de flash (mesh orange opaque) rendait comme un
      // « gros cercle orange dégueulasse ». Remplacée par une LUEUR DOUCE (sprite à dégradé
      // radial, additive) : la lumière du break, brève, sans bord dur.
      const big=this.cfg.flashBig, mini=this.cfg.flashMini;
      const sc=big?12:(mini?3:5), op=big?0.85:(mini?0.5:0.45), dur=big?0.30:(mini?0.10:0.12);
      const fr=big?1.6:1.5, fg2=big?1.62:1.15, fb=big?1.72:0.70;   // salut = blanc argenté ; bombes = blanc chaud
      spawnPuff(bx,apex,bz, 0,0,0, dur, sc*0.8, sc*1.35, fr,fg2,fb, op, 0, 1.0);
    }
    // afterGlow (B191, atome) : RÉSIDU chaud qui TRAÎNE au centre après le break (le point orange
    // des étapes 2-3 de la vidéo — le cœur qui finit de se consumer). Échelle ∝ calibre.
    if (this.cfg.afterGlow){ const ag=this.cfg.afterGlow, cm=this.cal/75;
      spawnPuff(bx,apex,bz, 0,0,0, ag.dur||1.5, (ag.sc||3)*cm, (ag.sc||3)*1.8*cm,
        1.0,0.45,0.12, ag.op||0.30, 0.5, 1.0); }
    // burstSparks (B157, user — UNIVERSEL) : la VRAIE petite explosion au centre (~1 m) qui
    // projette les effets — des « grains de riz » qui explosent et se consument 0,2-0,5 s
    // (aléatoire, flatLife). Taille ∝ calibre. Dosable/désactivable par effet.
    if (this.cfg.burstSparks){ const bs=this.cfg.burstSparks, c=bs.color||GOLD, calM=this.cal/75;
      for (let k=0;k<bs.n;k++){ const v=vrand(Math.random), sp2=(0.4+Math.random()*0.6)*bs.sp*calM;
        spawnTrail(bx,apex,bz, c.r,c.g,c.b, bs.grain||1.0, 0.4, (0.2+Math.random()*0.3)/0.26, v[0]*sp2*4, v[1]*sp2*4, v[2]*sp2*4, 0.8, 0.42, true); } }
    if (this.head){ scene.remove(this.head); this.headGeo.dispose(); this.headMat.dispose(); this.head=null; }
  }

  // MICRO-BILLE de pot à feu (B145, définition user) : expulsée du TUBE (base = 75 mm) à une
  // vitesse ASSEZ CONSÉQUENTE même pour les plus lentes -> le BAS DE LA COLONNE EST VIDE
  // (« si l'effet fait 10 m et le tube 50 cm, entre 50 cm et 3 m il n'y a quasi rien »).
  // La dispersion (biaisée bas, pow 1.5) étire le corps sur ~30-100% de la hauteur, les rares
  // rapides = la POINTE. Vie 1-1,5 s ; la bille est une COMÈTE : elle se CONSUME (shrink),
  // laisse des ÉTINCELLES (spark) puis s'éteint.
  _emitGerbeComet(){
    const g=this.cfg.gerbe, br=this.cfg.burstRadius;
    const A0=Math.random()*Math.PI*2, cone=Math.random()*g.cone, sc=Math.sin(cone), cc=Math.cos(cone);
    const sp=br*(0.72+0.58*Math.pow(Math.random(),1.5))*g.speedMul;
    const life=1.0+Math.random()*0.5;
    this.points.visible=true;
    this.addStar(this.ox+(Math.random()-0.5)*0.075, 1+Math.random()*0.5, this.oz+(Math.random()-0.5)*0.075,
      Math.cos(A0)*sc*sp, cc*sp, Math.sin(A0)*sc*sp, life, 0, this.cfg.trailing);
  }

  // SORTIE DU TUBE — 3 composantes (échelle ∝ calibre via muzzleScale) :
  // (B126) chaque jet suit l'AXE DU TUBE : + up×muTX/muTZ (mortier incliné -> la gueule crache en biais)
  _emitMuzzleFlare(){   // lueur de gueule (source lumière) : PETITE et contenue (user B84 : "- ronde, - grosse")
    const sc=this.muzzleScale, up=(1.5+Math.random()*1.5)*sc;
    spawnPuff(this.ox+(Math.random()-0.5)*0.3*sc, 1.0*sc, this.oz+(Math.random()-0.5)*0.3*sc,
      up*this.muTX, up, up*this.muTZ, 0.18+Math.random()*0.08, 1.2*sc, 2.4*sc,
      1.0,0.55,0.20, 0.50, 2*sc, 2.0);
  }
  _emitMuzzleFlame(){   // FLAMME : jet CONIQUE étroit (user B84 : "+ conique") — base serrée, monte plus haut, gonfle peu
    const sc=this.muzzleScale, ang=Math.random()*Math.PI*2, rad=Math.random()*Math.random();
    const out=(0.3+rad*1.1)*sc, up=(3.6+Math.random()*2.6)*sc, hot=1-rad;   // écart latéral réduit + vertical accru = cône
    spawnPuff(this.ox+(Math.random()-0.5)*0.18*sc, 0.8, this.oz+(Math.random()-0.5)*0.18*sc,
      Math.cos(ang)*out+up*this.muTX, up, Math.sin(ang)*out+up*this.muTZ, 0.22+Math.random()*0.16, 0.5*sc, 1.0*sc,
      1.0, 0.30+0.33*hot, 0.03+0.20*hot, 0.75, 1.5*sc, 2.8);
  }
  _emitMuzzleSmoke(){   // FUMÉE : colonne étroite et discrète (resserrée avec la flamme conique, B84)
    const sc=this.muzzleScale, ang=Math.random()*Math.PI*2, out=(0.4+Math.random()*1.0)*sc, w=0.16+Math.random()*0.09;
    const up=(3+Math.random()*4)*sc;
    spawnPuff(this.ox+(Math.random()-0.5)*0.45*sc, 0.7, this.oz+(Math.random()-0.5)*0.45*sc,
      Math.cos(ang)*out+up*this.muTX, up, Math.sin(ang)*out+up*this.muTZ, 1.1+Math.random()*1.0, 1.0*sc, 3.2*sc,
      w*1.5, w*1.25, w, 0.16, 2.0*sc, 1.1);
  }
  _emitMuzzleDebris(){  // quelques débris (opercule/bourre) éjectés qui retombent (trail = gravité)
    const sc=this.muzzleScale, ang=Math.random()*Math.PI*2, out=(2+Math.random()*5)*sc, up=(7+Math.random()*9)*sc;
    spawnTrail(this.ox+(Math.random()-0.5)*0.3, 0.9, this.oz+(Math.random()-0.5)*0.3,
      0.5,0.30,0.12, 0.4, 1.4, 2.4, (Math.cos(ang)*out+up*this.muTX)*4, up*4, (Math.sin(ang)*out+up*this.muTZ)*4);
  }

  heatColor(A,d){
    const c=d.coreColor ? d.coreColor
      : (this.cfg.colors ? this.cfg.colors[(d.comp||0)%this.cfg.colors.length] : this.cfg.color);
    let r,g,b;
    if (this.cfg.heat){ r=1.0;
      if (A<0.6){ g=(c.g+0.06)-0.06*(A/0.6); b=c.b+0.015; }
      else { const t=(A-0.6)/0.4; g=c.g-(c.g-0.05)*t; b=(c.b+0.015)*(1-t); }
    } else { r=c.r; g=c.g; b=c.b; }
    // COEUR CHAUD "qui brûle" : ignition blanc-jaune VIVE sur la 1re partie de vie -> couleur tenue.
    // Applique à toutes les étoiles (réaliste : incandescent blanc puis couleur) + donne le "feu/comète".
    if (A<0.15){ const f=1-A/0.15, f2=f*f*0.5; r=r+(1-r)*f2; g=g+(1-g)*f2; b=b+(1-b)*f2; }
    const fade=Math.max(0,1-A*A*0.85), fadeIn=0.4+0.6*Math.min(1,d.age/0.25);
    // +punch HDR (2.4->3.4) : le coeur sature en blanc-chaud, halo coloré au bloom => ça "brûle"
    return { r,g,b, inten:3.4*fade*d.dimVar*fadeIn };
  }

  // ABANDON PROPRE (B126) : une bombe remplacée alors qu'elle vit encore (PrevoFX.fire en console
  // pendant un tir) doit retirer/disposer ses objets de la scène — sinon étoiles FIGÉES à jamais
  // dans le ciel + fuite GPU (la libération normale n'existe que dans update() quand tout est mort).
  destroy(){
    if (this.dead) return; this.dead=true;
    if (this.head){ scene.remove(this.head); this.headGeo.dispose(); this.headMat.dispose(); this.head=null; }
    scene.remove(this.points); scene.remove(this.lines);
    this.geo.dispose(); this.mat.dispose(); this.lgeo.dispose(); this.lmat.dispose();
    if (this.flash){ scene.remove(this.flash); this.flash.geometry.dispose(); this.flash.material.dispose(); this.flash=null; }
  }

  update(dt){
    if (this.dead) return;
    this.age += dt;

    // === POT À FEU (B144, définition user) : l'effet est INSTANTANÉ — « comme un bouchon
    // composé de micro-billes qui est expulsé » : UNE chasse, tout part en ~0,1 s. C'est la
    // DISPERSION DES VITESSES qui étire la colonne (les rares rapides dessinent la POINTE).
    // Les étoiles brûlent 1-1,5 s. Sortie = 75 mm de diamètre, léger élargissement en montant.
    if (this.phase==='gerbe'){
      this.gerbeLeft -= dt;
      if (!this.gerbeFlashDone){ this.gerbeFlashDone=true;            // la CHASSE : flash + flammes brèves à la gueule
        for (let k=0;k<2;k++) this._emitMuzzleFlare();
        for (let k=0;k<10;k++) this._emitMuzzleFlame(); }
      if (this.gerbeLeft > 0){
        this.emitAcc += this.cfg.gerbe.cometRate*dt;                  // tout le « bouchon » part pendant dur=0,1 s
        while (this.emitAcc>=1){ this.emitAcc-=1; this._emitGerbeComet(); } }
      if (this.age < 0.35){                                           // le départ ÉCLAIRE le sol un bref instant
        this.glowAcc += 14*dt;
        while (this.glowAcc>=1){ this.glowAcc-=1; const c=this.cfg.color;
          spawnPuff(this.ox+(Math.random()-0.5)*2, 1.2, this.oz+(Math.random()-0.5)*2,
            0, 1.5, 0, 0.22+Math.random()*0.10, 5, 9, c.r*0.5,c.g*0.5,c.b*0.5, 0.16, 1.0, 2.0); } }
      // PAS de return : la boucle d'étoiles plus bas anime les billes.
      // La mort est gérée en bas : expulsion FINIE + plus aucune bille vivante.
    }

    if (this.hasMuzzle && this.muAge < this.muSmokeWin + 0.05){
      this.muAge += dt;
      if (!this.muDebrisDone){ this.muDebrisDone=true;           // au départ : flash de gueule + débris
        for(let k=0;k<3;k++) this._emitMuzzleFlare();
        const nd=Math.round(8*this.muzzleScale); for(let k=0;k<nd;k++) this._emitMuzzleDebris(); }
      if (this.muAge < this.muFlameWin){ this.muFlameAcc += 700*dt;     // FLAMME : brève, haut débit
        while(this.muFlameAcc>=1){ this.muFlameAcc-=1; this._emitMuzzleFlame(); } }
      if (this.muAge < this.muSmokeWin){ this.muSmokeAcc += 30*dt;      // FUMÉE : moins dense (rate bas)
        while(this.muSmokeAcc>=1){ this.muSmokeAcc-=1; this._emitMuzzleSmoke(); } }
    }

    if (this.phase==='rise'){
      const T=Math.min(1,this.age/this.riseTime), te=1-(1-T)*(1-T);
      const y=this.cfg.apex*te, hx=this.ox+(this.bx-this.ox)*te, hz=this.oz+(this.bz-this.oz)*te;
      const a=this.headGeo.attributes.position.array; a[0]=hx; a[1]=y; a[2]=hz;
      this.headGeo.attributes.position.needsUpdate=true;
      this.headTimer-=dt;
      const dmoved=Math.hypot(hx-this.headLastX, y-this.headLastY, hz-this.headLastZ);
      if (this.headTimer<=0 && dmoved>0.4){
        const mx=(this.headLastX+hx)*0.5, my=(this.headLastY+y)*0.5, mz=(this.headLastZ+hz)*0.5;
        const rc=this.cfg.riseColor, big=this.cfg.headSize>1.5;
        // riseTrail:false (B243, user — bombettes de compact) : PAS de traînée de montée,
        // on voit juste l'étoile monter, très légèrement.
        if (this.cfg.riseTrail!==false) spawnTrail(mx,my,mz, rc.r,rc.g,rc.b, big?1.4:1.1, 0.4, big?1.6:1.0);
        // TRONC (B229/B231/B232, zigzag « à tronc ») : QUEUE DE FUSÉE — étincelles FINES (0.65)
        // réparties LE LONG du trajet (plus d'amas « œuf de dragon »), aux vies ÉTAGÉES (B232,
        // user) : GROSSE BANDE DENSE sous le projectile (72 % de grains brefs), milieu
        // moitié-moitié (22 % moyens), et tout en bas SEULEMENT QUELQUES étincelles qui durent
        // plus longtemps que les autres (6 % longues, 1,8-2,9 s).
        if (this.cfg.trunk){ for (let k=0;k<12;k++){
          const fq=Math.random();
          const gx=this.headLastX+(hx-this.headLastX)*fq, gy=this.headLastY+(y-this.headLastY)*fq, gz=this.headLastZ+(hz-this.headLastZ)*fq;
          const u=Math.random();
          const lm = u<0.72 ? (1.0+Math.random()*0.5)    // brefs 0,26-0,39 s -> bande dense ~10-16 m
                   : u<0.94 ? (2.5+Math.random()*2.0)    // moyens 0,65-1,17 s -> milieu clairsemé
                            : (7+Math.random()*4);       // longs 1,8-2,9 s -> les rares du bas
          spawnTrail(gx+(Math.random()-0.5)*0.4, gy+(Math.random()-0.5)*0.4, gz+(Math.random()-0.5)*0.4,
            COPPER.r,COPPER.g,COPPER.b, 0.65, 0.13, lm, 0,0,0, 0.4, 0.42, true);
        } }
        this.headLastX=hx; this.headLastY=y; this.headLastZ=hz; this.headTimer=big?0.010:0.015;
      }
      if (T>=1){ this.burst(); this.phase='burst'; }
      return;
    }

    if (this.flash){ this.flashAge+=dt;
      if (this.flashAge<this.flashDur){ const p=this.flashAge/this.flashDur;
        this.flash.scale.setScalar(1+p*this.flashScale); this.flash.material.opacity=(1-p)*this.flashOp; }
      else { scene.remove(this.flash); this.flash.geometry.dispose(); this.flash.material.dispose(); this.flash=null; } }

    let alive=0; const tr=this.cfg.trailing, sway=this.cfg.sway, behave=this.cfg.behave;
    for (let i=0;i<this.nAlive;i++){
      const d=this.data[i], li=i*6;
      if (!d || d.age>=d.life){ this.col[i*3]=this.col[i*3+1]=this.col[i*3+2]=0;
        this.lcol[li]=this.lcol[li+1]=this.lcol[li+2]=this.lcol[li+3]=this.lcol[li+4]=this.lcol[li+5]=0; continue; }
      alive++; d.age+=dt; const A=d.age/d.life;

      d.vy -= this.cfg.G*this.cfg.gravStar*(d.gMul||1)*dt;
      const kd=Math.max(0,1-this.cfg.dragStar*BURST_PUNCH*dt); d.vx*=kd; d.vy*=kd; d.vz*=kd;   // ×PUNCH : freinage fort -> l'étoile finit quasi immobile (boule figée), flou de mouvement seulement dans sa course
      if (sway){ d.vx+=Math.sin(d.age*d.swF+d.phase)*sway*dt; d.vz+=Math.cos(d.age*d.swF2+d.phase2)*sway*dt; }
      if (this._windX||this._windZ){ d.vx+=this._windX*dt; d.vz+=this._windZ*dt; }        // vent commun du tir (feuilles mortes B120)
      if (this.cfg.noRise && d.vy>0) d.vy*=Math.max(0,1-4*dt);                            // presque JAMAIS vers le haut : l'ascendant s'étouffe en ~0,3s
      if (behave) behave(d,A,dt,this);
      const px=this.pos[i*3]+d.vx*dt, py=this.pos[i*3+1]+d.vy*dt, pz=this.pos[i*3+2]+d.vz*dt;
      this.pos[i*3]=px; this.pos[i*3+1]=py; this.pos[i*3+2]=pz;

      const cc=this.heatColor(A,d); let r=cc.r,g=cc.g,b=cc.b,inten=cc.inten;
      if (this.cfg.onStar){ const o=this.cfg.onStar(d,A,dt); if (o){
        if (o.intenMul!=null) inten*=o.intenMul;
        if (o.whiteMix){ const w=o.whiteMix; r=r+(1-r)*w; g=g+(1-g)*w; b=b+(1-b)*w; } } }
      // PISTIL crépitant : pops blancs vifs sur les étoiles du cœur, de + en + vers la FIN
      const crk = d.crackle && d.age>=(d.crackleAt||0);
      if (crk){
        if (d.popOnly){                                            // CŒUR : pops dorés répétés pendant la dispersion
          d.popOn=(d.popOn||0)-dt; if (d.popOn<=0 && Math.random()<16*dt) d.popOn=0.04;
          inten = d.popOn>0 ? 3.4 : 0; if (d.popOn>0){ r=1; g=0.82; b=0.4; } }
        else if (this.cfg.crackleStars || d.eggSplode){            // ŒUF DE DRAGON (étape 2) ou pistil eggSplode : l'étoile EXPLOSE = ses étincelles JAILLISSENT du point et s'écartent en BOULE, puis se FIGENT et s'éteignent
          if (d.snaps===undefined){ d.snaps=((this.cfg.crackleStars||{}).snaps||5)-1+(Math.random()*2|0); d.first=true; d.flashT=0.06;
            d.cx=this.pos[i*3]; d.cy=this.pos[i*3+1]; d.cz=this.pos[i*3+2]; }                          // CENTRE FIGÉ -> amas ROND
          d.flashT=(d.flashT||0)-dt; d.snapTimer=(d.snapTimer||0)-dt;
          if (d.snapTimer<=0 && d.snaps>0){ d.snaps--; d.snapTimer=0.03+Math.random()*0.04;
            const core=d.isCore, DG=3.4;
            const nq=d.first?(core?24:36):(core?10:15);                                                // COQUILLE = +50% d'étincelles (proportionnel à la taille -> reste PLEINE) ; cœur inchangé
            const Rmax=core?5.0:6.0, life=core?2.35:1.9;                                                // COQUILLE plus GROSSE (Rmax 5->6) à densité conservée ; +0,2s de vie pour les DEUX (cœur 1.9->2.35, coquille 1.45->1.9). Cœur : taille/densité inchangées
            for (let q=0;q<nq;q++){ const v=vrand(Math.random), R=0.8+Math.random()*(Rmax-0.8);        // distribution linéaire (centre plus dense = amas net, pas diffus), comme B65 mais plus gros
              const sp=R*DG*4;                                                                          // vitesse radiale ∝ R + drag DG -> l'étincelle JAILLIT puis se FIGE à ~R (*4 compense le ×0.25 interne de spawnTrail)
              spawnTrail(d.cx,d.cy,d.cz, EGGGOLD.r,EGGGOLD.g,EGGGOLD.b, d.first?1.6:1.2, 0.05, life, v[0]*sp,v[1]*sp,v[2]*sp, 0.1, DG); }  // jit 0.1 (pas de "nage"), gF 0.05 (ne tombe pas) -> s'écarte VITE puis se fige et s'éteint
            d.first=false; }
          if (d.flashT>0){ r=1.5; g=1.3; b=1.0; inten=Math.max(inten,1.2)*4.0; }                       // FLASH clair : l'étoile ÉCLATE
          else inten=0;                                                                                // puis DISPARUE (désintégrée en sa boule)
          if (d.snaps<=0) d.age=d.life; }
        else { d.popOn=(d.popOn||0)-dt;                            // pistil simple (crackling-aqua)
          if (d.popOn<=0 && Math.random()<(8+10*A)*dt) d.popOn=0.045;
          if (d.popOn>0){ inten*=2.8; const w=0.95; r=r+(1-r)*w; g=g+(1-g)*w; b=b+(1-b)*w; } }
      } else if (d.popOnly || d.eggSplode || d.hideStar){ inten = 0; }   // cœur/pistil œuf de dragon + PORTEURS DE MARRON (B157) : INVISIBLES (un marron = juste du bruit)
        else if (this.cfg.hideStars){ inten = 0; }                 // cascade : l'étoile-goutte est INVISIBLE — on ne voit que la POINTE du sillage (étincelles fraîches)
        else if (this.cfg.arrow){ inten *= 0.45; }                 // œuf de dragon : étoile TRÈS DISCRÈTE avant de claquer (à peine une boule, la traînée domine)
      this.col[i*3]=r*inten; this.col[i*3+1]=g*inten; this.col[i*3+2]=b*inten;

      // FLOU DE MOUVEMENT (B82, croquis user) : ROND + QUEUE EN CÔNE au shader — tête ronde pleine
      // taille + cône effilé derrière (part large comme la boule, finit en pointe), rond à l'arrêt.
      this.vel[i*3]=d.vx; this.vel[i*3+1]=d.vy; this.vel[i*3+2]=d.vz;
      // SHRINK (B88, palme multicolore) : l'étoile RÉTRÉCIT progressivement -> disparaît de plus en plus petite
      if (this.cfg.shrink){ const sf=(this.cfg.shrink===true)?0.9:this.cfg.shrink;   // shrink:1.0 (B178) = l'étoile FOND jusqu'à 0 de diamètre (extinction jamais soudaine)
        const Ap=this.cfg.shrinkPow?Math.pow(A,this.cfg.shrinkPow):A;                 // shrinkPow (B185) : ÉROSION LENTE au début, fonte en fin — le scintillement reste visible plus longtemps
        this.size[i]=(d.size0||this.cfg.starSize)*STAR_SCALE*Math.max(0,1-Ap*sf); }   // size0 (B191) : respecte la taille compSize du groupe (atome)

      if (tr && d.trailing && A<tr.emitUntil && !d.popOnly && d.age<(d.crackleAt||1e9)){   // d.trailing (B149) : le flag PAR ÉTOILE compte enfin — nécessaire dès qu'un effet mélange étoiles avec/sans traînée (marguerite : pétales oui, cœur/perles non)
        // ÉTINCELLES : débit ∝ VITESSE (B89) — grains/mètre constants. Sinon, quand l'étoile ralentit,
        // elle empile ses grains sur place et la traînée GROSSIT (plainte user) ; là le diamètre reste constant.
        // rateFloor (B150, marguerite) : plancher RELEVÉ = l'émission CONTINUE quand la tête ralentit ->
        // la matière « se détend » au bout (bande qui s'ÉLARGIT vers l'extérieur + pointes rugueuses).
        let emitDt=dt, slow=0;
        if (tr.spark){ const v=Math.hypot(d.vx,d.vy,d.vz); if(d.v0e===undefined) d.v0e=Math.max(v,1e-3);
          const vr=Math.min(1, v/d.v0e); slow=1-vr;
          emitDt=dt*Math.max(tr.rateFloor||0.10, vr); }
        d.since+=emitDt;   // traînée tant que l'étoile n'a pas commencé à claquer
        // ÉMISSION AU VRAI DÉBIT (B87) : n grains par frame si period < dt (avant : 1 max/frame ->
        // impossible d'avoir des "milliers d'étincelles"). Répartis le long du trajet de la frame.
        let nEmit=Math.floor(d.since/tr.period); if (nEmit>0){ if (nEmit>8) nEmit=8; d.since-=nEmit*tr.period;
          const tc=tr.fixedColor ? (tr.color||GOLD) : (d.coreColor||tr.color||GOLD);   // fixedColor : la traînée garde SA couleur (ex palme multicolore = queue OR, pointe colorée) ; sinon héritée de l'étoile (mosaïque assortie)
          for (let e=0;e<nEmit;e++){ const fq=Math.random();                            // position aléatoire entre l'ancienne et la nouvelle -> pas de paquets
            let mx=d.lastX+(px-d.lastX)*fq, my=d.lastY+(py-d.lastY)*fq, mz=d.lastZ+(pz-d.lastZ)*fq;
            // backOff (B308, corolle) : la traînée démarre X mètres DERRIÈRE l'étoile (petit
            // vide entre l'étoile de pointe et son brin — « une trentaine de cm », user).
            if (tr.backOff){ const vL=Math.hypot(d.vx,d.vy,d.vz)||1e-6, k=tr.backOff/vL;
              mx-=d.vx*k; my-=d.vy*k; mz-=d.vz*k; }
            // longLaw (B181, loi user) : proba qu'une étincelle soit LONGUE, GRADUELLE selon la
            // position d'émission — « 2/10 au début (centre), ~3,5/10 au milieu, 5/10 à la fin ».
            // Parmi les longues, les très longues (max, ex 7 s) restent RARES (tirage biaisé bas).
            let lm=tr.lifeMul, fl=!!tr.flatLife;
            if (tr.longLaw){ const L=tr.longLaw, p=L.p0+(L.p1-L.p0)*A;
              if (Math.random()<p){ lm=(L.min+(L.max-L.min)*Math.pow(Math.random(),L.pow||1))/0.26; fl=true; } }
            // fadeToStar (B200, user) : la traînée SE CONSUME AVEC l'étoile — les grains ne vivent
            // JAMAIS au-delà de sa mort (cap ×0.92) -> le front d'extinction remonte la traînée,
            // la REJOINT juste avant la fin, et l'étoile s'éteint À SON TOUR. Aucune traînée orpheline.
            // B203 (user : « au début elles sont trop, à la fin trop courtes ») : vie des grains
            // CROISSANTE avec l'âge de l'étoile (×0.45 à l'ouverture où tout file, ×1.55 à la fin
            // où l'étoile rampe) -> longueur de traînée bien plus RÉGULIÈRE sur toute la course.
            if (tr.fadeToStar){ const rem=(d.life-d.age)/0.26;
              // B205 (user) : quand l'étoile est ALLUMÉE, traînées un peu plus longues + extinction
              // plus lente -> les grains vivent tr.litBoost× plus longtemps (front qui recule doucement).
              const litM = (d._lit && tr.litBoost) ? tr.litBoost : 1;
              lm=Math.max(0.3, Math.min(lm*(0.45+1.1*A)*litM, rem*0.97)); fl=true; }   // cap 0.92 -> 0.97 : le front atteint l'étoile PLUS TARD (extinction ralentie), sans traînée orpheline
            if (tr.spark){   // ÉTINCELLES (décomposition de l'étoile) : brillance TRÈS variable + dispersion -> nuée qui pétille, pas un ruban lisse
              let tw=(0.35+Math.pow(Math.random(),1.6)*1.65)*(tr.bright||1);   // bright : atténue le glow par effet
              if (tr.rampIn) tw*=0.25+0.75*Math.min(1, A/0.4);                 // rampIn (cascade) : étincelles TAMISÉES tant que les mèches sont serrées (anti boule lumineuse au break), pleine brillance une fois écartées
              spawnTrail(mx,my,mz, tc.r*tw,tc.g*tw,tc.b*tw, tr.grain, tr.gF, lm, d.vx,d.vy,d.vz, (tr.jit||2.4)*(1+(tr.jitGrow||0)*slow), tr.fall||0.42, fl, tr.grainRampIn||0);   // jitGrow (B150) : dispersion qui AUGMENTE quand la tête ralentit -> bande fine à la base, LARGE au bout (photo réelle)
            } else {
              spawnTrail(mx,my,mz, tc.r,tc.g,tc.b, tr.grain, tr.gF, lm, d.vx,d.vy,d.vz, 0.8, 0.42, fl);
            } }
          d.lastX=px; d.lastY=py; d.lastZ=pz; } }
    }
    this.geo.attributes.position.needsUpdate=true; this.geo.attributes.aColor.needsUpdate=true;
    this.geo.attributes.aVel.needsUpdate=true;
    if (this.cfg.shrink) this.geo.attributes.size.needsUpdate=true;

    if ((this.phase==='burst' || (this.phase==='gerbe' && this.gerbeLeft<=0)) && alive===0){
      this.dead=true; scene.remove(this.points); scene.remove(this.lines);
      this.geo.dispose(); this.mat.dispose(); this.lgeo.dispose(); this.lmat.dispose();
      if (this.flash){ scene.remove(this.flash); this.flash.geometry.dispose(); this.flash.material.dispose(); }
    }
  }
}

// ============================================================================
// COMPACTS (B241) : batteries multi-tirs de bombettes 30 mm. Batterie physique = RANGÉES de
// tubes en éventail ; c'est la MÈCHE qui fait le motif (règles user 2026-07-10) :
// « éventaillé » = la mèche allume TOUTE une rangée ENSEMBLE (une salve = une rangée) ;
// « z » = la mèche parcourt la rangée TUBE PAR TUBE (essuie-glace) — tirs rapprochés dans la
// rangée, pause PLUS LONGUE entre les rangées, la rangée suivante repart dans l'AUTRE sens ;
// « bande » = le compact entier est UNE seule rangée. Durée totale = duree_s du catalogue.
export const COMPACTS = {
  zMeduse: { arch:'medusa', tirs:40, dur:30, pattern:'z', rowSize:5, fanDeg:25,
             label:'compact 40 tirs 30 mm z méduse (30 s)' },   // 500345000-500355000, couleur au sort par bombette
};
// B242 (user : « il faut quelques défauts — ça reste de la POUDRE ») : chaque intervalle de
// mèche brûle un peu inégalement (±6 % entre tubes, ±10 % entre rangées), les tubes ont ±1°
// d'imperfection, et la durée TOTALE varie de 29 à 31 s (normalisation ±1 s sur 30).
function buildCompactQueue(def){
  const rows=Math.max(1, Math.round(def.tirs/def.rowSize)), q=[];
  const half=(def.fanDeg||25)*Math.PI/180, jA=0.0175;   // ±1° par tube
  const ang=k=>-half+(2*half)*(def.rowSize>1?k/(def.rowSize-1):0.5)+(Math.random()-0.5)*2*jA;
  if (def.pattern==='fan'){
    const step=def.dur/rows;                        // ex 8 salves sur 30 s -> une rangée toutes les 3,75 s
    for (let r=0;r<rows;r++){ const tr=r*step*(1+(Math.random()-0.5)*0.05);
      for (let k=0;k<def.rowSize;k++)
        q.push({ t:tr+Math.random()*0.10, a:ang(k) }); }   // toute la rangée quasi ensemble (poudre : pas exactement)
  } else {                                          // 'z' : essuie-glace
    const a0=0.35;                                   // intervalle nominal DANS la rangée (tirs rapprochés)
    const b0=rows>1 ? Math.max(0.5, (def.dur - rows*(def.rowSize-1)*a0) / (rows-1)) : 0;   // pause nominale entre rangées
    let t=0;
    for (let r=0;r<rows;r++){
      for (let k=0;k<def.rowSize;k++){
        const kk=(r%2===0)?k:(def.rowSize-1-k);      // rangée suivante dans l'AUTRE sens = le Z du trajet de mèche
        q.push({ t, a:ang(kk) });
        if (k<def.rowSize-1) t+=a0*(0.94+Math.random()*0.12);   // très très légèrement inégal entre tubes
      }
      t+=b0*(0.90+Math.random()*0.20);               // pauses de rangées un peu variables
    }
  }
  q.sort((x,y)=>x.t-y.t);
  // durée TOTALE 29-31 (pour dur=30) : on renormalise le tout sur une cible tirée à ±dur/30
  const last=q[q.length-1].t||1, target=def.dur+(Math.random()*2-1)*(def.dur/30);
  const sc=target/last; for (const e of q) e.t*=sc;
  return q;
}

// DÉMO FORMES (user B127) : sourire 75mm + cœur 100mm (le cœur n'existe qu'en 100 -> il éclate
// PLUS HAUT, 116 m catalogue vs 95 m). Focus sur l'une des deux -> on tire les 2 EN MÊME TEMPS
// depuis la même batterie, mortiers INCLINÉS (éventail) pour qu'elles n'éclatent pas au même endroit.
const SHAPES_DUO = ['smiley','heart'];   // sourire à GAUCHE (-lean), cœur à DROITE (+lean)
const DUO_LEAN = 40;   // décalage horizontal du point d'éclatement (m) : formes ≈ 26 m de rayon ->
                       // ~28 m de vide entre elles, bords à ±66 m = large dans le champ caméra
                       // public par défaut (150 m, fov 60° -> demi-largeur 86 m)

// ============================================================================
// OVERLAY : canvas Three transparent (screen) au-dessus de Cesium + sync caméra.
// ============================================================================
export class ThreeFireworks {
  constructor(viewer, origin){
    this.viewer = viewer;
    this.canvas = document.createElement('canvas');
    Object.assign(this.canvas.style, { position:'fixed', top:'0', left:'0', width:'100%',
      height:'100%', pointerEvents:'none', zIndex:'1', mixBlendMode:'screen' });
    document.body.appendChild(this.canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas:this.canvas, antialias:true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 1, 50000);
    scene.add(this.camera);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.3, 0.22, 0.55)); // B106 anti-BROUILLARD : seuil 0.12->0.55 = seuls les CŒURS brillants blooment (la masse faible ne fait plus de halo), rayon resserré
    this.composer.addPass(new OutputPass());
    this._pe=new Cesium.Cartesian3(); this._de=new Cesium.Cartesian3(); this._ue=new Cesium.Cartesian3();
    this.setOrigin(origin);
    this.shells=[]; this.restDelay=0; this.focus='peony'; this.current='peony'; this.focusColor=null; this.onBurst=null; this.onLaunch=null;
    this.compact=null;   // séquence compact en cours : {def, queue, i, t, apexS} (B241)
    this.hud = document.getElementById('hud');
    addEventListener('resize', () => this._resize());
  }
  _resize(){ this.camera.aspect=innerWidth/innerHeight; this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight); this.composer.setSize(innerWidth, innerHeight); }
  setOrigin(origin){ this.origin=Cesium.Cartesian3.fromDegrees(origin.lon, origin.lat, origin.height);
    this.enuToFixed=Cesium.Transforms.eastNorthUpToFixedFrame(this.origin);
    this.fixedToEnu=Cesium.Matrix4.inverseTransformation(this.enuToFixed, new Cesium.Matrix4()); }
  localToWorld(local){ return Cesium.Matrix4.multiplyByPoint(this.enuToFixed,
    new Cesium.Cartesian3(local[0],local[1],local[2]), new Cesium.Cartesian3()); }
  // Distance caméra -> point (x,y,z) en coordonnées scène (B256 : son atténué/retardé par la distance)
  distTo(x, y, z){ const p=this.camera.position; return Math.hypot(p.x-x, p.y-y, p.z-z); }
  syncCamera(){ const cam=this.viewer.camera;
    Cesium.Matrix4.multiplyByPoint(this.fixedToEnu, cam.positionWC, this._pe);
    Cesium.Matrix4.multiplyByPointAsVector(this.fixedToEnu, cam.directionWC, this._de);
    Cesium.Matrix4.multiplyByPointAsVector(this.fixedToEnu, cam.upWC, this._ue);
    this.camera.position.set(this._pe.x, this._pe.z, -this._pe.y);
    this.camera.up.set(this._ue.x, this._ue.z, -this._ue.y);
    this.camera.lookAt(this._pe.x+this._de.x, this._pe.z+this._de.z, -this._pe.y-this._de.y);
    const f=cam.frustum, aspect=f.aspectRatio||(innerWidth/innerHeight);
    const vfov=(aspect>=1)?2*Math.atan(Math.tan(f.fov/2)/aspect):f.fov;
    this.camera.fov=THREE.MathUtils.radToDeg(vfov); this.camera.aspect=aspect; this.camera.updateProjectionMatrix(); }
  // compat : timeline.js lit layer.shell (barre de progression) -> 1re bombe encore VIVANTE du
  // groupe (sinon en trio la barre retombait à 0 dès la mort de la 1re alors que 2 brillent encore)
  get shell(){ for (const s of this.shells) if (!s.dead) return s; return this.shells[0]||null; }
  // B259 (user) : sur MOBILE, HUD réduit au seul tampon [Bnnn] (détecteur de cache) — pas de
  // titre « aperçu web », pas de nom d'effet/calibre, pas d'aides clavier (QZSD/Espace).
  _hud(txt){ if (!this.hud) return;
    const mob = (typeof matchMedia!=='undefined') && matchMedia('(pointer: coarse)').matches;
    this.hud.innerHTML = mob ? '<span style="color:#7fff7f">['+BUILD+']</span>'
      : '<b>PrevoFX — aperçu web</b> <span style="color:#7fff7f">['+BUILD+']</span><br>'+txt+' · QZSD + clic-glisser · Espace = pause'; }
  _clear(){ for (const s of this.shells) s.destroy(); }   // abandon propre des bombes remplacées
  fire(arch, color){ this.current=EFFECTS[arch]?arch:'peony';
    this._clear();
    this.shells=[new Shell(this.current,0,0,undefined, color?{color}:undefined)];
    if (this.onLaunch) this.onLaunch(this.current, this.shells[0].cal, this.distTo(this.shells[0].ox, 0, this.shells[0].oz));   // B167 : SON du départ. B254 : + calibre. B256 : + distance
    this._hud((LABELS[this.current]||this.current)+' '+this.shells[0].cal); }   // calibre RÉEL (cfg.cal, ex cœur=100), plus le « 75 » codé en dur
  fireNext(){
    // DÉMO FORMES (user B127) : focus sur sourire ou cœur -> on tire les DEUX EN MÊME TEMPS,
    // même batterie mais mortiers INCLINÉS (éventail) : sourire 75mm à -DUO_LEAN m, cœur 100mm
    // à +DUO_LEAN m (le cœur monte plus haut : il n'existe qu'en calibre 100).
    if (SHAPES_DUO.indexOf(this.focus)>=0){
      this.current=this.focus;
      this._clear();
      this.shells=SHAPES_DUO.map((a,i)=>new Shell(a,0,0,undefined,{lean:[(i*2-1)*DUO_LEAN,0]}));
      if (this.onLaunch) this.onLaunch(this.current, this.shells[0].cal, this.distTo(this.shells[0].ox, 0, this.shells[0].oz));
      this._hud('sourire 75 + cœur 100 (éventail)');
    } else if (COMPACTS[this.focus]){
      // COMPACT (B241) : on démarre la SÉQUENCE — les tirs partent au fil de la mèche dans update().
      const def=COMPACTS[this.focus];
      this.current=def.arch;
      this._clear(); this.shells=[];
      const pairs=EFFECTS[def.arch]&&EFFECTS[def.arch].colorPairs;
      this.compact={ def, queue:buildCompactQueue(def), i:0, t:0,
        pair: pairs ? pairs[Math.floor(Math.random()*pairs.length)] : null,   // UNE couleur pour toute la séquence (elle change à chaque boucle)
        apexS:((EFFECTS[def.arch]&&EFFECTS[def.arch].apex)||90)*APEX_SCALE };
      this._hud(def.label);
    } else this.fire(this.focus, this.focusColor);
  }
  setFocus(arch, color){ if (EFFECTS[arch] || COMPACTS[arch]){
    if (this.compact && arch!==this.focus){ this.compact=null; this._clear(); this.shells=[]; this.restDelay=0; }   // B241 : changer d'effet COUPE la mèche en cours (sinon la séquence continuait jusqu'à 30 s)
    this.focus=arch; if (color!==undefined) this.focusColor=color; } }
  update(dt){
    // SÉQUENCE COMPACT (B241) : la mèche avance, on tire chaque tube à son instant, incliné à
    // son angle d'éventail (lean = tan(angle) × hauteur d'éclatement -> l'inclinaison se lit).
    if (this.compact){
      const c=this.compact; c.t+=dt;
      while (c.i<c.queue.length && c.queue[c.i].t<=c.t){
        const q=c.queue[c.i++];
        const nsh=new Shell(c.def.arch,0,0,undefined,{lean:[Math.tan(q.a)*c.apexS,0], pair:c.pair||undefined});
        this.shells.push(nsh);
        if (this.onLaunch) this.onLaunch(c.def.arch, nsh.cal, this.distTo(nsh.ox, 0, nsh.oz));
      }
      if (c.i>=c.queue.length) this.compact=null;   // mèche finie — le repos/refire reprend quand tout est mort
    }
    if (!this.compact && (!this.shells.length || this.shells.every(s=>s.dead))){ this.restDelay-=dt;
      if (this.restDelay<=0){ this.fireNext();
        // repos APRÈS la mort des étoiles : 0.8s par défaut + restExtra de l'effet tiré (ex cascade 4.5s :
        // ses PAILLETTES vivent ~7s après l'éclatement -> sans ça, le tir suivant noyait la fin de la traîne)
        this.restDelay=0.8+((EFFECTS[this.current]&&EFFECTS[this.current].restExtra)||0); } }
    for (const s of this.shells){ const ph=s.phase; s.update(dt);
      if (ph!=='burst' && s.phase==='burst' && this.onBurst) this.onBurst(s.arch, s.cal, this.distTo(s.bx, s.cfg.apex, s.bz)); }  // hook son à CHAQUE éclatement (B254 : + calibre, B256 : + distance)
    updateTrails(dt);
    updatePuffs(dt);
  }
  render(){ this.syncCamera(); this.composer.render(); }
}

// Exports internes pour le BANC D'APERÇU hors-Cesium (_preview.html) — rendu réel d'un effet
// pour capture d'écran. N'affecte pas l'app (rien ne les importe en prod).
export { scene as __scene, Shell as __Shell, updateTrails as __updateTrails, updatePuffs as __updatePuffs, __setMarronPop, trail as __trailPool, buildCompactQueue as __buildCompactQueue };
