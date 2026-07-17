// Sons pyro — B255 : on joue les ENREGISTREMENTS de l'user (web/sons/*.mp3, déposés par lui
// dans inspiration/sons — la synthèse B254 « vraiment dégueu » est reléguée en SECOURS si un
// fichier ne charge pas). Variation par tir = jitter de vitesse de lecture + gain ; sons
// CALIBRÉS (vol/deep par calibre) ; LIMITEUR sur le master (salves de compacts).
//   launch    = « Départ de bombe »   breakOpen = « Bombe 75mm »
//   crackling = « Crackling » en TEXTURE ÉTALÉE : chaque ÉTOILE crépite (user B255) -> 3 couches
//               décalées (~0 / +0,6 / +1,3 s) qui couvrent la vie des étoiles, pas une rafale sèche
//   dragonEgg = « Oeuf de dragon » (+ 1 couche décalée, les étoiles crépitent aussi)
//   whistle   = « Sifflet »           hibou = « Hibou »          marron = synthèse (validée B154)
// L'audio ne démarre qu'après une interaction (politique navigateur) -> 1er clic/touche = activation.

const K = (fc, sr) => 1 - Math.exp(-2*Math.PI*fc/sr);   // coeff passe-bas 1 pôle pour une coupure fc
const vol  = c => Math.min(1.6, Math.max(0.30, Math.pow((c||75)/75, 0.9)));    // gain par calibre
const deep = c => Math.min(1.20, Math.max(0.85, Math.pow(75/(c||75), 0.12)));  // gros calibre = + grave
// DISTANCE caméra -> bombe (B256, user : « adapter le son selon la distance ») :
// loi en 1/d, référence 150 m (la vue public par défaut) ; et le son ARRIVE en retard (343 m/s)
// -> à la vue par défaut le boom claque ~0,5 s après le flash, comme en vrai.
const att = d => Math.max(0.03, Math.min(1.8, 150/Math.max(d||150, 25)));
const dly = d => d ? d/343 : 0;

// [fichier web/sons/<n>.mp3, gain de normalisation (pics mesurés : oeuf 0.20, sifflet 0.11)]
const SAMPLES = {
  launch:  ['depart',    0.78],
  break:   ['bombe75',   0.88],
  crack:   ['crackling', 1.25],
  dragon:  ['oeuf',      3.50],
  whistle: ['sifflet',   3.50],
  hibou:   ['hibou',     1.17],
};

