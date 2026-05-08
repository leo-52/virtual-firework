// Helpers WebGL2 minimalistes : compilation de shaders, programmes,
// buffers, textures de bruit. Aucune dépendance externe.

export function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error("Shader compile error:\n" + log + "\nSource:\n" + numberLines(src));
  }
  return sh;
}

export function program(gl, vs, fs) {
  const v = compile(gl, gl.VERTEX_SHADER, vs);
  const f = compile(gl, gl.FRAGMENT_SHADER, fs);
  const p = gl.createProgram();
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p);
    gl.deleteProgram(p);
    throw new Error("Program link error:\n" + log);
  }
  return {
    program: p,
    use: () => gl.useProgram(p),
    uniform: (name) => {
      const loc = gl.getUniformLocation(p, name);
      return loc;
    },
    attribute: (name) => gl.getAttribLocation(p, name),
  };
}

export function buffer(gl, target, data, usage = WebGL2RenderingContext.STATIC_DRAW) {
  const b = gl.createBuffer();
  gl.bindBuffer(target, b);
  gl.bufferData(target, data, usage);
  return b;
}

// Texture circulaire douce pour billboards de particules (gradient gaussien
// blanc → transparent). Générée procéduralement, donc pas de chargement.
export function makeSparkTexture(gl, size = 64) {
  const arr = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - c) / c;
      const dy = (y - c) / c;
      const d = Math.sqrt(dx * dx + dy * dy);
      // Profil : centre intense, halo doux
      const core = Math.exp(-d * d * 12);
      const halo = Math.exp(-d * d * 3) * 0.4;
      const a = Math.min(1, core + halo);
      const i = (y * size + x) * 4;
      arr[i + 0] = 255;
      arr[i + 1] = 255;
      arr[i + 2] = 255;
      arr[i + 3] = Math.floor(a * 255);
    }
  }
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, arr);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.generateMipmap(gl.TEXTURE_2D);
  return tex;
}

// Hex "#rrggbb" → [r, g, b] en 0..1
export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
  if (!m) return [1, 1, 1];
  return [
    parseInt(m[1], 16) / 255,
    parseInt(m[2], 16) / 255,
    parseInt(m[3], 16) / 255,
  ];
}

function numberLines(s) {
  return s.split("\n").map((l, i) => `${String(i + 1).padStart(3, "0")}  ${l}`).join("\n");
}
