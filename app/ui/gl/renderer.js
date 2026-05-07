// Renderer 3D principal — orchestrateur entre scène, particules et caméra.
//
// Pipeline par frame :
//   1. step() de ParticleSystem (CPU)
//   2. resolveBursts() pour déclencher les explosions
//   3. clear + drawSky + drawGround + drawParticles
//
// Particules : un quad billboarded par particule, instancié via un buffer
// per-instance (8 floats : pos.xyz + rgba + size). Blending additif pour
// le glow.

import { OrbitCamera } from "./camera.js";
import { Scene } from "./scene.js";
import { ParticleSystem, KIND } from "./particles.js";
import { spawnEffect, resolveBursts, trackRisingPositions } from "./spawner.js";
import { program, buffer, makeSparkTexture } from "./gl-utils.js";
import { mat4Multiply, mat4Identity } from "./math.js";
import { findEffect } from "../lib/state.js";
import { BloomPipeline } from "./bloom.js";

const PART_VS = `#version 300 es
in vec3 aQuad;             // quad corner -1..1
in vec3 aPos;              // particle position (instance)
in vec4 aColor;            // rgba (instance)
in float aSize;            // size in world units (instance)
uniform mat4 uViewProj;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
out vec4 vColor;
out vec2 vUV;
void main() {
  vec3 worldPos = aPos
    + uCamRight * aQuad.x * aSize
    + uCamUp    * aQuad.y * aSize;
  gl_Position = uViewProj * vec4(worldPos, 1.0);
  vColor = aColor;
  vUV = aQuad.xy * 0.5 + 0.5;
}`;

