// Couche de rendu des feux au-dessus du globe Cesium.
// Chaque particule (étoile / grain de traînée) = un BILLBOARD GPU, positionné dans le
// repère LOCAL (est, nord, haut) du lieu de tir puis converti en ECEF (Cesium).
// Le bloom est géré par le post-process intégré de Cesium (configuré dans main.js).
//
// PERF : on RÉUTILISE un pool de billboards (on met juste à jour position/couleur/visibilité),
// au lieu de tout recréer chaque frame -> pas de spirale GC. Scratch réutilisés (zéro alloc).

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
  constructor(viewer, origin){
    this.viewer = viewer;
    this.sprite = makeGlowSprite();
    this.billboards = viewer.scene.primitives.add(new Cesium.BillboardCollection());
    this.fireworks = [];

    const o = Cesium.Cartesian3.fromDegrees(origin.lon, origin.lat, origin.height);
    this.origin = o;
    this.enu = Cesium.Transforms.eastNorthUpToFixedFrame(o);

    this.pool = [];
    this.MAX_PARTICLES = 8000;     // plafond d'affichage
    this.MAX_FIREWORKS = 6;        // feux simultanés max (anti-accumulation)
    this._local = new Cesium.Cartesian3();
    this._world = new Cesium.Cartesian3();
    this._col = new Cesium.Color();
  }

  // [x,y,z] local (mètres) -> Cartesian3 ECEF (alloue : usage ponctuel, ex caméra)
  localToWorld(local){
    return Cesium.Matrix4.multiplyByPoint(
      this.enu, new Cesium.Cartesian3(local[0], local[1], local[2]), new Cesium.Cartesian3());
  }

  add(fw){ if (this.fireworks.length < this.MAX_FIREWORKS) this.fireworks.push(fw); }

  update(dt){
    for (const fw of this.fireworks) fw.update(dt);
    this.fireworks = this.fireworks.filter(f => !f.done);

    // collecte des particules à afficher (plafonnée)
    const items = [];
    for (const fw of this.fireworks){
      if (fw.phase === 'rise') items.push(fw.head);
      const ps = fw.particles;
      for (let i = 0; i < ps.length && items.length < this.MAX_PARTICLES; i++) items.push(ps[i]);
      if (items.length >= this.MAX_PARTICLES) break;
    }

    // agrandir le pool si nécessaire (jamais réduit -> pas de churn)
    while (this.pool.length < items.length){
      this.pool.push(this.billboards.add({ image: this.sprite, sizeInMeters: true, show: false }));
    }

    // mise à jour des billboards réutilisés
    const n = this.pool.length;
    for (let i = 0; i < n; i++){
      const bb = this.pool[i];
      if (i >= items.length){ if (bb.show) bb.show = false; continue; }
      const s = items[i];
      const b = s.bright < 0 ? 0 : (s.bright > 1 ? 1 : s.bright);
      if (b <= 0.01){ if (bb.show) bb.show = false; continue; }

      this._local.x = s.pos[0]; this._local.y = s.pos[1]; this._local.z = s.pos[2];
      Cesium.Matrix4.multiplyByPoint(this.enu, this._local, this._world);
      bb.position = this._world; // Cesium clone la valeur en interne

      this._col.red = s.color[0]; this._col.green = s.color[1]; this._col.blue = s.color[2]; this._col.alpha = b;
      bb.color = this._col;      // idem, cloné

      const sz = (s.size < 0.05 ? 0.05 : s.size) * 2.5;
      bb.width = sz; bb.height = sz;
      bb.show = true;
    }
  }
}
