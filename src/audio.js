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
//
// B391 (user : « des fois ça bug, je n'ai pas de son ») — causes trouvées et corrigées :
//  1. `enabled = false` par défaut (B265) : la page démarrait MUETTE, le bouton affichait « Son OFF »
//     et il fallait penser à cliquer. Désormais ON par défaut ; le choix de l'user est mémorisé
//     (localStorage « pfx_son ») : s'il coupe, ça reste coupé d'une visite à l'autre.
//  2. `_ready()` exigeait ctx.state === 'running' : juste après le 1er geste, resume() est
//     ASYNCHRONE -> le tir déclenché dans le même geste (barre espace, clic) partait dans le vide.
//     Même chose au retour d'onglet / après un appel sur iPhone (état 'interrupted') : silence
//     jusqu'au prochain geste. Désormais : les sons tirés pendant une reprise sont mis en
//     ATTENTE (≤ 0,8 s) et joués dès que le contexte tourne ; reprise aussi sur visibilitychange,
//     focus, pageshow et onstatechange ; un contexte 'closed' est recréé.
//  3. Les mp3 n'étaient téléchargés qu'APRÈS le 1er geste (décodage compris) : sur une liaison
//     lente, les premières bombes étaient muettes (silence par conception tant qu'un son n'est
//     pas prêt). Désormais : téléchargement dès le chargement de la page, décodage au 1er geste,
//     un son demandé pendant le décodage attend (≤ 0,8 s) au lieu d'être perdu ; si le fichier
//     ne charge pas (hors ligne, cache), la synthèse de secours prend le relais tout de suite.
//  4. L'URL des mp3 ne portait pas le ?v= anti-cache : ajouté (un mp3 remplacé est bien rechargé).
// B391 — RENDU (user : « même le son [plus beau/réaliste] ») sans toucher aux enregistrements :
//  - PANORAMIQUE stéréo léger selon la position de la bombe dans le champ de la caméra ;
//  - ABSORPTION DE L'AIR : passe-bas qui descend avec la distance (de loin, un boom est sourd) ;
//  - RÉVERBÉRATION de plein air courte (réponse impulsionnelle synthétique, réflexions
//    précoces + queue ~1,5 s), dosée par la distance (de près : sec ; de loin : enveloppé) ;
//  - GROS CALIBRES : une couche grave (≥ 100 mm) sous l'éclatement et le marron.
//  Le retard de propagation (343 m/s, B256) et le volume maître (0,5, B256 « trop fort ») sont
//  inchangés. ?son=ancien dans l'adresse = rendu d'avant (sans ces 4 ajouts).

const K = (fc, sr) => 1 - Math.exp(-2*Math.PI*fc/sr);   // coeff passe-bas 1 pôle pour une coupure fc
const vol  = c => Math.min(1.6, Math.max(0.30, Math.pow((c||75)/75, 0.9)));    // gain par calibre
const deep = c => Math.min(1.20, Math.max(0.85, Math.pow(75/(c||75), 0.12)));  // gros calibre = + grave
// DISTANCE caméra -> bombe (B256, user : « adapter le son selon la distance ») :
// loi en 1/d, référence 150 m (la vue public par défaut) ; et le son ARRIVE en retard (343 m/s)
// -> à la vue par défaut le boom claque ~0,5 s après le flash, comme en vrai.
const att = d => Math.max(0.03, Math.min(1.8, 150/Math.max(d||150, 25)));
const dly = d => d ? d/343 : 0;
// B391 : absorption de l'air = coupure du passe-bas selon la distance (m). 50 m : ~14,6 kHz
// (rien d'audible), 150 m : ~11,5 kHz, 300 m : ~8 kHz, 600 m : ~4 kHz, ≥ 1 km : 1,5 kHz.
const airFc = d => Math.max(1500, 15000 * Math.exp(-Math.max(0, (d||150) - 40) / 420));
// B391 : part de réverbération selon la distance (0,08 de près -> 0,55 à 500 m et au-delà).
const wetOf = d => Math.max(0.08, Math.min(0.55, ((d||150) - 30) / 400));

