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
  g.addColorStop(0.0,  'rgba(255,255,255,1.0)');
  g.addColorStop(0.22, 'rgba(255,255,255,0.96)'); // cœur clair plus large -> plus brillant
  g.addColorStop(0.5,  'rgba(255,255,255,0.45)');
  g.addColorStop(1.0,  'rgba(255,255,255,0.0)');
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

    this.setOrigin(origin); // repère local (ENU) ancré au lieu de tir

    this.pool = [];
    this.MAX_PARTICLES = 8000;     // plafond d'affichage
    this.MAX_FIREWORKS = 6;        // feux simultanés max (anti-accumulation)
    this._local = new Cesium.Cartesian3();
    this._world = new Cesium.Cartesian3();
    this._vel = new Cesium.Cartesian3();
    this._velW = new Cesium.Cartesian3();
    this._col = new Cesium.Color();
  }

  // (Re)définit le lieu de tir -> recalcule le repère local (ENU). Sert à caler le tir
  // sur le sol réel une fois le terrain chargé, et à changer de lieu (choix client).
  setOrigin(origin){
    this.origin = Cesium.Cartesian3.fromDegrees(origin.lon, origin.lat, origin.height);
    this.enu = Cesium.Transforms.eastNorthUpToFixedFrame(this.origin);
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
      const b0 = s.bright < 0 ? 0 : (s.bright > 1 ? 1 : s.bright);
      if (b0 <= 0.01){ if (bb.show) bb.show = false; continue; }
      let b = b0;

      this._local.x = s.pos[0]; this._local.y = s.pos[1]; this._local.z = s.pos[2];
      Cesium.Matrix4.multiplyByPoint(this.enu, this._local, this._world);
      bb.position = this._world; // Cesium clone la valeur en interne

      const sz = (s.size < 0.05 ? 0.05 : s.size) * 2.8;
      // FLOU DE MOUVEMENT : les étoiles RAPIDES s'étirent le long de leur vitesse (streak)
      // et redeviennent rondes en ralentissant. Signature "vidéo" (niveau 3).
      let stretch = 0;
      if (s.kind === 'star' && s.vel){
        const spd = Math.sqrt(s.vel[0]*s.vel[0] + s.vel[1]*s.vel[1] + s.vel[2]*s.vel[2]);
        stretch = Math.min(3.0, spd * 0.07);
      }
      if (stretch > 0.2){
        this._vel.x = s.vel[0]; this._vel.y = s.vel[1]; this._vel.z = s.vel[2];
        Cesium.Matrix4.multiplyByPointAsVector(this.enu, this._vel, this._velW);
        Cesium.Cartesian3.normalize(this._velW, this._velW);
        bb.alignedAxis = this._velW;                    // aligne le billboard sur la vitesse
        bb.width = sz; bb.height = sz * (1 + stretch);  // étiré le long de la vitesse
        b = b / Math.sqrt(1 + stretch);                 // énergie étalée -> flou doux
      } else {
        bb.alignedAxis = Cesium.Cartesian3.ZERO;        // rond (aligné écran)
        bb.width = sz; bb.height = sz;
      }

      // ÉCLAT : alpha amplifié + léger CŒUR BLANC-CHAUD quand brillant -> ça "brille".
      const a = b * 1.7 > 1 ? 1 : b * 1.7;
      const w = 0.30 * b0; // mix vers le blanc selon l'éclat d'origine
      this._col.red   = s.color[0] + (1 - s.color[0]) * w;
      this._col.green = s.color[1] + (1 - s.color[1]) * w;
      this._col.blue  = s.color[2] + (1 - s.color[2]) * w;
      this._col.alpha = a;
      bb.color = this._col;
      bb.show = true;
    }
  }
}
