// ============================================================================
// CATALOGUE PRÉVOT -> EFFET PREVOFX (B391)
// ============================================================================
// Traduit une DÉSIGNATION du catalogue Prévot (data/effets.json, catalogue_effets.csv) en
// l'effet du moteur le plus fidèle : archétype EFFECTS (+ options couleur/montée/calibre) ou,
// pour les produits multi-tirs (compacts, chandelles, bottes, feux automatiques), une
// SÉQUENCE (même forme que les entrées COMPACTS du moteur).
//
// Module AUTONOME (aucun import : utilisé tel quel par PrevoFX web ET injecté dans le
// simulateur de site 3D par outils/faire_moteur_simu.py). Les couleurs sont rendues par leur
// NOM (« rouge », « kamuro »…) + la table COULEURS (sRGB linéaire, même palette que le moteur) :
// c'est le consommateur qui fabrique les THREE.Color.
//
// user (24/10/2026) : « occupe-toi des effets manquants de PrevoFX par rapport à notre
// catalogue. Liste-les, crée-les ». Règle : 0 référence sans effet FIDÈLE (hors accessoires).
// ?catalogue=0 dans l'adresse : traduction GROSSIÈRE d'avant (archétype générique du fichier).

// --- couleurs (même palette que threeFireworks.js ; [r,g,b] linéaires, HDR possible) ---
export const COULEURS = {
  rouge:[1.0,0.14,0.18], vert:[0.3,1.0,0.45], bleu:[0.4,0.55,1.0], violet:[0.6,0.35,1.0], rose:[1.0,0.30,0.55],
  citron:[1.0,0.92,0.30], jaune:[1.0,0.92,0.30], orange:[1.0,0.45,0.08], aqua:[0.25,0.9,1.0], cyan:[0.25,0.9,1.0],
  argent:[0.82,0.88,1.0], blanc:[1.0,1.0,1.0], or:[1.0,0.72,0.32], kamuro:[0.55,0.40,0.14], cuivre:[1.22,0.60,0.16],
  peche:[1.0,0.62,0.45], sang:[0.85,0.05,0.08], lime:[0.6,1.0,0.2], titane:[1.15,1.02,0.86], charbon:[0.55,0.40,0.14],
  mauve:[0.7,0.45,1.0], turquoise:[0.25,0.9,0.9], pastel:'pastel', multicolore:'multi', assorti:'multi',
};
const MULTI = ['rouge','vert','bleu','citron','violet','rose','aqua','orange'];
const PASTEL = ['rose','citron','aqua','peche','mauve'];

