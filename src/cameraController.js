// Caméra "spectateur" (FPS) pour le web — reproduit les contrôles voulus :
//  - déplacement QZSD : Z/S avant-arrière, Q/D gauche-droite, A/E bas-haut (Shift = rapide),
//  - rotation = CLIC GAUCHE maintenu + glisser,
//  - PAS de zoom molette,
//  - SOL DUR : la caméra ne passe pas sous le terrain du lieu de tir.
// On désactive la navigation Cesium par défaut et on pilote la caméra via heading/pitch dans
// le repère local (ENU). On lit les touches par e.code (physique) -> marche AZERTY ET QWERTY :
// la "grappe" physique W/A/S/D correspond aux touches Z/Q/S/D sur un clavier AZERTY.

export class FpsCameraController {
  constructor(viewer, layer){
    this.viewer = viewer;
    this.camera = viewer.camera;
    this.layer = layer;

    const ssc = viewer.scene.screenSpaceCameraController;
    ssc.enableRotate = ssc.enableTranslate = ssc.enableZoom = ssc.enableTilt = ssc.enableLook = false;

    this.heading = 0; this.pitch = 0;            // rad (heading 0 = nord, pitch + = vers le haut)
    this.camPos = new Cesium.Cartesian3();
    this.keys = Object.create(null);
    this.dragging = false; this.lastX = 0; this.lastY = 0;

    this.moveSpeed = 22;   // m/s
    this.fastMul   = 4;
    this.lookSpeed = 0.005;// rad / pixel
    this.eyeFloor  = 1.6;  // m au-dessus du sol (hauteur d'homme mini)

    this._enu = new Cesium.Matrix4();
    this._v = new Cesium.Cartesian3();
    this._install();
  }

  // Vue initiale depuis une position locale + une cible locale (repère du layer).
  setFromLocal(camLocal, tgtLocal){
    this.camPos = this.layer.localToWorld(camLocal);
    const dx = tgtLocal[0]-camLocal[0], dy = tgtLocal[1]-camLocal[1], dz = tgtLocal[2]-camLocal[2];
    this.heading = Math.atan2(dx, dy);
    this.pitch   = Math.atan2(dz, Math.hypot(dx, dy));
  }

  _install(){
    const cv = this.viewer.canvas;
    cv.setAttribute('tabindex', '0');
    window.addEventListener('keydown', e => { this.keys[e.code] = true; });
    window.addEventListener('keyup',   e => { this.keys[e.code] = false; });
    cv.addEventListener('mousedown', e => { if (e.button === 0){ this.dragging = true; this.lastX = e.clientX; this.lastY = e.clientY; } });
    window.addEventListener('mouseup', e => { if (e.button === 0) this.dragging = false; });
    window.addEventListener('mousemove', e => {
      if (!this.dragging) return;
      this.heading += (e.clientX - this.lastX) * this.lookSpeed;
      this.pitch   -= (e.clientY - this.lastY) * this.lookSpeed;
      this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
      this.lastX = e.clientX; this.lastY = e.clientY;
    });
    cv.addEventListener('wheel', e => e.preventDefault(), { passive: false }); // PAS de zoom molette
    cv.addEventListener('contextmenu', e => e.preventDefault());
  }

  update(dt){
    const k = this.keys;
    let f = 0, r = 0, u = 0;
    if (k['KeyW']) f += 1; if (k['KeyS']) f -= 1;   // Z / S (azerty) = avant / arrière
    if (k['KeyD']) r += 1; if (k['KeyA']) r -= 1;   // D / Q = droite / gauche
    if (k['KeyE']) u += 1; if (k['KeyQ']) u -= 1;   // E / A = haut / bas

    if (f || r || u){
      const spd = this.moveSpeed * ((k['ShiftLeft'] || k['ShiftRight']) ? this.fastMul : 1) * dt;
      const ch = Math.cos(this.heading), sh = Math.sin(this.heading);
      // ENU : forward=(sin h, cos h, 0), right=(cos h, -sin h, 0), up=(0,0,1)
      this._v.x = sh * f + ch * r;
      this._v.y = ch * f - sh * r;
      this._v.z = u;
      Cesium.Transforms.eastNorthUpToFixedFrame(this.camPos, undefined, this._enu);
      Cesium.Matrix4.multiplyByPointAsVector(this._enu, this._v, this._v); // ENU -> ECEF (direction)
      Cesium.Cartesian3.normalize(this._v, this._v);
      Cesium.Cartesian3.multiplyByScalar(this._v, spd, this._v);
      Cesium.Cartesian3.add(this.camPos, this._v, this.camPos);
    }

    // SOL DUR : hauteur mini = sol du lieu de tir + marge.
    const groundH = Cesium.Cartographic.fromCartesian(this.layer.origin).height;
    const cc = Cesium.Cartographic.fromCartesian(this.camPos);
    if (cc.height < groundH + this.eyeFloor){
      cc.height = groundH + this.eyeFloor;
      this.camPos = Cesium.Cartographic.toCartesian(cc);
    }

    this.camera.setView({ destination: this.camPos, orientation: { heading: this.heading, pitch: this.pitch, roll: 0 } });
  }
}
