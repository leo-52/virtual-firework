// Sons pyro SYNTHÉTISÉS (Web Audio) — 100% originaux, aucun fichier/licence.
// B254 : TOUT recalé sur les 6 enregistrements de référence de l'user (inspiration/sons/,
// analyse enveloppe RMS + bandes spectrales + densité de pops + suivi de f0) :
//   launch      <- « Départ de bombe »  : THUMP sourd + roulement ~1,7 s + souffle de montée
//   breakOpen   <- « Bombe 75mm »       : CLAQUEMENT ultra-bref (-30 dB en 60 ms) puis roulement
//                                         grave qui ENFLE après coup (+0,45 s) + ÉCHO tardif ~+2 s
//   crackling   <- « Crackling »        : ~100 pops en 1 s (pic ~200/s à 0,25-0,6 s), médium/aigu
//   dragonEgg   <- « Oeuf de dragon »   : break ÉTOUFFÉ (bande ~200-800 Hz) + rafale retardée
//                                         ~0,2 s, ~55 pops sur 0,8 s — bien plus court qu'avant
//   whistle     <- « Sifflet »          : sifflement tenu ~1,5 s à ~3 850 Hz ±100 (marche aléatoire)
//   hibou       <- « Hibou »            : hululement ~820 Hz qui ondule ±110 Hz (période ~0,7 s)
// Revue adversariale B254 : POOL de variantes pré-générées au déblocage (générer un buffer de
// 3 s dans onBurst gelait la frame ~15-90 ms, pile au moment du break) ; LIMITEUR sur le bus
// master (les salves de compacts / multi-marrons écrêtaient en polyphonie) ; sons CALIBRÉS
// (une bombette 30 mm de compact ne claque pas comme une 75) ; fondu de fin anti-clic.
// ⚠️ Les passe-bas 1 pôle utilisent des COUPURES EN Hz (K(fc)) — un coefficient brut dépendrait
// du sampleRate (48 kHz navigateur vs 24 kHz du banc de test = coupures doublées).
// L'audio ne démarre qu'après une interaction (politique navigateur) -> 1er clic/touche = activation.

const K = (fc, sr) => 1 - Math.exp(-2*Math.PI*fc/sr);   // coeff passe-bas 1 pôle pour une coupure fc
const vol  = c => Math.min(1.6, Math.max(0.30, Math.pow((c||75)/75, 0.9)));    // gain par calibre
const deep = c => Math.min(1.20, Math.max(0.85, Math.pow(75/(c||75), 0.12)));  // gros calibre = + grave

