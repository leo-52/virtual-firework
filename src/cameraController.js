// Caméra "spectateur" (FPS) pour le web. Contrôles voulus :
//  - déplacement QZSD : Z/S avant-arrière, Q/D gauche-droite, A/E bas-haut (Shift = rapide),
//  - rotation = CLIC GAUCHE maintenu + glisser,
//  - ZOOM molette = avancer/reculer le long du regard (dolly),
//  - SOL DUR : ne passe pas sous le terrain (calé sur le sol RÉEL sous la caméra),
//  - vue par défaut : ~5 m au-dessus du sol, à 150 m, dans l'axe.
// On lit les touches par e.code (physique) -> la grappe W/A/S/D = Z/Q/S/D sur AZERTY.

export class FpsCameraController {
  constructor(viewer, layer){
    this.viewer = viewer;
    this.scene = viewer.scene;
    this.camera = viewer.camera;
    this.layer = layer;

    const ssc = this.scene.screenSpaceCameraController;
    ssc.enableRotate = ssc.enableTranslate = ssc.enableZoom = ssc.enableTilt = ssc.enableLook = false;

    this.heading = 0; this.pitch = 0;
    this.camPos = new Cesium.Cartesian3();
    this.keys = Object.create(null);
    this.dragging = false; this.lastX = 0; this.lastY = 0;

    this.moveSpeed = 22;   // m/s
    this.fastMul   = 4;
    this.lookSpeed = 0.005;// rad / pixel
    this.zoomFactor = 0.10;// molette -> dolly (m par unité de delta), borné par cran
    this.eyeDefault = 5;   // hauteur par défaut au-dessus du sol local (m)
    this.eyeFloor   = 2;   // hauteur mini au-dessus du sol (sol dur)

    this._enu = new Cesium.Matrix4();
    this._v = new Cesium.Cartesian3();

    this._installKeyboard();
    this._installMouse();
  }

  // Hauteur du SOL de référence = celle du LIEU DE TIR (calée précisément via
  // sampleHeightMostDetailed). On NE sample PLUS sous la caméra : scene.sampleHeight renvoie
  // souvent des valeurs ABERRANTES (artefacts tuiles Google -> ~700 m) qui propulsaient la
  // caméra dans les airs (vue plongeante -> charge énorme de tuiles -> FREEZE). Le terrain
  // autour d'un site de tir est ~plat, donc le sol du tir est la bonne référence.
  _groundUnder(cartesian){
    try { return Cesium.Cartographic.fromCartesian(this.layer.origin).height; } catch (e) { return null; }
  }

  // Vue depuis une position locale + cible locale (repère du layer). Cale la hauteur
  // à eyeDefault au-dessus du sol RÉEL sous la caméra.
  setFromLocal(camLocal, tgtLocal){
    this.camPos = this.layer.localToWorld(camLocal);
    const dx = tgtLocal[0]-camLocal[0], dy = tgtLocal[1]-camLocal[1], dz = tgtLocal[2]-camLocal[2];
    this.heading = Math.atan2(dx, dy);
    this.pitch   = Math.atan2(dz, Math.hypot(dx, dy));
    const g = this._groundUnder(this.camPos);
    if (g !== null){
      const c = Cesium.Cartographic.fromCartesian(this.camPos);
      c.height = g + this.eyeDefault;
      this.camPos = Cesium.Cartographic.toCartesian(c);
    }
  }

  _installKeyboard(){
    window.addEventListener('keydown', e => { this.keys[e.code] = true; });
    window.addEventListener('keyup',   e => { this.keys[e.code] = false; });
  }

  _installMouse(){
    // Système d'événements Cesium (fiable, pas de conflit avec le canvas WebGL).
    const h = new Cesium.ScreenSpaceEventHandler(this.scene.canvas);
    h.setInputAction(m => { this.dragging = true;  this.lastX = m.position.x; this.lastY = m.position.y; }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
    h.setInputAction(() => { this.dragging = false; }, Cesium.ScreenSpaceEventType.LEFT_UP);
    h.setInputAction(m => {
      if (!this.dragging) return;
      this.heading += (m.endPosition.x - this.lastX) * this.lookSpeed;
      this.pitch   -= (m.endPosition.y - this.lastY) * this.lookSpeed;
      this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
      this.lastX = m.endPosition.x; this.lastY = m.endPosition.y;
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    // ZOOM MOLETTE = dolly : on avance/recule le long du regard (delta>0 = on s'approche).
    h.setInputAction(delta => {
      const step = Math.max(-45, Math.min(45, delta * this.zoomFactor));
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      const ch = Math.cos(this.heading), sh = Math.sin(this.heading);
      this._v.x = sh * cp; this._v.y = ch * cp; this._v.z = sp; // direction du regard (ENU, avec pitch)
      Cesium.Transforms.eastNorthUpToFixedFrame(this.camPos, undefined, this._enu);
      Cesium.Matrix4.multiplyByPointAsVector(this._enu, this._v, this._v);
      Cesium.Cartesian3.normalize(this._v, this._v);
      Cesium.Cartesian3.multiplyByScalar(this._v, step, this._v);
      Cesium.Cartesian3.add(this.camPos, this._v, this.camPos);
    }, Cesium.ScreenSpaceEventType.WHEEL);
    this._mouse = h;
  }

  update(dt){
    const k = this.keys;
    let f = 0, r = 0, u = 0;
    if (k['KeyW']) f += 1; if (k['KeyS']) f -= 1;   // Z / S = avant / arrière
    if (k['KeyD']) r += 1; if (k['KeyA']) r -= 1;   // D / Q = droite / gauche
    if (k['KeyE']) u += 1; if (k['KeyQ']) u -= 1;   // E / A = haut / bas

    if (f || r || u){
      const spd = this.moveSpeed * ((k['ShiftLeft'] || k['ShiftRight']) ? this.fastMul : 1) * dt;
      const ch = Math.cos(this.heading), sh = Math.sin(this.heading);
      this._v.x = sh * f + ch * r;     // ENU : forward=(sin h,cos h,0), right=(cos h,-sin h,0)
      this._v.y = ch * f - sh * r;
      this._v.z = u;
      Cesium.Transforms.eastNorthUpToFixedFrame(this.camPos, undefined, this._enu);
      Cesium.Matrix4.multiplyByPointAsVector(this._enu, this._v, this._v);
      Cesium.Cartesian3.normalize(this._v, this._v);
      Cesium.Cartesian3.multiplyByScalar(this._v, spd, this._v);
      Cesium.Cartesian3.add(this.camPos, this._v, this.camPos);
    }

    // SOL DUR : ne pas descendre sous le terrain local + marge.
    const g = this._groundUnder(this.camPos);
    if (g !== null){
      const c = Cesium.Cartographic.fromCartesian(this.camPos);
      if (c.height < g + this.eyeFloor){
        c.height = g + this.eyeFloor;
        this.camPos = Cesium.Cartographic.toCartesian(c);
      }
    }

    this.camera.setView({ destination: this.camPos, orientation: { heading: this.heading, pitch: this.pitch, roll: 0 } });
  }
}
