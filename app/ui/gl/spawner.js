// Règles de spawn par partType (style VDL Finale 3D simplifié).
//
// Étant donné un effet (de notre catalogue) et un point de lancement (x, z),
// produit les particules nécessaires sur le système. Pour les bombes, une
// particule "RISING" est émise et explosera à l'apogée — l'explosion est
// gérée via un callback que le spawner attache.

import { KIND } from "./particles.js";
import { hexToRgb } from "./gl-utils.js";

// Mémoire des explosions différées : map id → {colors, height, subtype}
const pending = new Map();
let nextId = 1;

function rgbOf(eff, idx = 0) {
  return hexToRgb(eff.colors[idx % eff.colors.length] || "#ffd60a");
}

export function spawnEffect(ps, eff, launchPos = [0, 0, 0]) {
  const [lx, ly, lz] = launchPos;
  const pt = eff.partType;

  if (pt === "shell" || pt === "comet" || pt === "rocket") {
    spawnShell(ps, eff, lx, ly, lz);
  } else if (pt === "candle") {
    // Émet plusieurs shells dans le temps via un déclencheur
    // (on ne peut pas attendre dans cette fonction → on encode plusieurs
    // RISING avec différents launch delay via décalage initial de y).
    const shots = Math.max(3, Math.round(eff.duration / 1.2));
    for (let i = 0; i < shots; i++) {
      // Décalage simulé en abaissant initialement l'y et la vy ;
      // ce n'est pas parfait. Pour la prévisu, on triche et on
      // déclenche immédiatement avec léger jitter.
      spawnShell(ps, eff, lx + (Math.random() - 0.5) * 4, ly + i * 1.5, lz);
    }
  } else if (pt === "cake" || pt === "rack") {
    const shots = Math.round(eff.duration * 1.5);
    for (let i = 0; i < shots; i++) {
      const angle = (i / shots) * Math.PI * 2;
      const r = (i / shots) * 6;
      spawnShell(
        ps, eff,
        lx + Math.cos(angle) * r,
        ly + i * 0.5,
        lz + Math.sin(angle) * r
      );
    }
  } else if (pt === "fountain" || pt === "gerb") {
    spawnFountain(ps, eff, lx, ly, lz);
  } else if (pt === "mine") {
    spawnMine(ps, eff, lx, ly, lz);
  } else if (pt === "flame") {
    spawnFountain(ps, eff, lx, ly, lz);
  } else if (pt === "sfx" || pt === "light") {
    spawnGlow(ps, eff, lx, ly + 5, lz);
  } else {
    spawnMine(ps, eff, lx, ly, lz);
  }
}

function spawnShell(ps, eff, lx, ly, lz) {
  const targetY = Math.max(20, eff.height || 70);
  // Vitesse initiale calculée pour atteindre target sous gravité
  // v0 = sqrt(2 * g * h) — g est 9.81, on prend valeur effective ~9
  const v0 = Math.sqrt(2 * 9 * targetY);
  const id = nextId++;
  pending.set(id, {
    colors: eff.colors.map(hexToRgb),
    height: targetY,
    subtype: eff.subtype,
    duration: eff.duration,
  });
  ps.emit({
    x: lx, y: ly, z: lz,
    vx: (Math.random() - 0.5) * 1.5,
    vy: v0,
    vz: (Math.random() - 0.5) * 1.5,
    r: 1, g: 0.85, b: 0.5,
    life: 999, // tué par target
    size: 0.6,
    kind: KIND.RISING,
    target: targetY,
    targetEffectIdx: id,
  });
}

function spawnFountain(ps, eff, lx, ly, lz) {
  const colors = eff.colors.map(hexToRgb);
  const burstsPerSec = 60;
  const total = Math.floor(burstsPerSec * Math.max(1, eff.duration));
  const target = Math.max(2, eff.height || 8);
  // On émet en burst initial (la durée se reflète via la vie max)
  for (let i = 0; i < total; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.3;
    const speed = 8 + Math.random() * 5;
    const c = colors[Math.floor(Math.random() * colors.length)];
    const phase = i / total;
    ps.emit({
      x: lx + (Math.random() - 0.5) * 0.4,
      y: ly,
      z: lz + (Math.random() - 0.5) * 0.4,
      vx: Math.cos(angle) * (Math.random() - 0.5) * 4,
      vy: -speed * Math.sin(angle),
      vz: Math.sin(angle) * (Math.random() - 0.5) * 4,
      r: c[0], g: c[1], b: c[2],
      life: (eff.duration * (0.6 + Math.random() * 0.4)) - phase * eff.duration * 0.5,
      size: 0.3 + Math.random() * 0.3,
      kind: KIND.SPRAY,
      target,
    });
  }
}

function spawnMine(ps, eff, lx, ly, lz) {
  const colors = eff.colors.map(hexToRgb);
  const count = 80;
  const speed = Math.sqrt(2 * 9 * Math.max(15, eff.height || 30));
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.7;
    const az = Math.random() * Math.PI * 2;
    const c = colors[Math.floor(Math.random() * colors.length)];
    const sp = speed * (0.6 + Math.random() * 0.5);
    ps.emit({
      x: lx, y: ly, z: lz,
      vx: Math.cos(az) * Math.cos(angle) * sp,
      vy: -Math.sin(angle) * sp,
      vz: Math.sin(az) * Math.cos(angle) * sp,
      r: c[0], g: c[1], b: c[2],
      life: 1.2 + Math.random() * 1.5,
      size: 0.5 + Math.random() * 0.4,
      kind: KIND.SPARK,
      target: 0,
    });
  }
}

