// Système de particules CPU.
//
// Chaque particule : pos, vel, color, life, size, kind.
// Mise à jour CPU à chaque frame, upload dans un VBO partagé pour
// rendu GPU instancié.

const GRAVITY = -9.81;
const AIR_DRAG = 0.06;

const KINDS = {
  RISING: 0,   // mortier qui monte
  SPARK:  1,   // éclats d'explosion
  TRAIL:  2,   // traîne de comète
  SPRAY:  3,   // fontaine
  GLOW:   4,   // halo lumineux ponctuel
};

export class ParticleSystem {
  constructor(maxCount = 30000) {
    this.maxCount = maxCount;
    this.count = 0;
    // SoA pour update rapide
    this.x = new Float32Array(maxCount);
    this.y = new Float32Array(maxCount);
    this.z = new Float32Array(maxCount);
    this.vx = new Float32Array(maxCount);
    this.vy = new Float32Array(maxCount);
    this.vz = new Float32Array(maxCount);
    this.r = new Float32Array(maxCount);
    this.g = new Float32Array(maxCount);
    this.b = new Float32Array(maxCount);
    this.life = new Float32Array(maxCount);     // restant
    this.maxLife = new Float32Array(maxCount);  // initial
    this.size = new Float32Array(maxCount);
    this.kind = new Uint8Array(maxCount);
    this.target = new Float32Array(maxCount);   // pour rising : altitude cible
    this.targetEffectIdx = new Int32Array(maxCount); // index into burst pool
    this.burstColors = []; // [[r,g,b]...] indexé par targetEffectIdx
  }

  reset() {
    this.count = 0;
    this.burstColors = [];
  }

  // Buffer dense pour upload : [x,y,z, r,g,b,a, size]
  // 8 floats par particule. Le shader fait le billboard.
  serialize(buffer) {
    const need = this.count * 8;
    if (!buffer || buffer.length < need) buffer = new Float32Array(need);
    for (let i = 0; i < this.count; i++) {
      const o = i * 8;
      buffer[o + 0] = this.x[i];
      buffer[o + 1] = this.y[i];
      buffer[o + 2] = this.z[i];
      buffer[o + 3] = this.r[i];
      buffer[o + 4] = this.g[i];
      buffer[o + 5] = this.b[i];
      // Alpha basé sur ratio de vie
      buffer[o + 6] = Math.max(0, this.life[i] / Math.max(0.001, this.maxLife[i]));
      buffer[o + 7] = this.size[i];
    }
    return buffer;
  }

  step(dt) {
    let write = 0;
    for (let i = 0; i < this.count; i++) {
      let life = this.life[i] - dt;
      if (life <= 0) continue;

      const k = this.kind[i];
      let vx = this.vx[i], vy = this.vy[i], vz = this.vz[i];

      // Physique
      if (k === KINDS.RISING) {
        // Décélération gravitationnelle uniquement
        vy += GRAVITY * dt;
        if (vy < 0 && this.y[i] >= this.target[i]) {
          // Apogée atteinte → explose
          this.life[i] = 0;
          continue;
        }
      } else if (k === KINDS.SPARK || k === KINDS.TRAIL) {
        vy += GRAVITY * dt * 0.5;
        const drag = Math.exp(-AIR_DRAG * dt);
        vx *= drag; vy *= drag; vz *= drag;
      } else if (k === KINDS.SPRAY) {
        vy += GRAVITY * dt;
        const drag = Math.exp(-AIR_DRAG * dt * 1.5);
        vx *= drag; vy *= drag; vz *= drag;
        if (this.y[i] + vy * dt < 0) life = 0; // rebondit/sol → mort
      } else if (k === KINDS.GLOW) {
        // Statique
      }

      this.x[write] = this.x[i] + vx * dt;
      this.y[write] = this.y[i] + vy * dt;
      this.z[write] = this.z[i] + vz * dt;
      this.vx[write] = vx;
      this.vy[write] = vy;
      this.vz[write] = vz;
      this.r[write] = this.r[i];
      this.g[write] = this.g[i];
      this.b[write] = this.b[i];
      this.life[write] = life;
      this.maxLife[write] = this.maxLife[i];
      this.size[write] = this.size[i];
      this.kind[write] = k;
      this.target[write] = this.target[i];
      this.targetEffectIdx[write] = this.targetEffectIdx[i];
      write++;
    }
    this.count = write;

    // Trail : émet des sparks derrière les RISING vivants
    // Itère ce qu'il reste après compaction
    const before = this.count;
    for (let i = 0; i < before; i++) {
      if (this.kind[i] === KINDS.RISING && this.count < this.maxCount - 4) {
        for (let k = 0; k < 1; k++) {
          this._emit({
            x: this.x[i] + (Math.random() - 0.5) * 0.4,
            y: this.y[i] - 0.3,
            z: this.z[i] + (Math.random() - 0.5) * 0.4,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -1 - Math.random() * 1.5,
            vz: (Math.random() - 0.5) * 1.5,
            r: 1, g: 0.85, b: 0.5,
            life: 0.5 + Math.random() * 0.4,
            size: 0.4,
            kind: KINDS.TRAIL,
            target: 0,
            targetEffectIdx: -1,
          });
        }
      }
    }
  }

  // Détecte les RISING qui ont expiré pour déclencher leur explosion.
  // Appelé entre step() et le rendu.
  resolveBursts() {
    // L'event "explosion" est géré dans le spawner externe en regardant
    // les particules RISING avec life ≈ 0. Pour simplifier, on parcourt.
    const bursts = [];
    // Comme step() tue déjà les RISING expirés, ce hook est plutôt
    // déclenché depuis le spawner via un callback. Cf. spawner.js.
    return bursts;
  }

  _emit(p) {
    if (this.count >= this.maxCount) return;
    const i = this.count++;
    this.x[i] = p.x; this.y[i] = p.y; this.z[i] = p.z;
    this.vx[i] = p.vx; this.vy[i] = p.vy; this.vz[i] = p.vz;
    this.r[i] = p.r; this.g[i] = p.g; this.b[i] = p.b;
    this.life[i] = p.life; this.maxLife[i] = p.life;
    this.size[i] = p.size;
    this.kind[i] = p.kind;
    this.target[i] = p.target || 0;
    this.targetEffectIdx[i] = p.targetEffectIdx ?? -1;
  }

  emit(p) { this._emit(p); }
}

export const KIND = KINDS;
