// Timeline de lecture (barre en bas) + raccourci ESPACE = pause/play.
// En PAUSE : la simulation des feux est FIGÉE (artifices suspendus en l'air pour les inspecter
// en 3D) — la CAMÉRA reste libre (main.js passe dt=0 au layer mais le vrai dt à la caméra).
// La barre affiche : bouton lecture/pause, horloge, progression du tir courant, nom de l'effet.
// (Première version sur la démo en boucle ; prête à recevoir un vrai SHOW + scrub plus tard.)

export class Timeline {
  constructor(layer, labels){
    this.layer = layer;
    this.labels = labels || {};
    this.paused = false;
    this.elapsed = 0;          // temps de lecture écoulé (s)
    this._build();
    // ESPACE = pause/play (preventDefault pour ne pas scroller la page)
    window.addEventListener('keydown', e => {
      if (e.code === 'Space'){ e.preventDefault(); this.toggle(); }
    });
  }

  _build(){
    const style = document.createElement('style');
    style.textContent = `
      #tl { position:fixed; left:50%; bottom:16px; transform:translateX(-50%); z-index:11;
        display:flex; align-items:center; gap:12px; width:min(640px,88vw);
        background:rgba(0,0,0,.55); border:1px solid #444; border-radius:10px; padding:8px 14px;
        font-family:system-ui,sans-serif; color:#eee; font-size:13px; backdrop-filter:blur(4px); }
      #tl button { all:unset; cursor:pointer; width:30px; height:30px; border-radius:50%;
        display:flex; align-items:center; justify-content:center; font-size:14px; line-height:1;
        background:#ffae3b; color:#111; flex:0 0 auto; }
      #tl button:hover { background:#ffc163; }
      #tl .tm  { flex:0 0 auto; font-variant-numeric:tabular-nums; color:#bbb; min-width:34px; }
      #tl .trk { position:relative; flex:1 1 auto; height:6px; border-radius:3px; background:#333; overflow:hidden; }
      #tl .fil { position:absolute; left:0; top:0; bottom:0; width:0%;
        background:linear-gradient(90deg,#ff7a18,#ffd27a); transition:width .05s linear; }
      #tl .eff { flex:0 0 auto; min-width:100px; text-align:right; color:#ffd27a; font-weight:600;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      #tl.paused .fil { background:#7a7a7a; }
      #tl.paused .tm  { color:#ffae3b; font-weight:600; }
    `;
    document.head.appendChild(style);

    const el = document.createElement('div'); el.id = 'tl';
    el.innerHTML =
      '<button title="Espace : lecture / pause">&#10073;&#10073;</button>' +  // ⏸
      '<span class="tm">0:00</span>' +
      '<div class="trk"><div class="fil"></div></div>' +
      '<span class="eff">&mdash;</span>';
    document.body.appendChild(el);
    this.el  = el;
    this.btn = el.querySelector('button');
    this.tm  = el.querySelector('.tm');
    this.fil = el.querySelector('.fil');
    this.eff = el.querySelector('.eff');
    this.btn.addEventListener('click', () => this.toggle());
  }

  toggle(){
    this.paused = !this.paused;
    this.btn.innerHTML = this.paused ? '&#9658;' : '&#10073;&#10073;';   // ▶ / ⏸
    this.el.classList.toggle('paused', this.paused);
  }

  _fmt(t){ const m=Math.floor(t/60), s=Math.floor(t%60); return m+':'+String(s).padStart(2,'0'); }

  // Progression du tir courant (montée -> extinction) pour faire vivre la barre.
  _shotProgress(){
    const s = this.layer.shell;
    if (!s || s.dead) return 0;
    const rise = s.riseTime || 0;
    const life = ((s.cfg && s.cfg.lifeBase75) || 1.5) * 1.4 + 1.0;   // ~durée visible après le burst
    return Math.max(0, Math.min(1, s.age / (rise + life)));
  }

  // Appelée chaque frame avec le VRAI dt ; n'avance l'horloge que si on n'est pas en pause.
  update(dt){
    if (!this.paused) this.elapsed += dt;
    this.tm.textContent = this._fmt(this.elapsed);
    const cur = this.layer.current;
    this.eff.textContent = this.labels[cur] || cur || '—';
    this.fil.style.width = (this._shotProgress()*100).toFixed(1) + '%';
  }
}
