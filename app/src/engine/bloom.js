// Bloom post-process minimaliste.
//
// Pipeline :
//   1. Render principal vers une FBO (sceneTex, RGBA8 demi-résolution
//      pour rapidité).
//   2. Brightpass : copie scene → bright (seuils R+G+B > threshold)
//   3. Blur séparable horizontal puis vertical (3 itérations)
//   4. Composite : scene + blurred * intensity → écran
//
// Implémentation simple (pas de mipmaps multi-résolution). Suffisant
// pour un effet glow visible. Désactivable.

import { program, buffer } from "./gl-utils.js";

const FS_VS = `#version 300 es
in vec2 aPos;
out vec2 vUV;
void main() {
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const BRIGHT_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uScene;
uniform float uThreshold;
out vec4 fragColor;
void main() {
  vec3 c = texture(uScene, vUV).rgb;
  float l = max(c.r, max(c.g, c.b));
  float k = smoothstep(uThreshold, uThreshold + 0.4, l);
  fragColor = vec4(c * k, 1.0);
}`;

const BLUR_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec2 uDir;       // (1/w, 0) ou (0, 1/h)
out vec4 fragColor;
void main() {
  vec3 c = vec3(0.0);
  c += texture(uTex, vUV - uDir * 4.0).rgb * 0.05;
  c += texture(uTex, vUV - uDir * 3.0).rgb * 0.09;
  c += texture(uTex, vUV - uDir * 2.0).rgb * 0.12;
  c += texture(uTex, vUV - uDir * 1.0).rgb * 0.15;
  c += texture(uTex, vUV).rgb               * 0.18;
  c += texture(uTex, vUV + uDir * 1.0).rgb * 0.15;
  c += texture(uTex, vUV + uDir * 2.0).rgb * 0.12;
  c += texture(uTex, vUV + uDir * 3.0).rgb * 0.09;
  c += texture(uTex, vUV + uDir * 4.0).rgb * 0.05;
  fragColor = vec4(c, 1.0);
}`;

const COMPOSITE_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uIntensity;
out vec4 fragColor;
void main() {
  vec3 a = texture(uScene, vUV).rgb;
  vec3 b = texture(uBloom, vUV).rgb;
  vec3 c = a + b * uIntensity;
  // Tonemap simple Reinhard
  c = c / (c + vec3(1.0));
  fragColor = vec4(c, 1.0);
}`;

function makeFBO(gl, w, h) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { fbo, tex, w, h };
}

function makeDepthBuf(gl, w, h) {
  const rb = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
  return rb;
}

export class BloomPipeline {
  constructor(gl) {
    this.gl = gl;
    this.enabled = true;
    this.intensity = 0.9;
    this.threshold = 0.5;
    this.scaleDown = 2; // demi-résolution

    this._initFullscreenQuad();
    this.brightProg = program(gl, FS_VS, BRIGHT_FS);
    this.blurProg = program(gl, FS_VS, BLUR_FS);
    this.compProg = program(gl, FS_VS, COMPOSITE_FS);

    this.scene = null;
    this.bright = null;
    this.blurA = null;
    this.blurB = null;
    this.depth = null;
    this.w = 0; this.h = 0;
  }

  _initFullscreenQuad() {
    const gl = this.gl;
    this.fsVAO = gl.createVertexArray();
    gl.bindVertexArray(this.fsVAO);
    const verts = new Float32Array([-1, -1, 3, -1, -1, 3]);
    buffer(gl, gl.ARRAY_BUFFER, verts);
    const loc = this.brightProg.attribute("aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  resize(w, h) {
    // Guard contre canvas pas encore mesuré (width/height = 0)
    if (w < 2 || h < 2) return;
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    const gl = this.gl;
    const halfW = Math.max(1, Math.floor(w / this.scaleDown));
    const halfH = Math.max(1, Math.floor(h / this.scaleDown));
    this._dispose();
    this.scene = makeFBO(gl, w, h);
    this.depth = makeDepthBuf(gl, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fbo);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depth);
    this.bright = makeFBO(gl, halfW, halfH);
    this.blurA = makeFBO(gl, halfW, halfH);
    this.blurB = makeFBO(gl, halfW, halfH);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  _dispose() {
    const gl = this.gl;
    for (const f of [this.scene, this.bright, this.blurA, this.blurB]) {
      if (!f) continue;
      gl.deleteTexture(f.tex);
      gl.deleteFramebuffer(f.fbo);
    }
    if (this.depth) gl.deleteRenderbuffer(this.depth);
    this.scene = this.bright = this.blurA = this.blurB = this.depth = null;
  }

  // Active la FBO scène avant que le renderer ne dessine.
  beginSceneCapture() {
    if (!this.enabled || !this.scene) return false;
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fbo);
    gl.viewport(0, 0, this.scene.w, this.scene.h);
    return true;
  }

  // Compose le bloom et dessine vers le canvas (FBO null).
  finishToScreen() {
    if (!this.enabled || !this.scene) return;
    const gl = this.gl;

    // Bright pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bright.fbo);
    gl.viewport(0, 0, this.bright.w, this.bright.h);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    this.brightProg.use();
    gl.bindVertexArray(this.fsVAO);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.scene.tex);
    gl.uniform1i(this.brightProg.uniform("uScene"), 0);
    gl.uniform1f(this.brightProg.uniform("uThreshold"), this.threshold);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Blur 3 passes
    let src = this.bright;
    for (let i = 0; i < 3; i++) {
      // Horizontal
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurA.fbo);
      gl.viewport(0, 0, this.blurA.w, this.blurA.h);
      this.blurProg.use();
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(this.blurProg.uniform("uTex"), 0);
      gl.uniform2f(this.blurProg.uniform("uDir"), 1 / src.w, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // Vertical
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurB.fbo);
      gl.viewport(0, 0, this.blurB.w, this.blurB.h);
      gl.bindTexture(gl.TEXTURE_2D, this.blurA.tex);
      gl.uniform1i(this.blurProg.uniform("uTex"), 0);
      gl.uniform2f(this.blurProg.uniform("uDir"), 0, 1 / this.blurA.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      src = this.blurB;
    }

    // Composite vers écran
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    this.compProg.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.scene.tex);
    gl.uniform1i(this.compProg.uniform("uScene"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, src.tex);
    gl.uniform1i(this.compProg.uniform("uBloom"), 1);
    gl.uniform1f(this.compProg.uniform("uIntensity"), this.intensity);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindVertexArray(null);
  }
}
