// Overlay de feux Three.js par-dessus le décor Cesium.
// - canvas transparent en mix-blend-mode:screen -> les feux (+ bloom) s'ADDITIONNENT en
//   lumière sur le décor (le noir n'affecte rien) ; ça amorce les reflets sur le terrain.
// - la caméra Three.js est SYNCHRONISÉE sur la caméra Cesium chaque frame, dans le repère
//   local ENU (est, nord, haut) ancré au lieu de tir. Mapping ENU->Three : x=Est, y=Haut, z=-Nord.
// - le moteur (rise -> burst -> retombée) tourne en MÈTRES locaux ; l'obus part du SOL (y=0).
// Moteur identique à web/three-engine.html (calibré catalogue : 75mm apex 90m, envergure ~50m).

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// --- scène + texture (module-level : un seul overlay) ---
const scene = new THREE.Scene();

function makeStarTexture(){
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32,32,0, 32,32,32);
  g.addColorStop(0.0,  'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,200,120,0.95)');
  g.addColorStop(0.45, 'rgba(255,120,30,0.5)');
  g.addColorStop(1.0,  'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0,0,64,64);
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}
const starTex = makeStarTexture();

// --- pool de traînées (comète de montée + grains des effets traînants) ---
const TRAIL_MAX = 12000;
const trailPos  = new Float32Array(TRAIL_MAX * 3);
const trailCol  = new Float32Array(TRAIL_MAX * 3);
const trailSize = new Float32Array(TRAIL_MAX);
const trail = [];
for (let i = 0; i < TRAIL_MAX; i++){
  trail.push({ x:0,y:0,z:0, vx:0,vy:0,vz:0, age:0, life:0, size:0, r:0,g:0,b:0, alive:false });
  trailSize[i] = 0;
}
let trailHead = 0;
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
trailGeo.setAttribute('color',    new THREE.BufferAttribute(trailCol, 3));
trailGeo.setAttribute('size',     new THREE.BufferAttribute(trailSize, 1));
const trailMat = new THREE.PointsMaterial({
  size: 0.8, map: starTex, vertexColors: true, transparent: true,
  blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
});
scene.add(new THREE.Points(trailGeo, trailMat));

function spawnTrail(x,y,z, r,g,b, size){
  const i = trailHead; trailHead = (trailHead + 1) % TRAIL_MAX;
  const t = trail[i];
  t.x=x; t.y=y; t.z=z;
  t.vx = (Math.random()-0.5)*0.8; t.vy = -Math.random()*0.6; t.vz = (Math.random()-0.5)*0.8;
  t.age = 0;
  t.life = 0.26 * (0.35 + 1.45 * Math.pow(Math.random(), 1.6));
  t.size = size * (0.7 + Math.random()*0.6);
  t.r=r; t.g=g; t.b=b; t.alive = true;
}
function updateTrails(dt){
  for (let i = 0; i < TRAIL_MAX; i++){
    const t = trail[i];
    if (!t.alive){ trailSize[i] = 0; continue; }
    t.age += dt;
    if (t.age >= t.life){ t.alive = false; trailSize[i] = 0; continue; }
    t.vy -= 9.8 * 0.4 * dt;
    const kd = Math.max(0, 1 - 0.42*dt);
    t.vx *= kd; t.vy *= kd; t.vz *= kd;
    t.x += t.vx*dt; t.y += t.vy*dt; t.z += t.vz*dt;
    const a = 1 - t.age / t.life;
    trailPos[i*3] = t.x; trailPos[i*3+1] = t.y; trailPos[i*3+2] = t.z;
    trailCol[i*3] = t.r*a*0.85; trailCol[i*3+1] = t.g*a*0.85; trailCol[i*3+2] = t.b*a*0.85;
    trailSize[i] = t.size * a;
  }
  trailGeo.attributes.position.needsUpdate = true;
  trailGeo.attributes.color.needsUpdate = true;
  trailGeo.attributes.size.needsUpdate = true;
}

// --- pivoine 75mm calibrée catalogue (apex 90 m, envergure ~50 m) ---
const PEONY = {
  stars: 80, burstRadius: 13.5, speedMul: 1.8,
  apex: 90, riseTime: 2.5, riseLean: 12,
  G: 9.8, gravStar: 1.0, dragStar: 0.70,
  color: new THREE.Color(1.0, 0.22, 0.015),
  riseColor: new THREE.Color(1.0, 0.72, 0.35),
  starSize: 2.2, lifeMin: 1.35, lifeMax: 1.75, trailing: false
};