const _QS = (typeof location !== 'undefined' && location.search) || '';
const SON_ANCIEN = /[?&]son=ancien\b/.test(_QS);   // rendu B263 : ni panoramique, ni réverb, ni absorption, ni grave
const PREF = 'pfx_son';                             // choix de l'user (« 0 » = coupé), mémorisé
const _V = new URL(import.meta.url).search;         // « ?v=… » anti-cache d'index.html, propagé aux mp3
const MP3_URL = name => new URL('../sons/' + name + '.mp3' + _V, import.meta.url);

// [fichier web/sons/<n>.mp3, gain de normalisation (pics mesurés : oeuf 0.20, sifflet 0.11)]
const SAMPLES = {
  launch:  ['depart',    0.78],
  break:   ['bombe75',   0.88],
  crack:   ['crackling', 1.25],
  dragon:  ['oeuf',      3.50],
  whistle: ['sifflet',   3.50],
  hibou:   ['hibou',     1.17],
  marron:  ['marron',    0.64],   // B263 : « marron d'air ok » de l'user (boom + roulement ~4 s, pic 1.40)
};
const ATTENTE_MAX = 0.8;   // s : un son tiré pendant une reprise / un décodage attend au plus ça, puis est abandonné

// PANORAMIQUE (B391) : position d'un point du monde dans le champ d'une caméra three.js -> −1 (à
// gauche) … +1 (à droite). Se contente de la matrice monde->caméra (mise à jour à chaque rendu).
export function panDepuisCamera(cam, x, y, z){
  try {
    const e = cam.matrixWorldInverse.elements;
    const xc = e[0]*x + e[4]*y + e[8]*z + e[12], zc = e[2]*x + e[6]*y + e[10]*z + e[14];
    if (zc > -0.5) return 0;                                   // derrière ou au ras de la caméra : centré
    const demi = Math.atan(Math.tan((cam.fov||50) * Math.PI/360) * (cam.aspect||1.6));   // demi-champ horizontal
    return Math.max(-1, Math.min(1, Math.atan2(xc, -zc) / demi));
  } catch(e){ return 0; }
}