export class PyroAudio {
  constructor(){
    this.ctx = null; this.master = null;
    this.enabled = true;   // B169 : coupé/activé par le bouton son (indépendant du déblocage navigateur)
    this._pools = {}; this._smp = {}; this._smpFail = {}; this._smpLoading = false;
    this._resume = () => {
      if (!this.ctx){
        try {
          this.ctx = new (window.AudioContext || window.webkitAudioContext)();
          this.master = this.ctx.createGain(); this.master.gain.value = 0.5;   // B256 (user : « trop fort ») : 0.7 -> 0.5
          // LIMITEUR (revue B254) : compacts = salves, multi-marron = 5 booms — sans headroom
          // la somme écrête DUR. Seuil haut + ratio fort : un son seul passe quasi intact.
          const lim = this.ctx.createDynamicsCompressor();
          lim.threshold.value = -6; lim.knee.value = 4; lim.ratio.value = 12;
          lim.attack.value = 0.002; lim.release.value = 0.25;
          this.master.connect(lim); lim.connect(this.ctx.destination);
        } catch(e){ /* pas d'audio dispo */ }
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      // B261 (user : « pas de son SANS écouteurs, avec écouteurs ça marche ») = iOS : le
      // COMMUTATEUR SILENCIEUX coupe le Web Audio sur haut-parleur (pas sur écouteurs).
      // Parade double : 1) API audioSession (iOS 16.4+) -> catégorie « lecture » qui ignore
      // le commutateur ; 2) un <audio> SILENCIEUX en boucle lancé au 1er geste (même effet
      // sur les iOS plus vieux — l'astuce standard des jeux web).
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch(e){}
      if (!this._iosKick){
        try {
          const a = document.createElement('audio');
          a.loop = true; a.playsInline = true; a.preload = 'auto'; a.volume = 0.01;
          a.src = 'data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YVAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
          a.play().catch(()=>{});
          this._iosKick = a;
        } catch(e){}
      }
      this._loadSamples();
    };
    addEventListener('pointerdown', this._resume);
    addEventListener('keydown', this._resume);
  }
  unlock(){ this._resume(); }   // déblocage EXPLICITE (clic sur le bouton son)

  // Charge les 6 échantillons (asynchrone, dès le déblocage). Tant qu'un son n'est pas prêt
  // on ne joue RIEN pour lui (mieux qu'un son de synthèse moche) ; s'il ÉCHOUE (404/offline),
  // la synthèse B254 prend le relais définitivement.
  _loadSamples(){
    if (this._smpLoading || !this.ctx) return;
    this._smpLoading = true;
    for (const k of Object.keys(SAMPLES)){
      const [name, trim] = SAMPLES[k];
      fetch(new URL('../sons/' + name + '.mp3', import.meta.url))
        .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(ab => this.ctx.decodeAudioData(ab))
        .then(buf => { this._smp[k] = { buf, trim }; })
        .catch(() => { this._smpFail[k] = true; });
    }
  }

  // fadeOut (B256, user : « ça se coupe net ») : fondu de fin programmé sur le gain — les mp3
  // sont des extraits coupés, sans fondu la dernière couche s'arrête d'un coup.
  _play(buf, gain, when = 0, rateJit = 0.10, rateMul = 1, fadeOut = 0){
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const rate = (1 - rateJit/2 + Math.random()*rateJit) * rateMul;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    const t0 = this.ctx.currentTime + Math.max(0, when);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.006);              // micro fade-in anti-clic
    if (fadeOut > 0){
      const dur = buf.duration / rate;
      g.gain.setValueAtTime(gain, t0 + Math.max(0.01, dur - fadeOut));
      g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    }
    src.connect(g).connect(this.master);
    src.onended = () => { try { src.disconnect(); g.disconnect(); } catch(e){} };   // pas de nœuds orphelins pour le GC
    src.start(t0);
  }
  // Joue l'échantillon k s'il est chargé ; sinon synthèse de secours SEULEMENT si le
  // chargement a échoué (pendant le chargement : silence, pas de son moche).
  _shot(k, gain, when, rateJit, rateMul, fallback, fadeOut = 0){
    const s = this._smp[k];
    if (s) return this._play(s.buf, gain * s.trim, when, rateJit, rateMul, fadeOut);
    if (this._smpFail[k] && fallback) this._play(this._pool(k, fallback), gain, when, rateJit, rateMul, fadeOut);
  }
  _pool(name, maker){
    const P = this._pools[name] || (this._pools[name] = []);
    if (P.length === 0) P.push(maker());          // secours : généré au premier besoin
    return P[(Math.random()*P.length)|0];
  }
  _ready(){ return this.enabled && this.ctx && this.ctx.state === 'running'; }
  _norm(d, n){ let mx=0; for (let i=0;i<n;i++){ const a=d[i]<0?-d[i]:d[i]; if (a>mx) mx=a; }
    if (mx>0.99){ const g=0.99/mx; for (let i=0;i<n;i++) d[i]*=g; } }

  // DÉPART DE BOMBE (la chasse, à la sortie du tube) = « Départ de bombe.mp3 ».
  launch(cal, dist){
    if (!this._ready()) return;
    this._shot('launch', 0.60*vol(cal)*att(dist), dly(dist), 0.08, deep(cal), () => this._launchBuffer(), 0.25);
  }

  // EXPLOSION EN L'AIR (toute bombe) = « Bombe 75mm.mp3 » (claquement + boom qui roule + échos,
  // tels quels — le mp3 contient déjà tout).
  breakOpen(cal, dist){
    if (!this._ready()) return;
    this._shot('break', 0.90*vol(cal)*att(dist), dly(dist), 0.09, deep(cal), () => this._breakOpenBuffer(), 0.40);
  }

