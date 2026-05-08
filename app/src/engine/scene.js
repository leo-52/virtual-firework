// Scène : ciel dégradé (skybox quad) + sol (large plane texturé).

import { program, buffer } from "./gl-utils.js";

// ---- Skybox (gradient nuit/aube) ----------------------------------------

const SKY_VS = `#version 300 es
in vec2 aPos;
out vec2 vUV;
void main() {
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.999, 1.0);
}`;

const SKY_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform vec3 uTopColor;
uniform vec3 uHorizonColor;
uniform vec3 uGroundColor;
out vec4 fragColor;
void main() {
  float h = vUV.y;
  vec3 c;
  if (h < 0.5) {
    c = mix(uGroundColor, uHorizonColor, smoothstep(0.0, 0.5, h));
  } else {
    c = mix(uHorizonColor, uTopColor, smoothstep(0.5, 1.0, h));
  }
  // Petite étoile (bruit cheap) en haut du ciel
  if (h > 0.6) {
    vec2 g = floor(vUV * 800.0);
    float n = fract(sin(dot(g, vec2(127.1, 311.7))) * 43758.5);
    if (n > 0.998) c += vec3(0.6, 0.7, 0.9) * (n - 0.998) * 80.0;
  }
  fragColor = vec4(c, 1.0);
}`;

// ---- Ground (plane) ----

const GROUND_VS = `#version 300 es
in vec3 aPos;
in vec2 aUV;
uniform mat4 uViewProj;
out vec2 vUV;
out float vDist;
void main() {
  vDist = length(aPos.xz);
  vUV = aUV;
  gl_Position = uViewProj * vec4(aPos, 1.0);
}`;

const GROUND_FS = `#version 300 es
precision highp float;
in vec2 vUV;
in float vDist;
uniform vec3 uColor;
out vec4 fragColor;
void main() {
  // Grid lines doux
  vec2 g = abs(fract(vUV * 50.0) - 0.5);
  float line = smoothstep(0.46, 0.5, max(g.x, g.y));
  float fog = 1.0 - smoothstep(60.0, 240.0, vDist);
  vec3 base = uColor;
  base += vec3(0.04) * line;
  fragColor = vec4(base * fog, fog);
}`;

export class Scene {
  constructor(gl) {
    this.gl = gl;
    this._initSky();
    this._initGround();
    this.sky = {
      top: [0.04, 0.05, 0.12],
      horizon: [0.10, 0.06, 0.18],
      ground: [0.02, 0.02, 0.05],
    };
  }

  _initSky() {
    const gl = this.gl;
    this.skyProg = program(gl, SKY_VS, SKY_FS);
    this.skyVAO = gl.createVertexArray();
    gl.bindVertexArray(this.skyVAO);
    const verts = new Float32Array([-1, -1, 3, -1, -1, 3]);
    buffer(gl, gl.ARRAY_BUFFER, verts);
    const loc = this.skyProg.attribute("aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  _initGround() {
    const gl = this.gl;
    this.groundProg = program(gl, GROUND_VS, GROUND_FS);
    this.groundVAO = gl.createVertexArray();
    gl.bindVertexArray(this.groundVAO);

    const S = 400; // taille du plan
    const verts = new Float32Array([
      -S, 0, -S,  0, 0,
       S, 0, -S,  1, 0,
       S, 0,  S,  1, 1,
      -S, 0, -S,  0, 0,
       S, 0,  S,  1, 1,
      -S, 0,  S,  0, 1,
    ]);
    buffer(gl, gl.ARRAY_BUFFER, verts);
    const posLoc = this.groundProg.attribute("aPos");
    const uvLoc = this.groundProg.attribute("aUV");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 20, 12);
    gl.bindVertexArray(null);
  }

  drawSky(gl) {
    this.skyProg.use();
    gl.bindVertexArray(this.skyVAO);
    gl.uniform3fv(this.skyProg.uniform("uTopColor"), this.sky.top);
    gl.uniform3fv(this.skyProg.uniform("uHorizonColor"), this.sky.horizon);
    gl.uniform3fv(this.skyProg.uniform("uGroundColor"), this.sky.ground);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.bindVertexArray(null);
  }

  drawGround(gl, viewProj) {
    this.groundProg.use();
    gl.bindVertexArray(this.groundVAO);
    gl.uniformMatrix4fv(this.groundProg.uniform("uViewProj"), false, viewProj);
    gl.uniform3fv(this.groundProg.uniform("uColor"), [0.06, 0.07, 0.10]);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }
}
