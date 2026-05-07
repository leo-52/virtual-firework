// Caméra orbit autour d'un point cible.
//
// - Souris drag = rotation azimut/élévation
// - Roulette = zoom (distance)
// - Maj + drag = pan (translation cible)

import { mat4LookAt, mat4Perspective } from "./math.js";

export class OrbitCamera {
  constructor(canvas) {
    this.canvas = canvas;
    this.target = [0, 30, 0];
    this.distance = 150;
    this.azimuth = Math.PI * 0.25;     // angle horizontal
    this.elevation = Math.PI * 0.18;    // angle vertical
    this.fovY = Math.PI * 0.5;
    this.near = 0.5;
    this.far = 1000;

    this.viewMat = new Float32Array(16);
    this.projMat = new Float32Array(16);

    this._bindEvents();
    this.update();
  }

  position() {
    const [tx, ty, tz] = this.target;
    const cosE = Math.cos(this.elevation);
    return [
      tx + this.distance * cosE * Math.cos(this.azimuth),
      ty + this.distance * Math.sin(this.elevation),
      tz + this.distance * cosE * Math.sin(this.azimuth),
    ];
  }

  update() {
    const aspect = this.canvas.width / this.canvas.height || 1;
    mat4Perspective(this.projMat, this.fovY, aspect, this.near, this.far);
    mat4LookAt(this.viewMat, this.position(), this.target, [0, 1, 0]);
  }

  _bindEvents() {
    let dragging = null;
    this.canvas.addEventListener("mousedown", (e) => {
      if (e.button !== 0 && e.button !== 1) return;
      dragging = {
        x: e.clientX, y: e.clientY,
        az: this.azimuth, el: this.elevation,
        target: [...this.target],
        pan: e.shiftKey || e.button === 1,
      };
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - dragging.x;
      const dy = e.clientY - dragging.y;
      if (dragging.pan) {
        // Pan dans le plan caméra
        const speed = this.distance * 0.0015;
        const sinAz = Math.sin(this.azimuth), cosAz = Math.cos(this.azimuth);
        this.target = [
          dragging.target[0] - dx * cosAz * speed - dy * 0 * speed,
          dragging.target[1] + dy * speed * 0.7,
          dragging.target[2] - dx * sinAz * speed,
        ];
      } else {
        this.azimuth = dragging.az - dx * 0.005;
        this.elevation = clamp(dragging.el + dy * 0.005, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
      }
      this.update();
    });
    window.addEventListener("mouseup", () => { dragging = null; });
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const factor = Math.exp(e.deltaY * 0.001);
      this.distance = clamp(this.distance * factor, 5, 800);
      this.update();
    }, { passive: false });
  }
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
