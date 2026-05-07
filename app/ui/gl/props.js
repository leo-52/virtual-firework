// Props de scène : mortiers (cylindres au sol) + marqueur de lieu géo
// (cercle plat) + smoke résiduelle (particules persistantes après burst).
//
// Implémentation simple : un seul programme "mesh-color", géométries
// statiques uploadées une fois, instancié pour les mortiers.

import { program, buffer } from "./gl-utils.js";

const VS = `#version 300 es
in vec3 aPos;
in vec3 aNormal;
in vec3 aInstancePos;
in vec3 aInstanceColor;
uniform mat4 uViewProj;
out vec3 vNormal;
out vec3 vColor;
void main() {
  vec3 world = aPos + aInstancePos;
  vNormal = aNormal;
  vColor = aInstanceColor;
  gl_Position = uViewProj * vec4(world, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vColor;
uniform vec3 uSunDir;
out vec4 fragColor;
void main() {
  float NdotL = max(0.2, dot(normalize(vNormal), normalize(uSunDir)));
  vec3 c = vColor * (0.4 + 0.6 * NdotL);
  fragColor = vec4(c, 1.0);
}`;

// Cylindre vertical : rayon 0.4, hauteur 1.2, 12 segments
function cylinder(radius = 0.4, height = 1.2, segs = 12) {
  const pos = [];
  const norm = [];
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    const x0 = Math.cos(a0) * radius, z0 = Math.sin(a0) * radius;
    const x1 = Math.cos(a1) * radius, z1 = Math.sin(a1) * radius;
    // Quad latéral (deux triangles)
    pos.push(x0, 0, z0,  x1, 0, z1,  x1, height, z1);
    pos.push(x0, 0, z0,  x1, height, z1,  x0, height, z0);
    const nx0 = Math.cos((a0 + a1) / 2);
    const nz0 = Math.sin((a0 + a1) / 2);
    for (let k = 0; k < 6; k++) norm.push(nx0, 0, nz0);
    // Capuchon haut
    pos.push(0, height, 0,  x0, height, z0,  x1, height, z1);
    norm.push(0, 1, 0,  0, 1, 0,  0, 1, 0);
  }
  return { pos: new Float32Array(pos), norm: new Float32Array(norm), count: pos.length / 3 };
}

// Cercle plat (disque au sol)
function disc(radius = 5, segs = 32) {
  const pos = [];
  const norm = [];
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    pos.push(0, 0, 0,
             Math.cos(a0) * radius, 0, Math.sin(a0) * radius,
             Math.cos(a1) * radius, 0, Math.sin(a1) * radius);
    norm.push(0, 1, 0,  0, 1, 0,  0, 1, 0);
  }
  return { pos: new Float32Array(pos), norm: new Float32Array(norm), count: pos.length / 3 };
}

export class Props {
  constructor(gl) {
    this.gl = gl;
    this.prog = program(gl, VS, FS);
    this._initCylinder();
    this._initDisc();
    this.mortarPositions = [];   // [[x, y, z], ...]
    this.mortarColors = [];      // [[r,g,b], ...]
    this.geoMarker = null;       // { pos: [x,y,z], radius, color }
  }

  _initCylinder() {
    const gl = this.gl;
    const m = cylinder(0.45, 1.4, 14);
    this.cyl = m;
    this.cylVAO = gl.createVertexArray();
    gl.bindVertexArray(this.cylVAO);

    // Pos + normal interleaved (2 buffers séparés en fait)
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, m.pos, gl.STATIC_DRAW);
    const posLoc = this.prog.attribute("aPos");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

