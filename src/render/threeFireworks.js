// Overlay de feux Three.js par-dessus le décor Cesium — MOTEUR MULTI-ARCHÉTYPES.
// - canvas transparent en mix-blend-mode:screen -> les feux (+ bloom) s'ADDITIONNENT
//   en lumière sur le décor (le noir n'affecte rien).
// - caméra Three SYNCHRONISÉE sur la caméra Cesium chaque frame (repère ENU du lieu de
//   tir, mapping ENU(e,n,u)->Three(e,u,-n)). Sim en mètres locaux, obus du SOL (y=0).
// - 1 classe Shell générique + table EFFECTS : chaque archétype = distribution + trailing
//   + gravité/frein + durée (par calibre) + comportement spécial. Pipeline (rise, burst,
//   physique 1-drag*dt, motion-blur, bloom) commun. Spécs portées du code Unreal + étude.

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

// --- pool de traînées (comète de montée + grains des effets traînants) ---
const TRAIL_MAX = 14000;
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

function spawnTrail(x,y,z, r,g,b, size, gF=0.4, lifeMul=1){
  const i = trailHead; trailHead = (trailHead + 1) % TRAIL_MAX;
  const t = trail[i];
  t.x=x; t.y=y; t.z=z;
  t.vx=(Math.random()-0.5)*0.8; t.vy=-Math.random()*0.6; t.vz=(Math.random()-0.5)*0.8;
  t.age=0; t.life = lifeMul * 0.26 * (0.35 + 1.45*Math.pow(Math.random(),1.6));
  t.size = size*(0.7+Math.random()*0.6); t.r=r; t.g=g; t.b=b; t.gF=gF; t.alive=true;
}
function updateTrails(dt){
  for (let i = 0; i < TRAIL_MAX; i++){
    const t = trail[i];
    if (!t.alive){ trailSize[i]=0; continue; }
    t.age += dt; if (t.age >= t.life){ t.alive=false; trailSize[i]=0; continue; }
    t.vy -= 9.8 * t.gF * dt;
    const kd = Math.max(0, 1 - 0.42*dt);
    t.vx*=kd; t.vy*=kd; t.vz*=kd;
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

// ============================================================================
// DISTRIBUTIONS du break (i,n,rnd) -> {dx,dy,dz, spMul, isCore?}
// ============================================================================
function vrand(rnd){ const z=rnd()*2-1, t=rnd()*Math.PI*2, r=Math.sqrt(Math.max(0,1-z*z));
  return [Math.cos(t)*r, Math.sin(t)*r, z]; }

function distFibonacci(i,n,rnd){            // sphère pleine et homogène
  const off=2/n, inc=2.399963229728653;
  const yy=i*off-1+off/2, rr=Math.sqrt(Math.max(0,1-yy*yy)), a=i*inc;
  let dx=Math.cos(a)*rr+(rnd()-0.5)*0.05, dy=yy+(rnd()-0.5)*0.05, dz=Math.sin(a)*rr+(rnd()-0.5)*0.05;
  const L=Math.hypot(dx,dy,dz)||1; return {dx:dx/L,dy:dy/L,dz:dz/L,spMul:1};
}
function distRing(i,n,rnd){                 // anneau dans le plan Est-Haut (face caméra sud)
  const a=2*Math.PI*i/n;
  let dx=Math.cos(a), dy=Math.sin(a), dz=(rnd()-0.5)*0.18;
  const L=Math.hypot(dx,dy,dz)||1; return {dx:dx/L,dy:dy/L,dz:dz/L,spMul:1};
}
function distComet(i,n,rnd){                // petite grappe montante (la montée EST l'effet)
  const v=vrand(rnd);
  let dx=v[0]*0.55, dy=0.55+0.55*Math.abs(v[1]), dz=v[2]*0.55;
  const L=Math.hypot(dx,dy,dz)||1; return {dx:dx/L,dy:dy/L,dz:dz/L,spMul:0.7};
}
function distPalm(i,n,rnd){                 // frondes montantes obliques (palmier)
  const az=2*Math.PI*(i/n)+(rnd()-0.5)*0.3;
  const up=0.5+0.4*Math.abs(Math.sin(az));
  let dx=Math.cos(az), dy=up, dz=Math.sin(az);
  const L=Math.hypot(dx,dy,dz)||1; return {dx:dx/L,dy:dy/L,dz:dz/L,spMul:1.8};
}
function distCrackling(i,n,rnd){            // coquille pivoine + coeur (étoiles "isCore")
  const core=Math.floor(n/6);
  if (i<core){ const v=vrand(rnd); return {dx:v[0],dy:v[1],dz:v[2],spMul:0.22,isCore:true}; }
  return distFibonacci(i-core, n-core, rnd);
}

// ============================================================================
// HOOKS onStar(d, A) -> {intenMul?, whiteMix?} | null  (comportements sur la durée)
// ============================================================================
function strobeFn(d){                       // clignotement régulier ~9 Hz (phase décalée par étoile)
  return { intenMul: (Math.floor((d.age + d.phase)*9) % 2) ? 0 : 1 };
}
function crackleFn(d, A){                    // pops blancs saccadés du coeur, surtout en fin
  if (!d.isCore) return null;
  if (A > 0.40){
    if (Math.random() < 0.45) return { intenMul: 1.9, whiteMix: 0.85 };
    return { intenMul: 0.18 };
  }
  return null;
}

// ============================================================================
// TABLE DES EFFETS (toute clé absente hérite de BASE = profil pivoine)
// ============================================================================
const GOLD = new THREE.Color(1.0, 0.72, 0.32);
const CAL_SCALE = { 50:0.67, 75:1.0, 100:1.44, 125:1.87, 150:2.30, 200:2.58 };

const BASE = {
  stars:80, burstRadius:13.5, speedMul:1.8, speedJit:0.05,
  apex:90, riseTime:2.5, riseLean:12,
  G:9.8, gravStar:1.0, dragStar:0.70,
  color:new THREE.Color(1.0,0.22,0.015), riseColor:new THREE.Color(1.0,0.72,0.35),
  heat:true, starSize:2.2, lifeBase75:1.55, lifeJitter:0.13,
  dist:distFibonacci, trailing:false, onStar:null
};

const EFFECTS = {
  // pivoine — référence (validée)
  peony: {},
  // chrysanthème = pivoine + traîne d'étincelles OR (seul diff : trailing)
  chrysanthemum: { trailing:{emitUntil:0.55, period:0.022, grain:0.85, gF:0.40, lifeMul:1.0, color:GOLD} },
  // saule = gravité basse + frein haut + vie longue + traîne dorée longue
  willow: { apex:100, speedMul:1.53, gravStar:0.62, dragStar:0.50, lifeBase75:3.0, starSize:2.0,
            heat:false, color:new THREE.Color(1.0,0.62,0.22),
            trailing:{emitUntil:0.85, period:0.018, grain:1.0, gF:0.40, lifeMul:1.7, color:GOLD} },
  // comète = peu d'étoiles montantes, grosses, traçantes (la montée porte l'effet)
  comet: { apex:90, stars:6, dist:distComet, gravStar:0.90, dragStar:0.35, lifeBase75:2.4, starSize:3.4,
           trailing:{emitUntil:0.70, period:0.020, grain:0.9, gF:0.40, lifeMul:1.2, color:GOLD} },
  // sphère = pivoine étoiles plus fines + dispersion plus large
  sphere: { apex:68, starSize:1.3, speedMul:1.9, speedJit:0.18 },
  // couronne = distribution plane (anneau face caméra)
  ring: { apex:110, burstRadius:16, dist:distRing },
  // crépitant = pivoine + coeur qui crépite en pops blancs
  crackling: { apex:95, dist:distCrackling, onStar:crackleFn },
  // scintillant = clignotement on/off ~9 Hz, teinte froide
  strobe: { apex:112, heat:false, color:new THREE.Color(0.80,0.86,1.0), onStar:strobeFn },
  // feuille morte = chute très lente (grav basse, frein énorme, vie très longue)
  fallingLeaves: { apex:95, speedMul:0.9, gravStar:0.30, dragStar:1.40, lifeBase75:6.0,
                   heat:false, color:new THREE.Color(1.0,0.55,0.18),
                   trailing:{emitUntil:0.70, period:0.05, grain:1.0, gF:0.25, lifeMul:1.2, color:GOLD} },
  // palmier = peu de frondes montantes, grosses comètes
  palm: { apex:105, stars:11, dist:distPalm, gravStar:0.70, dragStar:0.45, lifeBase75:2.0, starSize:3.1,
          trailing:{emitUntil:0.70, period:0.018, grain:1.1, gF:0.40, lifeMul:1.3, color:GOLD} },
};

const LABELS = { peony:'pivoine', chrysanthemum:'chrysanthème', willow:'saule', comet:'comète',
  sphere:'sphère', ring:'couronne', crackling:'crépitant', strobe:'scintillant',
  fallingLeaves:'feuille morte', palm:'palmier' };

// ============================================================================
// SHELL : un obus (tir -> montée -> burst -> retombée), configuré par un archétype.
// ============================================================================
class Shell {
  constructor(arch, ox, oz, cal){
    this.arch = EFFECTS[arch] ? arch : 'peony';
    this.cfg = Object.assign({}, BASE, EFFECTS[this.arch]);
    this.cal = cal || 75;
    this.ox = ox||0; this.oz = oz||0;
    this.bx = this.ox + (Math.random()-0.5)*this.cfg.riseLean;
    this.bz = this.oz + (Math.random()-0.5)*this.cfg.riseLean;
    this.dead = false; this.age = 0; this.phase = 'rise';
    this.riseTime = this.cfg.riseTime * (0.95 + Math.random()*0.10);
    this.headLastX = this.ox; this.headLastY = 0; this.headLastZ = this.oz; this.headTimer = 0;
    const n = this.cfg.stars; this.n = n;

    const ug = new THREE.SphereGeometry(0.8, 12, 12);
    const um = new THREE.MeshBasicMaterial({ color:0xffe3b0, transparent:true, opacity:0.0,
      blending:THREE.AdditiveBlending, depthWrite:false });
    this.launch = new THREE.Mesh(ug, um); this.launch.position.set(this.ox, 1.5, this.oz);
    scene.add(this.launch);

    this.headGeo = new THREE.BufferGeometry();
    this.headGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([this.ox,0,this.oz]),3));
    this.headMat = new THREE.PointsMaterial({ size:1.0, map:starTex, color:this.cfg.riseColor,
      transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, sizeAttenuation:true });
    this.head = new THREE.Points(this.headGeo, this.headMat); scene.add(this.head);

    this.pos=new Float32Array(n*3); this.col=new Float32Array(n*3);
    this.lpos=new Float32Array(n*2*3); this.lcol=new Float32Array(n*2*3); this.data=[];
    this.geo=new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos,3));
    this.geo.setAttribute('color',    new THREE.BufferAttribute(this.col,3));
    this.mat=new THREE.PointsMaterial({ size:this.cfg.starSize, map:starTex, vertexColors:true,
      transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, sizeAttenuation:true });
    this.points=new THREE.Points(this.geo,this.mat); this.points.visible=false; scene.add(this.points);

    this.lgeo=new THREE.BufferGeometry();
    this.lgeo.setAttribute('position', new THREE.BufferAttribute(this.lpos,3));
    this.lgeo.setAttribute('color',    new THREE.BufferAttribute(this.lcol,3));
    this.lmat=new THREE.LineBasicMaterial({ vertexColors:true, transparent:true,
      blending:THREE.AdditiveBlending, depthWrite:false });
    this.lines=new THREE.LineSegments(this.lgeo,this.lmat); this.lines.visible=false; scene.add(this.lines);

    this.flash=null; this.flashAge=0;
  }

  life(){ const s = CAL_SCALE[this.cal]||1; const j=this.cfg.lifeJitter;
    return this.cfg.lifeBase75 * s * (1 + (Math.random()*2-1)*j); }

  burst(){
    const n=this.n, apex=this.cfg.apex, bx=this.bx, bz=this.bz;
    const speed=this.cfg.burstRadius*this.cfg.speedMul, jit=this.cfg.speedJit;
    for (let i=0;i<n;i++){
      this.pos[i*3]=bx; this.pos[i*3+1]=apex; this.pos[i*3+2]=bz;
      const dir=this.cfg.dist(i,n,Math.random);
      const sp=speed*(dir.spMul||1)*(1 - jit + Math.random()*2*jit);
      this.data.push({ vx:dir.dx*sp, vy:dir.dy*sp, vz:dir.dz*sp, age:0,
        life:this.life(), dimVar:0.95+Math.random()*0.10,
        isCore:!!dir.isCore, phase:Math.random(),
        trailing:!!this.cfg.trailing, since:0, lastX:bx, lastY:apex, lastZ:bz });
    }
    this.points.visible=true; this.lines.visible=true;
    const fg=new THREE.SphereGeometry(0.6,16,16);
    const fm=new THREE.MeshBasicMaterial({ color:0xffd9a0, transparent:true,
      blending:THREE.AdditiveBlending, depthWrite:false });
    this.flash=new THREE.Mesh(fg,fm); this.flash.position.set(bx,apex,bz); this.flashAge=0; scene.add(this.flash);
    scene.remove(this.head); this.headGeo.dispose(); this.headMat.dispose(); this.head=null;
  }

  // couleur de combustion : flash blanc -> teinte -> refroidissement (si heat) ; sinon teinte stable
  heatColor(A, d){
    const c=this.cfg.color; let r, g, b;
    if (this.cfg.heat){
      r=1.0;
      if (A<0.6){ g=(c.g+0.06)-0.06*(A/0.6); b=c.b+0.015; }
      else { const t=(A-0.6)/0.4; g=c.g-(c.g-0.05)*t; b=(c.b+0.015)*(1-t); }
      if (A<0.05){ const f=(1-A/0.05)*0.55; r=r+(1-r)*f; g=g+(1-g)*f; b=b+(1-b)*f; }
    } else {
      r=c.r; g=c.g; b=c.b;
      if (A<0.04){ const f=(1-A/0.04)*0.5; r=r+(1-r)*f; g=g+(1-g)*f; b=b+(1-b)*f; }
    }
    const fade=Math.max(0,1-A*A*0.85), fadeIn=0.4+0.6*Math.min(1,d.age/0.25);
    return { r, g, b, inten: 2.4*fade*d.dimVar*fadeIn };
  }

  update(dt){
    if (this.dead) return;
    this.age += dt;

    if (this.launch){
      const lp=this.age/0.18;
      if (lp<1){ this.launch.scale.setScalar(1+lp*5); this.launch.material.opacity=(1-lp)*0.6; }
      else { scene.remove(this.launch); this.launch.geometry.dispose(); this.launch.material.dispose(); this.launch=null; }
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
        spawnTrail(mx,my,mz, this.cfg.riseColor.r, this.cfg.riseColor.g, this.cfg.riseColor.b, 1.1);
        this.headLastX=hx; this.headLastY=y; this.headLastZ=hz; this.headTimer=0.015;
      }
      if (T>=1){ this.burst(); this.phase='burst'; }
      return;
    }

    if (this.flash){
      this.flashAge+=dt; const fd=0.12;
      if (this.flashAge<fd){ const p=this.flashAge/fd; this.flash.scale.setScalar(1+p*5); this.flash.material.opacity=(1-p)*0.4; }
      else { scene.remove(this.flash); this.flash.geometry.dispose(); this.flash.material.dispose(); this.flash=null; }
    }

    const n=this.n; let alive=0; const tr=this.cfg.trailing;
    for (let i=0;i<n;i++){
      const d=this.data[i], li=i*6;
      if (d.age>=d.life){ this.col[i*3]=this.col[i*3+1]=this.col[i*3+2]=0;
        this.lcol[li]=this.lcol[li+1]=this.lcol[li+2]=this.lcol[li+3]=this.lcol[li+4]=this.lcol[li+5]=0; continue; }
      alive++; d.age+=dt; const A=d.age/d.life;

      d.vy -= this.cfg.G*this.cfg.gravStar*dt;
      const kd=Math.max(0,1-this.cfg.dragStar*dt); d.vx*=kd; d.vy*=kd; d.vz*=kd;
      const px=this.pos[i*3]+d.vx*dt, py=this.pos[i*3+1]+d.vy*dt, pz=this.pos[i*3+2]+d.vz*dt;
      this.pos[i*3]=px; this.pos[i*3+1]=py; this.pos[i*3+2]=pz;

      const cc=this.heatColor(A,d); let r=cc.r,g=cc.g,b=cc.b,inten=cc.inten;
      if (this.cfg.onStar){ const o=this.cfg.onStar(d,A); if (o){
        if (o.intenMul!=null) inten*=o.intenMul;
        if (o.whiteMix){ const w=o.whiteMix; r=r+(1-r)*w; g=g+(1-g)*w; b=b+(1-b)*w; } } }
      this.col[i*3]=r*inten; this.col[i*3+1]=g*inten; this.col[i*3+2]=b*inten;

      const mbk=0.07;
      this.lpos[li]=px; this.lpos[li+1]=py; this.lpos[li+2]=pz;
      this.lpos[li+3]=px-d.vx*mbk; this.lpos[li+4]=py-d.vy*mbk; this.lpos[li+5]=pz-d.vz*mbk;
      const hr=r*inten, hg=g*inten, hb=b*inten;
      this.lcol[li]=hr*0.8; this.lcol[li+1]=hg*0.8; this.lcol[li+2]=hb*0.8;
      this.lcol[li+3]=hr*0.10; this.lcol[li+4]=hg*0.10; this.lcol[li+5]=hb*0.10;

      if (tr && A < tr.emitUntil){
        d.since+=dt;
        if (d.since > tr.period){
          const mx=(d.lastX+px)*0.5, my=(d.lastY+py)*0.5, mz=(d.lastZ+pz)*0.5;
          const tc=tr.color||GOLD;
          spawnTrail(mx,my,mz, tc.r,tc.g,tc.b, tr.grain, tr.gF, tr.lifeMul);
          d.lastX=px; d.lastY=py; d.lastZ=pz; d.since=0;
        }
      }
    }
    this.geo.attributes.position.needsUpdate=true; this.geo.attributes.color.needsUpdate=true;
    this.lgeo.attributes.position.needsUpdate=true; this.lgeo.attributes.color.needsUpdate=true;

    if (this.phase==='burst' && alive===0){
      this.dead=true;
      scene.remove(this.points); scene.remove(this.lines);
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
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.25, 0.12));
    this.composer.addPass(new OutputPass());

    this._pe=new Cesium.Cartesian3(); this._de=new Cesium.Cartesian3(); this._ue=new Cesium.Cartesian3();
    this.setOrigin(origin);

    this.shell=null; this.restDelay=0;
    this.cycle=['peony','chrysanthemum','willow','sphere','ring','palm','crackling','strobe','fallingLeaves','comet'];
    this.ci=0; this.current='peony';
    this.hud = document.getElementById('hud');

    addEventListener('resize', () => this._resize());
  }

  _resize(){
    this.camera.aspect=innerWidth/innerHeight; this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight); this.composer.setSize(innerWidth, innerHeight);
  }

  setOrigin(origin){
    this.origin=Cesium.Cartesian3.fromDegrees(origin.lon, origin.lat, origin.height);
    this.enuToFixed=Cesium.Transforms.eastNorthUpToFixedFrame(this.origin);
    this.fixedToEnu=Cesium.Matrix4.inverseTransformation(this.enuToFixed, new Cesium.Matrix4());
  }
  localToWorld(local){
    return Cesium.Matrix4.multiplyByPoint(this.enuToFixed,
      new Cesium.Cartesian3(local[0],local[1],local[2]), new Cesium.Cartesian3());
  }

  syncCamera(){
    const cam=this.viewer.camera;
    Cesium.Matrix4.multiplyByPoint(this.fixedToEnu, cam.positionWC, this._pe);
    Cesium.Matrix4.multiplyByPointAsVector(this.fixedToEnu, cam.directionWC, this._de);
    Cesium.Matrix4.multiplyByPointAsVector(this.fixedToEnu, cam.upWC, this._ue);
    this.camera.position.set(this._pe.x, this._pe.z, -this._pe.y);
    this.camera.up.set(this._ue.x, this._ue.z, -this._ue.y);
    this.camera.lookAt(this._pe.x+this._de.x, this._pe.z+this._de.z, -this._pe.y-this._de.y);
    const f=cam.frustum, aspect=f.aspectRatio||(innerWidth/innerHeight);
    const vfov=(aspect>=1) ? 2*Math.atan(Math.tan(f.fov/2)/aspect) : f.fov;
    this.camera.fov=THREE.MathUtils.radToDeg(vfov); this.camera.aspect=aspect; this.camera.updateProjectionMatrix();
  }

  fire(arch){ this.current = EFFECTS[arch] ? arch : 'peony'; this.shell = new Shell(this.current, 0, 0);
    if (this.hud) this.hud.innerHTML = '<b>PrevoFX — aperçu web</b><br>'+(LABELS[this.current]||this.current)+' 75 · QZSD + clic-glisser'; }
  fireNext(){ this.fire(this.cycle[this.ci % this.cycle.length]); this.ci++; }

  update(dt){
    if (!this.shell || this.shell.dead){
      this.restDelay -= dt;
      if (this.restDelay <= 0){ this.fireNext(); this.restDelay = 0.8; }
    }
    if (this.shell) this.shell.update(dt);
    updateTrails(dt);
  }

  render(){ this.syncCamera(); this.composer.render(); }
}
