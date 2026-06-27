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
}
