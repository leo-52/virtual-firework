// Simulation d'un feu d'artifice — PORTÉE depuis FireworkActor.cpp (Unreal C++).
// Unités : MÈTRES, repère LOCAL (x=est, y=nord, z=haut). La conversion vers le
// globe (ECEF Cesium) est faite dans la couche rendu (render/fireworksLayer.js).
//
// v1 : archétype "pivoine" (peony). Les autres archétypes se branchent dans burst().

const G = 9.8; // m/s²

// --- petits helpers vectoriels (tableaux [x,y,z]) ---
const rnd  = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const sub  = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const mid  = (a, b) => [(a[0]+b[0])*0.5, (a[1]+b[1])*0.5, (a[2]+b[2])*0.5];
const len  = (a) => Math.hypot(a[0], a[1], a[2]);
function norm(a){ const l = len(a) || 1; return [a[0]/l, a[1]/l, a[2]/l]; }
function vrand(){ // vecteur unitaire aléatoire uniforme sur la sphère
  const z = Math.random()*2 - 1;
  const t = Math.random()*Math.PI*2;
  const r = Math.sqrt(Math.max(0, 1 - z*z));
  return [Math.cos(t)*r, Math.sin(t)*r, z];
}

// Brillance selon l'âge normalisé (décroissance douce — approx de la courbe FWsim).
const brightnessFromAge = (A) => Math.max(0, 1 - A*A*0.85);

export class Firework {
  // params attendus :
  //  colors:[[r,g,b],...] (0..1), starCount, burstRadius(m), burstHeight(m),
  //  riseTime(s), minLife(s), maxLife(s), starSize(m), archetype:'peony'
  constructor(params){
    this.p = { archetype:'peony', ...params };
    this.t = 0;
    this.phase = 'rise';
    this.done = false;
    this.particles = [];
    this.apex = params.burstHeight;
    // tête de montée (la "boule" qui sort du tube et monte)
    this.head = {
      pos:[0,0,0], vel:[0,0,0], age:0, life:params.riseTime, kind:'head',
      color:[1,0.72,0.35], baseSize:0.45, size:0.45, bright:0.6,
      lastTrail:[0,0,0], trailTimer:0
    };
  }

  update(dt){
    this.t += dt;

    // --- phase MONTÉE ---
    if (this.phase === 'rise'){
      const T  = Math.min(1, this.t / this.p.riseTime);
      const te = 1 - (1-T)*(1-T);            // easeOut : ralentit en montant
      this.head.pos = [0, 0, this.apex * te];
      // traînée de montée (grains à durées variées)
      this.head.trailTimer -= dt;
      if (this.head.trailTimer <= 0){
        const d = sub(this.head.pos, this.head.lastTrail);
        if (len(d) > 0.5){
          this._spawnTrail(mid(this.head.lastTrail, this.head.pos), [1,0.72,0.35], 0.07);
          this.head.lastTrail = this.head.pos.slice();
        }
        this.head.trailTimer = 0.02;
      }
      if (T >= 1){ this._burst(); this.phase = 'burst'; }
    }

    // --- mise à jour des particules ---
    const alive = [];
    for (const s of this.particles){
      s.age += dt;
      if (s.age >= s.life) continue;
      const A = s.age / s.life;

      // gravité + frein (drag linéaire), cf FireworkActor::Tick
      const gF   = (s.kind === 'trail') ? 0.4 : 1.0;
      const drag = 0.42 * (s.kind === 'star' ? 1.8 : 1.0);
      s.vel[2] -= G * gF * dt;
      const k = Math.max(0, 1 - drag*dt);
      s.vel[0] *= k; s.vel[1] *= k; s.vel[2] *= k;
      s.pos[0] += s.vel[0]*dt; s.pos[1] += s.vel[1]*dt; s.pos[2] += s.vel[2]*dt;

      if (s.kind === 'trail'){
        s.bright = (1 - A) * 0.85;            // sillage qui s'éteint
        s.size   = s.baseSize * (1 - A);
      } else {
        // étoile : brillance fade × nuance propre × fondu d'entrée
        s.bright = brightnessFromAge(A) * s.dimVar * lerp(0.4, 1, Math.min(1, s.age/0.25));
        s.size   = s.baseSize * lerp(1, 0.62, A);
        // émission de traînée : micro-grains à durées TRÈS variées (s'éteignent un par un)
        if (s.trailing && A < 0.55){
          s.trailTimer -= dt;
          if (s.trailTimer <= 0){
            const d = sub(s.pos, s.lastTrail);
            if (len(d) > 0.16){
              this._spawnTrail(mid(s.lastTrail, s.pos), s.color, 0.045);
              s.lastTrail = s.pos.slice();
            }
            s.trailTimer = 0.022;
          }
        }
      }
      alive.push(s);
    }
    this.particles = alive;

    if (this.phase === 'burst' && this.particles.length === 0) this.done = true;
  }

  // grain de traînée : durée en loi de puissance -> extinction "grain par grain"
  _spawnTrail(pos, color, size){
    this.particles.push({
      pos: pos.slice(),
      vel: [rnd(-0.4,0.4), rnd(-0.4,0.4), rnd(-0.25,0.0)],
      age: 0,
      life: 0.26 * (0.35 + 1.45 * Math.pow(Math.random(), 1.6)),
      baseSize: size * rnd(0.7, 1.3),
      size, bright: 0.85, kind: 'trail', color: color.slice()
    });
  }

  // PIVOINE : coquille sphérique d'étoiles (Fibonacci) — vitesse quasi uniforme.
  _burst(){
    const p = this.p;
    const n = Math.max(8, p.starCount|0);
    const speed = p.burstRadius * 1.8;       // break rapide -> freinage marqué
    const apex = [0, 0, this.apex];
    for (let i = 0; i < n; i++){
      const yy = 1 - 2*(i + 0.5)/n;          // -1..1
      const rr = Math.sqrt(Math.max(0, 1 - yy*yy));
      const ph = 2.39996323 * i;             // angle d'or
      const j  = vrand();
      const dir = norm([Math.cos(ph)*rr + j[0]*0.05, yy + j[1]*0.05, Math.sin(ph)*rr + j[2]*0.05]);
      const sp = speed * rnd(0.95, 1.05);
      const color = p.colors[i % p.colors.length];
      this.particles.push({
        pos: apex.slice(),
        vel: [dir[0]*sp, dir[1]*sp, dir[2]*sp],
        age: 0,
        life: rnd(p.minLife, p.maxLife),
        baseSize: p.starSize * rnd(0.88, 1.12),
        size: p.starSize, bright: 1,
        kind: 'star', color: color.slice(),
        dimVar: rnd(0.80, 1.10),             // nuance : la nuée n'est pas uniforme
        trailing: true, trailTimer: 0, lastTrail: apex.slice()
      });
    }
  }
}