export class PyroAudio {
  constructor(){
    this.ctx = null; this.master = null;
    this.enabled = true;   // B169 : coupé/activé par le bouton son (indépendant du déblocage navigateur)
    this._pools = {}; this._warmQueue = null;
    this._resume = () => {
      if (!this.ctx){
        try {
          this.ctx = new (window.AudioContext || window.webkitAudioContext)();
          this.master = this.ctx.createGain(); this.master.gain.value = 0.7;
          // LIMITEUR (revue B254) : compacts = salves de 5, multi-marron = 5 booms ±0,7 s —
          // sans headroom la somme dépasse [-1,1] et le navigateur écrête DUR. Réglé en
          // limiteur (seuil haut, ratio fort) : un son seul passe quasi intact.
          const lim = this.ctx.createDynamicsCompressor();
          lim.threshold.value = -6; lim.knee.value = 4; lim.ratio.value = 12;
          lim.attack.value = 0.002; lim.release.value = 0.25;
          this.master.connect(lim); lim.connect(this.ctx.destination);
        } catch(e){ /* pas d'audio dispo */ }
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      this._prewarm();
    };
    addEventListener('pointerdown', this._resume);
    addEventListener('keydown', this._resume);
  }
  unlock(){ this._resume(); }   // déblocage EXPLICITE (clic sur le bouton son)

  // Pré-génère les variantes de buffers UNE PAR TICK (~60 ms d'écart) dès le déblocage :
  // aucune génération ne tombe plus dans la boucle de rendu au moment d'un tir (revue B254 :
  // _breakOpenBuffer ~15 ms desktop / 45-90 ms estimés mobile = frames perdues à chaque burst).
  _prewarm(){
    if (this._warmQueue !== null || !this.ctx) return;
    const jobs = [ ['launch', () => this._launchBuffer(), 2],
                   ['break',  () => this._breakOpenBuffer(), 4],
                   ['crack',  () => this._cracklingBuffer(), 2],
                   ['dragon', () => this._dragonEggBuffer(), 2],
                   ['marron', () => this._marronBuffer(), 1],
                   ['hibou',  () => this._hibouBuffer(), 2],
                   ['whistle',() => this._whistleBuffer(), 2] ];
    this._warmQueue = [];
    for (const [name, maker, k] of jobs) for (let i=0;i<k;i++) this._warmQueue.push([name, maker]);
    const step = () => {
      const j = this._warmQueue.shift();
      if (!j) return;
      (this._pools[j[0]] || (this._pools[j[0]] = [])).push(j[1]());
      setTimeout(step, 60);
    };
    setTimeout(step, 80);
  }
  _pool(name, maker){
    const P = this._pools[name] || (this._pools[name] = []);
    if (P.length === 0) P.push(maker());          // secours (tir avant la fin du prewarm)
    return P[(Math.random()*P.length)|0];
  }

  _play(buf, gain, when = 0, rateJit = 0.10, rateMul = 1){
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = (1 - rateJit/2 + Math.random()*rateJit) * rateMul;
    const g = this.ctx.createGain(); g.gain.value = gain;
    src.connect(g).connect(this.master);
    src.onended = () => { try { src.disconnect(); g.disconnect(); } catch(e){} };   // pas de nœuds orphelins pour le GC
    src.start(this.ctx.currentTime + Math.max(0, when));
  }
  _ready(){ return this.enabled && this.ctx && this.ctx.state === 'running'; }
  _norm(d, n){ let mx=0; for (let i=0;i<n;i++){ const a=d[i]<0?-d[i]:d[i]; if (a>mx) mx=a; }
    if (mx>0.99){ const g=0.99/mx; for (let i=0;i<n;i++) d[i]*=g; } }

  // DÉPART DE BOMBE (la chasse, à la sortie du tube). Réf : pic sourd (sub+basses mais pas
  // étouffé), PLATEAU ~0,25-0,30 s à -16 dB rel pic, chute rapide (-39 dB à ~+0,95 s), et un
  // SOUFFLE médium ~800-2500 Hz discret (la bombe qui monte) qui traîne derrière.
  _launchBuffer(){
    const ctx = this.ctx, sr = ctx.sampleRate, dur = 2.1, n = (sr*dur)|0;
    const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    const kT = K(900, sr), kR = K(190, sr), kH1 = K(2500, sr), kH2 = K(800, sr);
    let lpT = 0, lpR = 0, lpH1 = 0, lpH2 = 0;
    for (let i=0;i<n;i++){
      const t = i/sr, w = Math.random()*2-1;
      // 1) THUMP : bruit passe-bas costaud + un peu de large bande + 58 Hz + sub 44 Hz
      lpT += (w - lpT) * kT;
      let v = lpT * Math.exp(-t*38) * 2.2 + w * Math.exp(-t*45) * 0.25
            + Math.sin(2*Math.PI*58*t) * Math.exp(-t*16) * 0.85
            + Math.sin(2*Math.PI*44*t) * Math.exp(-t*11) * 0.45;
      // 2) ROULEMENT : plateau jusqu'à ~0,30 s puis chute rapide (mesuré : -39 dB à +0,95 s)
      lpR += (w - lpR) * kR;
      const eR = Math.min(1, t/0.05) * (t < 0.30 ? 1 : Math.exp(-(t-0.30)*4.2));
      v += lpR * eR * 0.85;
      // 3) SOUFFLE de montée : bande ~800-2500 Hz discrète, décroissance lente (τ ~0,6 s)
      lpH1 += (w - lpH1) * kH1; lpH2 += (w - lpH2) * kH2;
      if (t > 0.10) v += (lpH1 - lpH2) * Math.exp(-(t-0.10)*1.6) * 0.10;
      if (t > dur-0.10) v *= (dur-t)/0.10;                         // anti-clic de fin
      d[i] = v;
    }
    this._norm(d, n);
    return buf;
  }
  launch(cal){
    if (!this._ready()) return;
    this._play(this._pool('launch', () => this._launchBuffer()), 0.55*vol(cal), 0, 0.14, deep(cal));
  }

  // EXPLOSION EN L'AIR (toute bombe). Réf « Bombe 75mm » : CLAQUEMENT large bande ultra-bref
  // (-30 dB en ~60 ms), le roulement grave ENFLE APRÈS COUP (pic ~-23 dB vers +0,45 s — le boom
  // « arrive » du paysage), redescend vers -28 dB, puis ÉCHO grave tardif vers +2 s (~-20 dB).
  // 4 variantes en pool (délais/amplitudes d'échos différents) + jitter de vitesse par tir.
  _breakOpenBuffer(){
    const ctx = this.ctx, sr = ctx.sampleRate, dur = 3.0, n = (sr*dur)|0;
    const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    const kR = K(190, sr), kE1 = K(115, sr), kE2 = K(70, sr);
    const e1t = 0.72 + Math.random()*0.28, e1a = 0.30 + Math.random()*0.15;   // écho 1 (proche)
    const e2t = 1.85 + Math.random()*0.35, e2a = 0.55 + Math.random()*0.30;   // écho 2 (lointain, + grave)
    let lpR = 0, lpE1 = 0, lpE2 = 0;
    const bump = (t, t0, atk, dec) => t < t0 ? 0 : (t < t0+atk ? (t-t0)/atk : Math.exp(-(t-t0-atk)/dec));
    for (let i=0;i<n;i++){
      const t = i/sr, w = Math.random()*2-1;
      // 1) CLAQUEMENT : bruit blanc plein pot, -30 dB en ~70 ms + corps médium très bref
      let v = w * Math.exp(-t*75) * 1.0
            + Math.sin(2*Math.PI*180*t) * Math.exp(-t*30) * 0.28;
      // 2) ROULEMENT qui ENFLE : bruit passe-bas ~190 Hz, monte de +0,12 à +0,45 s puis τ ~0,9 s
      lpR += (w - lpR) * kR;
      const eR = bump(t, 0.12, 0.33, 0.9);
      v += lpR * eR * 0.16 + Math.sin(2*Math.PI*62*t) * eR * 0.05;
      // 3) ÉCHOS : bosses graves de plus en plus filtrées
      lpE1 += (w - lpE1) * kE1;
      v += lpE1 * bump(t, e1t, 0.18, 0.45) * 0.64 * e1a;
      lpE2 += (w - lpE2) * kE2;
      v += lpE2 * bump(t, e2t, 0.22, 0.50) * 1.40 * e2a;
      if (t > dur-0.15) v *= (dur-t)/0.15;                         // anti-clic : l'écho 2 était tronqué net
      d[i] = v;
    }
    this._norm(d, n);
    return buf;
  }
  breakOpen(cal){
    if (!this._ready()) return;
    this._play(this._pool('break', () => this._breakOpenBuffer()), 0.85*vol(cal), 0, 0.10, deep(cal));
  }

  // RAFALE de pops (partagée crackling / œuf de dragon) — processus de Poisson par AMINCISSEMENT
  // (tirage au max de densité puis acceptation à density(t)/densMax : une densité qui part de 0
  // ne fait plus sauter toute la fenêtre, bug du 1er jet B254).
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

  // CRACKLING (bombe crépitante). Réf : break immédiat (tilté bas) puis ~100 pops en 1 s —
  // densité en cloche raide : montée cubique vers ~260/s à 0,28 s, plateau jusqu'à 0,62 s,
  // chute rapide (τ ~0,10 s), fini vers 1,05 s. Pops médium/aigu.
  _cracklingBuffer(){
    const ctx = this.ctx, sr = ctx.sampleRate, dur = 1.4, n = (sr*dur)|0;
    const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    const kB = K(460, sr);
    let lp = 0;                                                    // break d'ouverture, tilté bas
    for (let i=0;i<(sr*0.10)|0;i++){ const t=i/sr, w=Math.random()*2-1;
      lp += (w - lp) * kB;
      d[i] += (w*0.25 + lp*2.0) * Math.exp(-t*40); }
    this._burst(d, sr, n, 0.02, 1.05, 260,
      t => t<0.28 ? 260*Math.pow(t/0.28,3) : (t<0.62 ? 260 : 260*Math.exp(-(t-0.62)/0.10)),
      t => 1 - 0.45*Math.min(1, t/1.0), 0.0008, 0.0018);
    this._norm(d, n);
    return buf;
  }
  crackling(cal){
    if (!this._ready()) return;
    this._play(this._pool('crack', () => this._cracklingBuffer()), 0.85*vol(cal), 0, 0.08, deep(cal));
  }

  // ŒUF DE DRAGON. Réf : break ÉTOUFFÉ (bande ~200-800 Hz — revue B254 : K(800)-K(200), les
  // anciennes coupures donnaient ~85-380 Hz, une octave trop bas) puis rafale RETARDÉE ~0,2 s,
  // ~55 pops sur 0,8 s (pic ~150/s vers 0,45-0,65 s), fini à ~1,0 s.
  _dragonEggBuffer(){
    const ctx = this.ctx, sr = ctx.sampleRate, dur = 1.4, n = (sr*dur)|0;
    const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    const kA = K(800, sr), kB2 = K(200, sr);
    let lpA = 0, lpB = 0;                                          // break étouffé : bande ~200-800 Hz
    for (let i=0;i<(sr*0.12)|0;i++){ const t=i/sr, w=Math.random()*2-1;
      lpA += (w - lpA) * kA; lpB += (w - lpB) * kB2;
      d[i] += (lpA - lpB) * Math.exp(-t*30) * 2.2; }
    this._burst(d, sr, n, 0.18, 0.95, 150,
      t => 150 * Math.pow(Math.max(0, Math.sin(Math.PI*(t-0.18)/0.75)), 1.2),
      t => 1 - 0.35*Math.min(1, (t-0.18)/0.8), 0.0006, 0.0018);
    this._norm(d, n);
    return buf;
  }
  dragonEgg(cal){
    if (!this._ready()) return;
    this._play(this._pool('dragon', () => this._dragonEggBuffer()), 0.9*vol(cal), 0, 0.08, deep(cal));
  }

  // SIFFLET (fusée sifflante — pour les réfs « espagnole … sifflet »). Réf : petit départ sourd
  // puis sifflement TENU ~1,5 s à ~3 850 Hz qui vague de ±100 Hz (marche aléatoire), fin nette.
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
      v += w * 0.035 * atk * rel;                                  // souffle
      lp += (w - lp) * kP;                                         // petit départ sourd
      v += lp * Math.exp(-t*30) * 0.9;
      if (t > dur-0.10) v *= (dur-t)/0.10;                         // anti-clic de fin
      d[i] = v;
    }
    this._norm(d, n);
    return buf;
  }
  whistle(when = 0){
    if (!this._ready()) return;
    this._play(this._pool('whistle', () => this._whistleBuffer()), 0.5, when, 0.06);
  }

  // HIBOU (tourbillon hululant). Réf : monte de ~640 à ~940 Hz en 0,35 s puis ONDULE autour de
  // ~820 Hz (±110 Hz, période ~0,7 s), gonfle jusqu'à ~0,9 s, tient, s'éteint vite après ~1,3 s.
  // Timbre « hou-hou » : fondamentale + harmoniques discrètes, trémolo calé sur l'ondulation.
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
      v += w * 0.02 * atk * rel;                                   // souffle léger
      if (t > dur-0.10) v *= (dur-t)/0.10;                         // anti-clic de fin
      d[i] = v;
    }
    this._norm(d, n);
    return buf;
  }
  hibou(when = 0){
    if (!this._ready()) return;
    this._play(this._pool('hibou', () => this._hibouBuffer()), 0.6, when, 0.06);
  }

  // MARRON D'AIR (B154, inchangé — validé) : DÉTONATION — l'effet EST le bruit (réf UE : plus
  // fort qu'une bombe classique, pitch BAS, ça RÉSONNE). 3 couches : CLAQUEMENT bref large bande
  // + COUP DE BASSE (~52 Hz + sub 38 Hz) + GRONDEMENT grave qui traîne (bruit passe-bas ~1,2 s).
  _marronBuffer(){
    const ctx = this.ctx, sr = ctx.sampleRate, dur = 1.5, n = (sr*dur)|0;
    const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    const cn = (sr*0.010)|0;                                       // 1) CLAQUEMENT : 10 ms plein pot
    for (let i=0;i<cn;i++){ const e=Math.exp(-(i/cn)*4);
      d[i] += (Math.random()*2-1) * e * 1.0; }
    const tn = (sr*0.7)|0;                                         // 2) BASSE : 52 Hz + sub 38 Hz
    for (let i=0;i<tn;i++){ const t=i/sr, e=Math.exp(-t*7);
      d[i] += (Math.sin(2*Math.PI*52*t)*0.85 + Math.sin(2*Math.PI*38*t)*0.55) * e; }
    const kG = K(470, sr);                                         // = l'ancien coeff 0.06 à 48 kHz (validé)
    let lp=0;                                                      // 3) GRONDEMENT : bruit passe-bas 1 pôle
    for (let i=0;i<n;i++){ const t=i/sr, e=Math.exp(-t*3.0);
      lp += ((Math.random()*2-1) - lp) * kG;
      d[i] += lp * e * 1.1; }
    this._norm(d, n);
    return buf;
  }

  // when = délai en secondes (les 4 marrons du MULTI détonent décalés). gain fort (×1.25 vs bombe).
  marron(when = 0){
    if (!this._ready()) return;
    this._play(this._pool('marron', () => this._marronBuffer()), 1.25, when, 0.08);
  }
}