  // CRACKLING : CHAQUE ÉTOILE crépite (user B255) et le son de chaque vague part de la bombe
  // AU MOMENT VISUEL du crépitement puis voyage (B258, user : « le crépitement arrive dès que
  // je vois l'étoile crépiter » — il doit arriver APRÈS). Timing visuel du moteur : l'effet
  // crackling = pivoine + pistil œuf de dragon qui explose 0,9 -> 1,5 s après le break
  // (cfg crackling.core.crackleAt 0.9, jitter 0.6 — si ça change là-bas, recaler ici).
  crackling(cal, dist){
    if (!this._ready()) return;
    const gB = 0.60*vol(cal)*att(dist), g = 0.85*vol(cal)*att(dist), dp = deep(cal), t = dly(dist), fb = () => this._cracklingBuffer();
    this._shot('break', gB,     t,                            0.09, dp,      () => this._breakOpenBuffer(), 0.40);   // l'ÉCLATEMENT de la pivoine
    this._shot('crack', g,      t + 0.90,                     0.10, dp,      fb, 0.35);   // le pistil crépite (visuel 0,9-1,5 s)
    this._shot('crack', g*0.65, t + 1.35 + Math.random()*0.20, 0.16, dp*1.04, fb, 0.50);
  }

  // ŒUF DE DRAGON — couches calées sur le TIMING VISUEL du moteur (B258) : le CŒUR crépite à
  // ~0,5-0,65 s (cfg dragonEgg.core.crackleAt 0.5), les ÉTOILES explosent entre 1,3 et 1,9 s
  // (cfg crackleStars delay 1.3 jitter 0.6) — chaque vague part de la bombe à son instant
  // visuel PUIS voyage vers la caméra. La rafale du mp3 démarre ~0,2 s après son début
  // -> chaque couche est posée 0,2 s avant l'instant visuel visé.
  dragonEgg(cal, dist){
    if (!this._ready()) return;
    const g = 0.90*vol(cal)*att(dist), dp = deep(cal), t = dly(dist), fb = () => this._dragonEggBuffer();
    this._shot('dragon', g,      t + 0.30,                     0.08, dp,      fb, 0.25);   // cœur : rafale audible à ~t+0,5
    this._shot('dragon', g*0.75, t + 1.10 + Math.random()*0.20, 0.12, dp*1.03, fb, 0.30);   // étoiles : 1,3-1,9 s
    this._shot('dragon', g*0.50, t + 1.50 + Math.random()*0.25, 0.14, dp*0.97, fb, 0.40);
  }

  // Couche de crépitement GÉNÉRIQUE (B262, composés type D8) : posée à `when` (instant VISUEL,
  // en s après le break) + trajet — pour les effets dont les étoiles crépitent tard.
  crackle(cal, dist, when = 0, gainMul = 1){
    if (!this._ready()) return;
    this._shot('crack', 0.85*vol(cal)*att(dist)*gainMul, when + dly(dist), 0.14, deep(cal), () => this._cracklingBuffer(), 0.45);
  }

  // SIFFLET = « Sifflet.mp3 » (pour les réfs « espagnole … sifflet »).
  whistle(when = 0, dist){
    if (!this._ready()) return;
    this._shot('whistle', 0.45*att(dist), when + dly(dist), 0.06, 1, () => this._whistleBuffer(), 0.15);
  }

  // HIBOU = « Hibou.mp3 » (tourbillon hululant, câblé sur l'archétype spinner).
  hibou(when = 0, dist){
    if (!this._ready()) return;
    this._shot('hibou', 0.60*att(dist), when + dly(dist), 0.06, 1, () => this._hibouBuffer(), 0.20);
  }

  // ============================== SYNTHÈSE DE SECOURS ==============================
  // (B254 — ne joue QUE si un mp3 ne charge pas. Recettes recalées sur les réfs user :
  // enveloppe RMS + bandes spectrales + densité de pops + f0. ⚠️ coupures en Hz via K(fc,sr).)

  _launchBuffer(){
    const ctx = this.ctx, sr = ctx.sampleRate, dur = 2.1, n = (sr*dur)|0;
    const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    const kT = K(900, sr), kR = K(190, sr), kH1 = K(2500, sr), kH2 = K(800, sr);
    let lpT = 0, lpR = 0, lpH1 = 0, lpH2 = 0;
    for (let i=0;i<n;i++){
      const t = i/sr, w = Math.random()*2-1;
      lpT += (w - lpT) * kT;
      let v = lpT * Math.exp(-t*38) * 2.2 + w * Math.exp(-t*45) * 0.25
            + Math.sin(2*Math.PI*58*t) * Math.exp(-t*16) * 0.85
            + Math.sin(2*Math.PI*44*t) * Math.exp(-t*11) * 0.45;
      lpR += (w - lpR) * kR;
      const eR = Math.min(1, t/0.05) * (t < 0.30 ? 1 : Math.exp(-(t-0.30)*4.2));
      v += lpR * eR * 0.85;
      lpH1 += (w - lpH1) * kH1; lpH2 += (w - lpH2) * kH2;
      if (t > 0.10) v += (lpH1 - lpH2) * Math.exp(-(t-0.10)*1.6) * 0.10;
      if (t > dur-0.10) v *= (dur-t)/0.10;
      d[i] = v;
    }
    this._norm(d, n);
    return buf;
  }

