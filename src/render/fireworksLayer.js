// Couche de rendu des feux au-dessus du globe Cesium.
// Chaque particule (étoile / grain de traînée) = un BILLBOARD GPU, positionné dans
// le repère LOCAL (est, nord, haut) du lieu de tir puis converti en ECEF (Cesium).
// Le bloom est géré par le post-process intégré de Cesium (configuré dans main.js).
//
// v1 : on reconstruit la collection chaque frame (simple). Pour des centaines/milliers
// de particules ça reste ok ; on optimisera (réutilisation d'instances) plus tard.

// Sprite "braise" généré au runtime (pas d'asset) : cœur clair -> bord transparent.
function makeGlowSprite(){
  const s = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
  g.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.25)');
  g.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return cv;
}

export class FireworksLayer {
  // viewer : Cesium.Viewer ; origin : {lon, lat, height} en degrés/mètres (lieu de tir)
  constructor(viewer, origin){
    this.viewer = viewer;
    this.sprite = makeGlowSprite();
    this.billboards = viewer.scene.primitives.add(new Cesium.BillboardCollection());
    this.fireworks = [];

    const o = Cesium.Cartesian3.fromDegrees(origin.lon, origin.lat, origin.height);
    this.origin = o;
    this.enu = Cesium.Transforms.eastNorthUpToFixedFrame(o);
    this._scratch = new Cesium.Cartesian3();
  }

  // [x,y,z] local (mètres) -> Cartesian3 ECEF
  localToWorld(local){
    return Cesium.Matrix4.multiplyByPoint(
      this.enu, new Cesium.Cartesian3(local[0], local[1], local[2]), new Cesium.Cartesian3());
  }

  add(fw){ this.fireworks.push(fw); }

  update(dt){
    for (const fw of this.fireworks) fw.update(dt);
    this.fireworks = this.fireworks.filter(f => !f.done);

    this.billboards.removeAll();
    for (const fw of this.fireworks){
      if (fw.phase === 'rise') this._addBillboard(fw.head);
      for (const s of fw.particles) this._addBillboard(s);
    }
  }

  _addBillboard(s){
    const pos = Cesium.Matrix4.multiplyByPoint(
      this.enu, new Cesium.Cartesian3(s.pos[0], s.pos[1], s.pos[2]), this._scratch);
    const b = Math.max(0, Math.min(1, s.bright));
    if (b <= 0.01) return;
    const sz = Math.max(0.05, s.size) * 2.5; // le sprite glow déborde du "cœur"
    this.billboards.add({
      position: new Cesium.Cartesian3(pos.x, pos.y, pos.z),
      image: this.sprite,
      color: new Cesium.Color(s.color[0], s.color[1], s.color[2], b),
      sizeInMeters: true,
      width: sz, height: sz
    });
  }
}
