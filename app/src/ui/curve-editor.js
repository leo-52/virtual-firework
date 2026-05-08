// Éditeur de courbes générique sur canvas.
//
// Modèle : array de points { t: 0..1, v: 0..1 }, triés sur t.
// Premier et dernier points sont attachés à t=0 et t=1, et déplaçables
// uniquement en v. Les points intermédiaires sont déplaçables en t et v.
// Double-clic sur la courbe = ajout d'un point ; double-clic sur un
// point existant = suppression.
//
// Usage :
//   const ed = createCurveEditor({ points, onChange });
//   container.appendChild(ed.node);
//   ed.set(points)         // reset
//   ed.get()               // points actuels

const W = 320;
const H = 140;
const PAD = 6;

export function createCurveEditor({
  points = [{ t: 0, v: 0 }, { t: 1, v: 1 }],
  onChange = () => {},
  label = "",
  color = "#0091ff",
} = {}) {
  let pts = normalize(points);
  let dragIdx = -1;

  const wrap = document.createElement("div");
  wrap.className = "curve-editor";
  if (label) {
    const lab = document.createElement("div");
    lab.className = "form-label";
    lab.textContent = label;
    wrap.appendChild(lab);
  }
  const canvas = document.createElement("canvas");
  canvas.className = "curve-editor-canvas";
  canvas.width = W;
  canvas.height = H;
  wrap.appendChild(canvas);
  const cx = canvas.getContext("2d");

  function pxToData(px, py) {
    const t = clamp((px - PAD) / (W - 2 * PAD), 0, 1);
    const v = clamp(1 - (py - PAD) / (H - 2 * PAD), 0, 1);
    return { t, v };
  }
  function dataToPx(p) {
    return [PAD + p.t * (W - 2 * PAD), PAD + (1 - p.v) * (H - 2 * PAD)];
  }

  function pickPoint(px, py) {
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = dataToPx(pts[i]);
      if (Math.hypot(px - x, py - y) < 8) return i;
    }
    return -1;
  }

  function draw() {
    cx.clearRect(0, 0, W, H);
    // Fond
    cx.fillStyle = "#04060f";
    cx.fillRect(0, 0, W, H);
    // Grille
    cx.strokeStyle = "rgba(255,255,255,0.05)";
    cx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const x = PAD + (i / 4) * (W - 2 * PAD);
      cx.beginPath(); cx.moveTo(x, PAD); cx.lineTo(x, H - PAD); cx.stroke();
      const y = PAD + (i / 4) * (H - 2 * PAD);
      cx.beginPath(); cx.moveTo(PAD, y); cx.lineTo(W - PAD, y); cx.stroke();
    }
    // Aire sous la courbe
    cx.fillStyle = color + "33";
    cx.beginPath();
    const [x0, y0] = dataToPx(pts[0]);
    cx.moveTo(x0, H - PAD);
    cx.lineTo(x0, y0);
    for (let i = 1; i < pts.length; i++) {
      const [x, y] = dataToPx(pts[i]);
      cx.lineTo(x, y);
    }
    const [xL] = dataToPx(pts[pts.length - 1]);
    cx.lineTo(xL, H - PAD);
    cx.closePath();
    cx.fill();
    // Trait
    cx.strokeStyle = color;
    cx.lineWidth = 2;
    cx.beginPath();
    cx.moveTo(x0, y0);
    for (let i = 1; i < pts.length; i++) {
      const [x, y] = dataToPx(pts[i]);
      cx.lineTo(x, y);
    }
    cx.stroke();
    // Points
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = dataToPx(pts[i]);
      cx.fillStyle = i === dragIdx ? "#fff" : color;
      cx.beginPath();
      cx.arc(x, y, i === dragIdx ? 5 : 4, 0, Math.PI * 2);
      cx.fill();
    }
  }

  canvas.addEventListener("mousedown", (e) => {
    const r = canvas.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    dragIdx = pickPoint(px, py);
    if (dragIdx < 0) {
      // Ajout à la position cliquée
      const p = pxToData(px, py);
      pts.push(p);
      pts = normalize(pts);
      dragIdx = pts.findIndex((q) => q.t === p.t);
      onChange(pts.slice());
    }
    draw();
  });
  window.addEventListener("mousemove", (e) => {
    if (dragIdx < 0) return;
    const r = canvas.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const p = pxToData(px, py);
    if (dragIdx === 0) p.t = 0;
    else if (dragIdx === pts.length - 1) p.t = 1;
    pts[dragIdx] = p;
    pts = normalize(pts);
    dragIdx = pts.findIndex((q) => q === p) >= 0 ? pts.indexOf(p) : dragIdx;
    onChange(pts.slice());
    draw();
  });
  window.addEventListener("mouseup", () => {
    if (dragIdx >= 0) {
      dragIdx = -1;
      draw();
    }
  });
  canvas.addEventListener("dblclick", (e) => {
    const r = canvas.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const idx = pickPoint(px, py);
    if (idx > 0 && idx < pts.length - 1) {
      pts.splice(idx, 1);
      onChange(pts.slice());
      draw();
    }
  });

  draw();

  return {
    node: wrap,
    set(newPoints) { pts = normalize(newPoints); draw(); },
    get() { return pts.slice(); },
    sample(t) { return sampleLinear(pts, t); },
  };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function normalize(pts) {
  const out = pts.map((p) => ({ t: clamp(p.t, 0, 1), v: clamp(p.v, 0, 1) }));
  out.sort((a, b) => a.t - b.t);
  if (!out.length) out.push({ t: 0, v: 0 }, { t: 1, v: 1 });
  if (out[0].t !== 0) out.unshift({ t: 0, v: out[0].v });
  if (out[out.length - 1].t !== 1) out.push({ t: 1, v: out[out.length - 1].v });
  return out;
}

export function sampleLinear(pts, t) {
  if (!pts.length) return 0;
  if (t <= pts[0].t) return pts[0].v;
  if (t >= pts[pts.length - 1].t) return pts[pts.length - 1].v;
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i].t) {
      const a = pts[i - 1], b = pts[i];
      const k = (t - a.t) / (b.t - a.t);
      return a.v + (b.v - a.v) * k;
    }
  }
  return pts[pts.length - 1].v;
}

// Presets utiles
export const PRESETS = {
  flat:     [{ t: 0, v: 1 }, { t: 1, v: 1 }],
  attack:   [{ t: 0, v: 0 }, { t: 0.1, v: 1 }, { t: 1, v: 0 }],
  decay:    [{ t: 0, v: 1 }, { t: 1, v: 0 }],
  bell:     [{ t: 0, v: 0 }, { t: 0.5, v: 1 }, { t: 1, v: 0 }],
  pulse:    [{ t: 0, v: 0 }, { t: 0.2, v: 1 }, { t: 0.4, v: 0 },
             { t: 0.6, v: 1 }, { t: 0.8, v: 0 }, { t: 1, v: 0 }],
};
