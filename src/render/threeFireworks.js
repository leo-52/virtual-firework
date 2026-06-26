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

// --- pool de traînées (comète, gerbe mine, grains des effets traînants) ---
const TRAIL_MAX = 16000;
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
trailGeo.setAttribute('color',    new THREE.BufferAttribute(trailCol, 3));
trailGeo.setAttribute('size',     new THREE.BufferAttribute(trailSize, 1));
const trailMat = new THREE.PointsMaterial({ size:0.8, map:starTex, vertexColors:true,
  transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, sizeAttenuation:true });
scene.add(new THREE.Points(trailGeo, trailMat));

function spawnTrail(x,y,z, r,g,b, size, gF=0.4, lifeMul=1, vx0=0, vy0=0, vz0=0){
  const i = trailHead; trailHead = (trailHead + 1) % TRAIL_MAX;
  const t = trail[i];
  t.x=x; t.y=y; t.z=z;
  t.vx=vx0*0.25+(Math.random()-0.5)*0.8; t.vy=vy0*0.25-Math.random()*0.6; t.vz=vz0*0.25+(Math.random()-0.5)*0.8;
  t.age=0; t.life = lifeMul * 0.26 * (0.35 + 1.45*Math.pow(Math.random(),1.6));
  t.size = size*(0.7+Math.random()*0.6); t.r=r; t.g=g; t.b=b; t.gF=gF; t.alive=true;
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
    const kd = Math.max(0, 1 - 0.42*dt); t.vx*=kd; t.vy*=kd; t.vz*=kd;
    t.x+=t.vx*dt; t.y+=t.vy*dt; t.z+=t.vz*dt;
    const a = 1 - t.age/t.life;
    trailPos[i*3]=t.x; trailPos[i*3+1]=t.y; trailPos[i*3+2]=t.z;
    trailCol[i*3]=t.r*a*0.85; trailCol[i*3+1]=t.g*a*0.85; trailCol[i*3+2]=t.b*a*0.85;
    trailSize[i]=t.size*a;
  }
  trailGeo.attributes.position.needsUpdate = true;
  trailGeo.attributes.color.needsUpdate = true;
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
  const s=new THREE.Sprite(m); s.visible=false; scene.add(s);
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
  RED=new THREE.Color(1.0,0.14,0.18), PURP=new THREE.Color(0.6,0.35,1.0);

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
function distPalm(i,n,rnd){ const az=2*Math.PI*(i/n)+(rnd()-0.5)*0.4, up=0.55+0.35*Math.random();
  let dx=Math.cos(az),dy=up,dz=Math.sin(az); const L=Math.hypot(dx,dy,dz)||1;
  return {dx:dx/L,dy:dy/L,dz:dz/L,spMul:1.6}; }
function distLeaves(i,n,rnd){ const v=vrand(rnd); return {dx:v[0],dy:v[1],dz:v[2],spMul:0.45+rnd()*0.45}; }
function distMedusa(i,n,rnd){ const v=vrand(rnd); let dy=Math.abs(v[2])*0.9+0.25, dx=v[0], dz=v[1];
  const L=Math.hypot(dx,dy,dz)||1; return {dx:dx/L,dy:dy/L,dz:dz/L,spMul:0.83}; }
function distHorsetail(i,n,rnd){ const dx=(rnd()-0.5)*0.18, dz=(rnd()-0.5)*0.18, dy=1.0;
  const L=Math.hypot(dx,dy,dz)||1; return {dx:dx/L,dy:dy/L,dz:dz/L,spMul:0.33}; }
function distCascade(i,n,rnd){ const az=2*Math.PI*(i+(rnd()-0.4))/n, up=rnd(-0.12,0.22);
  let dx=Math.cos(az),dy=up,dz=Math.sin(az); const L=Math.hypot(dx,dy,dz)||1;
  return {dx:dx/L,dy:dy/L,dz:dz/L,spMul:0.47}; }
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
  if (d._splitAt===undefined) d._splitAt = 1.8 + Math.random()*0.4;     // DÉLAI burst->division ≈ 2s (1.8..2.2) ALÉATOIRE par comète
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
    ctx.addStar(px,py,pz, ix/L*esp, iy/L*esp, iz/L*esp, 0.85+Math.random()*0.7, d.comp, true);
  }
  d.age=d.life;
}