const PART_FS = `#version 300 es
precision highp float;
in vec4 vColor;
in vec2 vUV;
uniform sampler2D uSparkTex;
out vec4 fragColor;
void main() {
  vec4 t = texture(uSparkTex, vUV);
  vec3 c = vColor.rgb;
  // Boost de luminosité au centre pour effet glow
  float intensity = t.a;
  vec3 glow = c * intensity * 2.0;
  // Coeur blanc chaud
  float core = pow(intensity, 4.0);
  glow += vec3(core) * 0.6;
  fragColor = vec4(glow * vColor.a, intensity * vColor.a);
}`;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: true,
      premultipliedAlpha: false,
    });
    if (!gl) throw new Error("WebGL2 indisponible");
    this.gl = gl;

    this.camera = new OrbitCamera(canvas);
    this.scene = new Scene(gl);
    this.particles = new ParticleSystem(40000);
    this.sparkTex = makeSparkTexture(gl, 64);
    this.bloom = new BloomPipeline(gl);

    this._initParticleProgram();

    this.viewProj = new Float32Array(16);
    this.lastFrame = performance.now();
    this.running = false;
    this._resize = this._resize.bind(this);
    window.addEventListener("resize", this._resize);
    this._resize();

    this.stats = { particles: 0, drawCalls: 0, batches: 0 };
    this.scheduledEvents = []; // { time, fn }
    this.t = 0;
    this.duration = 0;
    this.playing = false;

    this._instanceBuf = null;
    this._instanceArray = new Float32Array(0);
    this.onTick = null;
    this.onEnd = null;
  }

  _initParticleProgram() {
    const gl = this.gl;
    this.partProg = program(gl, PART_VS, PART_FS);

    // Quad (2 triangles)
    this.partVAO = gl.createVertexArray();
    gl.bindVertexArray(this.partVAO);

    const quad = new Float32Array([
      -1, -1, 0,   1, -1, 0,   1,  1, 0,
      -1, -1, 0,   1,  1, 0,  -1,  1, 0,
    ]);
    buffer(gl, gl.ARRAY_BUFFER, quad);
    const quadLoc = this.partProg.attribute("aQuad");
    gl.enableVertexAttribArray(quadLoc);
    gl.vertexAttribPointer(quadLoc, 3, gl.FLOAT, false, 0, 0);

    // Buffer instance (sera rempli par tick)
    this._instanceBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._instanceBuf);

    const stride = 8 * 4; // 8 floats
    const posLoc = this.partProg.attribute("aPos");
    const colLoc = this.partProg.attribute("aColor");
    const sizeLoc = this.partProg.attribute("aSize");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(posLoc, 1);
    gl.enableVertexAttribArray(colLoc);
    gl.vertexAttribPointer(colLoc, 4, gl.FLOAT, false, stride, 12);
    gl.vertexAttribDivisor(colLoc, 1);
    gl.enableVertexAttribArray(sizeLoc);
    gl.vertexAttribPointer(sizeLoc, 1, gl.FLOAT, false, stride, 28);
    gl.vertexAttribDivisor(sizeLoc, 1);

    gl.bindVertexArray(null);
  }

  _resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, r.width * dpr);
    this.canvas.height = Math.max(1, r.height * dpr);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    if (this.bloom) this.bloom.resize(this.canvas.width, this.canvas.height);
    this.camera.update();
  }

  destroy() {
    this.running = false;
    window.removeEventListener("resize", this._resize);
  }

  // ---- Lecture spectacle ----

  load(show) {
    this.show = show;
    this.duration = show.duration;
    this.scheduledEvents = [...show.cues]
      .sort((a, b) => a.time - b.time)
      .map((c) => ({ time: c.time, cue: c, fired: false }));
    this.reset();
  }

  reset() {
    this.t = 0;
    this.particles.reset();
    for (const e of this.scheduledEvents) e.fired = false;
    this.playing = false;
    this._render();
    if (this.onTick) this.onTick(this.t, this.duration);
  }

  play() {
    if (!this.show) return;
    if (this.t >= this.duration) this.reset();
    this.playing = true;
    this.lastFrame = performance.now();
    if (!this.running) {
      this.running = true;
      this._loop();
    }
  }

  pause() { this.playing = false; }

  seek(time) {
    this.reset();
    this.t = Math.max(0, Math.min(this.duration, time));
    for (const e of this.scheduledEvents) e.fired = e.time < this.t;
  }

  // Position de tir : étalée sur une ligne devant la caméra (modélise une
  // rampe de mortiers de 60m de long).
  _launchPosFor(cue, idx, total) {
    const span = 60;
    const x = -span / 2 + ((idx + 0.5) / Math.max(1, total)) * span;
    return [x, 0, 0];
  }

  // ---- Loop ----

  _loop() {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    if (this.playing) {
      this.t += dt;

      // Déclencher les cues dont c'est l'heure
      for (let idx = 0; idx < this.scheduledEvents.length; idx++) {
        const e = this.scheduledEvents[idx];
        if (e.fired) continue;
        if (e.time <= this.t) {
          const eff = findEffect(e.cue.effectId);
          if (eff) {
            for (let i = 0; i < e.cue.quantity; i++) {
              const pos = this._launchPosFor(e.cue, i, e.cue.quantity);
              spawnEffect(this.particles, eff, pos);
            }
          }
          e.fired = true;
        }
      }

      // Physique
      trackRisingPositions(this.particles);
      this.particles.step(dt);
      resolveBursts(this.particles);

      if (this.t >= this.duration && !this.particles.count) {
        this.playing = false;
        if (this.onEnd) this.onEnd();
      }
    }

    if (this.onTick) this.onTick(this.t, this.duration);
    this._render();
    requestAnimationFrame(() => this._loop());
  }

  _render() {
    const gl = this.gl;
    const cam = this.camera;
    cam.update();

    // viewProj = proj * view
    mat4Multiply(this.viewProj, cam.projMat, cam.viewMat);

    const usedBloom = this.bloom.beginSceneCapture();
    if (!usedBloom) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    gl.clearColor(0.02, 0.02, 0.04, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Sky
    this.scene.drawSky(gl);

    // Ground
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
    this.scene.drawGround(gl, this.viewProj);

    // Particules
    this._drawParticles();

    if (usedBloom) this.bloom.finishToScreen();

    this.stats.particles = this.particles.count;
    this.stats.drawCalls = usedBloom ? 9 : 3;
    this.stats.batches = usedBloom ? 5 : 1;
  }

  setBloomEnabled(on) { this.bloom.enabled = !!on; }
  setBloomIntensity(v) { this.bloom.intensity = Math.max(0, Math.min(3, v)); }
  setBloomThreshold(v) { this.bloom.threshold = Math.max(0, Math.min(1.5, v)); }

  _drawParticles() {
    const gl = this.gl;
    const ps = this.particles;
    if (!ps.count) return;

    const need = ps.count * 8;
    if (this._instanceArray.length < need) {
      this._instanceArray = new Float32Array(need);
    }
    ps.serialize(this._instanceArray);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._instanceBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this._instanceArray.subarray(0, need),
                  gl.DYNAMIC_DRAW);

    this.partProg.use();
    gl.bindVertexArray(this.partVAO);

    gl.uniformMatrix4fv(this.partProg.uniform("uViewProj"), false, this.viewProj);

    // Right / up de la caméra (pour billboard)
    const camPos = this.camera.position();
    const v = this.camera.viewMat;
    // Right est la première colonne (transposée) de la mat de vue
    const right = [v[0], v[4], v[8]];
    const up = [v[1], v[5], v[9]];
    gl.uniform3fv(this.partProg.uniform("uCamRight"), right);
    gl.uniform3fv(this.partProg.uniform("uCamUp"), up);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sparkTex);
    gl.uniform1i(this.partProg.uniform("uSparkTex"), 0);

    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, ps.count);

    gl.depthMask(true);
    gl.bindVertexArray(null);
  }
}