  _breakOpenBuffer(){
    const ctx = this.ctx, sr = ctx.sampleRate, dur = 3.0, n = (sr*dur)|0;
    const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    const kR = K(190, sr), kE1 = K(115, sr), kE2 = K(70, sr);
    const e1t = 0.72 + Math.random()*0.28, e1a = 0.30 + Math.random()*0.15;
    const e2t = 1.85 + Math.random()*0.35, e2a = 0.55 + Math.random()*0.30;
    let lpR = 0, lpE1 = 0, lpE2 = 0;
    const bump = (t, t0, atk, dec) => t < t0 ? 0 : (t < t0+atk ? (t-t0)/atk : Math.exp(-(t-t0-atk)/dec));
    for (let i=0;i<n;i++){
      const t = i/sr, w = Math.random()*2-1;
      let v = w * Math.exp(-t*75) * 1.0
            + Math.sin(2*Math.PI*180*t) * Math.exp(-t*30) * 0.28;
      lpR += (w - lpR) * kR;
      const eR = bump(t, 0.12, 0.33, 0.9);
      v += lpR * eR * 0.16 + Math.sin(2*Math.PI*62*t) * eR * 0.05;
      lpE1 += (w - lpE1) * kE1;
      v += lpE1 * bump(t, e1t, 0.18, 0.45) * 0.64 * e1a;
      lpE2 += (w - lpE2) * kE2;
      v += lpE2 * bump(t, e2t, 0.22, 0.50) * 1.40 * e2a;
      if (t > dur-0.15) v *= (dur-t)/0.15;
      d[i] = v;
    }
    this._norm(d, n);
    return buf;
  }

  _burst(d, sr, n, t0, t1, densMax, density, ampMul, popMin, popMax){
    let t = t0;
    while (t < t1){
      t += -Math.log(Math.random()+1e-6)/densMax;
      if (t >= t1 || Math.random() > density(t)/densMax) continue;
      const amp = (0.30 + Math.random()*0.5) * ampMul(t);
      const pl = ((popMin + Math.random()*(popMax-popMin))*sr)|0;
      const i0 = (t*sr)|0;
      for (let k=0;k<pl && i0+k<n;k++){ const e=Math.exp(-(k/pl)*5);
        d[i0+k] += (Math.random()*2-1) * e * amp; }
    }
  }

  _cracklingBuffer(){
    const ctx = this.ctx, sr = ctx.sampleRate, dur = 1.4, n = (sr*dur)|0;
    const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    const kB = K(460, sr);
    let lp = 0;
    for (let i=0;i<(sr*0.10)|0;i++){ const t=i/sr, w=Math.random()*2-1;
      lp += (w - lp) * kB;
      d[i] += (w*0.25 + lp*2.0) * Math.exp(-t*40); }
    this._burst(d, sr, n, 0.02, 1.05, 260,
      t => t<0.28 ? 260*Math.pow(t/0.28,3) : (t<0.62 ? 260 : 260*Math.exp(-(t-0.62)/0.10)),
      t => 1 - 0.45*Math.min(1, t/1.0), 0.0008, 0.0018);
    this._norm(d, n);
    return buf;
  }

  _dragonEggBuffer(){
    const ctx = this.ctx, sr = ctx.sampleRate, dur = 1.4, n = (sr*dur)|0;
    const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    const kA = K(800, sr), kB2 = K(200, sr);
    let lpA = 0, lpB = 0;
    for (let i=0;i<(sr*0.12)|0;i++){ const t=i/sr, w=Math.random()*2-1;
      lpA += (w - lpA) * kA; lpB += (w - lpB) * kB2;
      d[i] += (lpA - lpB) * Math.exp(-t*30) * 2.2; }
    this._burst(d, sr, n, 0.18, 0.95, 150,
      t => 150 * Math.pow(Math.max(0, Math.sin(Math.PI*(t-0.18)/0.75)), 1.2),
      t => 1 - 0.35*Math.min(1, (t-0.18)/0.8), 0.0006, 0.0018);
    this._norm(d, n);
    return buf;
  }

