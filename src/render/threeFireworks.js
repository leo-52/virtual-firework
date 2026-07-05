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
const BUILD = 'B124';  // tampon de version affiché dans le HUD -> permet de voir si le navigateur sert du CACHE

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
const TRAIL_MAX = 30000;   // agrandi B98 : les paillettes de la cascade vivent ~7s -> jusqu'à ~20k grains vivants (sinon le ring buffer écraserait des paillettes en vol)
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
const PUFF_MAX = 320;
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
  PALEGOLD=new THREE.Color(1.0,0.88,0.68),    // or PÂLE pour autres usages
  EGGWHITE=new THREE.Color(1.0,0.95,0.92),    // BLANC (ancien œuf de dragon, trop froid)
  EGGGOLD=new THREE.Color(1.4,1.18,0.88),     // BLANC CHAUD / champagne, HDR (œuf de dragon, retour B61 ; réf photo = amas blancs à reflets chauds). MÊME couleur traînée + points + cœur
  CKGRN=new THREE.Color(0.24,1.22,0.38),      // VERT FLASHY (crackling vert : un poil + saturé/punchy que GRN, sans toucher couronne/marguerite)
  EMBER=new THREE.Color(1.25,0.60,0.15);      // ORANGÉ/DORÉ CHAUD (braise HDR) — étincelles de la palme multicolore (plus chaud que GOLD, bleu bas -> reste orange en additif)

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
function distMedusa(i,n,rnd){ const v=vrand(rnd); let dy=Math.abs(v[2])*0.9+0.25, dx=v[0], dz=v[1];
  const L=Math.hypot(dx,dy,dz)||1; return {dx:dx/L,dy:dy/L,dz:dz/L,spMul:0.83}; }
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
function distAtom(i,n,rnd){
  const nRings=(n>=54)?3:2, perRing=Math.max(12,Math.floor(n/nRings));
  const NORMS=[[0,1,0],[0.9,0.44,0],[-0.45,0.44,0.78]];
  const r=Math.min(nRings-1,Math.floor(i/perRing)), idx=i-r*perRing;
  const N=norm([NORMS[r][0]+(rnd()-0.5)*0.3, NORMS[r][1]+(rnd()-0.5)*0.3, NORMS[r][2]+(rnd()-0.5)*0.3]);
  const A=Math.abs(N[1])<0.999?[0,1,0]:[1,0,0];
  const U=norm(cross(N,A)), V=cross(N,U), az=2*Math.PI*(idx+(rnd()-0.2))/perRing;
  return {dx:U[0]*Math.cos(az)+V[0]*Math.sin(az), dy:U[1]*Math.cos(az)+V[1]*Math.sin(az),
          dz:U[2]*Math.cos(az)+V[2]*Math.sin(az), spMul:0.55, comp:r%3};
}
function distHalfHalf(i,n,rnd){
  const off=2/n, inc=2.399963229728653, yy=i*off-1+off/2, rr=Math.sqrt(Math.max(0,1-yy*yy)), a=i*inc;
  const dx=Math.cos(a)*rr, dy=yy, dz=Math.sin(a)*rr;
  const comp=(dx*0.7+dy*0.2+dz*0.68)>=0?0:1;
  return {dx,dy,dz,spMul:1.0,comp};
}
function distSpinner(i,n,rnd){ const a0=Math.random()*Math.PI*2, rH=rnd(11,16), vUp=rnd(2.5,4.2);
  const dx=Math.cos(a0)*rH, dy=vUp, dz=Math.sin(a0)*rH, L=Math.hypot(dx,dy,dz)||1;
  return {dx:dx/L,dy:dy/L,dz:dz/L, spMul:(L/(13.5*1.8))}; }

// ============================================================================
// DISTRIBUTIONS 2D (formes face public) : dist2D(rnd,cal,nc) -> [{x,y,comp}] dans le disque unité
// ============================================================================
function shapeHeart(){ const pts=[]; for(let k=0;k<26;k++){ const t=2*Math.PI*k/26;
  const x=16*Math.pow(Math.sin(t),3);
  const y=13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t);
  pts.push({x:x/16,y:y/16,comp:0}); } return pts; }