class Peony {
  constructor(ox, oz){
    this.ox = ox||0; this.oz = oz||0;
    this.bx = this.ox + (Math.random()-0.5)*PEONY.riseLean;
    this.bz = this.oz + (Math.random()-0.5)*PEONY.riseLean;
    this.dead = false; this.age = 0; this.phase = 'rise';
    this.riseTime = PEONY.riseTime * (0.95 + Math.random()*0.10);
    this.headLastX = this.ox; this.headLastY = 0; this.headLastZ = this.oz; this.headTimer = 0;
    const n = PEONY.stars; this.n = n;

    const ug = new THREE.SphereGeometry(0.8, 12, 12);
    const um = new THREE.MeshBasicMaterial({ color:0xffe3b0, transparent:true, opacity:0.0,
      blending:THREE.AdditiveBlending, depthWrite:false });
    this.launch = new THREE.Mesh(ug, um);
    this.launch.position.set(this.ox, 1.5, this.oz);
    scene.add(this.launch);

    this.headGeo = new THREE.BufferGeometry();
    this.headGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([this.ox, 0, this.oz]), 3));
    this.headMat = new THREE.PointsMaterial({ size:1.0, map:starTex, color:PEONY.riseColor,
      transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, sizeAttenuation:true });
    this.head = new THREE.Points(this.headGeo, this.headMat);
    scene.add(this.head);

    this.pos  = new Float32Array(n*3);
    this.col  = new Float32Array(n*3);
    this.lpos = new Float32Array(n*2*3);
    this.lcol = new Float32Array(n*2*3);
    this.data = [];
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos,3));
    this.geo.setAttribute('color',    new THREE.BufferAttribute(this.col,3));
    this.mat = new THREE.PointsMaterial({ size:PEONY.starSize, map:starTex, vertexColors:true,
      transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, sizeAttenuation:true });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.visible = false; scene.add(this.points);

    this.lgeo = new THREE.BufferGeometry();
    this.lgeo.setAttribute('position', new THREE.BufferAttribute(this.lpos,3));
    this.lgeo.setAttribute('color',    new THREE.BufferAttribute(this.lcol,3));
    this.lmat = new THREE.LineBasicMaterial({ vertexColors:true, transparent:true,
      blending:THREE.AdditiveBlending, depthWrite:false });
    this.lines = new THREE.LineSegments(this.lgeo, this.lmat);
    this.lines.visible = false; scene.add(this.lines);

    this.flash = null; this.flashAge = 0;
  }

  burst(){
    const n = this.n, apex = PEONY.apex, bx = this.bx, bz = this.bz;
    const speed = PEONY.burstRadius * PEONY.speedMul;
    const inc = 2.399963229728653, off = 2/n;
    for (let i = 0; i < n; i++){
      this.pos[i*3]=bx; this.pos[i*3+1]=apex; this.pos[i*3+2]=bz;
      const yy = i*off - 1 + off/2;
      const rr = Math.sqrt(Math.max(0, 1 - yy*yy));
      const ang = i*inc;
      let dx = Math.cos(ang)*rr + (Math.random()-0.5)*0.05;
      let dy = yy               + (Math.random()-0.5)*0.05;
      let dz = Math.sin(ang)*rr + (Math.random()-0.5)*0.05;
      const Ln = Math.hypot(dx,dy,dz)||1; dx/=Ln; dy/=Ln; dz/=Ln;
      const sp = speed * (0.95 + Math.random()*0.10);
      this.data.push({ vx:dx*sp, vy:dy*sp, vz:dz*sp, age:0,
        life: PEONY.lifeMin + Math.random()*(PEONY.lifeMax-PEONY.lifeMin),
        dimVar: 0.95 + Math.random()*0.10,
        trailing: PEONY.trailing, since:0, lastX:bx, lastY:apex, lastZ:bz });
    }
    this.points.visible = true; this.lines.visible = true;
    const fg = new THREE.SphereGeometry(0.6, 16, 16);
    const fm = new THREE.MeshBasicMaterial({ color:0xffd9a0, transparent:true,
      blending:THREE.AdditiveBlending, depthWrite:false });
    this.flash = new THREE.Mesh(fg, fm); this.flash.position.set(bx, apex, bz); this.flashAge = 0;
    scene.add(this.flash);
    scene.remove(this.head); this.headGeo.dispose(); this.headMat.dispose(); this.head = null;
  }

  update(dt){
    if (this.dead) return;
    this.age += dt;

    if (this.launch){
      const lp = this.age / 0.18;
      if (lp < 1){ this.launch.scale.setScalar(1 + lp*5); this.launch.material.opacity = (1-lp)*0.6; }
      else { scene.remove(this.launch); this.launch.geometry.dispose(); this.launch.material.dispose(); this.launch = null; }
    }

    if (this.phase === 'rise'){
      const T = Math.min(1, this.age / this.riseTime);
      const te = 1 - (1-T)*(1-T);
      const y  = PEONY.apex * te;
      const hx = this.ox + (this.bx-this.ox)*te;
      const hz = this.oz + (this.bz-this.oz)*te;
      const a = this.headGeo.attributes.position.array;
      a[0]=hx; a[1]=y; a[2]=hz; this.headGeo.attributes.position.needsUpdate = true;
      this.headTimer -= dt;
      const dmoved = Math.hypot(hx-this.headLastX, y-this.headLastY, hz-this.headLastZ);
      if (this.headTimer <= 0 && dmoved > 0.4){
        const mx=(this.headLastX+hx)*0.5, my=(this.headLastY+y)*0.5, mz=(this.headLastZ+hz)*0.5;
        spawnTrail(mx, my, mz, PEONY.riseColor.r, PEONY.riseColor.g, PEONY.riseColor.b, 1.1);
        this.headLastX=hx; this.headLastY=y; this.headLastZ=hz; this.headTimer = 0.015;
      }
      if (T >= 1){ this.burst(); this.phase = 'burst'; }
      return;
    }

    if (this.flash){
      this.flashAge += dt; const fd = 0.12;
      if (this.flashAge < fd){
        const p = this.flashAge/fd;
        this.flash.scale.setScalar(1 + p*5);
        this.flash.material.opacity = (1-p)*0.4;
      } else { scene.remove(this.flash); this.flash.geometry.dispose(); this.flash.material.dispose(); this.flash = null; }
    }

    const n = this.n; let alive = 0;
    for (let i = 0; i < n; i++){
      const d = this.data[i];
      const li = i*6;
      if (d.age >= d.life){ this.col[i*3]=this.col[i*3+1]=this.col[i*3+2]=0;
        this.lcol[li]=this.lcol[li+1]=this.lcol[li+2]=this.lcol[li+3]=this.lcol[li+4]=this.lcol[li+5]=0; continue; }
      alive++; d.age += dt;
      const A = d.age / d.life;

      d.vy -= PEONY.G * PEONY.gravStar * dt;
      const kd = Math.max(0, 1 - PEONY.dragStar*dt);
      d.vx *= kd; d.vy *= kd; d.vz *= kd;
      const px = this.pos[i*3]+d.vx*dt, py = this.pos[i*3+1]+d.vy*dt, pz = this.pos[i*3+2]+d.vz*dt;
      this.pos[i*3]=px; this.pos[i*3+1]=py; this.pos[i*3+2]=pz;

      let r=1.0, g, b;
      if (A < 0.6){ g = 0.28 - 0.06*(A/0.6); b = 0.03; }
      else { const t=(A-0.6)/0.4; g = 0.22 - 0.17*t; b = 0.03*(1-t); }
      if (A < 0.05){ const f=(1-A/0.05)*0.55; r=r+(1-r)*f; g=g+(1-g)*f; b=b+(1-b)*f; }
      const fade   = Math.max(0, 1 - A*A*0.85);
      const fadeIn = 0.4 + 0.6*Math.min(1, d.age/0.25);
      const inten  = 2.4 * fade * d.dimVar * fadeIn;
      this.col[i*3]=r*inten; this.col[i*3+1]=g*inten; this.col[i*3+2]=b*inten;

      const mbk = 0.07;
      this.lpos[li]=px;            this.lpos[li+1]=py;            this.lpos[li+2]=pz;
      this.lpos[li+3]=px-d.vx*mbk; this.lpos[li+4]=py-d.vy*mbk;   this.lpos[li+5]=pz-d.vz*mbk;
      const hr=r*inten, hg=g*inten, hb=b*inten;
      this.lcol[li]=hr*0.8;    this.lcol[li+1]=hg*0.8;   this.lcol[li+2]=hb*0.8;
      this.lcol[li+3]=hr*0.10; this.lcol[li+4]=hg*0.10;  this.lcol[li+5]=hb*0.10;

      if (d.trailing && A < 0.55){
        d.since += dt;
        if (d.since > 0.022){
          const mx=(d.lastX+px)*0.5, my=(d.lastY+py)*0.5, mz=(d.lastZ+pz)*0.5;
          spawnTrail(mx,my,mz, r, g, b, 0.9);
          d.lastX=px; d.lastY=py; d.lastZ=pz; d.since=0;
        }
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.lgeo.attributes.position.needsUpdate = true;
    this.lgeo.attributes.color.needsUpdate = true;

    if (this.phase === 'burst' && alive === 0){
      this.dead = true;
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
    Object.assign(this.canvas.style, {
      position:'fixed', top:'0', left:'0', width:'100%', height:'100%',
      pointerEvents:'none', zIndex:'1', mixBlendMode:'screen'
    });
    document.body.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas:this.canvas, antialias:true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 1); // fond noir opaque (le screen le rend "transparent")
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;

    this.camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 1, 50000);
    scene.add(this.camera);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.25, 0.12));
    this.composer.addPass(new OutputPass());

    // scratch Cesium (zéro alloc par frame)
    this._pe = new Cesium.Cartesian3();
    this._de = new Cesium.Cartesian3();
    this._ue = new Cesium.Cartesian3();

    this.setOrigin(origin);
    this.peony = null; this.restDelay = 0;

    addEventListener('resize', () => this._resize());
  }

  _resize(){
    this.camera.aspect = innerWidth/innerHeight; this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setSize(innerWidth, innerHeight);
  }

  // (Re)cale le repère ENU au lieu de tir (sol réel).
  setOrigin(origin){
    this.origin = Cesium.Cartesian3.fromDegrees(origin.lon, origin.lat, origin.height);
    this.enuToFixed = Cesium.Transforms.eastNorthUpToFixedFrame(this.origin);
    this.fixedToEnu = Cesium.Matrix4.inverseTransformation(this.enuToFixed, new Cesium.Matrix4());
  }

  // [est, nord, haut] local (m) -> ECEF (compat FpsCameraController)
  localToWorld(local){
    return Cesium.Matrix4.multiplyByPoint(this.enuToFixed,
      new Cesium.Cartesian3(local[0], local[1], local[2]), new Cesium.Cartesian3());
  }

  // Synchronise la caméra Three sur la caméra Cesium (position + orientation + fov).
  syncCamera(){
    const cam = this.viewer.camera;
    Cesium.Matrix4.multiplyByPoint(this.fixedToEnu, cam.positionWC, this._pe);          // (E,N,U)
    Cesium.Matrix4.multiplyByPointAsVector(this.fixedToEnu, cam.directionWC, this._de);
    Cesium.Matrix4.multiplyByPointAsVector(this.fixedToEnu, cam.upWC, this._ue);
    // ENU(e,n,u) -> Three(x=E, y=U, z=-N)
    this.camera.position.set(this._pe.x, this._pe.z, -this._pe.y);
    this.camera.up.set(this._ue.x, this._ue.z, -this._ue.y);
    this.camera.lookAt(this._pe.x + this._de.x, this._pe.z + this._de.z, -this._pe.y - this._de.y);
    const f = cam.frustum, aspect = f.aspectRatio || (innerWidth/innerHeight);
    const vfov = (aspect >= 1) ? 2*Math.atan(Math.tan(f.fov/2)/aspect) : f.fov;
    this.camera.fov = THREE.MathUtils.radToDeg(vfov);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  fire(){ this.peony = new Peony(0, 0); }

  update(dt){
    if (!this.peony || this.peony.dead){
      this.restDelay -= dt;
      if (this.restDelay <= 0){ this.fire(); this.restDelay = 0.8; } // petit battement entre tirs
    }
    if (this.peony) this.peony.update(dt);
    updateTrails(dt);
  }

  // À appeler APRÈS le rendu Cesium (postRender) : la caméra Cesium est à jour.
  render(){
    this.syncCamera();
    this.composer.render();
  }
}