// ============================================================================
// TABLE DES EFFETS (clé absente -> BASE = profil pivoine)
// ============================================================================
const CAL_SCALE = { 50:0.67, 75:1.0, 100:1.44, 125:1.87, 150:2.30, 200:2.58 };
const STAR_SCALE = 1.2;   // étoiles +20% (réglage global ; user)
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
            starSize:1.8, speedMul:1.5, trailing:{emitUntil:0.95, period:0.014, grain:1.0, gF:0.22, lifeMul:4.0, color:GOLD} },
  comet: { apex:96, stars:1, dist:distComet, heat:false, color:GOLD, gravStar:0.90, dragStar:0.30,
           lifeBase75:3.0, starSize:4.5, speedMul:1.0, headSize:4.0, riseColor:GOLD,
           trailing:{emitUntil:0.97, period:0.012, grain:1.3, gF:0.35, lifeMul:1.8, color:GOLD} },
  sphere: { speedJit:0.02 },
  ring: { apex:110, burstRadius:16, stars:30, dist2D:shapeRing, orient:'random', heat:false, color:GRN },
  crackling: { apex:95, heat:false, color:CYAN, core:{ stars:18, radiusMul:0.42, color:GOLD } }, // pivoine COULEUR + pistil doré crépitant
  dragonEgg: { apex:95, heat:false, color:GOLD, onStar:crackleFn },                                // ŒUF DE DRAGON : crackle sur TOUT le break
  strobe: { apex:112, heat:false, color:SILVER, onStar:strobeFn, lifeBase75:2.4, gravStar:0.55 },
  fallingLeaves: { apex:95, dist:distLeaves, heat:false, color:new THREE.Color(1.0,0.45,0.55),
                   gravStar:0.26, dragStar:0.85, lifeBase75:6.0, speedMul:0.7, sway:7, starSize:2.4 },
  palm: { apex:105, stars:11, dist:distPalm, heat:false, color:GOLD, gravStar:0.95, dragStar:0.35,
          lifeBase75:2.4, starSize:3.0, trailing:{emitUntil:0.88, period:0.015, grain:1.3, gF:0.40, lifeMul:1.8, color:GOLD} },

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
  horsetail: { apex:80, heat:false, stars:11, starSize:1.7, lifeBase75:3.2, gravStar:0.78, dragStar:0.55,
               color:GOLD, dist:distHorsetail, onStar:glitterFn,
               trailing:{emitUntil:0.95, period:0.014, grain:1.0, gF:0.55, lifeMul:3.0, color:GOLD} },
  cascade:   { apex:110, heat:false, stars:90, starSize:2.0, lifeBase75:3.1, gravStar:0.80, dragStar:0.70,
               color:GOLD, dist:distCascade, trailing:{emitUntil:0.80, period:0.014, grain:1.1, gF:0.5, lifeMul:3.5, color:GOLD} },

  // === BEHAVE (mouvement/forks) ===
  fish:    { apex:85, heat:false, stars:40, starSize:2.0, lifeBase75:0.95, gravStar:0.20, dragStar:0.30,
             color:GRN, dist:distFish, behave:behaveFish, trailing:{emitUntil:0.6,period:0.02,grain:0.7,gF:0.3,lifeMul:0.7,color:GRN} },
  spinner: { apex:70, heat:false, stars:3, starSize:4.4, lifeBase75:2.2, gravStar:0.30, dragStar:0.18,
             color:SILVER, dist:distSpinner, behave:behaveSpinner },
  saucer:  { apex:60, heat:false, stars:1, starSize:4.6, lifeBase75:3.5, gravStar:0.85, dragStar:0.22,
             color:GOLD, headSize:3.0, riseColor:GOLD, dist:distSaucer, behave:behaveSaucer,
             trailing:{emitUntil:0.9, period:0.012, grain:1.1, gF:0.4, lifeMul:1.4, color:GOLD} },
  mosaic:  { apex:100, heat:false, stars:7, nMax:36, coreSplit:4, starSize:2.4, lifeBase75:3.0, color:SILVER, speedMul:1.8,
             dist:distMosaic, behave:behaveMosaic, trailing:{emitUntil:0.9, period:0.012, grain:1.2, gF:0.45, lifeMul:1.9, color:SILVER} },  // 75mm = 7 comètes, chacune se redivise en 4

  // === SOL / SPÉCIAUX ===
  mine:   { color:GOLD, gerbe:{ dur:2.0, rate:380, cone:0.18, speedMul:1.25, grain:1.1 } }, // pot à feu : gerbe au sol, MONTE HAUT
  salute: { apex:90, heat:false, stars:14, starSize:2.0, lifeBase75:0.22, color:SILVER, dist:distSalute, flashBig:true },
};