function shapeButterfly(_r,_c,nc){ const C2=(nc>1)?1:0, pts=[]; for(let k=0;k<34;k++){
  const t=2*Math.PI*k/34, r=Math.exp(Math.sin(t))-2*Math.cos(4*t);
  pts.push({x:Math.sin(t)*r/3.2,y:Math.cos(t)*r/3.2,comp:(k%2===0)?0:C2}); } return pts; }
function shapeSmiley(_r,_c,nc){ const C2=(nc>1)?1:0, pts=[];
  for(let k=0;k<20;k++){const t=2*Math.PI*k/20; pts.push({x:Math.cos(t),y:Math.sin(t),comp:0});}
  pts.push({x:-0.35,y:0.32,comp:C2}); pts.push({x:0.35,y:0.32,comp:C2});
  for(let k=0;k<=6;k++){const a=(205+(335-205)*k/6)*Math.PI/180; pts.push({x:Math.cos(a)*0.55,y:Math.sin(a)*0.55,comp:C2});}
  return pts; }
function shapeDaisy(_r,cal,nc){ const nPet=rndI(8,12), pts=[];
  for(let p=0;p<nPet;p++){ const aPet=2*Math.PI*p/nPet+rnd(-0.07,0.07), ns=rndI(2,4);
    for(let s=0;s<ns;s++){ const R=lerp(0.45,1.0, ns>1?s/(ns-1):0)*rnd(0.94,1.06);
      pts.push({x:Math.cos(aPet)*R,y:Math.sin(aPet)*R,comp:p%nc}); } }
  return pts; }
function shapeRing(){ const pts=[]; for(let k=0;k<26;k++){const t=2*Math.PI*k/26;
  pts.push({x:Math.cos(t),y:Math.sin(t),comp:0});} return pts; }

// ============================================================================
// HOOKS onStar(d,A,dt) -> {intenMul?,whiteMix?} (visuel)  /  behave(d,A,dt,ctx) (physique)
// ============================================================================
function strobeFn(d){ const ph=(d.age*d.strobeF+d.phase)%1; return {intenMul: ph<0.18?1.4:0.4}; }
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
function crackleFn(d,A,dt){ d.popOn=(d.popOn||0)-dt;
  if (d.popOn<=0 && Math.random()<7*dt) d.popOn=0.045;
  if (d.popOn>0) return {intenMul:2.3,whiteMix:0.9}; return null; }