function spawnGlow(ps, eff, lx, ly, lz) {
  const c = hexToRgb(eff.colors[0]);
  ps.emit({
    x: lx, y: ly, z: lz,
    vx: 0, vy: 0, vz: 0,
    r: c[0], g: c[1], b: c[2],
    life: eff.duration,
    size: 4 + (eff.duration || 1) * 0.2,
    kind: KIND.GLOW,
  });
}

// Doit être appelé chaque frame pour traiter les RISING qui ont atteint
// leur cible et déclencher l'explosion correspondante.
// `prevCount` = nb de particules avant step ; `ps` = système.
// Plus simple : on inspecte tous les targetEffectIdx présents AVANT step,
// et après step on regarde lesquels ont disparu → ceux-là explosent.
const prevAlive = new Set();
export function resolveBursts(ps) {
  const stillAlive = new Set();
  for (let i = 0; i < ps.count; i++) {
    if (ps.kind[i] === KIND.RISING) stillAlive.add(ps.targetEffectIdx[i]);
  }
  // Ceux dans prevAlive mais plus dans stillAlive ont fini leur ascension
  for (const id of prevAlive) {
    if (!stillAlive.has(id)) {
      explode(ps, id);
      pending.delete(id);
    }
  }
  prevAlive.clear();
  for (const id of stillAlive) prevAlive.add(id);
}

function explode(ps, id) {
  const data = pending.get(id);
  if (!data) return;
  // Position : la dernière connue (RISING a disparu, on doit estimer).
  // Plutôt que tracker la position au moment de la mort, on garde la
  // hauteur cible et on suppose centré devant la caméra. On étoffe
  // ça en stockant la position dans `pending` au prochain run.
  const colors = data.colors.length ? data.colors : [[1, 1, 1]];
  const subtype = data.subtype || "peony";
  const burstHeight = data.height;
  const center = data.lastPos || [0, burstHeight, 0];

  const STYLES = {
    peony:         { count: 220, speed: 18, lifeBase: 1.4, gravity: 0.6, spread: 1.0 },
    chrysanthemum: { count: 280, speed: 20, lifeBase: 1.8, gravity: 0.55, spread: 1.0 },
    willow:        { count: 240, speed: 14, lifeBase: 2.5, gravity: 0.9, spread: 0.9 },
    palm:          { count: 200, speed: 16, lifeBase: 2.2, gravity: 0.85, spread: 0.8 },
    brocade:       { count: 260, speed: 17, lifeBase: 2.2, gravity: 0.8, spread: 1.0 },
    kamuro:        { count: 200, speed: 12, lifeBase: 3.0, gravity: 1.0, spread: 0.9 },
    crossette:     { count: 60,  speed: 22, lifeBase: 1.6, gravity: 0.5, spread: 1.0 },
    dahlia:        { count: 180, speed: 24, lifeBase: 1.5, gravity: 0.5, spread: 1.0 },
    diadem:        { count: 240, speed: 14, lifeBase: 1.7, gravity: 0.4, spread: 1.0 },
    fallingLeaves: { count: 120, speed: 8,  lifeBase: 3.0, gravity: 1.1, spread: 0.7 },
    ring:          { count: 90,  speed: 18, lifeBase: 1.4, gravity: 0.5, spread: 0.4 },
    wave:          { count: 200, speed: 16, lifeBase: 1.6, gravity: 0.6, spread: 1.0 },
    other:         { count: 200, speed: 18, lifeBase: 1.6, gravity: 0.6, spread: 1.0 },
  };
  const s = STYLES[subtype] || STYLES.other;

  for (let i = 0; i < s.count; i++) {
    let vx, vy, vz;
    if (subtype === "ring") {
      // Anneau : tous dans le plan horizontal
      const a = (i / s.count) * Math.PI * 2;
      vx = Math.cos(a) * s.speed;
      vy = (Math.random() - 0.5) * 0.5;
      vz = Math.sin(a) * s.speed;
    } else {
      // Sphère uniforme via point sur sphère
      const u = Math.random() * 2 - 1;
      const phi = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const speed = s.speed * (0.7 + Math.random() * 0.5) * s.spread;
      vx = r * Math.cos(phi) * speed;
      vy = u * speed;
      vz = r * Math.sin(phi) * speed;
    }
    const c = colors[Math.floor(Math.random() * colors.length)];
    ps.emit({
      x: center[0],
      y: center[1],
      z: center[2],
      vx, vy, vz,
      r: c[0], g: c[1], b: c[2],
      life: s.lifeBase * (0.7 + Math.random() * 0.6),
      size: 0.5 + Math.random() * 0.4,
      kind: KIND.SPARK,
      target: 0,
    });
  }
}

// Hook permettant de tracker la dernière position des RISING avant qu'ils
// ne meurent, pour positionner correctement l'explosion. Appelé après step().
export function trackRisingPositions(ps) {
  for (let i = 0; i < ps.count; i++) {
    if (ps.kind[i] === KIND.RISING) {
      const id = ps.targetEffectIdx[i];
      const data = pending.get(id);
      if (data) data.lastPos = [ps.x[i], ps.y[i], ps.z[i]];
    }
  }
}
