# PrevoFX Web — État du projet

> Document vivant : où on en est, ce qui est fait, ce qui reste, la ligne directrice,
> les effets et leurs caractéristiques. Tenu à jour au fil des sessions.
> **Dernière mise à jour : 2026-10-23 (B388 : montée 75 mm = 2,5 s ; B387 : montées balistiques ; B386 : marrons sans étincelles ; B385 : marrons d'air ; B384 : chandelles ; B383 : chute réaliste, dispersion 10 % ; B382 : tailles angulaires, iPhone non cramé ; B381 : décor éclairé, ciel, fumée, bloom rond — notation à l'aveugle face à FWsim).**
>
> 📌 **VERSION DE BASE = B379** (choix user, 2026-10-22) : commit `9060f65`, branche figée
> **`base-B379`**, état AVANT les modifications de rendu B380. C'est la référence de retour :
> `git checkout base-B379`, ou en ligne `?look=b379` (rendu B379 à l'identique dans la B380).

---

## 1. Ligne directrice (le but)

Une **application navigateur** : le client pyrotechnicien choisit un **lieu de tir**
(n'importe où sur Terre, terrain réel photoréaliste) + un **show**, et obtient un
**aperçu visuel direct**. Aucune installation, distribuable par simple **URL**.

- **Décor** = CesiumJS + Google Photorealistic 3D Tiles (relayés par Cesium ion).
- **Feux** = moteur **Three.js** rendu en **overlay additif** par-dessus le décor.
- **Cap visuel = « niveau 3 »** : on vise le feu **vu à travers une caméra** (bloom,
  flou de mouvement, étalonnage « vidéo/ciné »), **pas** le réel à l'œil nu.
- **Source de vérité = les données** : catalogue Prévot (`data/effets.json`) + recettes
  d'effets portées du prototype Unreal et de l'étude `ressources/effets_reference.md`.

> ⚠️ Historique : le projet a connu deux pivots (app NW.js → simu Unreal Engine 5 →
> **app web Cesium+Three.js, qui est la ligne ACTIVE**). Le dossier `unreal/` et
> `git hub base/` ne sont plus la cible ; ils servent de réservoir de logique à porter.

---

## 2. Pile technique & arborescence

| Brique | Choix | Pourquoi |
|---|---|---|
| Globe / terrain / caméra | **CesiumJS 1.122** (CDN) | streaming terrain réel mondial |
| Terrain photoréaliste | **Google 3D Tiles via Cesium ion** | Google bloque l'accès direct par clé pour l'**EEA (Europe) → 403** ; ion relaie via un compte US → ça passe |
| Rendu des feux | **Three.js 0.160** (importmap CDN) + `EffectComposer`/`UnrealBloomPass`/ACES | vrai additif HDR + bloom ciné, impossible avec les billboards Cesium |
| Composition | canvas Three transparent en `mix-blend-mode: screen` au-dessus de Cesium | le noir n'affecte rien, les feux **s'additionnent en lumière** sur le décor |

```
web/
├── index.html              ← Cesium + importmap Three + HUD ; charge src/main.js
├── src/
│   ├── main.js             ← bootstrap : viewer Cesium, token ion, lieu de tir,
│   │                          calage du sol, boucle de rendu maison, sélecteur d'effet
│   ├── cameraController.js  ← FpsCameraController (vue public, QZSD, clic-glisser, sol dur)
│   └── render/
│       └── threeFireworks.js ← LE MOTEUR : classe Shell + table EFFECTS (25 effets) + overlay
├── data/effets.json        ← catalogue Prévot (1168 effets) — pas encore branché à l'UI
├── three-engine.html       ← page de test PIVOINE seule (référence, non multi-archétype)
└── README.md / ETAT_DU_PROJET.md
```

> `src/sim/firework.js` et `src/render/fireworksLayer.js` sont d'anciens prototypes
> (billboards Cesium) **remplacés** par `threeFireworks.js`. Gardés pour référence.

### Déploiement
- Repo : **`github.com/leo-52/virtual-firework`**, on pousse **uniquement le dossier `web/`**
  sur la branche **`web`** (PAS le projet Unreal de ~3,9 Go).
- Hébergement : **GitHub Pages → https://leo-52.github.io/virtual-firework/**
  (ajouter `?v=<hash>` pour forcer le rafraîchissement du cache).
- Le token Cesium ion est dans `src/main.js` (`ION_TOKEN`) — repo public assumé.

---

## 3. Physique (le cycle de vie d'un tir) — NE PAS PERDRE

C'est le squelette commun à tous les effets « bombe ». À chaque régression visuelle,
**ne jamais larguer cette physique** en itérant l'esthétique.

1. **Sortie du tube (muzzle)** : modèle d'après une vidéo de tir **150 mm** → **jet vertical de
   flamme** (bouffées = *sprites* additifs, car `PointsMaterial` ne grossit pas par particule)
   **jaune-blanc à la gueule → orange** qui **champignonne**, **flare de lumière à la gueule**
   (source basse), **flamme BRÈVE (~0,15 s) + COLONNE DE FUMÉE** (bouffées grises chaudes qui
   montent et se dissipent en ~3 s) + **débris** éjectés. Tout ∝ calibre (`muzzleScale = cal/75` :
   75 mm=1, 150 mm=2, 50 mm=0,67). Pool de bouffées `PUFF_MAX=320`, mis à jour par `updatePuffs`.
2. **Montée (rise)** : comète en `easeOut` (`y = apex·(1-(1-T)²)`) + traînée de poudre.
3. **Apex** → **explosion depuis le centre** (vitesse = `burstRadius · speedMul`).
4. **Vol** : `vy -= G·gravStar·dt` (gravité par type) + **frein linéaire** `v *= (1-dragStar·dt)`.
5. **Retombée** gravitaire → **extinction quasi simultanée (±10 %)**.

**Règle couleur** (validée par l'user, pyrotechnicien) : la couleur **tient jusqu'au bout**
(pas de refroidissement rouge-braise → `heat:false` sur la plupart des effets ; un bref
flash d'allumage est OK). Brillance de référence : `3.4 · (1-A²·0.85) · dimVar · fadeIn`
(punch HDR : les cœurs saturent en blanc-chaud, halo coloré au bloom = effet « ça brûle »).
Chaque étoile a un **cœur d'ignition** blanc-jaune sur les premiers 15 % de sa vie (réaliste :
incandescent → couleur tenue), ce qui donne le grain « feu / comète ».

**Rendu des étoiles B380** (user : « ça fait fade, faux, générique » face à FWsim) — l'ASPECT
seul change, la physique et les réglages d'effets sont intacts :
- **Halo** de la couleur PURE de l'étoile autour de sa tête, de taille ~fixe À L'ÉCRAN
  (`STAR_LOOK.haloPx = 13 px`, `haloI = 0.18`) : il habille les petites étoiles lointaines, les grosses
  têtes (palme) ne gagnent qu'un léger rayonnement (`haloMin = 1.35`) et gardent leur or. Le noyau
  d'avant est dessiné à l'identique au centre du sprite. Traînées : halo léger (`TRAIL_LOOK`).
- **Taille mini** 1,6 px à l'écran (avant : sous-pixel au loin -> étoile qui disparaît / clignote),
  éclat réduit en proportion.
- **Lueur de l'air** par bombe : sprite très doux, opacité ∝ lumière réellement émise par les
  étoiles (`AIR_K`, plafond `AIR_MAX = 0.12` — une lueur, jamais un brouillard, cf B106), teinte
  = couleur moyenne réchauffée (sinon une bombe blanche/or faisait un voile gris), centrée sur le
  barycentre, taille = étalement des étoiles. Elle naît, grandit et s'éteint avec la bombe.
- **Comparer** : `…/virtual-firework/?look=b379` = rendu d'avant à l'identique ; `?air=0` = sans lueur d'air.

**Scène B381** (objectif « 8/10 face à FWsim », jugé par des relecteurs indépendants À L'AVEUGLE
sur captures mélangées avec celles de FWsim) — toujours sans toucher à la physique des effets :
- **Le décor est éclairé par les feux** (`main.js`, CustomShader sur les Google 3D Tiles) : les tuiles
  (photos de jour) passent en nuit (`GROUND_AMB`), puis reçoivent la lumière des 8 sources les plus
  fortes du moteur (`layer.lights()` : étoiles de chaque bombe, flash d'ouverture, flash de gueule
  des mortiers, traînées), couleur réelle, 1/d², orientation des surfaces. Gain : `GROUND_K`.
- **Ciel** : post-traitement Cesium, peint seulement là où il n'y a pas de décor (les collines le
  masquent) — dégradé selon l'élévation + étoiles clairsemées fixes ; fond d'étoiles Cesium, soleil
  et lune masqués. `?ciel=bleu|nuit|noir`.
- **Cadrage** : objectif 76° (au lieu de 60°) visé à 46 m -> l'horizon et le décor entrent dans le
  cadre, comme chez FWsim. Position du public inchangée (150 m, dans l'axe).
- **Fumée** : chaque étoile laisse des bouffées sur son trajet (points texturés « nuage », 1 appel de
  dessin) qui dérivent ~20 s ; éclairée par les bombes SUIVANTES et par le flash, pas par ses propres
  étoiles (sinon : « flou », « tache »). `?fumee=0` pour couper.
- **Traînées pailletées** (`TRAIL_LOOK.spark`) : l'éclat de chaque grain saute ~14×/s, moyenne inchangée.
- **Étoiles** : petite taille mini (3,5 px, bord doux = rondes), cœur blanc-chaud sur la TÊTE seulement
  (sur la queue : « paires d'étoiles »), 2 halos calculés par étoile (serré 8 px + large 20 px).
- **BLOOM ROND** : le flou du bloom de Three.js r160 coupe sa gaussienne à 1 sigma -> noyau presque
  CARRÉ : tout point très vif (éclair de crackling, tête) avait une lueur carrée, sur TOUS les GPU.
  Corrigé : même largeur, noyau prolongé à 2,5 sigma (`?bloomk=0` = noyau d'origine). Du coup le bloom
  peut être plus fort : `BLOOM_DEF = [0.8, 0, 0.55]` (seuil B106 GARDÉ : la masse faible ne bloome pas)
  et les 2 niveaux les plus larges coupés (`BLOOM_FACTORS`, `?bloomf=`) -> pas de voile brun autour
  des saules. Coût : ~2,5× plus d'échantillons dans le flou du bloom (images réduites, faible).
- **Lueur de l'air** retirée par défaut (« cercle de brouillard ») — `?air=1` pour la revoir.
- **Réglages par l'adresse** (banc d'essai) : `?halo=px,I &halo2=px,I &thalo2=px,I &white= &expo= &var=
  &sspark= &minpx= &soft= &bloom=f,r,s &bloomf=5 poids &bloomk= &air= &sol=K,amb &fumee=0 &ciel=`.
- **Mesure à l'aveugle (2026-10-22)** — 13 images PrevoFX choisies par règle fixe (4+3 instants de 2
  spectacles + 6 bombes isolées), mélangées avec 10 captures FWsim publiques, notées par des relecteurs
  indépendants ; note équivalente = 9 × (moyenne PrevoFX / moyenne FWsim) :
  | | spectacle | bombes isolées | global |
  |---|---|---|---|
  | B379 (même relecteur que la ligne B381 c) | 7,3 | 5,2 | 6,3 |
  | B381 relecteur a | 7,6 | 5,4 | 6,6 |
  | B381 relecteur b | 7,8 | 5,2 | 6,6 |
  | B381 relecteur c (lot avec B379) | 9,25 | 6,6 | 8,0 |
  Ce qui reste bas : les effets « à points » vus seuls (pivoine, chrysanthème 50, dahlia, crépitement)
  — tous les relecteurs veulent des FILÉS sur les étoiles, ce qui toucherait la pivoine validée (sans
  traînée, boule quasi figée). Option non activée : `?expo=0.35` (pose plus longue du flou de mouvement).
- **B382 (user sur iPhone : « c'est cramé », « ça ne vit pas »)** : la taille des étoiles en px ne suivait
  pas l'objectif. En PORTRAIT (téléphone) le champ de 76° devient vertical -> la bombe rapetisse à
  l'écran mais pas ses étoiles/halos -> chevauchement, addition, blanc. Désormais étoiles, traînées,
  halos et fumée ont une taille ANGULAIRE, référence = écran 16:9 (sur ordinateur rien ne change, rendu
  validé à l'aveugle ; une référence B379 plus petite avait fait perdre ~0,5 point à l'aveugle).
  `?angul=0` = ancien calcul. + léger vacillement de combustion des étoiles (`spark 0.2`) et éclats
  inégaux (`var 0.25`), pour la vie en mouvement. Note : le calque des feux est rendu à 2× au plus
  (`setPixelRatio`), un iPhone 3× l'agrandit de 1,5 (léger flou) — passer à 3 coûterait ~2,3× en pixels.
- **B383 (physique, accord user)** : CHUTE en fin de vie séparée de l'éjection (l'ouverture et l'envergure
  validées ne bougent pas) avec la vitesse limite réelle d'une étoile (18 m/s en 75 mm, ∝ √ échelle du
  calibre ; docs/physique) pour les étoiles lourdes (gravStar ≥ 0,9) -> la pivoine « fond » de ~7 m au
  lieu de ~4,5 m. Saules, feuilles mortes, effets légers inchangés. `?chute=0` = avant. Dispersion des
  durées d'étoiles (BASE.lifeJitter) 13 % -> 10 % (user : « les japonais c'est de l'art », 10 % =
  fournisseur standard).
- **B384 (user : « fais les chandelles »)** : la TÊTE DE MONTÉE (bille de chandelle, tête de toute bombe qui
  monte) passe au rendu des étoiles (halo, cœur blanc, flou de mouvement, taille angulaire), même
  texture/taille/couleur qu'avant -> passage tête -> étoile toujours sans saut (B355). `?tete=0` = avant.
  Chandelles « œuf de dragon » : le nuage de 230 grains (B363) faisait une boule blanche floue avec le bloom
  B381 -> éclat ×0,45 (`?oeuf=1` = avant) : grappe crépitante visible, éclair blanc conservé.
- **B385 (user : « refais les marrons d'air, ils sont moches »)** : le marron simple était une grosse boule
  grise à bord net (sprite de 12 m pendant 0,3 s). Désormais (`saluteBlast`) : ÉCLAIR blanc très bref
  (0,07 s, petit et très vif, le bloom fait l'éblouissement) + gerbe de ~140 étincelles blanches qui fusent
  (45-85 m/s, freinées, 0,1-0,4 s) + BOULE DE FUMÉE blanche formée d'un coup et éclairée par son propre
  flash, qui reste en l'air (~25 s). Multi-marron : même éclair/étincelles/fumée à chaque détonation, les
  90 grains argentés superposés à demi-éclat (sinon boule floue avec le bloom B381) ; forme validée
  (paquet qui s'ouvre en cercle, B167-168), instants et hauteurs inchangés. `?marron=0` = avant.
- **B386 (user : « le marron ne fait presque pas d'étincelles, à la manière d'un pétard, c'est juste de la
  poudre »)** : gerbe d'étincelles retirée (marron simple : 15 grains à peine visibles, 0,04-0,12 s ; multi :
  aucune ajoutée — son paquet validé B167-168 reste), les 14 petites étoiles argentées du marron simple
  masquées. Reste : éclair bref + boule de fumée. Tête de montée : halo DISCRET des traînées pour les bombes
  (le halo des étoiles faisait briller la montée presque autant que l'éclatement), look étoile gardé pour
  les CHANDELLES (noIgnite : la bille est l'étoile).
- **B387 — MONTÉES refaites (user : « refais les montées, la physique, l'aérodynamisme »)** — docs/physique 07 et 08 :
  - TEMPS tir -> éclatement recalé sur la profession : 75 mm (80 m rendus) ≈ 2,9 s, 100 mm ≈ 3,4 s,
    150 mm ≈ 4,5 s, 30 mm ≈ 1,8 s (`2,9 s × (apex/80)^0,62`, principe B192 gardé). Avant : 75 mm ≈ 2,2 s.
    Effets à montée chronométrée par l'user (riseTime explicite : zigzag, saule pointes 100…) inchangés ;
    chandelles et noRise gardent l'ancienne courbe (calées sur vidéo).
  - TRAJECTOIRE balistique réelle : gravité + traînée quadratique (C_D 0,45, masse/diamètre par calibre),
    vitesse de sortie résolue (75 mm ≈ 51 m/s) -> départ fulgurant puis ralenti ; éclatement AVANT le
    sommet (la bombe monte encore ~8-10 m/s) et les étoiles héritent de cet élan (comme Finale). Légère
    dérive au vent en haut de course (trajet très légèrement arqué, points de départ/éclatement inchangés).
  - TRAÎNÉE émise à cadence fixe (plus de chapelet de perles par mètre) -> densité ∝ 1/vitesse : paquet
    lumineux sous l'éclatement. Bombe nue = mince filet de MÈCHE terne (`?meche=k`, défaut 1,6), tête =
    point net ; PALMIERS (`risingTail:'gold'`) = vraie comète dorée (tronc fin, irrégulier, pailleté).
  - DÉPART : étincelles de chasse (courte gerbe orange qui suit la bombe 5-30 m) + fumée de levée
    persistante sur le pas de tir (suit le vent, éclairée par les flashs).
  - À l'aveugle (salves au ras du sol, FWsim = 9) : montée 8,2 et 8,9 (deux relecteurs) contre 5,0-5,6
    pour l'ancienne. `?montee=0` = ancienne montée.
- **B388 (user : « fais un entre-deux pour les bombes : 2,5 s de montée »)** : temps tir -> éclatement de la 75 mm
  (80 m) = 2,5 s (`RISE_T80`), entre l'ancien moteur (~2,2 s) et la profession (~2,9 s). Même loi pour les autres
  calibres : 100 mm ≈ 2,9 s, 150 mm ≈ 3,9 s, 30 mm ≈ 1,5 s. La bombe sort un peu plus vite (~54 m/s) et éclate en
  montant encore à ~15 m/s (dans la fourchette Kosanke 15-20 m/s). Montées chronométrées par l'user inchangées.
- ⚠️ **Banc d'essai** : entre deux captures sur la même page, il FAUT laisser s'éteindre traînées et
  fumée (≥ 25 s de simulation), sinon la fumée de l'effet précédent, éclairée par le suivant, pollue
  l'image (des tours de relecture ont été faussés ainsi).

**Calibrage (données catalogue « donnée A » + métier user)** :
| Calibre | Donnée A catalogue (m) | Hauteur RENDUE (×0,89, m) | Nb étoiles pivoine | Envergure (diam., m) |
|---|---|---|---|---|
| 50 mm | ~67 | ~60 | — | — |
| **75 mm** | **~90** | **~80** | **80** | **~50 (rayon ~25)** |
| 100 mm | ~117 | ~104 | **130** | (à fournir) |
| 150 mm | ~200 | ~178 | — | (à fournir) |

Moteur : `apex 90` (donnée catalogue), `burstRadius 13.5` → envergure mesurée ~48 m.
⚠️ **`APEX_SCALE = 0.89`** : hauteurs **abaissées de 11 %** au rendu pour caler la **pivoine 75 mm
à ~80 m** (valeur voulue par l'user). `riseTime` suit le même facteur (montée pas plus molle).
C'est **le knob unique** pour régler la hauteur globale.
Échelle des étoiles ~`calibre^1.7`. `CAL_SCALE` pilote la durée de vie par calibre.
`STAR_SCALE = 1.2` (toutes les étoiles +20 %, réglage global demandé).

---

## 4. Caméra & contrôles (vue public)

- **Vue par défaut** : hauteur d'homme (1,75 m), à **150 m**, **dans l'axe de tir**
  (`CAM_LOCAL [0,-150,1.75]`, vise le burst à ~60 m → regard ~+21°).
- **Déplacement QZSD** (AZERTY, lu par `e.code`) : Z/S avant-arrière, Q/D gauche-droite,
  A/E bas-haut, **Shift = rapide**.
- **Rotation** = clic gauche maintenu + glisser. **Molette** = dolly (avancer/reculer).
- **Sol DUR** : la caméra ne descend pas sous le terrain.
- **Espace = pause/play** (barre de lecture en bas, `src/timeline.js`) : fige la **sim des feux**
  (artifices suspendus en l'air pour inspecter) ; la **caméra reste libre** (`main.js` passe `dt=0`
  au layer mais le vrai `dt` à la caméra). La barre montre horloge + progression du tir + effet courant.

---

## 5. Les 25 effets (table EFFECTS)

Tout effet absent de la table hérite de `BASE` (= profil pivoine). Chaque effet n'active
que les hooks dont il a besoin : `dist` (distribution 3D), `dist2D` (forme face public),
`trailing` (traînée), `onStar` (visuel par frame), `behave` (physique/forks), `colors`
(multi-couleurs), `gerbe` (gerbe au sol), `flashBig` (salut).

### Base sphérique
| Effet (label) | Caractéristique clé |
|---|---|
| **pivoine** (`peony`) | étoiles fines orange, **sans traînée**, meurt avant de tomber. **VALIDÉE — ne pas y toucher.** |
| **chrysanthème** (`chrysanthemum`) | pivoine **+ traînée d'étincelles or**. |
| **sphère** (`sphere`) | pivoine **plus régulière** (moins de dispersion). |

### Traîne / retombée longue
| **saule** (`willow`) | **forme** qui retombe et **pend** ; traînée or longue (×4). KAMURO = la **couleur** (or pailleté). |
| **comète** (`comet`) | **1 seule étoile, AUCUN éclatement** ; grosse, brûle longtemps, traînée or chaud. La montée EST l'effet. |
| **palme** (`palm`) | **frondes** (effet palme), **PAS de tronc**, traînée or. |
| **méduse** (`medusa`) | dôme cyan + tentacules qui pendent. |
| **queue de cheval** (`horsetail`) | faisceau étroit vers le haut, or, glitter, très longue traînée. |
| **cascade** (`cascade`) | rideau d'or qui retombe. |
| **feuille morte** (`fallingLeaves`) | feuilles colorées **super légères**, **tangue au gré du vent** (`sway`), **sans traînée**, durée très longue (×6). |

### Crépitant / scintillant
| **crackling** (`crackling`) | **pivoine de la couleur** (ext. pur) **+ pistil doré au centre qui crépite** (pops blancs, surtout vers la fin). Couleur via override (`crackling aqua`…). |
| **œuf de dragon** (`dragonEgg`) | **tout** le break crépite en pops dorés (≠ crackling). |
| **scintillant** (`strobe`) | **entre-deux** : ni noir ni éclairé, pulse doux argent (pas un on/off net). |
| **salut** (`salute`) | détonation : **flash énorme bref** (`flashBig`), argent. |

### Formes 2D (face public)
| **cœur** (`heart`) · **papillon** (`butterfly`) · **smiley** (`smiley`) · **marguerite** (`daisy`) | dessin projeté **face au spectateur** (`dist2D`), multi-couleurs. Catalogue vérifié (B127) : cœur = **21 étoiles, 100 mm uniquement** (116 m) ; sourire 75 mm = **15 cercle orange + 2 yeux verts + 5 bouche rouge** (95 m). Focus sourire/cœur → **duo tiré en éventail** (mortiers inclinés, `SHAPES_DUO`). |

### Motifs 3D multi-couleurs
| **atome** (`atom`) | 3 anneaux croisés, cyan/rose/jaune. |
| **demi-demi** (`halfHalf`) | sphère à 2 hémisphères de couleurs ≠ (rouge / bleu). |
| ~~couronne (`ring`)~~ | **SUPPRIMÉ (B127)** — plus aucune bombe « effet cercle » seule au catalogue (production 75 mm arrêtée). |

### Mouvement (hook `behave`)
| **poisson** (`fish`) | étoiles qui **serpentent**, vert, rapide. |
| **tourbillon** (`spinner`) | étoiles en **vrille** autour d'un axe, argent. |
| **soucoupe** (`saucer`) | monte, **rebondit**, retombe, or. |
| **mosaïque** (`mosaic`) | 8 comètes argent qui **forkent en 4** à mi-vie (coquille de coquilles). |

### Sol
| **pot à feu** (`mine`) | **gerbe au sol** qui **monte haut** (pas de montée ni de burst), or. |

> Démo : l'effet sélectionné **tourne en boucle** (`PrevoFX.focus`) — jamais un défilé.
> Sélecteur en haut à droite. Console : `PrevoFX.focus('willow')` ou `PrevoFX.fire('atom')`.

---

## 6. Pièges techniques résolus (à ne pas réintroduire)

- **Boucle de rendu** : Cesium « s'endort » quand la scène est stable → l'overlay se fige.
  Fix : `viewer.useDefaultRenderLoop = false` + **rAF maison** (`cam → layer → scene.render → layer.render`).
- **FREEZE (vue plongeante)** : `_groundUnder` lisait `scene.sampleHeight` **sous la caméra**,
  qui renvoie des valeurs aberrantes (~700 m, artefacts tuiles Google) → la caméra était
  propulsée à +291 m → vue plongeante → des milliers de tuiles → gel. Fix : `_groundUnder`
  retourne le sol du **lieu de tir** (terrain ~plat autour).
- **Vue par défaut « pas fiable »** : calage du sol par **médiane d'une grille 9 points**
  (±15 m) + **retry jusqu'à stable** (les tuiles chargent en différé).
- **Charge tuiles** : `maximumScreenSpaceError = 24` (tuiles plus grossières) pour alléger.
- **Three.js** : `PointsMaterial` **ignore** la taille par-point → il faut régler
  `material.size` (global). La brillance vient du **punch HDR** (couleur ×~2, ACES encaisse), pas de l'accumulation de traînées.
  → Les **étoiles** utilisent désormais un **ShaderMaterial** avec attribut `size` PAR point
  (`uH=0.5·hauteurBuffer` reproduit la sizeAttenuation à l'identique) → on peut varier la taille
  par étoile (ex. mosaïque : grosses comètes + petites secondaires via `cfg.splitStarSize`). Le pool
  de traînées reste en `PointsMaterial` (taille globale 0.8).
- **Traînée morte qui ne disparaît jamais** (corollaire du point ci-dessus) : comme `size`
  est ignoré, mettre `trailSize=0` ne cache PAS un grain mort — il restait figé à sa dernière
  **couleur** (faible mais non nulle) pour toujours, surtout l'amas dense d'étincelles **muzzle**
  au-dessus du tube. Fix : **zéroter la COULEUR** des grains morts dans `updateTrails` (le fondu
  des traînées ne tient QUE par la couleur, jamais par la taille).
- **Cache des modules JS** (piège SÉRIEUX) : le navigateur met en cache chaque module ES par
  son URL ; le `?v=` sur la page **ne rafraîchit PAS** `threeFireworks.js` → on voyait l'ANCIEN
  code après un déploiement (des correctifs ne parvenaient jamais au navigateur). Fix :
  `index.html` importe `main.js?v=Date.now()` et `main.js` **propage ce `?v=`** à ses imports
  enfants (`threeFireworks.js`, `cameraController.js`) → tout est rechargé frais à chaque visite.
- **Vérification** : screenshots de Cesium impossibles (rendu continu → timeout). On vérifie
  **numériquement** via `preview_eval` (`window.PrevoFX`) ou **visuellement sur GitHub Pages**.

---

## 7. Ce qui reste à faire

**Court terme (calibrage)**
- [ ] **Envergure exacte par calibre** (l'user va la fournir — le web ne la documente pas).
- [ ] Nb d'étoiles par calibre pour les autres effets.
- [ ] Confirmer la **sortie du tube** (jet étroit, dernier réglage `626bd4a`) ; si encore trop
      épais → rendre les étincelles plus fines (taille globale du pool de traînées).

**Moyen terme (produit)**
- [x] **Timeline** v1 : barre de lecture en bas + **Espace = pause/play** (fige les feux, `src/timeline.js`).
      Reste : un vrai **show** (séquence d'effets datés) + **scrub** ←/→ ±0,5 s (nécessite un sim rejouable déterministe).
- [ ] **UI client** : choix du **lieu** (carte / adresse) + choix du **show**.
- [ ] Brancher **`data/effets.json`** : dérivation auto archétype + calibre + couleurs par référence.
- [ ] **Durées** calées sur la table Finale 3D par effet × calibre (cf `effets_reference.md`).
- [ ] **Sons** procéduraux (crackling, sifflet, marron) — spec dans `effets_reference.md`, pas encore web.

**Validé / à ne PAS retoucher**
- [x] Pivoine (look + physique) — laissée telle quelle.
- [x] Les 25 effets portés et tirant sans erreur.
- [x] Freeze + vue publique fiable.

---

## 8. Liens internes
- `README.md` — comment lancer / déployer.
- `../ressources/effets_reference.md` — taxonomie, durées Finale 3D, chimie, sons (autorité effets).
- `data/effets.json` — catalogue Prévot (donnée A = `hauteur_m`).