function glitterFn(d){ return {intenMul: Math.random()<0.45?0.4:1.6}; }

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
const CAL_SCALE = { 50:0.67, 75:1.0, 100:1.44, 125:1.87, 150:2.30, 200:2.58 };
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
  gerbe:null, flashBig:false
};
const EFFECTS = {
  // === 10 EXISTANTS (intacts ; ring passé en orientation aléatoire) ===
  peony: {},
  chrysanthemum: { trailing:{emitUntil:0.85, period:0.015, grain:0.9, gF:0.40, lifeMul:1.6, color:GOLD} },
  willow: { apex:100, heat:false, color:DIMGOLD, gravStar:0.92, dragStar:0.25, lifeBase75:3.2,
            starSize:0.9, speedMul:1.5, trailing:{emitUntil:0.95, period:0.013, grain:2.5, gF:0.22, lifeMul:9.0, color:GOLD} },  // KAMURO : longues traînées or PENDANTES ; tête = POINTE, pas une boule (user B94, effets dorés)
  comet: { apex:96, stars:1, dist:distComet, heat:false, color:GOLD, gravStar:0.90, dragStar:0.30,
           lifeBase75:3.0, starSize:5.4, speedMul:1.0, headSize:4.0, riseColor:GOLD,   // compensé (STAR_SCALE 1.2->1.0), taille inchangée (4.5×1.2)
           trailing:{emitUntil:0.97, period:0.012, grain:1.3, gF:0.35, lifeMul:1.8, color:GOLD} },
  sphere: { speedJit:0.02 },
  ring: { apex:110, burstRadius:16, stars:30, dist2D:shapeRing, orient:'random', heat:false, color:GRN },
  crackling: { apex:95, heat:false, color:CKGRN, pureColor:true, stars:83,                            // crackling VERT 75mm = pivoine VERT FLASHY 83 étoiles (texture neutre = vert franc) ; décliner via override {color}
    core:{ stars:20, radiusMul:0.42, color:GOLD, eggSplode:true, crackleAt:0.9, jitter:0.6 } },       // + pistil = ~20 étoiles ŒUF DE DRAGON INVISIBLES (on ne voit QUE le crépitement) : explosent étalées 0,9→1,5s après l'éclatement
  dragonEgg: { apex:95, heat:false, color:GOLD, stars:84, lifeBase75:2.4, starSize:0.7, arrow:true, speedMul:1.25, gravStar:0.5,  // ŒUF DE DRAGON (~40m, retombe peu = pivoine, pas saule) — 3 TEMPS :
    trailing:{emitUntil:0.95, period:0.013, grain:1.0, gF:0.12, lifeMul:2.0, color:EGGGOLD},          //  1) T=0 : éclate comme une pivoine mais étoiles TRÈS PETITES/DISCRÈTES (à peine une boule, on voit surtout la traînée : starSize 0.7 + arrow=dim 0.45)
    core:{ stars:30, radiusMul:0.30, color:GOLD, minCal:75, crackleAt:0.5, jitter:0.15 },             //  2) T≈0,5s : le CŒUR crépite (explose en boules) PENDANT que les étoiles se dispersent. 84+30 amas -> REMPLIT la sphère. PAS en 50mm
    crackleStars:{ delay:1.3, jitter:0.6, snaps:5 } },                                                //  3) chaque ÉTOILE explose entre 1,3 s et 1,9 s (jitter 0,6 = très étalé/aléatoire) en BOULE qui S'ÉTEINT sur place
  strobe: { apex:112, heat:false, color:SILVER, onStar:strobeFn, lifeBase75:2.4, gravStar:0.55 },
  finalCli: { apex:95, heat:false, color:PINK, pureColor:true, onStar:finalCliFn, lifeBase75:2.3, gravStar:0.7 },  // FINAL CLI. BLANC ROSE 75mm (catalogue, 95m) : pivoine rose -> les étoiles finissent en CLIGNOTANT BLANC ; décliner via {color} (citron/rouge/verte/bleue/violette)
  fallingLeaves: { apex:95, stars:75, dist:distLeaves, heat:false, color:new THREE.Color(1.0,0.45,0.55),
                   gravStar:0.75, gravJit:0.2, dragStar:0.5, lifeBase75:6.0, speedMul:0.5, sway:1.5, wind:1.8, noRise:true, starSize:2.1 },   // B124 (user) : éclat plus COMPACT (speedMul 0.5), 75 étoiles ; chute ~7 m/s ±20%, vent commun, jamais vers le haut
  palm: { apex:105, stars:15, dist:distFibonacci, heat:false, color:WHITE, onStar:glitterFn, gravStar:1.0, dragStar:0.6,   // PIVOINE (sphère, bien écartée) + traînée, 15 étoiles ; blanc scintillant + traînée OR
          lifeBase75:2.8, starSize:4.1, trailing:{emitUntil:0.97, period:0.006, grain:1.3, gF:0.45, lifeMul:9.0, color:GOLD} },  // FRONDES = TRÈS LONGUES queues dorées = la palme (compensé, taille inchangée = 3.4×1.2)
  palmMulti: { apex:105, stars:15, dist:distFibonacci, heat:false, pureColor:true, assorted:[GRN,RED,BLU], gravStar:1.0, dragStar:0.6, shrink:true,   // PALME MULTICOLORE 75mm (catalogue, user : 15 étoiles vertes/rouges/bleues)
          lifeBase75:3.0, starSize:2.6, trailing:{emitUntil:0.97, period:0.0022, grain:0.8, gF:0.45, lifeMul:8.15, color:EMBER, fixedColor:true, spark:true} },  // étincelles CHAUDES orangé/doré (EMBER) + DENSES (period 0.0022, B91) ; vie moy 1,9s ; étoiles réduites + shrink ; pointe verte/rouge/bleue

  // === FORMES 2D (face public) ===
  heart:     { apex:90, heat:false, stars:64, starSize:2.4, dist2D:shapeHeart, colors:[RED] },
  butterfly: { apex:90, heat:false, stars:64, starSize:2.3, dist2D:shapeButterfly, colors:[new THREE.Color(1.0,0.55,0.12), PURP] },
  smiley:    { apex:90, heat:false, stars:64, starSize:2.4, dist2D:shapeSmiley, colors:[YEL, new THREE.Color(1.0,0.25,0.12)] },
  daisy:     { apex:95, heat:false, stars:64, starSize:2.3, dist2D:shapeDaisy, colors:[PINK,YEL,CYAN,GRN] },

  // === MOTIFS 3D multi-couleurs ===
  atom:    { apex:100, heat:false, stars:60, starSize:2.2, lifeBase75:1.7, speedJit:0.08, dist:distAtom, colors:[CYAN,PINK,YEL] },
  halfHalf:{ apex:90, heat:false, stars:90, starSize:2.2, dist:distHalfHalf, colors:[new THREE.Color(1.0,0.2,0.2), BLU] },

  // === MOUVEMENT / TRAÎNE (hooks existants) ===
  medusa:    { apex:95, heat:false, stars:70, starSize:2.2, lifeBase75:2.3, gravStar:0.72, dragStar:0.55,
               color:CYAN, dist:distMedusa, trailing:{emitUntil:0.80, period:0.018, grain:1.0, gF:0.42, lifeMul:1.0, color:CYAN} },
  horsetail: { apex:80, heat:false, stars:11, starSize:0.9, lifeBase75:3.2, gravStar:0.78, dragStar:0.55,   // tête = POINTE, pas une boule (user B94, effets dorés)
               color:GOLD, dist:distHorsetail, onStar:glitterFn,
               trailing:{emitUntil:0.95, period:0.014, grain:1.0, gF:0.55, lifeMul:3.0, color:GOLD} },
  cascade:   { apex:110, heat:false, stars:30, starSize:0.9, lifeBase75:5.5, lifeJitter:0.30, speedJit:0.45, gravStar:1.0, dragStar:0.55, randomAxis:true, restExtra:3.5, noFlash:true, hideStars:true,   // CASCADE (B118) : encore + d'ESPACE entre boules (vitesses ±45%) ; gouttes invisibles ; morts aléatoires
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
  mine:   { color:GOLD, gerbe:{ dur:2.0, rate:380, cone:0.18, speedMul:1.25, grain:1.1 } }, // pot à feu : gerbe au sol, MONTE HAUT
  salute: { apex:90, heat:false, stars:14, starSize:2.0, lifeBase75:0.22, color:SILVER, dist:distSalute, flashBig:true },
};

export const LABELS = { peony:'pivoine', chrysanthemum:'chrysanthème', willow:'saule (kamuro)', comet:'comète',
  sphere:'sphère', ring:'couronne', crackling:'crackling', dragonEgg:'œuf de dragon', strobe:'scintillant', finalCli:'final cli. blanc rose', palmMulti:'palme multicolore',
  fallingLeaves:'feuille morte', palm:'palme', heart:'cœur', butterfly:'papillon', smiley:'smiley',
  daisy:'marguerite', atom:'atome', halfHalf:'demi-demi', medusa:'méduse', horsetail:'queue de cheval',
  cascade:'cascade', fish:'poisson', spinner:'tourbillon', saucer:'soucoupe', mosaic:'mosaïque', mosaicMix:'mosaïque assortie',
  mine:'pot à feu', salute:'salut' };

// ============================================================================
// SHELL
// ============================================================================
class Shell {
  constructor(arch, ox, oz, cal, opts){
    this.arch = EFFECTS[arch] ? arch : 'peony';
    this.cfg = Object.assign({}, BASE, EFFECTS[this.arch]);
    this.cfg.apex *= APEX_SCALE;   // abaisse TOUTES les hauteurs d'un coup (cfg est une copie -> safe)
    if (opts && opts.color) this.cfg.color = opts.color;   // override couleur (ex "crackling aqua", "mosaïque rouge")
    this.cal = cal || 75;
    this.ox = ox||0; this.oz = oz||0;
    this.bx = this.ox + (Math.random()-0.5)*this.cfg.riseLean;
    this.bz = this.oz + (Math.random()-0.5)*this.cfg.riseLean;
    this.dead = false; this.age = 0;
    // riseTime suit l'apex (×APEX_SCALE) -> la vitesse de montée reste identique (pas de comète molle)
    this.riseTime = this.cfg.riseTime * APEX_SCALE * (0.95 + Math.random()*0.10);
    this.headLastX=this.ox; this.headLastY=0; this.headLastZ=this.oz; this.headTimer=0;
    this.nMax = (this.cfg.nMax || this.cfg.stars) + (this.cfg.core ? this.cfg.core.stars : 0); this.nAlive = 0;
    this.data = []; this.flash=null; this.hasMuzzle=false;

    if (this.cfg.gerbe){               // POT À FEU : pas de montée ni burst, gerbe au sol
      this.phase='gerbe'; this.gerbeLeft=this.cfg.gerbe.dur; this.emitAcc=0; this.head=null;
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
      const N=(this.cfg.orient==='random')?vrand(Math.random):this.faceNormal();
      let aU=cross(N,[0,1,0]); if(len2(aU)<0.01)aU=cross(N,[1,0,0]); aU=norm(aU);
      const aV=cross(N,aU), roll=Math.random()*Math.PI*2;
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
    // VENT commun par tir (B120, feuilles mortes) : toutes les étoiles dérivent dans la MÊME direction
    // horizontale (un minimum de sens), le tangage individuel ne fait que broder autour.
    this._windX=0; this._windZ=0;
    if (this.cfg.wind){ const wa=Math.random()*Math.PI*2;
      this._windX=Math.cos(wa)*this.cfg.wind; this._windZ=Math.sin(wa)*this.cfg.wind; }
    this.nAlive=n;
    for (let i=0;i<n;i++){
      this.pos[i*3]=bx; this.pos[i*3+1]=apex; this.pos[i*3+2]=bz;
      let dir, comp=0;
      if (plane){ const p=pts[i];
        const px=p.x*plane.CR-p.y*plane.SR, py=p.x*plane.SR+p.y*plane.CR;
        let dx=plane.aU[0]*px+plane.aV[0]*py, dy=plane.aU[1]*px+plane.aV[1]*py, dz=plane.aU[2]*px+plane.aV[2]*py;
        const v=vrand(Math.random); dx+=v[0]*0.05; dy+=v[1]*0.05; dz+=v[2]*0.05;
        const L=Math.hypot(dx,dy,dz)||1;
        dir={dx:dx/L,dy:dy/L,dz:dz/L,spMul:0.9*(0.92+Math.random()*0.16)}; comp=p.comp||0;
      } else { dir=this.cfg.dist(i,n,Math.random); comp=dir.comp||0;
        if (this._rAxis){ const A2=this._rAxis, U=this._rU, V=this._rV;   // AXE ALÉATOIRE (B97, cascade) : la gerbe "haut" est réorientée vers l'axe tiré au sort pour CETTE bombe
          dir={ dx:U[0]*dir.dx+A2[0]*dir.dy+V[0]*dir.dz, dy:U[1]*dir.dx+A2[1]*dir.dy+V[1]*dir.dz, dz:U[2]*dir.dx+A2[2]*dir.dy+V[2]*dir.dz, spMul:dir.spMul, comp:dir.comp }; } }
      const sp=speed*(dir.spMul||1)*(1-jit+Math.random()*2*jit);
      const s=this._newStar(dir.dx*sp, dir.dy*sp, dir.dz*sp, comp, this.cfg.trailing);
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
      const big=this.cfg.flashBig;
      const fg=new THREE.SphereGeometry(0.6,16,16);
      const fm=new THREE.MeshBasicMaterial({ color:0xffd9a0, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false });
      this.flash=new THREE.Mesh(fg,fm); this.flash.position.set(bx,apex,bz); this.flashAge=0;
      this.flashScale=big?12:5; this.flashOp=big?0.9:0.4; this.flashDur=big?0.30:0.12;
      scene.add(this.flash);
    }
    if (this.head){ scene.remove(this.head); this.headGeo.dispose(); this.headMat.dispose(); this.head=null; }
  }

  _emitGerbe(){
    const g=this.cfg.gerbe, br=this.cfg.burstRadius, c=this.cfg.color;
    const A0=Math.random()*Math.PI*2, cone=Math.random()*g.cone, sc=Math.sin(cone), cc=Math.cos(cone);
    const sp=br*(0.45+Math.random()*1.40)*g.speedMul;
    const vx=Math.cos(A0)*sc*sp, vy=cc*sp, vz=Math.sin(A0)*sc*sp;
    spawnTrail(this.ox+(Math.random()-0.5)*2, 1+Math.random()*0.5, this.oz+(Math.random()-0.5)*2,
      c.r,c.g,c.b, 1.1*g.grain, 1.0, 1.5+Math.random()*2.5, vx*4, vy*4, vz*4);
  }

  // SORTIE DU TUBE — 3 composantes (échelle ∝ calibre via muzzleScale) :
  _emitMuzzleFlare(){   // lueur de gueule (source lumière) : PETITE et contenue (user B84 : "- ronde, - grosse")
    const sc=this.muzzleScale;
    spawnPuff(this.ox+(Math.random()-0.5)*0.3*sc, 1.0*sc, this.oz+(Math.random()-0.5)*0.3*sc,
      0,(1.5+Math.random()*1.5)*sc,0, 0.18+Math.random()*0.08, 1.2*sc, 2.4*sc,
      1.0,0.55,0.20, 0.50, 2*sc, 2.0);
  }
  _emitMuzzleFlame(){   // FLAMME : jet CONIQUE étroit (user B84 : "+ conique") — base serrée, monte plus haut, gonfle peu
    const sc=this.muzzleScale, ang=Math.random()*Math.PI*2, rad=Math.random()*Math.random();
    const out=(0.3+rad*1.1)*sc, up=(3.6+Math.random()*2.6)*sc, hot=1-rad;   // écart latéral réduit + vertical accru = cône
    spawnPuff(this.ox+(Math.random()-0.5)*0.18*sc, 0.8, this.oz+(Math.random()-0.5)*0.18*sc,
      Math.cos(ang)*out, up, Math.sin(ang)*out, 0.22+Math.random()*0.16, 0.5*sc, 1.0*sc,
      1.0, 0.30+0.33*hot, 0.03+0.20*hot, 0.75, 1.5*sc, 2.8);
  }
  _emitMuzzleSmoke(){   // FUMÉE : colonne étroite et discrète (resserrée avec la flamme conique, B84)
    const sc=this.muzzleScale, ang=Math.random()*Math.PI*2, out=(0.4+Math.random()*1.0)*sc, w=0.16+Math.random()*0.09;
    spawnPuff(this.ox+(Math.random()-0.5)*0.45*sc, 0.7, this.oz+(Math.random()-0.5)*0.45*sc,
      Math.cos(ang)*out, (3+Math.random()*4)*sc, Math.sin(ang)*out, 1.1+Math.random()*1.0, 1.0*sc, 3.2*sc,
      w*1.5, w*1.25, w, 0.16, 2.0*sc, 1.1);
  }
  _emitMuzzleDebris(){  // quelques débris (opercule/bourre) éjectés qui retombent (trail = gravité)
    const sc=this.muzzleScale, ang=Math.random()*Math.PI*2, out=(2+Math.random()*5)*sc, up=(7+Math.random()*9)*sc;
    spawnTrail(this.ox+(Math.random()-0.5)*0.3, 0.9, this.oz+(Math.random()-0.5)*0.3,
      0.5,0.30,0.12, 0.4, 1.4, 2.4, Math.cos(ang)*out*4, up*4, Math.sin(ang)*out*4);
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

  update(dt){
    if (this.dead) return;
    this.age += dt;

    // === POT À FEU : gerbe au sol ===
    if (this.phase==='gerbe'){
      this.gerbeLeft -= dt;
      if (this.gerbeLeft > 0){ this.emitAcc += this.cfg.gerbe.rate*dt;
        while (this.emitAcc>=1){ this.emitAcc-=1; this._emitGerbe(); } }
      else this.dead = true;
      return;
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
        spawnTrail(mx,my,mz, rc.r,rc.g,rc.b, big?1.4:1.1, 0.4, big?1.6:1.0);
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
      } else if (d.popOnly || d.eggSplode){ inten = 0; }           // cœur/pistil œuf de dragon : INVISIBLE avant de claquer (on ne voit que le crépitement)
        else if (this.cfg.hideStars){ inten = 0; }                 // cascade : l'étoile-goutte est INVISIBLE — on ne voit que la POINTE du sillage (étincelles fraîches)
        else if (this.cfg.arrow){ inten *= 0.45; }                 // œuf de dragon : étoile TRÈS DISCRÈTE avant de claquer (à peine une boule, la traînée domine)
      this.col[i*3]=r*inten; this.col[i*3+1]=g*inten; this.col[i*3+2]=b*inten;

      // FLOU DE MOUVEMENT (B82, croquis user) : ROND + QUEUE EN CÔNE au shader — tête ronde pleine
      // taille + cône effilé derrière (part large comme la boule, finit en pointe), rond à l'arrêt.
      this.vel[i*3]=d.vx; this.vel[i*3+1]=d.vy; this.vel[i*3+2]=d.vz;
      // SHRINK (B88, palme multicolore) : l'étoile RÉTRÉCIT progressivement -> disparaît de plus en plus petite
      if (this.cfg.shrink) this.size[i]=this.cfg.starSize*STAR_SCALE*(1-A*0.9);

      if (tr && A<tr.emitUntil && !d.popOnly && d.age<(d.crackleAt||1e9)){
        // ÉTINCELLES : débit ∝ VITESSE (B89) — grains/mètre constants. Sinon, quand l'étoile ralentit,
        // elle empile ses grains sur place et la traînée GROSSIT (plainte user) ; là le diamètre reste constant.
        let emitDt=dt;
        if (tr.spark){ const v=Math.hypot(d.vx,d.vy,d.vz); if(d.v0e===undefined) d.v0e=Math.max(v,1e-3);
          emitDt=dt*Math.max(0.10, Math.min(1, v/d.v0e)); }
        d.since+=emitDt;   // traînée tant que l'étoile n'a pas commencé à claquer
        // ÉMISSION AU VRAI DÉBIT (B87) : n grains par frame si period < dt (avant : 1 max/frame ->
        // impossible d'avoir des "milliers d'étincelles"). Répartis le long du trajet de la frame.
        let nEmit=Math.floor(d.since/tr.period); if (nEmit>0){ if (nEmit>8) nEmit=8; d.since-=nEmit*tr.period;
          const tc=tr.fixedColor ? (tr.color||GOLD) : (d.coreColor||tr.color||GOLD);   // fixedColor : la traînée garde SA couleur (ex palme multicolore = queue OR, pointe colorée) ; sinon héritée de l'étoile (mosaïque assortie)
          for (let e=0;e<nEmit;e++){ const fq=Math.random();                            // position aléatoire entre l'ancienne et la nouvelle -> pas de paquets
            const mx=d.lastX+(px-d.lastX)*fq, my=d.lastY+(py-d.lastY)*fq, mz=d.lastZ+(pz-d.lastZ)*fq;
            if (tr.spark){   // ÉTINCELLES (décomposition de l'étoile) : brillance TRÈS variable + dispersion -> nuée qui pétille, pas un ruban lisse
              let tw=(0.35+Math.pow(Math.random(),1.6)*1.65)*(tr.bright||1);   // bright : atténue le glow par effet
              if (tr.rampIn) tw*=0.25+0.75*Math.min(1, A/0.4);                 // rampIn (cascade) : étincelles TAMISÉES tant que les mèches sont serrées (anti boule lumineuse au break), pleine brillance une fois écartées
              spawnTrail(mx,my,mz, tc.r*tw,tc.g*tw,tc.b*tw, tr.grain, tr.gF, tr.lifeMul, d.vx,d.vy,d.vz, tr.jit||2.4, tr.fall||0.42, !!tr.flatLife, tr.grainRampIn||0);   // jit / fall / flatLife / grainRampIn réglables par effet
            } else {
              spawnTrail(mx,my,mz, tc.r,tc.g,tc.b, tr.grain, tr.gF, tr.lifeMul, d.vx,d.vy,d.vz);
            } }
          d.lastX=px; d.lastY=py; d.lastZ=pz; } }
    }
    this.geo.attributes.position.needsUpdate=true; this.geo.attributes.aColor.needsUpdate=true;
    this.geo.attributes.aVel.needsUpdate=true;
    if (this.cfg.shrink) this.geo.attributes.size.needsUpdate=true;

    if (this.phase==='burst' && alive===0){
      this.dead=true; scene.remove(this.points); scene.remove(this.lines);
      this.geo.dispose(); this.mat.dispose(); this.lgeo.dispose(); this.lmat.dispose();
      if (this.flash){ scene.remove(this.flash); this.flash.geometry.dispose(); this.flash.material.dispose(); }
    }
  }
}

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
    this.shell=null; this.restDelay=0; this.focus='peony'; this.current='peony'; this.focusColor=null; this.onBurst=null;
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
  fire(arch, color){ this.current=EFFECTS[arch]?arch:'peony';
    this.shell=new Shell(this.current,0,0,undefined, color?{color}:undefined);
    if (this.hud) this.hud.innerHTML='<b>PrevoFX — aperçu web</b> <span style="color:#7fff7f">['+BUILD+']</span><br>'+(LABELS[this.current]||this.current)+' 75 · QZSD + clic-glisser · Espace = pause'; }
  fireNext(){ this.fire(this.focus, this.focusColor); }
  setFocus(arch, color){ if (EFFECTS[arch]){ this.focus=arch; if (color!==undefined) this.focusColor=color; } }
  update(dt){
    if (!this.shell || this.shell.dead){ this.restDelay-=dt;
      if (this.restDelay<=0){ this.fireNext();
        // repos APRÈS la mort des étoiles : 0.8s par défaut + restExtra de l'effet tiré (ex cascade 4.5s :
        // ses PAILLETTES vivent ~7s après l'éclatement -> sans ça, le tir suivant noyait la fin de la traîne)
        this.restDelay=0.8+((EFFECTS[this.current]&&EFFECTS[this.current].restExtra)||0); } }
    if (this.shell){ const ph=this.shell.phase; this.shell.update(dt);
      if (ph!=='burst' && this.shell.phase==='burst' && this.onBurst) this.onBurst(this.current); }  // hook son à l'éclatement
    updateTrails(dt);
    updatePuffs(dt);
  }
  render(){ this.syncCamera(); this.composer.render(); }
}

// Exports internes pour le BANC D'APERÇU hors-Cesium (_preview.html) — rendu réel d'un effet
// pour capture d'écran. N'affecte pas l'app (rien ne les importe en prod).
export { scene as __scene, Shell as __Shell, updateTrails as __updateTrails, updatePuffs as __updatePuffs };
