# Catalogue Prévot → effets PrevoFX (B391)

> Document pour l'utilisateur : **quelle référence du catalogue donne quel effet à l'écran**, ce qui
> existait déjà, ce qui a été créé en B391, les sources consultées, et ce qui reste approximatif.
> Généré/relu le 2026-10-24. Tableau de contrôle : `node outils/test_catalogue.mjs` (résumé),
> `node outils/test_catalogue.mjs "désignation"` (traduction d'une référence),
> `node outils/test_catalogue.mjs --json fichier` (inventaire complet).

## 1. En deux mots

- **1 168 références** dans `data/effets.json` → **134 accessoires écartés** (étiquettes, cartons,
  systèmes de tir, fil, lampions, allumeurs…) → **1 034 références utiles**, toutes traduites :
  **106 types d'effet**, **0 rabat générique** (aucune référence n'est rendue « pivoine par défaut »),
  19 références « hors périmètre » (objets qui ne font pas d'image : planches d'étiquettes, etc.).
- **307 références** passent par un **archétype créé en B391** (31 nouveaux ou variantes),
  les 708 autres par les archétypes qui existaient (pivoine, saule, mosaïque, traçante…).
- Traduction = `src/render/catalogue.js` : `effetPour(designation, calibre, infos)` → `{ type, arch,
  opts, compact, cree }`. Module autonome (aucun import), le même fichier sert **PrevoFX web**
  (sélecteur « Catalogue Prévot » dans la barre d'effets, ou `PrevoFX.catalogue("mots")` en console)
  et le **simulateur de site 3D** (`outils/simu3d/feux_auto.js` : toute désignation d'un feu
  automatique passe d'abord par le catalogue ; le générateur `outils/faire_moteur_simu.py` injecte
  `<script id="catalogue">`, objet `PFX_CATALOGUE`).
- `defDepuisCatalogue(res)` (moteur) transforme la traduction en définition jouable : archétype,
  couleurs **par nom** (`NOMS_COULEUR`), hauteur (`hauteur_m` du catalogue → `apexMul`), durée des
  produits de sol, séquences (compacts, chandelles, bottes, feux automatiques, assortiments).
- Interrupteur : **`?catalogue=0`** rabat chaque archétype neuf sur l'ancien le plus proche
  (dahlia → dahliaCli, farfalle → daisy, fontaine → pot à feu, bombettes → bombettes rouges…) ;
  les effets existants sont **inchangés** (vérifié sur 10 témoins banc B390 vs B391 : luminance et
  pixels allumés équivalents, aux aléas de tir près).

## 2. Archétypes créés en B391 (`src/render/threeFireworks.js`, table `EFFECTS`)

| Archétype | Pour quelles références | Ce qu'il montre | Source visuelle consultée |
|---|---|---|---|
| `dahlia` | « dahlia » purs (22 réf., 50-150 mm) | **peu d'étoiles, grosses, qui vont loin**, boule moins ronde que la pivoine, courte traîne | glossaire fireworks.com, dictionary.com, mentalfloss (« fewer, larger stars that travel farther ») |
| `peonyPistil`, `peonyPistilCli` | « pistil / centre couleur », « w/ red pistil », « green strobe pistil » | pivoine d'une couleur + **cœur** d'une autre (fixe ou clignotant) | glossaires pistil (Keystone, fireworks.com) |
| `kamuroPistil` | « extérieur kamuro centre violet/rouge… » (12 réf.) | enveloppe kamuro or + **centre de couleur** | idem pistil |
| `halfHalfCli` | « moitié-moitié centre cli. blanc » | deux hémisphères de couleur + cœur cli. blanc | — (composition de deux effets validés) |
| `palmEgg` | « centre œuf de dragon palme » | frondes de palme + cœur d'œufs de dragon qui claquent | — (composition) |
| `tracerTrunk` | « traçante tronc blanc » 125 mm (23 réf.) | traçante + **tronc blanc** de montée | — (désignation explicite) |
| `farfalle`, `farfallePistil` | « marguerite cylindrique », « marguerite tourbillon », « marguerite mosaïque » (Farfalle) | **pièces qui vrillent** en s'écartant (anneaux spiralés argent, Rodrigues) + étoiles de couleur / pistil | funtrivia (tube à évent, anneaux de titane spiralés + étoiles), vidéo catalogue `KOs-1JG1LRU` |
| `multibombe`, `multibombeMix` | « multibombe » (shell-of-shells — 18 réf. dans `catalogue_effets.csv` de la passerelle, 0 dans `effets.json`) | bombe qui libère des **sous-éclats** (petites pivoines) | définition « shell of shells » (glossaires) |
| `titane` | « bombe titane à étoiles », « silver tail to titane salute » (CSV passerelle) | boule verte + **étincelles titane** blanches à l'éclatement | — |
| `sifflet` | « sifflets », « hiboux » (compacts 20 mm) | **1 pièce** qui monte en **hélice serrée** avec une traîne argent (le son est à part) | Red Apple Fireworks (spinner : spirales tournantes + sifflement) ; hiboux : aucune source visuelle, rendu = sifflet |
| `fishBomb` | « poissons » 30 mm (compacts) | nuée de **petites pièces qui nagent** au hasard, traîne fine | Keystone (« swarm of squirming objects »), mentalfloss, vidéo catalogue `x9SnhfC73f8` |
| `colonne` | monocoups 30 mm « colonne bleu à citron », « kamuro à cli. blanc »… | pot à feu **haut et étroit** dont les billes **changent de couleur** A → B (fin cli. ou œuf) | vidéo catalogue `17Zu0qBXXc0` (pas de source écrite) |
| `bengale` | bengales, lances décor, torches | **flamme fixe** saturée (rouge, vert…), fumée teintée, lueur courte, 60 s | vidéo catalogue `px3HG9puyi0` |
| `fumee` | fumigènes (monocoups, goupille, théâtre) — effet **de jour** | **panache de fumée colorée** qui monte (~1 m/s) et dérive, 20 s | vidéo catalogue `80Zx0PhARJ4` |
| `fontaine` | fontaines, gerbes, volcans, gerbes titane (hauteur/durée de la référence) | **jet de sol** continu, étincelles fines argent/or qui retombent, panache de fumée discret | vidéo catalogue `rf9vx8DCJQA` |
| `girandole` | girandole espagnole 8 jets | **jets qui tournent** (roue horizontale), 40 s | Académie française (gerbe tournante), vidéo `34tflYgIFN4` |
| `cascadeLigne` | « cascade 10 m 24 jets 20 mm argent pointes rouge » | rideau de **24 jets vers le bas** sur 10 m, pointes rouges | vidéo catalogue `0lgccgRbqlI` |
| `cascadeRing` | « centre cascade cercle multicolore » 75 mm | gouttes de cascade + **cercle** de 24 étoiles face public | — (désignation) |
| `rings3` | « three rings w/ green strobe pistil » 150 mm | **3 anneaux** dans 3 plans + pistil clignotant | glossaires « ring shell » |
| `mosaicCrackle` | mosaïques crackling | mosaïque dont chaque pièce **crépite** | — (composition) |
| `candleDeto` | « chandelle déto » | chandelle de **marrons** (claquements, flash, pas d'étoiles) | — |
| `bombEgg`, `bombCrackle`, `bombCli`, `bombPalm`, `bombKamuroTips` | **bombettes** 30 mm des compacts / chandelles / pots à feu + bombette | les effets 75 mm à l'échelle bombette (vie ×0,5) : œuf de dragon, crackling, cli., palme, kamuro à pointes | — (réductions d'effets validés) |
| `compactMix` | feux automatiques, séries cartes, lesli (**103 réf.** sans détail d'effet) | séquence de **5 bombettes mêlées** (rouge, kamuro, crackling, cli., palme) au rythme du produit | — (le catalogue ne détaille pas ces produits) |
| `assortiment` | bouquets / assortiments | 5 bombes de pivoines variées | — |

Outils ajoutés au moteur pour ces archétypes : `makeDistEnvPistil`, `makeDistFarfalle` + `behaveFarfalle`,
`behaveMultibombe`, `behaveSifflet`, `behaveColonne` + `colonneFn`, `flareFn`, `distCascadeRing`,
`distRings3`, recyclage des cases d'étoiles (`_caseLibre`, effets de sol longs), `splitCrackle`, fumée
**teintée** (`spawnSmokePuff(..., tint, vy0)`), options gerbe `spin / jets / line / down / y0 / flare / tint / fumee`,
`opts.cfg` du `Shell` (surcharges par tir), **panache budgété** des effets de sol longs (`gerbeLongue` :
quelques bouffées/s au-dessus de la gerbe au lieu d'une par bille — sinon boule blanche), lueur d'air
réglable par effet (`airMin`, `airMul` : une flamme de 1 m n'a pas une lueur de 14 m).

## 3. Les 106 types (nombre de références, archétype, statut)

| Type d'effet | Réf. | Archétype(s) | Statut | Exemple de désignation |
|---|---|---|---|---|
| feu automatique (multi-effets, sans détail) | 94 | `compactMix` | **créé** | compact lesli 30 tirs volt! white red rebel |
| pivoine | 38 | `peony` | existait | bombe 50 mm pivoine rose aqua citron |
| mosaïque | 33 | `mosaic`, `mosaicMix` | existait | bombe 75 mm mosaïque rouge |
| saule / kamuro / brocart | 32 | `willowTips` | existait | 5 bombes 75 mm saule or à pointes assorties |
| compact de pots à feu | 30 | `mine30r` | existait | compact bande 9 tirs 30 mm éventaillé pot à feu bleu |
| crackling | 30 | `crackling` | existait | bombe 50 mm crackling bleu |
| compact bombettes (pivoines) | 29 | `bombRouge` | existait | compact 20 tirs 30 mm bombettes rose ascension citron |
| chandelle/compact pot à feu + queue de cheval pointe | 25 | `candle30qc` | existait | chandelle 30 mm 8 tirs comète traçante argent et queue de ch |
| compact/chandelle mosaïque | 25 | `mosaic` | existait | chandelle 49 mm 8 tirs mosaïque argent |
| monocoup : pot à feu | 25 | `mine30r` | existait | monocoup 40 mm pot à feu rouge |
| palme | 25 | `palm` | existait | bombe 75 mm palmes citron |
| moitié-moitié | 24 | `halfHalf` | existait | bombe 50 mm moitié kamuro moitié argent |
| feuille morte | 23 | `fallingLeaves` | existait | bombe 75 mm feuille morte rouge |
| final cli. blanc | 23 | `finalCli` | existait | bombe 50 mm à final cli. blanc rose |
| traçante | 23 | `tracer` | existait | bombe 75 mm traçante multicolore |
| traçante tronc blanc 125 | 23 | `tracerTrunk` | **créé** | bombe 125 mm traçante rose tronc blanc |
| dahlia (pur) | 22 | `dahlia` | **créé** | bombe 75 mm dahlia blanc |
| botte de chandelles (perles) | 21 | `candle10` | existait | botte de 3 chandelles 10 mm 20 tirs vert |
| compact/chandelle comètes | 20 | `candle30` | existait | compact 40 tirs 30 mm éventaillé comète cli. blanc |
| hors périmètre | 19 | — | — | planche d'étiquettes hydrophobes à allumeur (21 étiquettes) |
| chrysanthème | 18 | `chrysanthemum` | existait | bombe 50 mm chrysanthème bleu |
| compact bombettes kamuro | 18 | `bombKamuroTips`, `bombKamuro` | **créé** | compact 13 tirs 30 mm bombettes kamuro avec pointes multicol |
| bouquet / assortiment (pivoines variées) | 17 | `assortiment` | **créé** | 5 bombes 75 mm fantaisie |
| cli. / clignotant / scintillant (pivoine) | 17 | `cli` | existait | bombe 50 mm à effet cli. blanc |
| pot à feu + bombette | 17 | `bombRouge`, `bombKamuro`, `bombCli` | **créé** | compact 20 tirs 30 mm pot à feu et bombette kamuro |
| compact feuilles mortes | 15 | `fallingLeaves` | existait | compact 25 tirs 30 mm feuilles mortes rouge |
| pot à feu + comète traçante | 14 | `candle30`, `candle30k` | existait | chandelle 30 mm 8 tirs pot à feu argent + comète traçante ar |
| saule or pointes 100 | 14 | `willowTips` | existait | bombe 75 mm saule or pointes argent |
| atome | 12 | `atom` | existait | bombe 150 mm atome aqua |
| compact crackling | 11 | `bombCrackle` | **créé** | compact 20 tirs 30 mm bombettes crackling vertes |
| dahlia centre cli. blanc | 11 | `dahliaCli` | existait | bombe 100 mm dahlia blanc centre cli. blanc |
| monocoup : pot à feu + bombette | 11 | `bombRouge` | existait | monocoup 30 mm pot à feu rouge et bombette rouge |
| cascade | 10 | `cascade` | existait | bombe 50 mm à effet cascade or |
| compact méduse | 10 | `medusa` | existait | compact 40 tirs 30 mm z méduse rose |
| fumigène (jour) | 10 | `fumee` | **créé** | monocoup 30 mm fumigène bleu ciel avec infla 1 m - 117SS30-1 |
| compact série cartes (multi-effets) | 9 | `compactMix` | **créé** | compact 50 tirs 25 mm dix de coeur série cartes |
| ext. kamuro centre couleur | 9 | `kamuroPistil` | **créé** | bombe 75 mm extérieur kamuro centre vert |
| bengale / lance (feu fixe) | 8 | `bengale` | **créé** | lance décor rouge |
| centre œuf de dragon palme | 8 | `palmEgg` | **créé** | bombe 75 mm centre oeuf de dragon palme kamuro |
| compact/chandelle clignotant | 8 | `bombCli` | **créé** | compact 20 tirs 30 mm bombettes cli. vert ascension verte |
| marguerite cylindrique (Farfalle) | 8 | `farfalle` | **créé** | bombe 100 mm marguerite rouge cylindrique |
| monocoup : monocoup colonne | 8 | `colonne` | **créé** | monocoup 30 mm colonne bleu à citron |
| cercle progressif feuille morte | 7 | `fmRing` | existait | bombe 100 mm cercle progressif citron feuille morte bleu |
| compact palmes | 7 | `bombPalm` | **créé** | compact 20 tirs 30 mm palmes or crackling tronc bleu |
| moitié-moitié centre cli. blanc | 7 | `halfHalfCli` | **créé** | bombe 100 mm moitié citron moitié bleu centre cli. blanc |
| œuf de dragon (bombe) | 7 | `dragonEgg` | existait | bombe 50 mm à effet oeuf de dragon |
| cercle / anneau | 6 | `ring` | existait | bombe 100 mm silver ring dark sea blue peony silver (mèche c |
| compact tourbillons | 6 | `tourbBomb` | existait | compact 20 tirs 30 mm disque de tourbillons ascension rouge |
| compact/chandelle sifflets | 6 | `sifflet` | **créé** | botte de 3 chandelles 20 mm 7 tirs sifflet |
| crackling kamuro / willow | 6 | `crackling` | existait | bombe 50 mm crackling kamuro |
| moitié changeante centre cli. | 6 | `halfSwapCli` | existait | bombe 125 mm moitié citron à bleu moitié bleu à citron centr |
| monocoup : pot à feu + comète traçante | 6 | `candle30`, `candle30k` | existait | monocoup 30 mm pot à feu cli. blanc et comète kamuro |
| pistil / centre couleur | 6 | `kamuroPistil`, `peonyPistil` | **créé** | bombe 150 mm kamuro centre bleue |
| compact bombettes (générique) | 5 | `bombRouge` | existait | compact 50 tirs 20 mm éventaillé violet ascension argent |
| compact/chandelle œufs de dragon | 5 | `bombEgg`, `candle10egg` | **créé** | botte de 3 chandelles 10 mm 20 tirs oeuf de dragon |
| comète | 5 | `comet` | existait | bombe 75 mm comète violette (71640) |
| botte de chandelles clignotantes | 4 | `candle10` | existait | botte de 3 chandelles 10 mm 20 tirs scintillant blanc |
| corolle à pointes 75 | 4 | `corolle`, `corolleOr` | existait | bombe 75 mm à effet corolle or pointes rouge |
| kamuro à pointes | 4 | `willowTips`, `willowTips100` | existait | bombe 50 mm kamuro à pointes multicolore |
| mine (bombe de mines) | 4 | `horsetail` | existait | bombe 75 mm blue mines (mèche courte, infla direct uniquemen |
| monocoup : compact/chandelle comètes | 4 | `candle30` | existait | monocoup 30 mm comète kamuro |
| queue de cheval | 4 | `horsetail` | existait | bombe 75 mm flower crown horse tail (mèche courte, infla dir |
| volcan | 4 | `fontaine` | **créé** | volcan suisse 1 min or étoiles multicolore (2225) |
| chandelle déto | 3 | `candleDeto` | **créé** | chandelle 20 mm 7 tirs déto avec flash |
| compact poissons | 3 | `fishBomb` | **créé** | compact 20 tirs 30 mm poissons rouge |
| cœur | 3 | `heart` | existait | bombe 100 mm à effet coeur rose |
| ext. kamuro centre cli. blanc | 3 | `kamuroCli` | existait | bombe 75 mm extérieur kamuro centre cli .blanc |
| feu automatique Jacques Prévot (détail dans le simulateur 3D) | 3 | `compactMix` | **créé** | feu automatique éventaillé jacques prévot 5 min 226 tirs jup |
| marron d'air / déto | 3 | `salute` | existait | bombe 50 mm espagnole marron d'air |
| monocoup : compact bombettes (générique) | 3 | `bombRouge` | existait | monocoup 40 mm golden flashing tail ldc646gf |
| saule or pointes scintillant | 3 | `willowStrobe` | existait | bombe 75 mm saule or pointes scintillant rouge |
| tourbillon | 3 | `spinner` | existait | bombe 75 mm silver whirl flower color tail (mèche courte, in |
| zigzag | 3 | `zigzag` | existait | bombe 100 mm zigzag rouge |
| botte de chandelles kamuro (perles) | 2 | `candle10` | existait | botte de 3 chandelles 10 mm 20 tirs kamuro |
| compact marrons d'air | 2 | `salute` | existait | compact 25 tirs 25 mm marron d'air 25 s |
| gerbe (jet bref) | 2 | `fontaine` | **créé** | gerbe argent titane (4,5 m, 1,5 s)  (4815) théâtre |
| kamuro longue durée | 2 | `willowLong50`, `willowLong150` | existait | bombe 50 mm kamuro longue durée |
| marron d'air multi | 2 | `saluteMulti` | existait | bombe 75 mm cylindrique espagnole multi marron d'air |
| palme multicolore | 2 | `palmMulti` | existait | bombe 75 mm palmes multicolore |
| palme or scintillant | 2 | `palmStrobe` | existait | bombe 75 mm palme or scintillant blanc |
| papillon | 2 | `butterfly` | existait | bombe 75 mm à effet papillon |
| sifflet (tournant) | 2 | `sifflet` | **créé** | bombe 100 mm espagnole pot à feu crackling cercle déto et si |
| soucoupe | 2 | `saucer` | existait | soucoupe espagnole double ascension or scintillant |
| à tronc saule kamuro | 2 | `willowTrunk` | existait | bombe 75 mm à tronc saule kamuro |
| D10 composé 150 | 1 | `d10` | existait | bombe 150 mm D10 – centre bleu + cercle kamuro traçant + cer |
| D8 composé 150 | 1 | `d8` | existait | bombe 150 mm D8 – centre bleu + cercle traçant rouge + jaune |
| D9 composé 150 | 1 | `d9` | existait | bombe 150 mm D9 – kamuro à final plume rouge + centre plume  |
| cascade (centre) + cercle | 1 | `cascadeRing` | **créé** | bombe 75 mm à effet centre cascade cercle multicolore |
| cascade de jets (ligne) | 1 | `cascadeLigne` | **créé** | cascade 10 m 24 jets 20 mm argent pointes rouge monté sur fi |
| compact hiboux | 1 | `sifflet` | **créé** | compact 100 tirs 20 mm z hiboux multicolore |
| dragon (brocart à pointes) | 1 | `willowTips` | existait | bombe 150 mm purple dragon (mèche courte, infla direct uniqu |
| explosions sur l'eau (nautique) (nautique) | 1 | `saluteMulti` | existait | bombe 100 mm nautique 4 water explosions rainbow |
| fantôme | 1 | `fantome` | existait | bombe 100 mm à effet fantôme argent pointes rouge |
| fontaine | 1 | `fontaine` | **créé** | compact nautique 20 tirs éventaillé fontaine argent |
| française tricolore | 1 | `halfHalf` | existait | bombe 100 mm française bleu blanc rouge (atpm) |
| française tricolore (nautique) | 1 | `halfHalf` | existait | bombe 75 mm nautique française multicolore (atpm) |
| girandole | 1 | `girandole` | **créé** | girandole espagnol 8 jets argent puis or puis argent puis or |
| kamuro final cli. blanc centre cli. blanc | 1 | `kamuroCli` | existait | bombe 150 mm extérieur kamuro final cli. blanc centre cli. b |
| kamuro à pointes (nautique) | 1 | `willowTips100` | existait | bombe 100 mm nautique peony kamuro multiflash tips |
| monocoup : compact/chandelle œufs de dragon | 1 | `bombEgg` | **créé** | monocoup 30 mm bombette oeuf de dragon à tronc |
| pivoine de couleur (désignation = couleur seule) | 1 | `peony` | existait | 5 bombes 75 mm en or |
| pot à feu 75 mm (bombe) | 1 | `mine` | existait | bombe 75 mm pot à feu rouge |
| saule pleureur pointes | 1 | `willowTips100` | existait | 5 bombes 100 mm saule pleureur pointes couleurs assorties |
| sourire | 1 | `smiley` | existait | bombe 75 mm à effet sourire |
| sphère / bombette colorée | 1 | `peony` | existait | bombe 75 mm multicol wave w/silver tail (mèche courte, infla |
| trois cercles + pistil | 1 | `rings3` | **créé** | bombe 150 mm three rings w/green strobe pistil (mèche courte |

## 4. Ce qui reste approximatif (à vérifier par l'utilisateur)

- **Feux automatiques / séries cartes / lesli (103 réf.)** : le catalogue ne décrit pas les effets ; rendu
  = mélange de 5 bombettes au rythme (tirs, durée) de la référence. Les feux automatiques Jacques Prévot
  détaillés dans le simulateur 3D (`outils/simu3d/feux_auto.js`, effets « nouveaux », ex. 046) gardent
  la priorité : le catalogue n'est consulté que si `effetNouveau` ne connaît pas la désignation.
- **Hiboux** : rendu comme le sifflet (hélice + traîne argent) ; le « son hibou » relève du chantier son.
- **Colonne, poissons (FR), multibombe** : aucune description écrite trouvée en ligne ; rendu d'après les
  vidéos du catalogue et les glossaires anglais (fish, shell of shells).
- **Nautiques** (française tricolore, kamuro nautique, « water explosions ») : rendus comme l'effet
  aérien équivalent posé bas (`nautique:true`) ; pas de gerbe d'eau.
- **Multibombe / titane** : archétypes présents mais **aucune référence dans `effets.json`** (18 et 2 réf.
  dans `catalogue_effets.csv` de la passerelle) ; jouables par désignation (simulateur 3D).
- **Hauteurs des produits de sol** : `hauteur_m` du catalogue quand il existe, sinon valeur de
  l'archétype (fontaine 4-10 m, girandole 6 m, cascade 10 m).
- **Lampions, étiquettes, systèmes de tir, fil, allumeurs** : hors périmètre (pas d'image).
- **Notation à l'aveugle** : les planches sont prêtes (`scratchpad/envoi/aveugle_B391/` + clé) mais la
  notation par relecteurs indépendants n'a pas encore été faite dans ce chantier — à lancer au jury final.