export const LABELS = { peony:'pivoine', chrysanthemum:'chrysanthème', willow:'saule (kamuro)', comet:'comète',
  sphere:'sphère', ring:'couronne', crackling:'crackling', dragonEgg:'œuf de dragon', strobe:'scintillant',
  fallingLeaves:'feuille morte', palm:'palme', heart:'cœur', butterfly:'papillon', smiley:'smiley',
  daisy:'marguerite', atom:'atome', halfHalf:'demi-demi', medusa:'méduse', horsetail:'queue de cheval',
  cascade:'cascade', fish:'poisson', spinner:'tourbillon', saucer:'soucoupe', mosaic:'mosaïque',
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
      this.head=new THREE.Points(this.headGeo,this.headMat); scene.add(this.head);
    }

    const m=this.nMax;
    this.pos=new Float32Array(m*3); this.col=new Float32Array(m*3);
    this.lpos=new Float32Array(m*2*3); this.lcol=new Float32Array(m*2*3);
    this.geo=new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos,3));
    this.geo.setAttribute('color',    new THREE.BufferAttribute(this.col,3));
    this.mat=new THREE.PointsMaterial({ size:this.cfg.starSize*STAR_SCALE, map:starTex, vertexColors:true,
      transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, sizeAttenuation:true });
    this.points=new THREE.Points(this.geo,this.mat); this.points.visible=false; scene.add(this.points);
    this.lgeo=new THREE.BufferGeometry();
    this.lgeo.setAttribute('position', new THREE.BufferAttribute(this.lpos,3));
    this.lgeo.setAttribute('color',    new THREE.BufferAttribute(this.lcol,3));
    this.lmat=new THREE.LineBasicMaterial({ vertexColors:true, transparent:true,
      blending:THREE.AdditiveBlending, depthWrite:false });
    this.lines=new THREE.LineSegments(this.lgeo,this.lmat); this.lines.visible=false; scene.add(this.lines);
  }

  _numColors(){ return this.cfg.colors ? this.cfg.colors.length : 1; }
  faceNormal(){ return norm([0,0.12,-1]); } // face public (vers -nord, légèrement haut)
  life(){ const s=CAL_SCALE[this.cal]||1, j=this.cfg.lifeJitter;
    return this.cfg.lifeBase75*s*(1+(Math.random()*2-1)*j); }

  _newStar(vx,vy,vz, comp, trailing){
    return { vx,vy,vz, age:0, life:this.life(), dimVar:0.95+Math.random()*0.10,
      phase:Math.random(), strobeF:2+Math.random()*2.5, swF:1.5+Math.random()*1.5,
      swF2:1.5+Math.random()*1.5, phase2:Math.random()*6.28, comp:comp||0,
      trailing:!!trailing, since:0, lastX:this.bx, lastY:this.cfg.apex, lastZ:this.bz };
  }

  addStar(px,py,pz, vx,vy,vz, life, comp, trailing){
    if (this.nAlive>=this.nMax) return; const i=this.nAlive++;
    this.pos[i*3]=px; this.pos[i*3+1]=py; this.pos[i*3+2]=pz;
    const s=this._newStar(vx,vy,vz, comp, trailing);
    s.life=life; s._i=i; s._split=true; s.lastX=px; s.lastY=py; s.lastZ=pz;
    this.data[i]=s;
  }

  burst(){
    const apex=this.cfg.apex, bx=this.bx, bz=this.bz;
    const speed=this.cfg.burstRadius*this.cfg.speedMul, jit=this.cfg.speedJit;
    let plane=null, pts=null, n;
    if (this.cfg.dist2D){
      pts=this.cfg.dist2D(Math.random, this.cal, this._numColors());
      n=Math.min(pts.length, this.nMax);
      const N=(this.cfg.orient==='random')?vrand(Math.random):this.faceNormal();
      let aU=cross(N,[0,1,0]); if(len2(aU)<0.01)aU=cross(N,[1,0,0]); aU=norm(aU);
      const aV=cross(N,aU), roll=Math.random()*Math.PI*2;
      plane={aU,aV,CR:Math.cos(roll),SR:Math.sin(roll)};
    } else n=this.cfg.stars;
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
      } else { dir=this.cfg.dist(i,n,Math.random); comp=dir.comp||0; }
      const sp=speed*(dir.spMul||1)*(1-jit+Math.random()*2*jit);
      const s=this._newStar(dir.dx*sp, dir.dy*sp, dir.dz*sp, comp, this.cfg.trailing);
      s._i=i; s._split=false; this.data[i]=s;
    }
    // PISTIL : un cœur d'étoiles plus petit (ex CRACKLING <couleur> = pivoine couleur + pistil
    // doré qui CRÉPITE). Les étoiles du cœur (d.crackle) poppent en blanc, surtout vers la fin.
    if (this.cfg.core){
      const co=this.cfg.core, cn=co.stars, csp=speed*co.radiusMul;
      for (let j=0;j<cn && this.nAlive<this.nMax;j++){
        const i=this.nAlive++, dir=distFibonacci(j,cn,Math.random), sp2=csp*(0.8+Math.random()*0.45);
        this.pos[i*3]=bx; this.pos[i*3+1]=apex; this.pos[i*3+2]=bz;
        const s=this._newStar(dir.dx*sp2, dir.dy*sp2, dir.dz*sp2, 0, false);
        s._i=i; s._split=false; s.crackle=true; s.coreColor=co.color; this.data[i]=s;
      }
    }
    this.points.visible=true; this.lines.visible=true;
    const big=this.cfg.flashBig;
    const fg=new THREE.SphereGeometry(0.6,16,16);
    const fm=new THREE.MeshBasicMaterial({ color:0xffd9a0, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false });
    this.flash=new THREE.Mesh(fg,fm); this.flash.position.set(bx,apex,bz); this.flashAge=0;
    this.flashScale=big?12:5; this.flashOp=big?0.9:0.4; this.flashDur=big?0.30:0.12;
    scene.add(this.flash);
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
  _emitMuzzleFlare(){   // lueur de gueule (source lumière) : plus CHAUDE et plus CONTENUE (moins voyante)
    const sc=this.muzzleScale;
    spawnPuff(this.ox+(Math.random()-0.5)*0.4*sc, 1.0*sc, this.oz+(Math.random()-0.5)*0.4*sc,
      0,(1.5+Math.random()*1.5)*sc,0, 0.20+Math.random()*0.10, 1.8*sc, 4.0*sc,
      1.0,0.55,0.20, 0.62, 2*sc, 2.0);
  }
  _emitMuzzleFlame(){   // FLAMME : pic ~2 m au-dessus du tube (75mm) ; étroit, chaud (orange). ∝ calibre.
    const sc=this.muzzleScale, ang=Math.random()*Math.PI*2, rad=Math.random()*Math.random();
    const out=(0.6+rad*2.1)*sc, up=(3+Math.random()*2.4)*sc, hot=1-rad;   // coeur(rad~0)=chaud ; bord=orange
    spawnPuff(this.ox+(Math.random()-0.5)*0.3*sc, 0.8, this.oz+(Math.random()-0.5)*0.3*sc,
      Math.cos(ang)*out, up, Math.sin(ang)*out, 0.22+Math.random()*0.16, 0.6*sc, 1.6*sc,
      1.0, 0.30+0.33*hot, 0.03+0.20*hot, 0.75, 1.5*sc, 2.8);
  }
  _emitMuzzleSmoke(){   // FUMÉE : plus DISCRÈTE (moins grosse / dense / visible que la flamme)
    const sc=this.muzzleScale, ang=Math.random()*Math.PI*2, out=(0.6+Math.random()*1.4)*sc, w=0.16+Math.random()*0.09;
    spawnPuff(this.ox+(Math.random()-0.5)*0.6*sc, 0.7, this.oz+(Math.random()-0.5)*0.6*sc,
      Math.cos(ang)*out, (3+Math.random()*4)*sc, Math.sin(ang)*out, 1.1+Math.random()*1.0, 1.2*sc, 4.0*sc,
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

      d.vy -= this.cfg.G*this.cfg.gravStar*dt;
      const kd=Math.max(0,1-this.cfg.dragStar*dt); d.vx*=kd; d.vy*=kd; d.vz*=kd;
      if (sway){ d.vx+=Math.sin(d.age*d.swF+d.phase)*sway*dt; d.vz+=Math.cos(d.age*d.swF2+d.phase2)*sway*dt; }
      if (behave) behave(d,A,dt,this);
      const px=this.pos[i*3]+d.vx*dt, py=this.pos[i*3+1]+d.vy*dt, pz=this.pos[i*3+2]+d.vz*dt;
      this.pos[i*3]=px; this.pos[i*3+1]=py; this.pos[i*3+2]=pz;

      const cc=this.heatColor(A,d); let r=cc.r,g=cc.g,b=cc.b,inten=cc.inten;
      if (this.cfg.onStar){ const o=this.cfg.onStar(d,A,dt); if (o){
        if (o.intenMul!=null) inten*=o.intenMul;
        if (o.whiteMix){ const w=o.whiteMix; r=r+(1-r)*w; g=g+(1-g)*w; b=b+(1-b)*w; } } }
      // PISTIL crépitant : pops blancs vifs sur les étoiles du cœur, de + en + vers la FIN
      if (d.crackle){ d.popOn=(d.popOn||0)-dt;
        if (d.popOn<=0 && Math.random()<(2.5+9*A)*dt) d.popOn=0.045;
        if (d.popOn>0){ inten*=2.6; const w=0.92; r=r+(1-r)*w; g=g+(1-g)*w; b=b+(1-b)*w; } }
      this.col[i*3]=r*inten; this.col[i*3+1]=g*inten; this.col[i*3+2]=b*inten;

      const mbk=0.07;
      this.lpos[li]=px; this.lpos[li+1]=py; this.lpos[li+2]=pz;
      this.lpos[li+3]=px-d.vx*mbk; this.lpos[li+4]=py-d.vy*mbk; this.lpos[li+5]=pz-d.vz*mbk;
      const hr=r*inten, hg=g*inten, hb=b*inten;
      this.lcol[li]=hr*0.8; this.lcol[li+1]=hg*0.8; this.lcol[li+2]=hb*0.8;
      this.lcol[li+3]=hr*0.10; this.lcol[li+4]=hg*0.10; this.lcol[li+5]=hb*0.10;

      if (tr && A<tr.emitUntil){ d.since+=dt;
        if (d.since>tr.period){ const mx=(d.lastX+px)*0.5, my=(d.lastY+py)*0.5, mz=(d.lastZ+pz)*0.5;
          const tc=tr.color||GOLD;
          spawnTrail(mx,my,mz, tc.r,tc.g,tc.b, tr.grain, tr.gF, tr.lifeMul, d.vx,d.vy,d.vz);
          d.lastX=px; d.lastY=py; d.lastZ=pz; d.since=0; } }
    }
    this.geo.attributes.position.needsUpdate=true; this.geo.attributes.color.needsUpdate=true;
    this.lgeo.attributes.position.needsUpdate=true; this.lgeo.attributes.color.needsUpdate=true;

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
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.3, 0.25, 0.12)); // moins de bloom
    this.composer.addPass(new OutputPass());
    this._pe=new Cesium.Cartesian3(); this._de=new Cesium.Cartesian3(); this._ue=new Cesium.Cartesian3();
    this.setOrigin(origin);
    this.shell=null; this.restDelay=0; this.focus='peony'; this.current='peony'; this.focusColor=null;
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
    if (this.hud) this.hud.innerHTML='<b>PrevoFX — aperçu web</b><br>'+(LABELS[this.current]||this.current)+' 75 · QZSD + clic-glisser · Espace = pause'; }
  fireNext(){ this.fire(this.focus, this.focusColor); }
  setFocus(arch, color){ if (EFFECTS[arch]){ this.focus=arch; if (color!==undefined) this.focusColor=color; } }
  update(dt){
    if (!this.shell || this.shell.dead){ this.restDelay-=dt;
      if (this.restDelay<=0){ this.fireNext(); this.restDelay=0.8; } }
    if (this.shell) this.shell.update(dt);
    updateTrails(dt);
    updatePuffs(dt);
  }
  render(){ this.syncCamera(); this.composer.render(); }
}

// Exports internes pour le BANC D'APERÇU hors-Cesium (_preview.html) — rendu réel d'un effet
// pour capture d'écran. N'affecte pas l'app (rien ne les importe en prod).
export { scene as __scene, Shell as __Shell, updateTrails as __updateTrails, updatePuffs as __updatePuffs };