  _whistleBuffer(){
    const ctx = this.ctx, sr = ctx.sampleRate, dur = 1.9, n = (sr*dur)|0;
    const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    const kP = K(380, sr);
    let f = 3850, ph = 0, lp = 0;
    const step = (sr*0.02)|0;
    for (let i=0;i<n;i++){
      const t = i/sr, w = Math.random()*2-1;
      if (i % step === 0){ f += (Math.random()-0.5)*60; if (f<3600) f=3600; if (f>4050) f=4050; }
      ph += 2*Math.PI*f/sr;
      const atk = Math.min(1, t/0.06);
      const rel = t < 1.55 ? 1 : Math.exp(-(t-1.55)/0.09);
      const trem = 0.88 + 0.12*Math.sin(2*Math.PI*6.5*t);
      let v = (Math.sin(ph) + Math.sin(2*ph)*0.13) * atk * rel * trem * 0.55;
      v += w * 0.035 * atk * rel;
      lp += (w - lp) * kP;
      v += lp * Math.exp(-t*30) * 0.9;
      if (t > dur-0.10) v *= (dur-t)/0.10;
      d[i] = v;
    }
    this._norm(d, n);
    return buf;
  }

  _hibouBuffer(){
    const ctx = this.ctx, sr = ctx.sampleRate, dur = 1.9, n = (sr*dur)|0;
    const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    let ph = 0; const phi = Math.random()*Math.PI*2;
    for (let i=0;i<n;i++){
      const t = i/sr, w = Math.random()*2-1;
      const rise = Math.min(1, t/0.35);
      const wob = Math.sin(2*Math.PI*1.35*t + phi);
      const f = 640 + 200*rise + (110*wob + 30*Math.sin(2*Math.PI*3.1*t)) * rise;
      ph += 2*Math.PI*f/sr;
      const atk = Math.min(1, t/0.35);
      const rel = t < 1.30 ? 1 : Math.exp(-(t-1.30)/0.14);
      const trem = 0.80 + 0.20*wob;
      let v = (Math.sin(ph) + Math.sin(2*ph)*0.30 + Math.sin(3*ph)*0.12) * atk * rel * trem * 0.55;
      v += w * 0.02 * atk * rel;
      if (t > dur-0.10) v *= (dur-t)/0.10;
      d[i] = v;
    }
    this._norm(d, n);
    return buf;
  }

  // MARRON D'AIR (B154, SYNTHÈSE conservée — validée ; pas de mp3 fourni) : DÉTONATION,
  // 3 couches : CLAQUEMENT bref large bande + BASSE (52 Hz + sub 38 Hz) + GRONDEMENT passe-bas.
  _marronBuffer(){
    const ctx = this.ctx, sr = ctx.sampleRate, dur = 1.5, n = (sr*dur)|0;
    const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    const cn = (sr*0.010)|0;
    for (let i=0;i<cn;i++){ const e=Math.exp(-(i/cn)*4);
      d[i] += (Math.random()*2-1) * e * 1.0; }
    const tn = (sr*0.7)|0;
    for (let i=0;i<tn;i++){ const t=i/sr, e=Math.exp(-t*7);
      d[i] += (Math.sin(2*Math.PI*52*t)*0.85 + Math.sin(2*Math.PI*38*t)*0.55) * e; }
    const kG = K(470, sr);                                         // = l'ancien coeff 0.06 à 48 kHz (validé)
    let lp=0;
    for (let i=0;i<n;i++){ const t=i/sr, e=Math.exp(-t*3.0);
      lp += ((Math.random()*2-1) - lp) * kG;
      d[i] += lp * e * 1.1; }
    this._norm(d, n);
    return buf;
  }

  // when = délai en secondes (les marrons du MULTI détonent décalés). gain fort (×1.25 vs bombe).
  marron(when = 0, dist){
    if (!this._ready()) return;
    this._play(this._pool('marron', () => this._marronBuffer()), 1.25*att(dist), when + dly(dist), 0.08, 1, 0.20);
  }
}