export class PyroAudio {
  constructor(){
    this.ctx = null; this.master = null; this.reverb = null;
    let pref = null; try { pref = localStorage.getItem(PREF); } catch(e){}
    this.enabled = pref !== '0';      // B391 : ON par défaut (B265 l'avait mis OFF) ; le choix de l'user est gardé
    this.onStatus = null;             // rappel UI (bouton) à chaque changement d'état
    this._pools = {}; this._smp = {}; this._smpFail = {}; this._abuf = {}; this._decoding = {};
    this._queue = [];
    this._prefetch();                 // les mp3 se téléchargent dès maintenant (pas besoin de contexte audio)
    this._resume = () => {
      if (this.ctx && this.ctx.state === 'closed') this.ctx = null;   // contexte fermé (Safari, mémoire) : on en refait un
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
          if (!SON_ANCIEN){                       // B391 : bus de réverbération de plein air
            try { this.reverb = this.ctx.createConvolver(); this.reverb.buffer = this._irBuffer(); this.reverb.connect(this.master); }
            catch(e){ this.reverb = null; }
          }
          this.ctx.onstatechange = () => { this._status(); if (this.ctx && this.ctx.state === 'running') this._flush(); };
          this._decodeAll();
        } catch(e){ /* pas d'audio dispo */ }
      }
      this._wake();
      // B261 (user : « pas de son SANS écouteurs, avec écouteurs ça marche ») = iOS : le
      // COMMUTATEUR SILENCIEUX coupe le Web Audio sur haut-parleur (pas sur écouteurs).
      // Parade double : 1) API audioSession (iOS 16.4+) -> catégorie « lecture » qui ignore
      // le commutateur ; 2) un <audio> SILENCIEUX en boucle lancé au 1er geste (même effet
      // sur les iOS plus vieux — l'astuce standard des jeux web).
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch(e){}
      if (!this._iosKick){
        try {
          const a = document.createElement('audio');
          a.loop = true; a.playsInline = true; a.setAttribute('playsinline',''); a.preload = 'auto'; a.volume = 0.01;
          a.src = 'data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YVAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
          this._iosKick = a;
        } catch(e){}
      }
      if (this._iosKick && this._iosKick.paused) this._iosKick.play().catch(()=>{});   // relancé à CHAQUE geste (un play() refusé une fois ne condamne plus le haut-parleur)
      this._status();
    };
    // capture:true -> on passe AVANT les écouteurs de la page (barre espace, bouton « tirer ») :
    // le contexte est créé et la reprise lancée avant que le tir ne demande son son.
    addEventListener('pointerdown', this._resume, { capture: true });
    addEventListener('keydown', this._resume, { capture: true });
    // B391 : retour d'onglet, de veille, d'appel : on relance sans attendre un geste
    try {
      document.addEventListener('visibilitychange', () => { if (!document.hidden) this._wake(); });
      addEventListener('focus', () => this._wake());
      addEventListener('pageshow', () => this._wake());
    } catch(e){}
  }
  unlock(){ this._resume(); }   // déblocage EXPLICITE (clic sur le bouton son)
  // B391 : (re)met le contexte en marche s'il ne tourne pas ('suspended' / 'interrupted' iOS)
  _wake(){
    if (!this.ctx) return;
    if (this.ctx.state !== 'running' && this.ctx.state !== 'closed'){
      try { const p = this.ctx.resume(); if (p && p.then) p.then(() => this._flush(), () => {}); } catch(e){}
    }
    if (this._iosKick && this._iosKick.paused) this._iosKick.play().catch(()=>{});
  }
  // mémorise le choix de l'user (bouton son)
  setEnabled(on){ this.enabled = !!on; try { localStorage.setItem(PREF, on ? '1' : '0'); } catch(e){} this._status(); }
  // État lisible par l'interface : 'off' | 'attente' (aucun geste encore) | 'chargement' | 'pret' | 'secours'
  status(){
    if (!this.enabled) return 'off';
    if (!this.ctx) return 'attente';
    const ks = Object.keys(SAMPLES);
    if (ks.every(k => this._smp[k])) return 'pret';
    if (ks.some(k => this._smpFail[k]) && ks.every(k => this._smp[k] || this._smpFail[k])) return 'secours';
    return 'chargement';
  }
  _status(){ if (this.onStatus) { try { this.onStatus(this.status()); } catch(e){} } }

  // B391 : téléchargement des 7 échantillons dès le chargement (fetch ne demande aucun geste) ;
  // le décodage, lui, attend le contexte audio (1er geste). En cas d'échec (404, hors ligne) :
  // la synthèse B254 prend le relais pour ce son, tout de suite.
  _prefetch(){
    for (const k of Object.keys(SAMPLES)){
      const [name] = SAMPLES[k];
      let src; try { src = MP3_URL(name); } catch(e){ this._smpFail[k] = true; continue; }
      if (src && typeof src.byteLength === 'number'){ this._abuf[k] = src; continue; }   // déjà en mémoire (simu 3D : mp3 embarqués)
      fetch(src)
        .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(ab => { this._abuf[k] = ab; if (this.ctx) this._decodeOne(k); })
        .catch(() => { this._smpFail[k] = true; this._flush(); this._status(); });
    }
  }
  _decodeAll(){ for (const k of Object.keys(this._abuf)) this._decodeOne(k); }
  _decodeOne(k){
    if (!this.ctx || this._smp[k] || this._decoding[k] || !this._abuf[k]) return;
    this._decoding[k] = true;
    const trim = SAMPLES[k][1];
    const fini = () => { this._decoding[k] = false; this._flush(); this._status(); };
    try {
      // copie : decodeAudioData DÉTACHE le tampon (un 2e décodage, après un contexte fermé, le retrouve vide sinon)
      const p = this.ctx.decodeAudioData(this._abuf[k].slice(0), buf => { this._smp[k] = { buf, trim }; fini(); }, () => { this._smpFail[k] = true; fini(); });
      if (p && p.then) p.then(buf => { if (!this._smp[k]) { this._smp[k] = { buf, trim }; fini(); } }, () => { if (!this._smp[k]) { this._smpFail[k] = true; fini(); } });
    } catch(e){ this._smpFail[k] = true; fini(); }
  }

  // B391 : FILE D'ATTENTE des sons demandés pendant une reprise ou un décodage : joués dès que
  // possible, avec leur retard de propagation réduit du temps déjà perdu ; abandonnés au-delà de
  // ATTENTE_MAX (un boom qui arrive une seconde après l'éclair serait faux).
  _enqueue(go, k){
    this._queue.push({ go, k, t: performance.now() });
    if (this._queue.length > 32) this._queue.shift();
  }
  _flush(){
    if (!this._queue.length) return;
    const now = performance.now(), reste = [];
    for (const it of this._queue){
      const e = (now - it.t) / 1000;
      if (e > ATTENTE_MAX) continue;                                         // trop tard : abandonné
      const pret = !it.k || this._smp[it.k] || this._smpFail[it.k];
      if (this.ctx && this.ctx.state === 'running' && pret) { try { it.go(e); } catch(err){} }
      else reste.push(it);
    }
    this._queue = reste;
  }

  // fadeOut (B256, user : « ça se coupe net ») : fondu de fin programmé sur le gain — les mp3
  // sont des extraits coupés, sans fondu la dernière couche s'arrête d'un coup.
  // muffle (B356, user : « une chandelle 10 mm et une bombe 75 mm, ce n'est pas du tout le même
  // bruit — moins fort et plus étouffé ») : passe-bas optionnel, en Hz. Un petit tube ne claque
  // pas, il fait un « pouf » sourd : c'est le HAUT du spectre qu'il faut enlever, pas seulement
  // baisser le volume.
  // ou (B391) : { dist, pan } -> absorption de l'air, panoramique et part de réverbération.
  _play(buf, gain, when = 0, rateJit = 0.10, rateMul = 1, fadeOut = 0, muffle = 0, ou = null){
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
    const noeuds = [src, g];
    // passe-bas : le plus bas de « étouffé » (muffle) et « absorption de l'air » (distance)
    let fc = muffle > 0 ? muffle : 0;
    if (!SON_ANCIEN && ou && ou.dist){ const fa = airFc(ou.dist); fc = fc > 0 ? Math.min(fc, fa) : (fa < 14000 ? fa : 0); }
    let tete = src;
    if (fc > 0){
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.value = fc; lp.Q.value = 0.5;
      tete.connect(lp); tete = lp; noeuds.push(lp);
    }
    tete.connect(g); tete = g;
    if (!SON_ANCIEN && ou && ou.pan && this.ctx.createStereoPanner){
      const pan = this.ctx.createStereoPanner(); pan.pan.value = Math.max(-1, Math.min(1, ou.pan)) * 0.7;   // léger : on reste large
      tete.connect(pan); tete = pan; noeuds.push(pan);
    }
    if (!SON_ANCIEN && this.reverb && ou && ou.dist){
      const w = wetOf(ou.dist), send = this.ctx.createGain(); send.gain.value = w;
      g.gain.value = gain; noeuds.push(send);
      // le son direct baisse un peu quand l'écho monte : le niveau perçu ne change pas
      const dry = this.ctx.createGain(); dry.gain.value = 1 - 0.3*w; noeuds.push(dry);
      tete.connect(dry); dry.connect(this.master);
      tete.connect(send); send.connect(this.reverb);
    } else tete.connect(this.master);
    src.onended = () => { for (const n of noeuds) { try { n.disconnect(); } catch(e){} } };   // pas de nœuds orphelins pour le GC
    src.start(t0);
  }
  // Joue l'échantillon k s'il est chargé ; sinon synthèse de secours SEULEMENT si le
  // chargement a échoué. B391 : pendant une reprise du contexte ou un décodage, le son
  // ATTEND (≤ 0,8 s) au lieu d'être perdu ; sans contexte (aucun geste encore), rien à faire.
  _shot(k, gain, when, rateJit, rateMul, fallback, fadeOut = 0, muffle = 0, ou = null){
    if (!this.enabled || !this.ctx) return;
    const synthese = !SAMPLES[k];   // son sans mp3 (couche grave) : toujours synthétisé
    const go = (retard = 0) => {
      const s = this._smp[k], w = Math.max(0, (when || 0) - retard);
      if (s) return this._play(s.buf, gain * s.trim, w, rateJit, rateMul, fadeOut, muffle, ou);
      if ((synthese || this._smpFail[k]) && fallback) this._play(this._pool(k, fallback), gain, w, rateJit, rateMul, fadeOut, muffle, ou);
    };
    if (this.ctx.state !== 'running'){ this._enqueue(go, synthese ? null : k); this._wake(); return; }
    if (!synthese && !this._smp[k] && !this._smpFail[k]){ this._enqueue(go, k); if (this._abuf[k]) this._decodeOne(k); return; }
    go();
  }
  _pool(name, maker){
    const P = this._pools[name] || (this._pools[name] = []);
    if (P.length === 0) P.push(maker());          // secours : généré au premier besoin
    return P[(Math.random()*P.length)|0];
  }
  _ready(){ return this.enabled && !!this.ctx; }   // B391 : plus besoin que le contexte tourne déjà (file d'attente)
  _ou(dist, pan){ return { dist: dist || 0, pan: pan || 0 }; }
  _norm(d, n){ let mx=0; for (let i=0;i<n;i++){ const a=d[i]<0?-d[i]:d[i]; if (a>mx) mx=a; }
    if (mx>0.99){ const g=0.99/mx; for (let i=0;i<n;i++) d[i]*=g; } }

  // DÉPART DE BOMBE (la chasse, à la sortie du tube) = « Départ de bombe.mp3 ».
  launch(cal, dist, pan){
    if (!this._ready()) return;
    this._shot('launch', 0.60*vol(cal)*att(dist), dly(dist), 0.08, deep(cal), () => this._launchBuffer(), 0.25, 0, this._ou(dist, pan));
  }

  // DÉPART DE CHANDELLE 10 mm (B356, user) : rien à voir avec une 75 mm. Un tube de 10 mm ne
  // « claque » pas et ne roule pas : c'est un POUF sourd et bref, très en retrait — d'où un gain
  // 8 fois plus bas, un passe-bas à 620 Hz (on enlève le claquement, pas juste le volume), une
  // lecture un peu plus rapide (tube court) et une queue coupée court.
  candle(dist, pan){
    if (!this._ready()) return;
    // B357 (user) : « moins grave et plus étouffé » -> lecture plus rapide (ça remonte le son, un
    // petit tube n'a rien de grave) et coupure abaissée. B360 : « encore beaucoup moins fort et
    // plus étouffé » -> gain divisé par 2 (soit ~1/17 d'un départ de 75 mm) et coupure à 260 Hz.
    // B361 (user) : « on ne doit quasiment pas entendre le départ, à 50 m c'est à peine
    // perceptible » -> niveau divisé encore par 5. À 50 m (att plafonné à 1,8) le pic tombe vers
    // -39 dBFS, soit ~1/85 d'un départ de 75 mm ; la coupure descend à 220 Hz.
    // B366 : niveau donné par l'user -> 0,03 (soit -27 dBFS à 50 m, ~1/20 du départ d'une 75 mm).
    this._shot('launch', 0.030*att(dist), dly(dist), 0.14, 1.95, () => this._launchBuffer(), 0.06, 220, this._ou(dist, pan));
  }

  // CRÉPITEMENT D'UN ŒUF DE DRAGON DE CHANDELLE 10 mm (B360, user : « ça crépite mais moins fort
  // que le 75 mm ») : le même échantillon d'œuf, mais à ~1/4 du niveau et adouci (2,2 kHz) — on
  // garde la texture crépitante, on enlève l'agressivité. UNE seule couche : le crépitement est
  // terminal et bref (~1,2 s), pas étalé en 3 vagues comme sur une bombe.
  // B361 (user) : « le crépitement doit s'entendre, lui — genre 3 fois moins que le 75 mm ».
  // B366 : niveau donné par l'user -> 0,10 contre 0,90 pour l'œuf d'une 75 mm, soit 1/9.
  // Coupure gardée à 3,2 kHz : c'est le niveau qui baisse, pas le mordant.
  candleEgg(dist, pan){
    if (!this._ready()) return;
    this._shot('dragon', 0.10*att(dist), dly(dist), 0.12, 1.35, () => this._dragonEggBuffer(), 0.30, 3200, this._ou(dist, pan));
  }

  // POINTE EN QUEUE DE CHEVAL (B369, user) : « elle éclate mais d'un bruit SOURD, presque comme
  // une botte de chandelle à la sortie du tube » -> le son de départ, à peine plus présent et
  // toujours très étouffé : un « pouf » mat, sans claquement.
  candleTip(dist, pan){
    if (!this._ready()) return;
    this._shot('launch', 0.060*att(dist), dly(dist), 0.12, 1.45, () => this._launchBuffer(), 0.10, 300, this._ou(dist, pan));
  }

  // EXPLOSION EN L'AIR (toute bombe) = « Bombe 75mm.mp3 » (claquement + boom qui roule + échos,
  // tels quels — le mp3 contient déjà tout). B391 : au-dessus de 75 mm, une couche GRAVE en plus
  // (une 150 mm pousse l'air : ça se sent dans la poitrine, pas seulement dans les oreilles).
  breakOpen(cal, dist, pan){
    if (!this._ready()) return;
    this._shot('break', 0.90*vol(cal)*att(dist), dly(dist), 0.09, deep(cal), () => this._breakOpenBuffer(), 0.40, 0, this._ou(dist, pan));
    this._thump(cal, dist, dly(dist), 0.42, pan);
  }
  // couche grave des gros calibres (B391) : rien sous 90 mm, pleine à 150 mm
  _thump(cal, dist, when, k, pan){
    if (SON_ANCIEN || !this.ctx || !cal || cal < 90) return;
    const a = Math.min(1, (cal - 75) / 75);
    this._shot('thump', k*a*att(dist), when, 0.06, deep(cal), () => this._thumpBuffer(), 0.15, 0, this._ou(dist, pan));
  }

  // CRACKLING : CHAQUE ÉTOILE crépite (user B255) et le son de chaque vague part de la bombe
  // AU MOMENT VISUEL du crépitement puis voyage (B258, user : « le crépitement arrive dès que
  // je vois l'étoile crépiter » — il doit arriver APRÈS). Timing visuel du moteur : l'effet
  // crackling = pivoine + pistil œuf de dragon qui explose 0,9 -> 1,5 s après le break
  // (cfg crackling.core.crackleAt 0.9, jitter 0.6 — si ça change là-bas, recaler ici).
  crackling(cal, dist, pan){
    if (!this._ready()) return;
    const gB = 0.60*vol(cal)*att(dist), g = 0.85*vol(cal)*att(dist), dp = deep(cal), t = dly(dist), fb = () => this._cracklingBuffer(), ou = this._ou(dist, pan);
    this._shot('break', gB,     t,                            0.09, dp,      () => this._breakOpenBuffer(), 0.40, 0, ou);   // l'ÉCLATEMENT de la pivoine
    this._shot('crack', g,      t + 0.90,                     0.10, dp,      fb, 0.35, 0, ou);   // le pistil crépite (visuel 0,9-1,5 s)
    this._shot('crack', g*0.65, t + 1.35 + Math.random()*0.20, 0.16, dp*1.04, fb, 0.50, 0, ou);
  }

  // ŒUF DE DRAGON — couches calées sur le TIMING VISUEL du moteur (B258) : le CŒUR crépite à
  // ~0,5-0,65 s (cfg dragonEgg.core.crackleAt 0.5), les ÉTOILES explosent entre 1,3 et 1,9 s
  // (cfg crackleStars delay 1.3 jitter 0.6) — chaque vague part de la bombe à son instant
  // visuel PUIS voyage vers la caméra. La rafale du mp3 démarre ~0,2 s après son début
  // -> chaque couche est posée 0,2 s avant l'instant visuel visé.
  dragonEgg(cal, dist, pan){
    if (!this._ready()) return;
    const g = 0.90*vol(cal)*att(dist), dp = deep(cal), t = dly(dist), fb = () => this._dragonEggBuffer(), ou = this._ou(dist, pan);
    this._shot('dragon', g,      t + 0.30,                     0.08, dp,      fb, 0.25, 0, ou);   // cœur : rafale audible à ~t+0,5
    this._shot('dragon', g*0.75, t + 1.10 + Math.random()*0.20, 0.12, dp*1.03, fb, 0.30, 0, ou);   // étoiles : 1,3-1,9 s
    this._shot('dragon', g*0.50, t + 1.50 + Math.random()*0.25, 0.14, dp*0.97, fb, 0.40, 0, ou);
  }

  // Couche de crépitement GÉNÉRIQUE (B262, composés type D8) : posée à `when` (instant VISUEL,
  // en s après le break) + trajet — pour les effets dont les étoiles crépitent tard.
  crackle(cal, dist, when = 0, gainMul = 1, pan){
    if (!this._ready()) return;
    this._shot('crack', 0.85*vol(cal)*att(dist)*gainMul, when + dly(dist), 0.14, deep(cal), () => this._cracklingBuffer(), 0.45, 0, this._ou(dist, pan));
  }

  // SIFFLET = « Sifflet.mp3 » (pour les réfs « espagnole … sifflet »).
  whistle(when = 0, dist, pan){
    if (!this._ready()) return;
    this._shot('whistle', 0.45*att(dist), when + dly(dist), 0.06, 1, () => this._whistleBuffer(), 0.15, 0, this._ou(dist, pan));
  }

  // HIBOU = « Hibou.mp3 » (tourbillon hululant, câblé sur l'archétype spinner).
  hibou(when = 0, dist, pan){
    if (!this._ready()) return;
    this._shot('hibou', 0.60*att(dist), when + dly(dist), 0.06, 1, () => this._hibouBuffer(), 0.20, 0, this._ou(dist, pan));
  }

  // MARRON D'AIR = « marron d'air ok.mp3 » (B263, fourni par l'user ; synthèse B154 en secours).
  // when = instant VISUEL de la détonation ; gain fort (×1.25 vs bombe) MAIS calibré : un marron
  // 50 mm cogne moins qu'un 75, et les MINI-marrons du multi passent par gainMul<1 (user B263 :
  // « plus ou moins fort selon l'effet et les calibres »).
  marron(when = 0, dist, cal, gainMul = 1, pan){
    if (!this._ready()) return;
    this._shot('marron', 1.25*vol(cal)*att(dist)*gainMul, when + dly(dist), 0.08, deep(cal), () => this._marronBuffer(), 0.35, 0, this._ou(dist, pan));
    this._thump(cal, dist, when + dly(dist), 0.55*gainMul, pan);
  }

  // ============================== B391 : RÉVERB & GRAVE ==============================
  // Réponse impulsionnelle de PLEIN AIR (stéréo, 1,8 s) : quelques réflexions précoces (sol,
  // façades, arbres) puis une queue de bruit qui s'assombrit en s'éteignant — pas une salle.
  _irBuffer(){
    const ctx = this.ctx, sr = ctx.sampleRate, dur = 1.8, n = (sr*dur)|0;
    const buf = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++){
      const d = buf.getChannelData(c);
      const refl = c === 0 ? [[0.019,0.50],[0.037,0.30],[0.058,0.26],[0.083,0.18],[0.121,0.12]] : [[0.023,0.46],[0.031,0.34],[0.064,0.24],[0.091,0.16],[0.113,0.13]];
      for (const [t, a] of refl){ const i0 = (t*sr)|0, pl = (0.004*sr)|0; for (let k=0;k<pl && i0+k<n;k++) d[i0+k] += (Math.random()*2-1) * a * Math.exp(-k/pl*4); }
      let lp = 0;
      for (let i=0;i<n;i++){
        const t = i/sr, w = Math.random()*2-1;
        const fc = 3800 * Math.exp(-t/0.9) + 350;            // la queue s'assombrit (l'air et le sol mangent les aigus)
        lp += (w - lp) * K(fc, sr);
        const env = t < 0.03 ? 0 : Math.exp(-(t-0.03)/0.42) * 0.55;
        d[i] += lp * env;
      }
    }
    for (let c = 0; c < 2; c++){ const d = buf.getChannelData(c); let mx = 0; for (let i=0;i<n;i++){ const a = Math.abs(d[i]); if (a>mx) mx=a; } if (mx>0){ const g = 0.6/mx; for (let i=0;i<n;i++) d[i]*=g; } }
    return buf;
  }
  // Couche grave des gros calibres : impulsion sourde 70 -> 40 Hz qui s'éteint en ~0,6 s.
  _thumpBuffer(){
    const ctx = this.ctx, sr = ctx.sampleRate, dur = 0.8, n = (sr*dur)|0;
    const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    let ph = 0;
    for (let i=0;i<n;i++){
      const t = i/sr, f = 40 + 30*Math.exp(-t*9);
      ph += 2*Math.PI*f/sr;
      let v = Math.sin(ph) * Math.min(1, t/0.012) * Math.exp(-t*4.5);
      v += (Math.random()*2-1) * Math.exp(-t*60) * 0.15;
      if (t > dur-0.1) v *= (dur-t)/0.1;
      d[i] = v;
    }
    this._norm(d, n);
    return buf;
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
}