// mots -> couleur canonique (ordre : les plus longs d'abord ; motifs sur texte sans accents)
const MOTS_COULEUR = [
  ["vert d'eau",'aqua'],["vert deau",'aqua'],['bleu blanc rouge','tricolore'],['multicolore','multicolore'],['multicol','multicolore'],['multi-color','multicolore'],
  ['assorties','assorti'],['assortis','assorti'],['assortie','assorti'],['assorti','assorti'],['pastel','pastel'],['varg','multicolore'],['rainbow','multicolore'],
  ['rouge sang','sang'],['sang','sang'],['rouge','rouge'],['red','rouge'],['vertes','vert'],['verte','vert'],['verts','vert'],['vert','vert'],['green','vert'],['lime','lime'],
  ['bleues','bleu'],['bleue','bleu'],['bleus','bleu'],['bleu','bleu'],['blue','bleu'],['sea blue','bleu'],['seablue','bleu'],
  ['violettes','violet'],['violette','violet'],['violets','violet'],['violet','violet'],['purple','violet'],['mauve','mauve'],
  ['roses','rose'],['rose','rose'],['pink','rose'],['citron','citron'],['lemon','citron'],['jaunes','jaune'],['jaune','jaune'],['yellow','jaune'],
  ['oranges','orange'],['orange','orange'],['tangerine','orange'],['aqua','aqua'],['cyan','cyan'],['turquoise','turquoise'],
  ['argentees','argent'],['argentee','argent'],['argent','argent'],['silver','argent'],['blanches','blanc'],['blanche','blanc'],['blancs','blanc'],['blanc','blanc'],['white','blanc'],
  ['dorees','or'],['doree','or'],['dores','or'],['dore','or'],['golden','or'],['gold','or'],['or','or'],['kamuro','kamuro'],['brocade','kamuro'],['brocart','kamuro'],
  ['cuivre','cuivre'],['copper','cuivre'],['peche','peche'],['peach','peche'],['titane','titane'],['titanium','titane'],['charbon','charbon'],['charcoal','charbon'],
];
const RE_COULEUR = new RegExp('(^|[^a-z])(' + MOTS_COULEUR.map(m => m[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?=$|[^a-z])', 'g');
const CANON = Object.fromEntries(MOTS_COULEUR);

export function plat(s){   // minuscules, sans accents ni ponctuation superflue
  return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/œ/g,'oe').replace(/[’']/g,"'").replace(/\s+/g,' ').trim();
}
export function couleursDe(texte){   // couleurs dans l'ORDRE d'apparition (sans doublon), 'or' seul en fin de mot pris aussi
  const t = plat(texte), out = []; let m;
  RE_COULEUR.lastIndex = 0;
  while ((m = RE_COULEUR.exec(t))){ const c = CANON[m[2]]; if (c && out.indexOf(c) < 0) out.push(c); }
  return out;
}
function etendre(cs){   // multicolore/assorti/pastel -> liste réelle
  const out = [];
  for (const c of cs){ if (c==='multicolore'||c==='assorti') out.push(...MULTI); else if (c==='pastel') out.push(...PASTEL); else if (c==='tricolore') out.push('bleu','blanc','rouge'); else out.push(c); }
  return out;
}

// --- analyse d'une désignation ---
export function analyser(designation){
  const t = plat(designation);
  const cal = (t.match(/(\d{2,3}) ?mm/)||[])[1];
  const tirs = (t.match(/(\d{1,3}) ?tirs?/)||[])[1];
  const duree = (t.match(/(\d{2,3}) ?(?:s|sec|secondes)\b/)||[])[1] || (t.match(/(\d+) ?min(?:ute)?s?\b/)||[])[1]*60 || null;
  let produit = 'bombe';
  if (/^(double )?feu automatique|^portable|^compact (lesli|weco)|feu automatique/.test(t)) produit = 'feu_auto';
  else if (/^compact/.test(t)) produit = 'compact';
  else if (/^botte/.test(t)) produit = 'botte';
  else if (/^chandelle/.test(t)) produit = 'chandelle';
  else if (/^monocoup/.test(t)) produit = 'monocoup';
  else if (/^(bombe|\d+ bombes|chaine de)/.test(t)) produit = 'bombe';
  else if (/^fusee/.test(t)) produit = 'fusee';
  else if (/^(fontaine|gerbe|volcan|girandole|soleil)/.test(t)) produit = 'fontaine';
  else if (/^cascade/.test(t)) produit = 'cascade_jets';
  else if (/^(bengale|lance|torche|flamme)/.test(t)) produit = 'bengale';
  else if (/^(fumigene|jet fumigene|fumee)/.test(t)) produit = 'fumee';
  else if (/^soucoupe/.test(t)) produit = 'soucoupe';
  else if (/^lampion/.test(t)) produit = 'lampion';
  else if (/^pot a feu/.test(t)) produit = 'pot';
  const nautique = /nautique|on water|water explosion/.test(t);
  const motif = /eventaill/.test(t) ? 'fan' : /\bz\b|z-shape/.test(t) ? 'z' : /\bbande\b/.test(t) ? 'bande' : /droit/.test(t) ? 'droit' : null;
  return { t, cal: cal ? +cal : null, tirs: tirs ? +tirs : null, duree: duree ? +duree : null, produit, nautique, motif, couleurs: couleursDe(t) };
}

// couleur(s) utiles : hors montée ("ascension X"), hors "tronc X" ; pour les composés on sépare
function partie(t, re){ const m = re.exec(t); return m ? m[1] : ''; }
function sansMontee(t){ return t.replace(/ascension [a-z' ]+?(?=( et |,|$| pointes| centre| queue))/g,' ').replace(/ascension [a-z]+/g,' '); }

// ============================================================================
// TYPES D'EFFET VISUELS — du plus spécifique au plus général. Chaque règle rend
// { arch, opts, type } ; `cree:true` = archétype AJOUTÉ en B391 (n'existait pas).
// ============================================================================
const R = [];
function regle(type, re, fn, infos){ R.push({ type, re, fn, infos: infos||{} }); }

const couleur1 = (cs, defaut) => { const e = etendre(cs.filter(c => c!=='or' && c!=='kamuro' && c!=='argent')); return e[0] || (cs[0]) || defaut; };
const paire = (cs) => { const e = etendre(cs); return [e[0]||'rouge', e[1]||e[0]||'blanc']; };

// --- BOMBES : formes & composés (spécifiques) ---
regle('D8 composé 150', /\bd8\b/, () => ({ arch:'d8' }));
regle('D9 composé 150', /\bd9\b/, () => ({ arch:'d9' }));
regle('D10 composé 150', /\bd10\b/, () => ({ arch:'d10' }));
regle('cœur', /\b(coeur|heart)\b/, (a) => ({ arch:'heart', opts:{ couleur: couleur1(a.couleurs,'rouge') } }));
regle('sourire', /sourire|smiley/, () => ({ arch:'smiley' }));
regle('papillon', /papillon|butterfly/, () => ({ arch:'butterfly' }));
regle('cercle progressif feuille morte', /cercle progressif/, (a) => ({ arch:'fmRing', opts:{ paire: paire(a.couleurs) } }));
regle('atome', /\batome\b/, (a) => ({ arch:'atom', opts:{ couleur: couleur1(a.couleurs,'multicolore') } }));
regle('fantôme', /fantome|ghost/, () => ({ arch:'fantome' }));
regle('corolle à pointes 75', /corolle/, (a) => ({ arch: a.cal===75 ? 'corolleOr' : 'corolle', opts:{ pointe: couleur1(a.couleurs.filter(c=>c!=='or'),'argent') } }));
regle('zigzag', /zigzag|swimming stars/, (a) => ({ arch:'zigzag', opts:{ couleur: couleur1(a.couleurs,'rouge') } }));
regle('marguerite cylindrique (Farfalle)', /marguerite.*(cylindrique|tourbillon|mosaique)/, (a) => ({ arch:'farfalle', opts:{ couleur: couleur1(a.couleurs,'argent'), variante: /tourbillon/.test(a.t)?'tourbillon': /mosaique/.test(a.t)?'crossette':'pistil' } }), { cree:true });
regle('marguerite (motif)', /marguerite/, (a) => ({ arch:'daisy', opts:{ couleur: couleur1(a.couleurs,'rouge') } }));
regle('multibombe', /multibombe|shell-of-shells|shell of shells/, (a) => ({ arch:'multibombe', opts:{ couleur: couleur1(a.couleurs,'multicolore') } }), { cree:true });
regle('bombe titane à étoiles', /titane avec etoiles|bombe titane/, (a) => ({ arch:'titane', opts:{ couleur: couleur1(a.couleurs,'vert') } }), { cree:true });
regle('méduse', /meduse/, (a) => ({ arch:'medusa', opts:{ couleur: couleur1(a.couleurs,'argent') } }));
regle('mosaïque crackling', /mosaique crackling/, (a) => ({ arch:'mosaicCrackle', opts:{ couleur: couleur1(a.couleurs,'or') } }), { cree:true });
regle('mosaïque', /mosaique|crossette/, (a) => { const cs = etendre(a.couleurs); return cs.length>1 || a.couleurs.includes('multicolore') || a.couleurs.includes('assorti') ? { arch:'mosaicMix' } : { arch:'mosaic', opts:{ couleur: cs[0]||'argent' } }; });
regle('soucoupe', /soucoupe|saucer/, () => ({ arch:'saucer' }));
regle('poissons', /poisson|flying fish/, (a) => ({ arch:'fish', opts:{ couleur: couleur1(a.couleurs,'vert') } }));
regle('hiboux (tourbillons hululants)', /hibou/, (a) => ({ arch:'spinner', opts:{ couleur: couleur1(a.couleurs,'multicolore'), son:'hibou' } }));
regle('sifflet (tournant)', /sifflet|siffl|whistl/, (a) => ({ arch:'sifflet', opts:{ couleur: couleur1(a.couleurs,'argent') } }), { cree:true });
regle('disque de tourbillons', /disque de tourbillon|tourbillons? (argent|rouge|cyan|aqua)|tourbillon$|tourbillons$/, (a) => ({ arch:'tourbBomb', opts:{ montee: couleur1(a.couleurs,'argent') } }));
regle('tourbillon', /tourbillon|whirl/, (a) => ({ arch:'spinner', opts:{ couleur: couleur1(a.couleurs,'argent') } }));
regle('cascade (centre) + cercle', /centre cascade cercle/, () => ({ arch:'cascadeRing' }), { cree:true });
regle('cascade', /cascade|waterfall/, (a) => ({ arch:'cascade', opts:{ couleur: couleur1(a.couleurs,'or') } }));
regle('queue de cheval pointe (chandelle/compact)', /queue de cheval pointe/, (a) => ({ arch:'candle30qc', opts:{ couleur: couleur1(a.couleurs,'argent') } }));
regle('queue de cheval', /queue de cheval|horse ?tail|horsetail/, (a) => ({ arch:'horsetail', opts:{ couleur: couleur1(a.couleurs,'or') } }));
regle('traçante tronc blanc 125', /tracante.*tronc blanc/, (a) => ({ arch:'tracerTrunk', opts:{ couleur: couleur1(a.couleurs,'rouge') } }), { cree:true });
regle('traçante', /tracante|tracer/, (a) => ({ arch:'tracer', opts:{ couleur: couleur1(a.couleurs,'rouge') } }));
regle('moitié changeante centre cli.', /moitie .* a .* moitie .* a .*centre cli/, (a) => ({ arch:'halfSwapCli', opts:{ paire: paire(a.couleurs) } }));
regle('moitié-moitié centre cli. blanc', /moitie .*moitie .*centre cli/, (a) => ({ arch:'halfHalfCli', opts:{ paire: paire(a.couleurs) } }), { cree:true });
regle('moitié-moitié', /moitie|half and half|half & half/, (a) => ({ arch:'halfHalf', opts:{ paire: paire(a.couleurs) } }));
regle('dahlia centre cli. blanc', /dahlia.*(centre cli|strobing pistil)/, (a) => ({ arch:'dahliaCli', opts:{ couleur: couleur1(a.couleurs,'blanc') } }));
regle('dahlia (pur)', /dahlia|dhalia/, (a) => ({ arch:'dahlia', opts:{ couleur: couleur1(a.couleurs,'blanc'), montee: /tail/.test(a.t) ? 'argent' : undefined } }), { cree:true });
regle('kamuro final cli. blanc centre cli. blanc', /kamuro final cli.*centre cli/, (a) => ({ arch:'kamuroCli', opts:{ finalCli:true } }));
regle('ext. kamuro centre cli. blanc', /(exterieur kamuro|kamuro) centre cli|kamuro.*(small )?white strobing pistil/, () => ({ arch:'kamuroCli' }));
regle('ext. kamuro centre couleur', /exterieur kamuro centre/, (a) => ({ arch:'kamuroPistil', opts:{ pistil: couleur1(a.couleurs,'violet') } }), { cree:true });
regle('centre œuf de dragon palme', /centre oeuf de dragon palme/, (a) => ({ arch:'palmEgg', opts:{ couleur: couleur1(a.couleurs.filter(c=>c!=='kamuro'),'kamuro') } }), { cree:true });
regle('palme or scintillant', /palmes? or scintillant|palme.*scintillant|glittering palm|palm.*glitter/, () => ({ arch:'palmStrobe' }));
regle('palme multicolore', /palmes? multicolore/, () => ({ arch:'palmMulti' }));
regle('palme', /palmes?\b|palm\b|coconut/, (a) => ({ arch:'palm', opts:{ couleur: couleur1(a.couleurs,'blanc') } }));
regle('trois cercles + pistil', /three rings|3 rings|trois cercles/, (a) => ({ arch:'rings3', opts:{ pistil: couleur1(a.couleurs,'vert') } }), { cree:true });   // avant « pistil » (la désignation contient aussi « pistil »)
regle('pistil / centre couleur', /(pistil|centre) (rouge|vert|bleu|violet|rose|citron|jaune|orange|aqua|argent|blanc|or|silver|red|green|blue|purple|pink|lemon|coconut|glitter|strobe)|w\/ ?(red|green|blue|silver|pink|white|lemon|purple) ?(strobe |glitter |coconut )?pistil|with (silver|red|green|blue) (strobe |coconut )?pistil/,
  (a) => { const m = /(?:pistil|centre|w\/|with) ?(rouge|vert|bleu|violet|rose|citron|jaune|orange|aqua|argent|blanc|or|silver|red|green|blue|purple|pink|lemon|white)/.exec(a.t);
    const p = m ? CANON[m[1]]||m[1] : 'argent'; const env = etendre(a.couleurs.filter(c => c!==p))[0] || 'rouge';
    if (env==='kamuro') return { arch:'kamuroPistil', opts:{ pistil:p } };
    return { arch:'peonyPistil', opts:{ paire:[env,p], pistilCli: /strobe|cli/.test(a.t), pistilCrackle: /glitter|crackl/.test(a.t) } }; }, { cree:true });
regle('saule or pointes scintillant', /saule or pointes scintillant|saule or pointes cli/, () => ({ arch:'willowStrobe' }));
regle('saule or pointes 100', /saule or pointes/, (a) => ({ arch: a.cal>=100 ? 'willowTips100' : 'willowTips', opts:{ pointe: couleur1(a.couleurs.filter(c=>c!=='or'),'argent') } }));
regle('kamuro à pointes', /kamuro a pointes|kamuro pointes|kamuro to (varg|red|green|blue|white|silver|purple|lemon|pink)|brocade .* tips|multiflash tips/, (a) => ({ arch: a.cal>=100 ? 'willowTips100' : 'willowTips', opts:{ pointe: couleur1(a.couleurs.filter(c=>c!=='kamuro'&&c!=='or'),'multicolore') } }));
regle('saule pleureur pointes', /saule pleureur/, (a) => ({ arch:'willowTips100', opts:{ pointe: couleur1(a.couleurs,'multicolore') } }));
regle('à tronc saule kamuro', /tronc saule|tronc kamuro/, () => ({ arch:'willowTrunk' }));
regle('kamuro longue durée', /longue duree/, (a) => ({ arch: a.cal>=150 ? 'willowLong150' : 'willowLong50' }));
regle('crackling kamuro / willow', /crackling (kamuro|willow)|crackling big willow|super titan crackling willow/, () => ({ arch:'crackling', opts:{ couleur:'kamuro' } }));
regle('saule / kamuro / brocart', /\b(saule|kamuro|brocart|brocade|willow|crown|golden rain|time rain|pluie argent|pluie)\b/, (a) => {
  const strobe = /strobe|scintill|cli/.test(a.t), silverTail = /silver tail|w\/silver|argent tail/.test(a.t);
  if (strobe) return { arch:'willowStrobe', opts:{ pointe: couleur1(a.couleurs.filter(c=>c!=='kamuro'&&c!=='or'),'blanc') } };
  const pts = a.couleurs.filter(c=>!['kamuro','or','argent','blanc'].includes(c));
  if (pts.length) return { arch: a.cal>=100 ? 'willowTips100' : 'willowTips', opts:{ pointe: pts[0] } };
  return { arch:'willow', opts:{ montee: silverTail ? 'argent' : undefined, couleur: /silver|argent|pluie/.test(a.t) ? 'argent' : undefined } }; });
regle('œuf de dragon (bombe)', /oeuf de dragon|dragon egg|golden dragon|popcorn|crackle flowers/, (a) => ({ arch:'dragonEgg' }));
regle('dragon (brocart à pointes)', /\bdragon\b/, (a) => ({ arch:'willowTips', opts:{ pointe: couleur1(a.couleurs,'violet') } }));
regle('crackling', /crackling|crepit|crackl/, (a) => ({ arch:'crackling', opts:{ couleur: couleur1(a.couleurs,'vert') } }));
regle('final cli. blanc', /final cli/, (a) => ({ arch:'finalCli', opts:{ couleur: couleur1(a.couleurs.filter(c=>c!=='blanc'),'rose') } }));
regle('cli. / clignotant / scintillant (pivoine)', /\bcli\b|clignotant|strobe|scintillant|flashing|shimmering|glitter|multiflash/, (a) => {
  const c = couleur1(a.couleurs,'blanc'); return (c==='blanc'||c==='rouge') ? { arch:'cli', opts:{ couleur:c } } : { arch:'strobe', opts:{ couleur:c } }; });
regle('chrysanthème', /chrysanth|chrys?\b|chrys?\./, (a) => ({ arch:'chrysanthemum', opts:{ couleur: couleur1(a.couleurs,'multicolore'), montee: /silver tail/.test(a.t)?'argent':undefined, dense: /thousands/.test(a.t) } }));
regle('feuille morte', /feuilles? mortes?|feuilles tombantes|falling leaves/, (a) => ({ arch:'fallingLeaves', opts:{ couleur: couleur1(a.couleurs,'rose') } }));
regle('cercle / anneau', /\b(cercle|ring|rings|anneau)\b/, (a) => ({ arch: /three rings|3 rings/.test(a.t) ? 'rings3' : 'ring', opts:{ couleur: couleur1(a.couleurs,'argent') } }), { cree:'rings3' });
regle('marron d\'air multi', /multi marron|flash et deto x|deto x\d+|x15/, () => ({ arch:'saluteMulti' }));
regle('marron d\'air / déto', /marron|deto\b|detonation|salut\b|report\b|flash\b/, (a) => ({ arch:'salute', opts:{ couleur: couleur1(a.couleurs,'argent') } }));
regle('comète kamuro (comète à traîne or)', /comete kamuro|comete.*kamuro/, () => ({ arch:'comet' }));
regle('comète', /comete|comet|tiger tail|scatter/, (a) => ({ arch:'comet', opts:{ couleur: couleur1(a.couleurs,'or') } }));
regle('bouquet / assortiment (pivoines variées)', /bouquet|fantaisie|furieuses|eclatantes|sucrees|mouvantes|croustillantes|bluffante|patchwork|introduction|envoutante|enivrante|devorante|a motif/, () => ({ arch:'assortiment' }), { cree:true });
regle('pot à feu 75 mm (bombe)', /^bombe \d+ mm pot a feu/, (a) => ({ arch:'mine', opts:{ couleur: couleur1(a.couleurs,'rouge'), cli: /cli/.test(a.t) } }));
regle('explosions sur l\'eau (nautique)', /water explosion/, () => ({ arch:'saluteMulti', opts:{ nautique:true } }));
regle('mine (bombe de mines)', /\bmines?\b/, (a) => ({ arch:'horsetail', opts:{ couleur: couleur1(a.couleurs,'bleu') } }));
regle('pivoine', /pivoine|peony/, (a) => ({ arch:'peony', opts:{ couleur: couleur1(a.couleurs,'rouge'), montee: /silver tail|w\/silver/.test(a.t)?'argent':undefined } }));
regle('sphère / bombette colorée', /bombette|sphere|wave/, (a) => ({ arch:'peony', opts:{ couleur: couleur1(a.couleurs,'rouge') } }));
regle('à effet cli. (couleur)', /a effet cli/, (a) => ({ arch:'cli', opts:{ couleur: couleur1(a.couleurs,'blanc') } }));
regle('française tricolore', /francaise/, () => ({ arch:'halfHalf', opts:{ paire:['bleu','rouge'] } }));

export const TYPES_BOMBE = R;

// ============================================================================
// PRODUITS AU SOL et multi-tirs
// ============================================================================
function sequence(a, arch, extra){   // squelette de séquence (COMPACTS du moteur)
  const tirs = a.tirs || extra.tirs || 20, dur = a.duree || extra.dur || Math.max(20, Math.min(60, tirs*1.2));
  const pattern = a.motif==='fan' ? 'fan' : a.motif==='z' ? 'z' : a.motif==='bande' ? 'bande' : 'droit';
  return Object.assign({ arch, tirs, dur, pattern, rowSize: pattern==='z' ? Math.max(3, Math.round(Math.sqrt(tirs))) : pattern==='fan' ? Math.max(3, Math.min(10, Math.round(tirs/Math.max(2, Math.round(dur/4))))) : tirs, fanDeg: pattern==='bande' ? 30 : 25 }, extra||{});
}

export function effetPour(designation, calibre, infos){
  const a = analyser(designation); infos = infos || {};
  if (calibre && !a.cal) a.cal = +calibre;
  const out = { designation, produit: a.produit, calibre: a.cal, nautique: a.nautique, hauteur_m: infos.hauteur_m||null, duree_s: infos.duree_s||a.duree||null };
  // --- hors périmètre (pas un effet visuel) ---
  if (/^(etiquette|scotch|pastille|elastique|carton|systeme de tir|poincon|tente|testeur|extincteur|planche d'etiquettes|cable|fil |allumeur|mortier|rack|sac pluie|formation|option|service|houssse|housse)/.test(a.t)
      || /^(fil |lampion)/.test(a.t)) return Object.assign(out, { type:'hors périmètre', arch:null });

  // --- produits AU SOL ---
  if (a.produit==='bengale') return Object.assign(out, { type:'bengale / lance (feu fixe)', arch:'bengale', opts:{ couleur: couleur1(a.couleurs,'rouge'), duree: a.duree||60, cli: /cli|clignot/.test(a.t) } , cree:true });
  if (a.produit==='fumee' || /fumigene|fumee/.test(a.t)) return Object.assign(out, { type:'fumigène (jour)', arch:'fumee', opts:{ couleur: couleur1(a.couleurs,'blanc'), duree: a.duree||(/minute/.test(a.t)?60:20), hauteur: a.produit==='monocoup' ? 15 : 2 }, cree:true });
  if (a.produit==='cascade_jets') { const m = /(\d+) m/.exec(a.t); return Object.assign(out, { type:'cascade de jets (ligne)', arch:'cascadeLigne', opts:{ longueur: m ? +m[1] : 10, jets: a.tirs || +((/(\d+) jets/.exec(a.t)||[])[1]) || 24, couleur: couleur1(a.couleurs,'argent') }, cree:true }); }
  if (a.produit==='fontaine' || /^gerbe|fontaine|girandole|volcan|soleil/.test(a.t)){
    const h = +((/\((\d+(?:[.,]\d+)?) ?m/.exec(a.t)||[])[1]||0) || (/volcan/.test(a.t)?8:/t2/.test(a.t)?10:5);
    const d = +((/, ?(\d+(?:[.,]\d+)?) ?s/.exec(a.t)||[])[1]||0) || a.duree || (/volcan/.test(a.t)?60:/gerbe/.test(a.t)?1.5:30);
    const type = /volcan/.test(a.t) ? 'volcan' : /girandole/.test(a.t) ? 'girandole' : /soleil/.test(a.t) ? 'soleil' : /gerbe/.test(a.t) ? 'gerbe (jet bref)' : 'fontaine';
    return Object.assign(out, { type, arch: /girandole|soleil/.test(a.t) ? 'girandole' : 'fontaine', opts:{ hauteur:h, duree:d, couleur: couleur1(a.couleurs,'argent'), etoiles: /etoiles/.test(a.t) ? couleur1(a.couleurs.slice(1),'multicolore') : null, jets: +((/(\d+) jets/.exec(a.t)||[])[1]||1) }, cree:true });
  }
  if (a.produit==='soucoupe') return Object.assign(out, { type:'soucoupe', arch:'saucer', opts:{ double: /double/.test(a.t) } });
  if (a.produit==='pot') return Object.assign(out, { type:'pot à feu (seul)', arch:'mine', opts:{ couleur: couleur1(a.couleurs,'rouge') } });

  // --- MULTI-TIRS : compacts, chandelles, bottes, feux automatiques ---
  if (a.produit==='compact' || a.produit==='chandelle' || a.produit==='botte' || a.produit==='feu_auto' || a.produit==='monocoup'){
    const t = sansMontee(a.t), cs = couleursDe(t), c1 = couleur1(cs, 'rouge');
    const asc = /ascension ([a-z' ]+)/.exec(a.t); const montee = asc ? (couleursDe(asc[1])[0] || (/tourbillon/.test(asc[1]) ? 'tourbillon' : /crepit/.test(asc[1]) ? 'crepitant' : /brocart|kamuro|or/.test(asc[1]) ? 'or' : undefined)) : undefined;
    const tubes = a.produit==='botte' ? (+((/botte de (\d+)/.exec(a.t)||[])[1]) || 3) : 1;
    const perTube = a.tirs || 20;
    // monocoup = 1 seul tir : séquence d'un coup
    let def = null, type = '';
    const petit = a.cal && a.cal <= 30;   // bombettes 20-30 mm : archétypes « bombette »
    if (a.cal && a.cal <= 10 && !/oeuf de dragon/.test(t)) { type = /kamuro|brocart/.test(t) ? 'botte de chandelles kamuro (perles)' : /cli|scintill/.test(t) ? 'botte de chandelles clignotantes' : 'botte de chandelles (perles)'; def = sequence(a, 'candle10', { couleur: /kamuro|brocart/.test(t) ? 'kamuro' : c1, tubes, cli: /cli|scintill/.test(t) }); }
    else if (/pot a feu .*queue de cheval|queue de cheval pointe/.test(t)) { type='chandelle/compact pot à feu + queue de cheval pointe'; def = sequence(a, 'candle30qc', { mine:'mine30c', mineColored:true, couleur:c1 }); }
    else if (/pot a feu .*comete|comete tracante/.test(t)) { type='pot à feu + comète traçante'; def = sequence(a, cs.includes('kamuro') ? 'candle30k' : 'candle30', { mine: cs.includes('kamuro') ? 'mine30' : 'mine30c', mineColored: !cs.includes('kamuro'), couleur:c1 }); }
    else if (/pot a feu .*bombette|bombette .*pot a feu|pot a feu et bombette/.test(t)) {
      type='pot à feu + bombette';
      const b = /kamuro|brocart|brocade/.test(t) ? 'bombKamuro' : /oeuf de dragon/.test(t) ? 'bombEgg' : /crackling/.test(t) ? 'bombCrackle' : /cli/.test(t) ? 'bombCli' : /marron/.test(t) ? 'salute' : 'bombRouge';
      def = sequence(a, b, { mine: /kamuro/.test(t) && !/pot a feu (rouge|vert|bleu|blanc|cli)/.test(t) ? 'mine30' : (/pot a feu kamuro/.test(t) ? 'mine30' : 'mine30r'), mineColored: !/pot a feu kamuro/.test(t), couleur: c1 });
    }
    else if (/^(compact|botte|chandelle|monocoup).*(pot a feu|mine)/.test(t) && !/bombette|comete/.test(t)) { type = a.produit==='monocoup' ? 'pot à feu' : 'compact de pots à feu'; def = sequence(a, 'mine30r', { couleur:c1, gerbeSeule:true }); }
    else if (/meduse/.test(t)) { type='compact méduse'; def = sequence(a, 'medusa', { couleur:c1 }); }
    else if (/poisson/.test(t)) { type='compact poissons'; def = sequence(a, 'fishBomb', { couleur:c1 }); }
    else if (/disque de tourbillon|^compact .*tourbillon|tourbillons? (argent|rouge|cyan)/.test(t)) { type='compact tourbillons'; def = sequence(a, 'tourbBomb', { couleur:c1, montee }); }
    else if (/sifflet|siffl|hibou/.test(t)) { type = /hibou/.test(t) ? 'compact hiboux' : 'compact/chandelle sifflets'; def = sequence(a, 'sifflet', { couleur:c1, son: /hibou/.test(t)?'hibou':'sifflet' }); }
    else if (/marron/.test(t)) { type='compact marrons d\'air'; def = sequence(a, 'salute', { couleur:'argent' }); }
    else if (/deto/.test(t)) { type='chandelle déto'; def = sequence(a, 'candleDeto', { couleur:c1, flash: /flash/.test(t) }); }
    else if (/colonne/.test(t)) { type='monocoup colonne'; const cc = etendre(cs); def = sequence(a, 'colonne', { couleur: cc[0]||'bleu', couleur2: cc[1]||cc[0]||'citron', fin: /oeuf de dragon/.test(t)?'oeuf': /cli/.test(t)?'cli':null, tirs:1, dur:1 }); }
    else if (/feuilles? mortes?/.test(t)) { type='compact feuilles mortes'; def = sequence(a, 'fallingLeaves', { couleur:c1, bombette:true }); }
    else if (/mosaique/.test(t)) { type='compact/chandelle mosaïque'; def = sequence(a, /crackling/.test(t)?'mosaicCrackle':'mosaic', { couleur:c1 }); }
    else if (/comete/.test(t)) { type='compact/chandelle comètes'; def = sequence(a, petit && a.cal<=20 ? 'candle10' : 'candle30', { couleur: /kamuro|brocart/.test(t)?'kamuro':c1, cli: /cli/.test(t), crackling: /crackling/.test(t), large: /large/.test(t) }); }
    else if (/palme/.test(t)) { type='compact palmes'; def = sequence(a, 'bombPalm', { couleur:c1, crackling: /crackling/.test(t), tronc: /tronc/.test(t) }); }
    else if (/crackling/.test(t)) { type='compact crackling'; def = sequence(a, 'bombCrackle', { couleur:c1 }); }
    else if (/oeuf de dragon/.test(t)) { type='compact/chandelle œufs de dragon'; def = sequence(a, a.cal<=10 ? 'candle10egg' : 'bombEgg', { couleur:'or', tubes }); }
    else if (/saule|kamuro|brocart|brocade/.test(t)) { type='compact bombettes kamuro'; const pts = cs.filter(c=>!['kamuro','or','argent'].includes(c)); def = sequence(a, pts.length ? 'bombKamuroTips' : 'bombKamuro', { couleur:'kamuro', pointe: pts[0], montee }); }
    else if (/titane/.test(t)) { type='compact titane'; def = sequence(a, 'titane', { couleur:c1 }); }
    else if (/cli|clignot|scintill|strobe/.test(t)) { type='compact/chandelle clignotant'; def = sequence(a, a.cal<=10 ? 'candle10' : 'bombCli', { couleur:c1, tubes }); }
    else if (/pivoine|bombettes?|tronc|pearl|perle/.test(t) || a.produit==='chandelle' || a.produit==='botte') { type = a.cal<=10 ? 'botte de chandelles (perles)' : 'compact bombettes (pivoines)'; def = sequence(a, a.cal<=10 ? 'candle10' : 'bombRouge', { couleur:c1, tubes, trunk: /tronc/.test(t), montee }); }
    else if (/serie cartes|lesli|weco|feu automatique|portable|jupiter|venus|saturne|monster|bling|full|pavo|trinity|pegasus|ikarus|taurus|krawallig|kryptonit|prometheus|pictus|excalibur|vengeance|sensation|symphony|titanium|optymum|maxymum|ultymum|fyre|hype|oxyd|deluxe|finest|belle|pryme|premyum|shyne|dakyn|heisenberg|protocol|anarchy|enemy|code red|inclusive|wolfdog|force|matchpoint|sturdy|speed|shred|elephant|dezemberfest|opera|intensity|onkel|theater|gorilla|family|street|universe|spaceman/.test(t) || a.produit==='feu_auto') {
      type = /serie cartes/.test(t) ? 'compact série cartes (multi-effets)' : 'feu automatique (multi-effets, sans détail)';
      def = sequence(a, 'compactMix', { tirs: a.tirs||100, dur: a.duree||(a.tirs ? Math.round(a.tirs*0.9) : 90), mix:['bombRouge','bombKamuro','bombCrackle','bombCli','bombPalm'], couleur:'multicolore', eventail: a.motif==='fan' });
      if (/egypt|jupiter|venus|saturne/.test(t)) type = 'feu automatique Jacques Prévot (détail dans le simulateur 3D)';
    }
    else { type='compact bombettes (générique)'; def = sequence(a, 'bombRouge', { couleur:c1, montee }); }
    if (a.produit==='monocoup'){ def.tirs = 1; def.dur = 1; def.pattern = 'droit'; type = 'monocoup : ' + type; }
    if (a.produit==='botte'){ def.pattern='candle'; def.tubes = tubes; def.shotsPerTube = perTube; def.tirs = tubes*perTube; def.dur = a.duree || 30; }
    if (a.produit==='chandelle'){ def.pattern='candle'; def.tubes=1; def.shotsPerTube=perTube; def.tirs=perTube; def.dur = a.duree || (perTube<=8 ? 25 : 30); }
    const cree = ['fishBomb','sifflet','candleDeto','colonne','bombEgg','bombCrackle','bombCli','bombPalm','bombKamuroTips','titane','compactMix','mosaicCrackle'].includes(def.arch);
    return Object.assign(out, { type, arch: def.arch, compact: def, cree });
  }

  // --- BOMBES (et fusées) ---
  const t = sansMontee(a.t);
  const a2 = Object.assign({}, a, { t, couleurs: couleursDe(t) });
  for (const r of R){ if (r.re.test(t)){ const res = r.fn(a2) || {}; res.opts = res.opts || {};
      if (/silver tail|w\/silver|w\/ silver|gold tail|w\/ gold tail/.test(t) && !res.opts.montee) res.opts.montee = /gold/.test(t) ? 'or' : 'argent';
      if (/tronc (blanc|argent|or|kamuro)/.test(t) && !res.opts.tronc) res.opts.tronc = CANON[(/tronc (blanc|argent|or|kamuro)/.exec(t))[1]] || 'blanc';
      if (a.produit==='fusee') res.opts.montee = res.opts.montee || 'argent';
      if (a.nautique) res.opts.nautique = true;
      return Object.assign(out, { type: r.type + (a.nautique ? ' (nautique)' : ''), arch: res.arch, opts: res.opts, cree: !!r.infos.cree }); } }
  // défaut : une bombe sans mot-clé = pivoine de sa couleur (ex « bombe 75 mm rouge »)
  const cs = couleursDe(t);
  if (cs.length) return Object.assign(out, { type:'pivoine de couleur (désignation = couleur seule)', arch: cs[0]==='kamuro' ? 'willow' : 'peony', opts:{ couleur: couleur1(cs,'rouge') } });
  return Object.assign(out, { type:'pivoine (défaut : désignation sans effet nommé)', arch:'peony', opts:{ couleur:'rouge' }, generique:true });
}

// Inventaire : regroupe une liste [{reference, designation, calibre, hauteur_m, duree_s, video_url}] par TYPE
export function inventaire(refs){
  const par = new Map();
  for (const e of refs){
    const r = effetPour(e.designation, e.calibre, { hauteur_m:e.hauteur_m, duree_s:e.duree_s });
    const k = r.type; if (!par.has(k)) par.set(k, { type:k, arch:r.arch, cree:!!r.cree, n:0, refs:[] });
    const g = par.get(k); g.n++; if (g.refs.length < 6) g.refs.push({ reference:e.reference, designation:e.designation, arch:r.arch, opts:r.opts||r.compact, video:e.video_url });
  }
  return [...par.values()].sort((x,y) => y.n - x.n);
}
