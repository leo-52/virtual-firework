// Sons pyro SYNTHÉTISÉS (Web Audio) — 100% originaux, aucun fichier/licence.
// Œuf de dragon = bref "pop" de break + RAFALE dense de micro-claquements (1-3 ms, large bande,
// densité qui monte puis décroît ~2 s). Recette = ressources/effets_reference.md (train d'impulsions).
// L'audio ne démarre qu'après une interaction (politique navigateur) -> 1er clic/touche = activation.

export class PyroAudio {
  constructor(){
    this.ctx = null; this.master = null;
    const resume = () => {
      if (!this.ctx){
        try {
          this.ctx = new (window.AudioContext || window.webkitAudioContext)();
          this.master = this.ctx.createGain(); this.master.gain.value = 0.7;
          this.master.connect(this.ctx.destination);
        } catch(e){ /* pas d'audio dispo */ }
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    };
    addEventListener('pointerdown', resume);
    addEventListener('keydown', resume);
  }

  // Construit un buffer "œuf de dragon" (break + crépitement) — léger à générer (~quelques ms).
  _dragonEggBuffer(){
    const ctx = this.ctx, sr = ctx.sampleRate, dur = 2.6, n = (sr*dur)|0;
    const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);

    // 1) BREAK : "pop" bref et grave (l'ouverture de la bombe)
    const bn = (sr*0.14)|0;
    for (let i=0;i<bn;i++){ const t=i/sr, e=Math.exp(-t*30);
      d[i] += ((Math.random()*2-1)*0.45 + Math.sin(2*Math.PI*72*t)*0.55) * e * 0.7; }

    // 2) CRÉPITEMENT : rafale de pops courts. Délai ~0.22 s (le crépitement est RETARDÉ),
    //    intervalles aléatoires (loi de Poisson), densité qui monte (~50 -> 200/s) puis décroît.
    const start=0.22, len=2.0, end=start+len; let t=start;
    while (t < end){
      const p = (t-start)/len;                                   // 0..1
      const density = 45 + 165*Math.sin(Math.PI*Math.min(1,p*1.08));
      t += -Math.log(Math.random()+1e-6)/density;                // intervalle poissonien
      const amp = (0.28 + Math.random()*0.5) * (1 - 0.65*p);     // décroît sur la durée
      const pl = ((0.001 + Math.random()*0.0025)*sr)|0;          // pop 1-3.5 ms
      const i0 = (t*sr)|0;
      for (let k=0;k<pl && i0+k<n;k++){ const e=Math.exp(-(k/pl)*5);
        d[i0+k] += (Math.random()*2-1) * e * amp; }              // bruit large bande
    }

    // anti-clip
    let mx=0; for (let i=0;i<n;i++){ const a=d[i]<0?-d[i]:d[i]; if (a>mx) mx=a; }
    if (mx>0.99){ const g=0.99/mx; for (let i=0;i<n;i++) d[i]*=g; }
    return buf;
  }

  dragonEgg(){
    if (!this.ctx || this.ctx.state !== 'running') return;        // pas encore activé (pas d'interaction)
    const src = this.ctx.createBufferSource();
    src.buffer = this._dragonEggBuffer();
    const g = this.ctx.createGain(); g.gain.value = 0.9;
    src.connect(g).connect(this.master);
    src.start();
  }

  // BREAK (B165, user : « l'explosion centrale n'a pas de son ? ») : le POP de l'éclatement de
  // TOUTE bombe — claquement bref + petit coup sourd (~95 Hz), bien plus discret qu'un marron.
  _breakBuffer(){
    const ctx = this.ctx, sr = ctx.sampleRate, dur = 0.65, n = (sr*dur)|0;
    const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    const cn = (sr*0.006)|0;
    for (let i=0;i<cn;i++){ const e=Math.exp(-(i/cn)*3.5); d[i] += (Math.random()*2-1) * e * 0.8; }
    const tn = (sr*0.40)|0;
    for (let i=0;i<tn;i++){ const t=i/sr, e=Math.exp(-t*11); d[i] += Math.sin(2*Math.PI*95*t) * e * 0.7; }
    let lp=0;
    for (let i=0;i<n;i++){ const t=i/sr, e=Math.exp(-t*6);
      lp += ((Math.random()*2-1) - lp) * 0.09; d[i] += lp * e * 0.5; }
    let mx=0; for (let i=0;i<n;i++){ const a=d[i]<0?-d[i]:d[i]; if (a>mx) mx=a; }
    if (mx>0.99){ const g=0.99/mx; for (let i=0;i<n;i++) d[i]*=g; }
    return buf;
  }
  breakPop(){
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (!this._breakBuf) this._breakBuf = this._breakBuffer();
    const src = this.ctx.createBufferSource();
    src.buffer = this._breakBuf;
    src.playbackRate.value = 0.92 + Math.random()*0.16;
    const g = this.ctx.createGain(); g.gain.value = 0.65;
    src.connect(g).connect(this.master);
    src.start();
  }

  // MARRON D'AIR (B154) : DÉTONATION — l'effet EST le bruit (réf UE : plus fort qu'une bombe
  // classique, pitch BAS, ça RÉSONNE). 3 couches : CLAQUEMENT bref large bande + COUP DE BASSE
  // (~52 Hz + sub 38 Hz) + GRONDEMENT grave qui traîne (bruit filtré passe-bas ~1,2 s).
  _marronBuffer(){
    const ctx = this.ctx, sr = ctx.sampleRate, dur = 1.5, n = (sr*dur)|0;
    const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    const cn = (sr*0.010)|0;                                       // 1) CLAQUEMENT : 10 ms plein pot
    for (let i=0;i<cn;i++){ const e=Math.exp(-(i/cn)*4);
      d[i] += (Math.random()*2-1) * e * 1.0; }
    const tn = (sr*0.7)|0;                                         // 2) BASSE : 52 Hz + sub 38 Hz
    for (let i=0;i<tn;i++){ const t=i/sr, e=Math.exp(-t*7);
      d[i] += (Math.sin(2*Math.PI*52*t)*0.85 + Math.sin(2*Math.PI*38*t)*0.55) * e; }
    let lp=0;                                                      // 3) GRONDEMENT : bruit passe-bas 1 pôle
    for (let i=0;i<n;i++){ const t=i/sr, e=Math.exp(-t*3.0);
      lp += ((Math.random()*2-1) - lp) * 0.06;
      d[i] += lp * e * 1.1; }
    let mx=0; for (let i=0;i<n;i++){ const a=d[i]<0?-d[i]:d[i]; if (a>mx) mx=a; }
    if (mx>0.99){ const g=0.99/mx; for (let i=0;i<n;i++) d[i]*=g; }
    return buf;
  }

  // when = délai en secondes (les 4 marrons du MULTI détonent décalés). gain fort (×1.25 vs bombe).
  marron(when = 0){
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (!this._marronBuf) this._marronBuf = this._marronBuffer();  // buffer réutilisé (identique à chaque boom)
    const src = this.ctx.createBufferSource();
    src.buffer = this._marronBuf;
    src.playbackRate.value = 0.96 + Math.random()*0.08;            // chaque boom légèrement différent
    const g = this.ctx.createGain(); g.gain.value = 1.25;
    src.connect(g).connect(this.master);
    src.start(this.ctx.currentTime + Math.max(0, when));
  }
}