    const nBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nBuf);
    gl.bufferData(gl.ARRAY_BUFFER, m.norm, gl.STATIC_DRAW);
    const nLoc = this.prog.attribute("aNormal");
    gl.enableVertexAttribArray(nLoc);
    gl.vertexAttribPointer(nLoc, 3, gl.FLOAT, false, 0, 0);

    // Buffer instances (rempli plus tard)
    this.cylInstBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cylInstBuf);
    const stride = 6 * 4;
    const ipLoc = this.prog.attribute("aInstancePos");
    gl.enableVertexAttribArray(ipLoc);
    gl.vertexAttribPointer(ipLoc, 3, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(ipLoc, 1);
    const icLoc = this.prog.attribute("aInstanceColor");
    gl.enableVertexAttribArray(icLoc);
    gl.vertexAttribPointer(icLoc, 3, gl.FLOAT, false, stride, 12);
    gl.vertexAttribDivisor(icLoc, 1);

    gl.bindVertexArray(null);
  }

  _initDisc() {
    const gl = this.gl;
    const m = disc(8, 48);
    this.disc = m;
    this.discVAO = gl.createVertexArray();
    gl.bindVertexArray(this.discVAO);
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, m.pos, gl.STATIC_DRAW);
    const posLoc = this.prog.attribute("aPos");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);
    const nBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nBuf);
    gl.bufferData(gl.ARRAY_BUFFER, m.norm, gl.STATIC_DRAW);
    const nLoc = this.prog.attribute("aNormal");
    gl.enableVertexAttribArray(nLoc);
    gl.vertexAttribPointer(nLoc, 3, gl.FLOAT, false, 0, 0);

    // Disc instance buffer (single instance, mais on garde le format)
    this.discInstBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.discInstBuf);
    const stride = 6 * 4;
    const ipLoc = this.prog.attribute("aInstancePos");
    gl.enableVertexAttribArray(ipLoc);
    gl.vertexAttribPointer(ipLoc, 3, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(ipLoc, 1);
    const icLoc = this.prog.attribute("aInstanceColor");
    gl.enableVertexAttribArray(icLoc);
    gl.vertexAttribPointer(icLoc, 3, gl.FLOAT, false, stride, 12);
    gl.vertexAttribDivisor(icLoc, 1);

    gl.bindVertexArray(null);
  }

  // Configure des mortiers : positions sur une ligne devant l'origine.
  setMortars(positions, color = [0.18, 0.18, 0.22]) {
    this.mortarPositions = positions;
    this.mortarColors = positions.map(() => color);
  }

  setGeoMarker(opts) { this.geoMarker = opts; }

  draw(gl, viewProj, sunDir = [0.5, 1, 0.3]) {
    this.prog.use();
    gl.uniformMatrix4fv(this.prog.uniform("uViewProj"), false, viewProj);
    gl.uniform3fv(this.prog.uniform("uSunDir"), sunDir);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    // Mortiers
    if (this.mortarPositions.length) {
      gl.bindVertexArray(this.cylVAO);
      const flat = new Float32Array(this.mortarPositions.length * 6);
      for (let i = 0; i < this.mortarPositions.length; i++) {
        const p = this.mortarPositions[i];
        const c = this.mortarColors[i];
        flat[i * 6] = p[0];
        flat[i * 6 + 1] = p[1];
        flat[i * 6 + 2] = p[2];
        flat[i * 6 + 3] = c[0];
        flat[i * 6 + 4] = c[1];
        flat[i * 6 + 5] = c[2];
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, this.cylInstBuf);
      gl.bufferData(gl.ARRAY_BUFFER, flat, gl.DYNAMIC_DRAW);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, this.cyl.count, this.mortarPositions.length);
      gl.bindVertexArray(null);
    }

    // Géo marker
    if (this.geoMarker) {
      gl.bindVertexArray(this.discVAO);
      const flat = new Float32Array([
        this.geoMarker.pos[0], 0.05, this.geoMarker.pos[2],
        this.geoMarker.color[0], this.geoMarker.color[1], this.geoMarker.color[2],
      ]);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.discInstBuf);
      gl.bufferData(gl.ARRAY_BUFFER, flat, gl.DYNAMIC_DRAW);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, this.disc.count, 1);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
    }
  }
}
