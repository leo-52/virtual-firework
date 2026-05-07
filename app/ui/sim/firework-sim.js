// Simulateur 2D Canvas de feux d'artifice. Indépendant du moteur GPU
// existant. Il joue une séquence de cues (effectId + time + quantity).
// L'objectif : prévisu rapide pour valider le timing, pas le réalisme.

import { getEffect, CATEGORIES } from "../data/effects.js";

const GRAVITY = 0.04;
const AIR = 0.985;

export class FireworkSim {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.particles = [];
    this.cuesPending = [];
    this.cuesAll = [];
    this.t = 0; // secondes
    this.duration = 0;
    this.playing = false;
    this.lastFrame = 0;
    this.onTick = null;
    this.onEnd = null;
    this._raf = null;

    this._resize = this._resize.bind(this);
    window.addEventListener("resize", this._resize);
    this._resize();
  }

  destroy() {
    window.removeEventListener("resize", this._resize);
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = rect.width;
    this.H = rect.height;
    this._drawBackground();
  }

  load(show) {
    this.show = show;
    this.duration = show.duration;
    this.cuesAll = [...show.cues].sort((a, b) => a.time - b.time);
    this.reset();
  }

  reset() {
    this.t = 0;
    this.particles = [];
    this.cuesPending = [...this.cuesAll];
    this.playing = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this._drawBackground();
    if (this.onTick) this.onTick(this.t, this.duration);
  }

  play() {
    if (this.playing) return;
    if (this.t >= this.duration) this.reset();
    this.playing = true;
    this.lastFrame = performance.now();
    this._loop();
  }

  pause() {
    this.playing = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  seek(time) {
    // Simplification : on remet à zéro et on avance virtuellement à `time`.
    // Les particules entre l'origine et `time` ne sont pas reconstituées
    // (elles ne pèsent que ~quelques secondes, donc négligeable).
    this.reset();
    this.t = Math.max(0, Math.min(this.duration, time));
    this.cuesPending = this.cuesAll.filter((c) => c.time >= this.t);
    if (this.onTick) this.onTick(this.t, this.duration);
    this._render();
  }

  _loop() {
    if (!this.playing) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    this.t += dt;

    // Déclenche les cues dont l'heure est venue
    while (this.cuesPending.length && this.cuesPending[0].time <= this.t) {
      const cue = this.cuesPending.shift();
      this._fireCue(cue);
    }

    // Avance la physique
    for (const p of this.particles) {
      if (p.kind === "rising") {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.02; // léger ralentissement
        p.life -= dt;
        if (p.life <= 0) {
          // Explosion à la place
          this._explode(p);
          p.dead = true;
        }
      } else {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= AIR;
        p.vy = p.vy * AIR + GRAVITY;
        p.life -= dt;
        if (p.life <= 0) p.dead = true;
      }
    }
    this.particles = this.particles.filter((p) => !p.dead);

    if (this.onTick) this.onTick(this.t, this.duration);

    this._render();

    if (this.t >= this.duration && !this.particles.length) {
      this.playing = false;
      if (this.onEnd) this.onEnd();
      return;
    }

    this._raf = requestAnimationFrame(() => this._loop());
  }

  _fireCue(cue) {
    const eff = getEffect(cue.effectId);
    if (!eff) return;
    for (let i = 0; i < cue.quantity; i++) {
      const launchX = this._launchX(cue.quantity, i);
      this._spawnByCategory(eff, launchX);
    }
  }

  _launchX(qty, idx) {
    if (qty === 1) return this.W / 2 + (Math.random() - 0.5) * this.W * 0.3;
    const span = this.W * 0.7;
    return this.W / 2 - span / 2 + (idx / Math.max(1, qty - 1)) * span;
  }

  _spawnByCategory(eff, x) {
    const cat = eff.category;
    const targetY = this._heightToY(eff.height);
    if (cat === "bombe" || cat === "comete") {
      this._spawnRising(eff, x, targetY);
    } else if (cat === "chandelle") {
      // Chandelle : plusieurs tirs étalés dans le temps -> on simule
      // en empilant plusieurs montées sur 2-3 secondes.
      const shots = Math.max(3, Math.round(eff.duration / 1.2));
      for (let i = 0; i < shots; i++) {
        setTimeout(() => {
          if (!this.playing) return;
          this._spawnRising(eff, x + (Math.random() - 0.5) * 30, targetY);
        }, i * 250);
      }
    } else if (cat === "fontaine" || cat === "gerbe") {
      this._spawnFountain(eff, x);
    } else if (cat === "mine") {
      this._spawnMine(eff, x);
    } else if (cat === "finale") {
      // Pluie d'effets : plusieurs explosions étalées
      const shots = Math.round(eff.duration * 1.5);
      for (let i = 0; i < shots; i++) {
        setTimeout(() => {
          if (!this.playing) return;
          this._spawnRising(
            eff,
            this._launchX(1, 0),
            targetY + (Math.random() - 0.5) * 80
          );
        }, i * (eff.duration * 1000) / shots);
      }
    }
  }

  _heightToY(meters) {
    // Mapping simple : 0 = sol (bas), 200 m → 5% du haut.
    const ground = this.H - 20;
    const top = this.H * 0.05;
    const ratio = Math.min(1, meters / 200);
    return ground - (ground - top) * ratio;
  }

  _spawnRising(eff, x, targetY) {
    const startY = this.H - 20;
    const dy = targetY - startY;
    const flightTime = 0.9 + Math.random() * 0.3;
    this.particles.push({
      kind: "rising",
      x,
      y: startY,
      vx: (Math.random() - 0.5) * 0.5,
      vy: dy / (flightTime * 60),
      life: flightTime,
      size: 2,
      color: eff.colors[0],
      effectColors: eff.colors,
      effectCategory: eff.category,
      effectName: eff.name,
    });
  }

  _explode(rising) {
    const colors = rising.effectColors;
    const count = 60 + Math.floor(Math.random() * 30);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.1;
      const speed = 1.5 + Math.random() * 2.0;
      this.particles.push({
        kind: "spark",
        x: rising.x,
        y: rising.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.2 + Math.random() * 0.8,
        maxLife: 1.8,
        size: 1.5 + Math.random() * 1.5,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  _spawnFountain(eff, x) {
    const startY = this.H - 25;
    const burstsPerSec = 80;
    const total = Math.floor(burstsPerSec * eff.duration);
    let i = 0;
    const tick = () => {
      if (!this.playing || i >= total) return;
      for (let k = 0; k < 4; k++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;
        const speed = 2 + Math.random() * 2.5;
        this.particles.push({
          kind: "spark",
          x: x + (Math.random() - 0.5) * 8,
          y: startY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.6 + Math.random() * 0.5,
          maxLife: 1.0,
          size: 1.2 + Math.random() * 0.8,
          color: eff.colors[Math.floor(Math.random() * eff.colors.length)],
        });
      }
      i += 4;
      setTimeout(tick, 1000 / burstsPerSec * 4);
    };
    tick();
  }

  _spawnMine(eff, x) {
    const startY = this.H - 25;
    const count = 40;
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
      const speed = 4 + Math.random() * 3;
      this.particles.push({
        kind: "spark",
        x: x + (Math.random() - 0.5) * 4,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.3 + Math.random() * 0.5,
        maxLife: 1.8,
        size: 1.5 + Math.random() * 1.0,
        color: eff.colors[Math.floor(Math.random() * eff.colors.length)],
      });
    }
  }

  _drawBackground() {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, this.H);
    grad.addColorStop(0, "#040611");
    grad.addColorStop(1, "#0c0f1c");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.W, this.H);

    // Étoiles fixes
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    for (let i = 0; i < 80; i++) {
      const x = ((i * 73) % this.W);
      const y = ((i * 137) % (this.H * 0.7));
      ctx.fillRect(x, y, 1, 1);
    }

    // Sol
    ctx.fillStyle = "#070912";
    ctx.fillRect(0, this.H - 18, this.W, 18);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(0, this.H - 18, this.W, 1);
  }

  _render() {
    const ctx = this.ctx;
    // Trail effect
    ctx.fillStyle = "rgba(4, 6, 17, 0.25)";
    ctx.fillRect(0, 0, this.W, this.H);

    // Sol (re-stamp pour qu'il ne soit pas effacé par le trail)
    ctx.fillStyle = "#070912";
    ctx.fillRect(0, this.H - 18, this.W, 18);

    for (const p of this.particles) {
      const lifeRatio = p.kind === "rising" ? 1 : p.life / (p.maxLife || p.life);
      const alpha = Math.max(0, Math.min(1, lifeRatio));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      // Lueur
      ctx.globalAlpha = alpha * 0.3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
