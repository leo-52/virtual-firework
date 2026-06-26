# PrevoFX Web — État du projet

> Document vivant : où on en est, ce qui est fait, ce qui reste, la ligne directrice,
> les effets et leurs caractéristiques. Tenu à jour au fil des sessions.
> **Dernière mise à jour : 2026-06-25.**

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
| **cœur** (`heart`) · **papillon** (`butterfly`) · **smiley** (`smiley`) · **marguerite** (`daisy`) | dessin projeté **face au spectateur** (`dist2D`), multi-couleurs. |

### Motifs 3D multi-couleurs
| **atome** (`atom`) | 3 anneaux croisés, cyan/rose/jaune. |
| **demi-demi** (`halfHalf`) | sphère à 2 hémisphères de couleurs ≠ (rouge / bleu). |
| **couronne** (`ring`) | anneau plan, **orientation 3D aléatoire** (pas toujours droit). |

### Mouvement (hook `behave`)
| **poisson** (`fish`) | étoiles qui **serpentent**, vert, rapide. |
| **tourbillon** (`spinner`) | étoiles en **vrille** autour d'un axe, argent. |
| **soucoupe** (`saucer`) | monte, **rebondit**, retombe, or. |
| **mosaïque** (`mosaic`) | 8 comètes argent qui **forkent en 4** à mi-vie (coquille de coquilles). |

### Sol
| **pot à feu** (`mine`) | **gerbe au sol** qui **monte haut** (pas de montée ni de burst), or. |

> Démo : l'effet sélectionné **tourne en boucle** (`PrevoFX.focus`) — jamais un défilé.
> Sélecteur en haut à droite. Console : `PrevoFX.focus('willow')` ou `PrevoFX.fire('ring')`.

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
