# 07 — La montée de la bombe : temps de montée, vitesse, aspect, son

Notes pour le simulateur, rédigées pour un artificier professionnel. Elles complètent :
- 01 (balistique : traînée, rotation, effet Magnus, inclinaison) ;
- 04 §6.7 (traînée de montée, physique des étincelles) ;
- 05 (fumée et retard du son) ;
- 06 (hauteurs des bombes chinoises GB / F4).

Ce qui est déjà dans ces notes n'est que rappelé ici.

**Périmètre sécurité.** Aucune formulation (ni pourcentage ni rapport), aucune masse de charge de chasse ou d'éclatement, aucune procédure de fabrication ou d'assemblage. Les sources consultées contenant ce genre de détails (Shimizu ch. 20, thèse Ding) n'ont été exploitées que pour les **observations visuelles et les grandeurs mesurées**.

Légende (la même que dans 01 et 06) :
- ✅ **Sourcé** : mesure publiée, norme, ou plusieurs sources concordantes.
- 🟡 **Ordre de grandeur** : logiciel, fabricant, forum de professionnels, règle de métier.
- 🧮 **Calcul propre**, à partir de valeurs sourcées (scripts dans `scratchpad/calc/montee*.py`).
- ⚠️ **Incertain** : estimation, observation personnelle non sourcée, source faible.

---

## 0. TL;DR pour l'implémentation

### 0.1 Temps de montée (de la mise à feu de la chasse à l'éclatement) — valeurs conseillées

Ces temps ne comptent pas la latence du système de tir (inflammateur électrique, de 0 à ~0,1 s).

| Calibre (mortier) | Temps conseillé | Fourchette réaliste | Hauteur d'éclatement (chinois F4, cf. 06) | Apogée « physique » si rien n'éclatait 🧮 | Principales sources de la fourchette |
|---|---|---|---|---|---|
| 30 mm (compact) | **1,8 s** | 1,5–2,0 s | 30–50 m | 2,6–3,0 s | Finale 1" = 1,59 s ; catalogue Prévot 20–30 mm : 1,59–1,75 s 🟡 |
| 50 mm | **2,3 s** | 2,0–2,5 s | 50–80 m | 3,4–3,8 s | Finale 1,75" = 2,05 s ; forum : 62 mm à 2,25 s, compacts 2" ~2 s 🟡 |
| 75 mm | **2,9 s** | 2,7–3,2 s | ~95 m | 3,8–4,2 s | Skylighter 3" = 3 s ; étude japonaise 3 gō ≈ 3 s ; loi Finale ≈ 2,8 s 🟡/✅ |
| 100 mm | **3,3 s** | 2,8–3,6 s | ~115 m | 4,2–4,6 s | Finale 4" = 3,2 s ; Prévot 100 mm cyl. = 2,80 s ; Brass (DE) : 2,5–3,5 s ; Skylighter 3,5 s ; rec.pyro 3,5 s 🟡 |
| 125 mm | **3,7 s** | 3,4–4,1 s | ~135 m | 4,6–5,0 s | Skylighter 5" = 4 s ; loi Finale ≈ 3,6 s 🟡 |
| 150 mm | **4,2 s** | 3,9–5,0 s | ~155 m (JP ~190 m) | 5,0–5,6 s | Skylighter 6" = 5 s ; loi Finale ≈ 3,9 s ; Shimizu (Osaka 1965) : bombes réglées pour éclater 4 s après le tir 🟡/✅ |
| 200 mm | **5,0 s** | 4,5–6,0 s | ~195 m (JP ~250 m) | 5,8–6,4 s | Skylighter 8" = 6 s ; loi Finale ≈ 4,5 s ; « 8" ≈ 4,5 s » (source faible) 🟡/⚠️ |
| 300 mm | **6,3 s** | 5,5–7,0 s | ~250 m (JP ~330 m) | 6,5–7,3 s | Skylighter 12" = 7 s ; loi Finale ≈ 5,5 s ; modèle balistique 🟡/🧮 |

Formules compactes :
- **t_b ≈ 1,8 s × (D / 30 mm)^0,55** reproduit la colonne « conseillé » à ±0,1 s 🧮.
- La loi Finale implicite donne un peu moins sur les gros calibres : **t_b ≈ 1,6 s × √(D en pouces)** 🧮 (ajustée sur trois valeurs, voir §2.1).

**Dispersion d'un tir à l'autre, à référence égale :**
- σ ≈ 0,15–0,3 s en gamme pro ; en gamme économique, jusqu'à ±0,5 s ou plus (forum Pyrotalk : une bombe 4" bas de gamme était décalée de 0,5 s) 🟡.
- La dispersion vient de la vitesse de combustion de la mèche, très variable sur la mèche chinoise (cf. 06 §4.4).

### 0.2 Points clés

1. **Le temps de montée des catalogues et des logiciels est plus court que le temps physique jusqu'à l'apogée.** 🧮✅
   - Avec les hauteurs nominales et un C_D réaliste, l'apogée arriverait 0,3 à 1,5 s plus tard.
   - La bombe éclate donc **avant l'apogée** : à environ 90–95 % de la hauteur maximale pour 75–125 mm, à 97–100 % pour ≥ 200 mm.
   - Elle monte encore à **~10–15 m/s** pour 75–150 mm et à **~3–8 m/s** pour 200–300 mm.
   - Finale 3D le dit explicitement : « the defaults cause aerial effects to burst just before they reach apogee to mirror the performance of real-life effects ».
2. **La courbe de vitesse** : sortie à **60–130 m/s**, puis freinage très fort. Pour une montée normalisée au temps d'éclatement t_b :

   | t / t_b | 0,1 | 0,2 | 0,3 | 0,5 | 0,7 | 0,9 | 1,0 |
   |---|---|---|---|---|---|---|---|
   | h / H_b | ≈ 0,18 | ≈ 0,34 | ≈ 0,47 | ≈ 0,70 | ≈ 0,86 | ≈ 0,96 | 1 |

   🧮 La moitié de la hauteur est atteinte à ~30 % du temps, et le dernier tiers du temps ne fait gagner que ~15 % de hauteur.
3. **Aspect :**
   - **Départ** : flash orange bref au mortier avec un panache de flamme, des étincelles de chasse qui accompagnent la bombe sur les premiers mètres ou dizaines de mètres, une bouffée de fumée grise et basse. **La bombe sort au-dessus de la fumée** (✅ thèse Ding : « flamme et fumée jaillissent de la bouche, puis la bombe apparaît au-dessus de la fumée »).
   - **Sans effet de montée** : seule la mèche est visible. C'est un filet d'étincelles orange très ténu, souvent à peine visible ou invisible à 200–300 m (⚠️ ; Shimizu : « les étincelles de la mèche ne sont pas visibles de loin »).
   - **Avec une traînée de montée** (comète « Gold / Silver Tail », 曲導 *kyokudo*) : un « tronc » qui part de la bouche du mortier, devient de plus en plus dense en haut, et se termine en point brillant au moment de l'éclatement.
4. **Son :**
   - Le « boum » de départ part à t ≈ 0 ; la bombe met ~35 ms à sortir d'un mortier de 3 gō (✅ Ding).
   - Il est entendu **d / 343 s** après le flash : 0,44 s à 150 m, 0,58 s à 200 m, 0,87 s à 300 m.
   - À ~100 m, il est **plus faible que l'éclatement** (~82–85 dB contre ~101 dB) mais très riche en basses (98–104 dB en basses fréquences, pic vers 16–25 Hz) ✅.

---

## 1. Définitions et conventions des logiciels

- **Prefire / pré-fire / PFT** : le temps entre l'ordre de tir du système et l'instant « synchronisé » de l'effet, c'est-à-dire l'éclatement. Pour une bombe, on a **prefire = temps de montée** (lift time) ✅. Règles de Finale 3D :
  - « Prefire ≥ 0.5 defines aerial shell lift time ; PFT < 0.5 defines delay before simulation » : une valeur inférieure à 0,5 s est prise comme une latence du système de tir.
  - Les termes VDL **LFT** (lift time) et **DLY** (retard avant lancement, par exemple une mèche lente) remplacent les valeurs par défaut, avec **DLY + LFT = PFT**.
  - Exemple de la documentation : « 50mm … 1.0 DLY … 3.0 LFT » donne un premier éclatement à 4,0 s.
  - Exemple du forum : une bombe consommateur 1,75" avec 4 s de mèche lente et **2 s de montée**, soit 6 s de PFT.

  Sources : https://finale3d.com/documentation/prefire/ et https://finale3d.com/groups/english/forum/topic/1-4g-mortar-timing/
- **Finale 3D fixe le prefire et la hauteur par défaut d'après le calibre** ✅ (DrewFinale, https://finale3d.com/groups/english/forum/topic/cake-effects-breaking-early/).
  - Si l'on impose un prefire court à un gros calibre sans donner de hauteur, le logiciel garde la hauteur par défaut. La bombe éclate alors **en montant encore vite** (https://finale3d.com/groups/english/forum/topic/shell-effects/).
  - **Pour notre moteur** : la paire (hauteur, temps) doit rester cohérente avec la balistique (voir §3).
- **COBRA Show Creator** : la colonne « Pre-Fire » est soustraite de l'heure de chaque événement pour que l'effet se produise au bon moment 🟡 (aide COBRA, page 403 ; contenu d'après le moteur de recherche). https://help.cobrafiringsystems.com/hc/en-us/articles/8686896849435-What-is-a-Pre-Fire-Time
- **FWsim** (version 4.4, 2026) 🟡 :
  - Il calcule hauteurs et délais automatiquement. Le réglage « Automatic heights and delays » avait un « Old model (before June 2025) », retiré depuis.
  - Depuis la 4.4.1.8 (juillet 2026), la base d'effets de FWsim Pro **affiche la hauteur et le « rising time »**.
  - Aucune table n'est publiée.
  - Le simulateur génère automatiquement des **« launch sparks »** au départ des bombes, comètes et chandelles.
  - Il propose une « Shell Rotation » où **la traînée de montée commence serrée puis s'élargit en spirale**.

  Source : https://fwsim.com/updates-v4.html
- **FireOne, Pyrodigital, Explo, Galaxis, Mongoose** : je n'ai trouvé **aucune table publique de temps de montée par défaut** ⚠️. Ces systèmes importent le prefire saisi par l'utilisateur ou par le logiciel de conception, Finale le plus souvent.
- **Fiches produit CE / EN 16261 / GB 19594** : elles donnent la **hauteur** (et le rayon), **jamais le temps de montée** dans les fiches consultées (voir 06 §3.2). Le marquage GB exige la hauteur de tir, le rayon et la hauteur d'extinction, pas de temps ✅.
- **Le mot « apex »** chez les praticiens désigne en fait l'éclatement. Exemple : Brass (cours de l'université de Halle) écrit « le point le plus haut est atteint environ 2,5–3,5 s après le tir » pour des bombes de 100 mm montant à 120–140 m. Physiquement, l'apogée de ces bombes serait vers 4,2–4,9 s (§3) : **ce qu'il donne est le temps d'éclatement.** 🧮

---

## 2. Données collectées par calibre

### 2.1 Tableau des sources (temps entre le départ et l'éclatement)

| Calibre | Valeur | Nature | Source |
|---|---|---|---|
| 1" (25 mm) | 1,59 s | défaut Finale 3D (rapporté par un utilisateur) 🟡 | https://finale3d.com/groups/english/forum/topic/1-4g-mortar-timing/ |
| 1,75" (44 mm) | 2,05 s | défaut Finale 3D 🟡 | idem |
| 1,75" consommateur | 2 s de montée (après une mèche lente de 4 s) | exemple du forum Finale 🟡 | idem |
| 4" (100 mm) | 3,2 s | défaut Finale 3D (réponse de l'équipe Finale, citée via le moteur de recherche, non vue directement) ⚠️ | forum Finale (fil non retrouvé) |
| 20 mm compact | 1,59 s PFT, 50 m | catalogue de l'utilisateur (description Finale) 🟡 | `base_de_donnees/catalogue_effets.csv` du dépôt (code 605004000) |
| 25 mm compact | 1,75 s PFT, 32 m | idem 🟡 | `tests/fixtures/catalogue_test.txt` (500360000) |
| 30 mm | 1,69 s PFT | idem 🟡 | catalogue_effets.csv |
| 100 mm cylindrique (« marguerite », Prévot) | **2,80 s** PFT, 100 m | idem 🟡 | catalogue_effets.csv (510399000…510407000) |
| 62 mm (« 3" NOAB ») | 2,25 s (« 0 prefire ») | réglage d'un utilisateur 🟡 | https://www.pyrotalk.com/bulletin/archive/index.php/t-8381.html |
| compacts 2" | ~2 s | idem 🟡 | idem |
| 3 gō (9 cm, ~120 m) | ≈ 3 s (horodatages du départ à 15:00:37 et de l'éclatement à 15:00:40, résolution 1 s) | mesure acoustique ✅/⚠️ | Mio et al., PMC5373909 : https://pmc.ncbi.nlm.nih.gov/articles/PMC5373909 |
| 100 mm (120–140 m) | « point le plus haut » atteint à 2,5–3,5 s | cours d'un artificier allemand 🟡 | Brass, Univ. Halle 2018 : https://users.informatik.uni-halle.de/~brass/feuerwerk.pdf |
| bombette de compact | retard de mèche ~2 s | idem 🟡 | idem |
| 3" / 4" / 5" / 6" / 8" / 10" / 12" | **3 / 3,5 / 4 / 5 / 6 / 6,5 / 7 s** | retard de mèche conseillé (tableau de conception) 🟡 | Skylighter, « Aerial Shell Making Charts » : https://www.skylighter.com/blogs/fireworks-information/aerial-shell-making-charts |
| 4" boule amateur, apogée ~120 m | « 3,5 s, c'est à peu près juste » ; « une mèche de 3 s est idéale pour un apogée de 400 ft » | forum (artificiers amateurs expérimentés) 🟡 | https://rec.pyrotechnics.narkive.com/sDKjkK6d/shell-lift-and-timing |
| tous calibres | mèche de 3 à 6 s selon le calibre | Poulton & Kosanke 1995 ✅ | https://www.fireengineering.com/firefighting/fireworks-and-their-hazards/ |
| bombes sphériques | temps de vol de 3 à 5 s selon le calibre, montée jusqu'à ~200 m | Physik Journal 2005, d'après un résumé de moteur de recherche ⚠️ | (article non consulté directement) |
| bombes japonaises de concert (Osaka 1965, « music of fire ») | « chaque bombe est fabriquée pour éclater exactement 4 s après le tir » ; sifflet de montée (*kyokudo*) de 4 s | Shimizu ✅ | Shimizu, *Fireworks: The Art, Science and Technique*, §2–4 |
| pokamono (bombe « poka », légère) | « temps jusqu'à l'apogée un peu plus court que pour un warimono » ; même mèche par simplicité | Shimizu §17.2 ✅ | idem |
| 8" | « environ 4,5 s de l'allumage à l'éclatement » | site de vulgarisation ⚠️ | https://asmr.education/faq/fireworks/firework-timing-control-synchronization |
| 1–5 s selon le calibre | ordre de grandeur général | idem ⚠️ | idem |

Remarques :
- Le seul fil Finale qui demande une table par calibre, de 2,5" à 6", reste **sans réponse**. Son auteur trouve les défauts Finale « excessivement longs » par rapport au réel ⚠️ (https://finale3d.com/groups/english/forum/topic/pre-fire-durations/). Je n'ai pas pu vérifier ce jugement.
- **Loi Finale implicite** 🧮 : 1,59 s à 1", 2,05 s à 1,75" et 3,2 s à 4" s'ajustent sur t ≈ 1,59 × (D en pouces)^0,45–0,5, soit ≈ 1,6 √D. Extrapolée, cela donne :
  - 2" : 2,25 s ;
  - 3" : 2,75 s ;
  - 5" : 3,55 s ;
  - 6" : 3,9 s ;
  - 8" : 4,5 s ;
  - 10" : 5,0 s ;
  - 12" : 5,5 s.

  ⚠️ Ces valeurs ne reposent que sur trois points, dont un non vérifié.
- **Le retard de mèche du tableau Skylighter** démarre à l'allumage par la flamme de chasse. Il est donc presque égal au temps de montée, à quelques dizaines de ms près (le temps passé dans le mortier). Ces valeurs concernent des bombes de conception américaine ou amateur, qui montent plus haut que les chinoises F4. **Elles sont un peu longues pour du chinois standard**, surtout de 150 à 300 mm.

### 2.2 Différences selon le type de bombe 🟡/⚠️

| Type | Effet sur la montée | Fiabilité |
|---|---|---|
| **Sphérique chinoise F4** (le gros du marché) | Hauteurs nominales plus basses que les tables japonaises (cf. 06). **Temps de montée de la colonne « conseillé »**, plutôt dans le bas de fourchette pour 150–300 mm | 🧮 |
| **Warimono japonais** | Plus lourd, monte plus haut (5 gō ~190 m, 10 gō ~330 m). Temps plus longs : environ +0,3 à +0,8 s par rapport au chinois à mortier égal. Shimizu cite 4 s pour les bombes de concert d'Osaka (probablement 5–6") | ✅/🧮 |
| **Poka (pokamono), bombes légères** (parachutes, saules lâches) | À calibre égal, l'apogée arrive un peu plus tôt (Shimizu), mais **avec la même mèche** : l'éclatement se fait donc **plus près de l'apogée, voire après** | ✅ (qualitatif) |
| **Cylindriques (italiennes, espagnoles, chinoises ≤ 6")** | Plus lourdes à diamètre égal, mortiers souvent longs. Ex. : catalogue Prévot, 100 mm cylindrique « marguerite » = 2,80 s pour 100 m. Pour les **multi-coups**, le premier éclatement se règle comme une bombe simple ; les suivants s'enchaînent, **chacun plus haut** (06 §6), en fraction de seconde à ~1 s ⚠️ | 🟡/⚠️ |
| **Bombettes de compacts (20–50 mm)** | 1,5–2,5 s. Éclatement souvent bien avant l'apogée : Finale le note pour les petits calibres (« especially true with smaller caliber such as cake shots ») | 🟡 |

---

## 3. Vitesse de sortie et forme de la courbe de vitesse

### 3.1 Vitesse de sortie mesurée

- ✅ **Thèse Ding (Univ. de Yokohama)**, mesure par caméra rapide :
  - Bombe n°3 de 84 mm et ~240 g, tirée d'un mortier de 90 mm : vitesse initiale de **70 à 135 m/s selon la charge de chasse** (9 essais ; je ne recopie pas les charges).
  - Les étoiles tirées de petits mortiers vont de 23 à plus de 250 m/s.
  - D'après la pression mesurée, la bombe **atteint la bouche du mortier ~0,035 s** après le départ de la montée en pression.
  - La vitesse est mesurée entre le moment où la bombe émerge de la fumée et 5 m de hauteur, parce que **« la vraie vitesse de bouche est cachée par la fumée »**.

  https://ynu.repo.nii.ac.jp/record/4839/files/11913887-03.pdf
- ✅ Ding & Yoshida 2008 : plus de 70 m/s pour un 3 gō en chasse de spectacle (cf. 01).
- ✅ Poulton & Kosanke 1995 : **≈ 250 mph ≈ 112 m/s**, « quel que soit le calibre ».
- 🟡 Christian Science Monitor (1998, vulgarisation) : **200–400 ft/s ≈ 61–122 m/s**. https://www.csmonitor.com/1998/0630/063098.home.home.1.html
- 🧮 Vitesse nécessaire pour atteindre la hauteur nominale chinoise au temps conseillé (C_D 0,45 ; masses estimées) :

  | Calibre | v₀ |
  |---|---|
  | 75 mm | ~60 m/s |
  | 100 mm | ~66 m/s |
  | 150 mm | ~75 m/s |
  | 200 mm | ~84 m/s |
  | 300 mm | ~93 m/s |

  C'est **au bas des mesures**. Avec un C_D effectif plus élevé (0,8–1,2 : rotation, rugosité, aspérités de l'enveloppe), il faut **70–110 m/s pour 75–100 mm** pour la même hauteur, et le temps d'apogée ne baisse que de ~0,2–0,5 s. **Pour le moteur, une plage de v₀ de 60 à 130 m/s est réaliste.** Il vaut mieux caler (C_D, v₀) sur le couple (hauteur, temps) que l'inverse.

### 3.2 Profil de montée 🧮

Modèle : sphère, C_D 0,45, ρ_air 1,2 kg/m³, masses estimées pour des bombes chinoises (75 mm : 0,22 kg ; 100 : 0,45 ; 150 : 1,4 ; 200 : 3,0 ; 300 : 9 kg). v₀ est ajusté pour que la bombe soit à H_b au temps t_b. Script : `scratchpad/calc/montee3.py`.

**Hauteur et vitesse en fonction du temps (normalisé au temps d'éclatement t_b)**

| Cas | t/t_b = 0,05 | 0,1 | 0,2 | 0,3 | 0,4 | 0,5 | 0,6 | 0,7 | 0,8 | 0,9 | 1,0 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 75 mm (2,9 s ; 95 m) h/H_b | 0,09 | 0,17 | 0,32 | 0,45 | 0,57 | 0,67 | 0,76 | 0,83 | 0,90 | 0,95 | 1 |
| v (m/s) | 56 | 52 | 46 | 40 | 35 | 31 | 27 | 23 | 20 | 16 | **13** |
| 150 mm (4,2 s ; 155 m) h/H_b | 0,10 | 0,19 | 0,35 | 0,49 | 0,60 | 0,71 | 0,79 | 0,86 | 0,92 | 0,97 | 1 |
| v (m/s) | 69 | 64 | 55 | 47 | 40 | 34 | 29 | 24 | 19 | 15 | **10** |
| 300 mm (6,3 s ; 250 m) h/H_b | 0,11 | 0,21 | 0,39 | 0,54 | 0,66 | 0,77 | 0,85 | 0,91 | 0,96 | 0,99 | 1 |
| v (m/s) | 85 | 77 | 65 | 54 | 44 | 36 | 29 | 22 | 15 | 9 | **2** |

**Profil normalisé à l'apogée physique T (indépendant du calibre à ±0,02)**

| t/T | 0,1 | 0,2 | 0,3 | 0,4 | 0,5 | 0,6 | 0,7 | 0,8 | 0,9 | 1 |
|---|---|---|---|---|---|---|---|---|---|---|
| h/H_max | 0,22 | 0,40 | 0,55 | 0,68 | 0,78 | 0,86 | 0,92 | 0,97 | 0,99 | 1 |
| v/v₀ | 0,83 | 0,69 | 0,57 | 0,47 | 0,38 | 0,29 | 0,21 | 0,14 | 0,07 | 0 |

Dans le vide, h/H_max vaudrait 0,19 / 0,36 / 0,51 / 0,64 / 0,75 / 0,84 / 0,91 / 0,96 / 0,99. **La différence de forme est modérée.** Ce qui change beaucoup, c'est l'échelle : sans air, v₀ = 112 m/s donnerait 640 m en 11,4 s (cf. 01).

**Forme de la courbe :**
- Décélération initiale de **g + traînée ≈ 2–4 g** pendant la première seconde ; au sommet, elle se réduit presque à g.
- On voit donc un départ fulgurant puis un « ralenti » très visible : **la moitié de la hauteur est atteinte en ~1,1–1,7 s, quel que soit le calibre.**

**Temps d'apogée physique (si la bombe n'éclatait pas)**, aux hauteurs chinoises :

| Calibre | Apogée physique |
|---|---|
| 30 mm | 2,7 s |
| 50 mm | 3,5 s |
| 75 mm | 4,1 s |
| 100 mm | 4,4 s |
| 125 mm | 4,8 s |
| 150 mm | 5,2 s |
| 200 mm | 5,8 s |
| 300 mm | 6,5 s |

Aux hauteurs japonaises : 5 gō 5,6 s, 7 gō 6,3 s, 10 gō 7,3 s. Le résultat dépend peu du C_D (±0,3 s entre 0,35 et 1,2) et de la masse (±0,2 s).

**Cohérence avec les temps de l'industrie (point 1 du TL;DR) :** en confrontant les temps du §2 aux hauteurs nominales, on obtient :
- 75 mm à 2,8–3,0 s : éclatement à ~90–93 % de l'apogée, à 12–15 m/s, 1,2–1,4 s avant l'apogée ;
- 100 mm à 3,2–3,5 s : 92–96 %, 10–14 m/s ;
- 150 mm à 4,0–4,5 s : 95–99 %, 7–13 m/s ;
- 200 mm à 5,0–5,5 s : 98–100 %, 3–8 m/s ;
- 300 mm à 6,0–6,5 s : 99–100 %, 0–5 m/s.

→ La bombe qui éclate encore en montant ajoute **+5 à +15 m/s vers le haut à toutes les étoiles** (cf. 01 §2.5 et 06 §4.4). Pour 75–125 mm, la fleur est donc **légèrement décalée vers le haut** pendant la première seconde. C'est réaliste, et c'est voulu par Finale.

---

## 4. Ce qu'on voit : aspect réel de la montée (spectateur à 150–300 m)

### 4.1 Le départ au mortier

- **Flamme et fumée** ✅ : « quand on tire la bombe, flamme et fumée jaillissent de la bouche du mortier ; ensuite la bombe apparaît au-dessus de la fumée » (thèse Ding, traduite du japonais). Le gaz de chasse fuit aussi autour de la bombe pendant la montée dans le tube (STEM ; Ding).
- **Flash** ⚠️ (estimation, aucune mesure trouvée) :
  - Bref, de l'ordre de **20–100 ms** (1 à 3 images à 30 i/s).
  - **Jaune-orangé** (flamme de poudre noire, ~1 700–2 000 K) ; un peu plus blanc au cœur pour les gros calibres.
  - Panache de **~1–3 m** au-dessus de la bouche pour 75–150 mm, davantage pour 200–300 mm.
  - À 200 m, c'est un point lumineux qui éclaire **par en dessous** le pied du nuage de fumée, l'eau et le sol proches. Lors d'un final, ces lueurs se répètent en rafale au ras du sol.
- **Étincelles de chasse** ⚠️ :
  - Des grains de chasse encore en feu sont éjectés derrière la bombe : une gerbe courte d'étincelles orange qui suit la bombe sur les **premiers ~5–30 m**, puis s'éteint en ~0,2–0,5 s.
  - Shimizu signale qu'un mortier trop court expulse de la chasse non brûlée (cf. 01).
  - FWsim génère automatiquement des « launch sparks » pour les bombes, comètes et chandelles, et les a rendues « plus clairsemées et plus brèves » en 2026 (https://fwsim.com/updates-v4.html) 🟡.
- **Fumée de levée** (cf. 05) ⚠️ :
  - Bouffée **gris clair à blanche**, dense, d'abord de ~2–5 m, qui grossit à ~5–10 m en quelques secondes.
  - Elle reste basse, monte un peu (gaz chauds) et suit le vent de surface.
  - Elle persiste quelques dizaines de secondes. Lors d'un final, elle forme un **banc** sur le pas de tir.
  - De nuit, elle n'est visible que lorsqu'elle est éclairée par les flashs suivants ou par les éclatements.
- **Débris** ⚠️ :
  - Rondelles et bourres de carton, papier de chasse, fragments de mèche, retombant dans un rayon de **0–20 m** autour du mortier.
  - Ils sont surtout **sombres** : quelques braises rougeoient 0,5–2 s.
  - À 150–300 m, ils sont **quasi invisibles**, sauf quelques points orange qui retombent près de la flamme.

  Les débris d'éclatement (enveloppe) sont un autre sujet ; voir 06 §3.1, où la norme GB exige qu'aucun résidu ne brûle encore sous 10 m.
- **Inclinaison** : en éventail (±15–30°), on voit les départs partir en gerbe. Voir 01 §5.3.

### 4.2 Bombe « nue » : seule la mèche est visible

- La mèche brûle pendant toute la montée et projette **un mince filet d'étincelles orange et ternes**.
  - De près, ou sur vidéo au téléobjectif, on voit une petite lueur qui monte avec une traîne courte.
  - À 150–300 m, c'est **un point faible, souvent invisible**, surtout dans un ciel déjà éclairé par d'autres effets ⚠️.
  - Shimizu note que « les étincelles ou la lumière de la mèche ne sont pas visibles de loin ». ⚠️ La phrase est isolée dans le texte et son contexte n'est pas clair.
- **Spirale** ✅/⚠️ :
  - La bombe tourne au hasard à **3–15 tr/s**, sur un axe aléatoire et fixe, et cette rotation s'amortit en ~1–2 s (Ding & Yoshida 2008, cf. 01 §5.2). Leurs vidéos montrent la lueur décrivant **une hélice**.
  - Le rayon de l'hélice est celui de la bombe (3,5–15 cm). À 200 m, cela fait **< 3 minutes d'arc**, donc **pas de spirale lisible à l'œil nu** depuis le public.
  - Ce qui se voit, ce sont les étincelles éjectées tangentiellement (ω·r ≈ 2–6 m/s 🧮), qui donnent une **traîne légèrement « ondulée » ou élargie** en début de montée, puis plus droite à mesure que la rotation s'amortit.
- **Ce qu'on voit le mieux d'une bombe nue**, c'est souvent… rien entre le flash au sol et l'éclatement. Le public perçoit « boum au sol, puis fleur 3–4 s plus tard ». Pour le rendu, une lueur de mèche **très discrète** (désactivable) est le bon compromis 🧮.

### 4.3 Bombe avec effet de montée (« rising tail », 曲導 *kyokudo*, 带物上升型)

**Définitions sourcées :**
- ✅ Finale VDL : « **Tail** : a star that is attached as a rising effect to a shell » ; exemple « 3″ Blue Dahlia w/Gold Tail ». https://finale3d.com/documentation/vdl-effect-glossary/
- ✅ Glossaires : comète fixée sur la bombe qui dessine un « tronc » pendant la montée, typique des **palmiers**. Pour un palmier, c'est un tronc or ou argent suivi de palmes en brocart ou en saule (montreal-fireworks ; Butler Eagle).
- ✅ Shimizu ch. 20 « Kyoku-do » : effets portés par la bombe qui se manifestent **sur la trajectoire de montée**. Il cite **traînée argentée, petites fleurs, comètes, marrons, sifflets**, ainsi que fumée de jour.
  - Ces pièces sont **allumées par la flamme de la chasse** : la traînée démarre donc **dès la bouche du mortier**.
  - Elles doivent rester solidaires de la bombe au départ.
- ✅ Les noms japonais suivent le motif « 昇り… » (*nobori*, « montant ») :
  - **銀竜 (*ginryū*, « dragon d'argent »)** : traînée d'étincelles argentées continue pendant la montée.
  - **昇小花 (petites fleurs montantes)** : de petites fleurs s'ouvrent « paf, paf » successivement le long de la montée.
  - **銀笛 (sifflet d'argent)** : sifflement accompagné d'une traînée argentée.

  https://pachiseven.jp/columns/column_detail/19332
- ✅ GB 19594 (Chine) : type « 带物上升型 », effets qui accompagnent la montée (petites fleurs, sifflet, colonne lumineuse). Cf. 06 §6.

**Catalogue des effets de montée et aspect** (fiabilité indiquée par ligne) :

| Effet (libellé catalogue) | Aspect pour un spectateur à 150–300 m | Fiabilité |
|---|---|---|
| **Gold tail / tiger tail** (charbon) | Colonne d'étincelles **or-orangé, assez peu lumineuses mais longues**, étincelles vivant ~0,5–1,5 s (cf. 04). Le tronc reste visible sur **15–60 m** derrière la bombe. Shimizu : une comète « tiger tail » de montée brûle **~5 s**, donc toute la montée | ✅ (durée) / 🧮 (longueur) |
| **Silver tail / 銀竜** (métal) | Traînée **blanc-argent, nettement plus brillante**, étincelles plus courtes (~0,2–0,5 s). On voit une **« comète » de 6–25 m** qui suit la bombe plutôt qu'un tronc complet | ✅ (existence) / 🧮 (longueur) |
| **Glittering / brocade tail** | Traînée or ou argent **pailletée** : flashs blancs retardés qui scintillent dans le sillage | 🟡 (cf. 04 §3) |
| **Crackling tail** | Traînée ponctuée de **petits crépitements** (éclairs + claquements secs) sur 0,5–1 s derrière la bombe | 🟡 |
| **Strobing tail** (ex. « Red Strobing Tail ») | La tête **clignote** (quelques Hz à ~10 Hz, cf. 04) ; peu ou pas de traînée continue | 🟡 (libellés Finale / catalogues) |
| **Whistle tail / 銀笛 / rising whistle** | Sifflement continu pendant la montée (Shimizu : un *kyokudo* « gros sifflet » dure **4 s**), souvent avec une traînée argentée | ✅ |
| **Rising flowers / 昇小花** | **3 à 8 petites fleurs** (⚠️ nombre et taille estimés : ~5–15 m de diamètre) qui éclosent l'une après l'autre le long de la trajectoire | ✅ (principe) / ⚠️ (chiffres) |
| **Ascending comets / « separating stars »** | Comètes projetées **une après l'autre** depuis la bombe pendant la montée, chacune partant en biais | ✅ Shimizu §20.3 |
| **Rising thunder / ascending reports** | Série de **détonations** espacées pendant la montée, chacune avec un éclair blanc | ✅ Shimizu §20.5 |
| **Fumée (jour)** | Traînée de fumée colorée ou blanche | ✅ Shimizu (déf. *kyokudo*) |

**Géométrie et luminance de la traînée** 🧮 (modèle du §3.2). Les étincelles perdent leur vitesse en ~0,1–0,3 s et restent quasi sur place ; la traînée visible correspond donc au **chemin parcouru pendant la durée de vie d'une étincelle**.

Longueur de traînée selon la durée de vie τ des étincelles :

| Calibre | τ | à t = 0,5 s | à t = 1 s | à t = 2 s | à t_b − 0,3 s | à t_b |
|---|---|---|---|---|---|---|
| 100 mm | 1,0 s (or) | 30 m | **54 m** | 35 m | 22 m | 18 m |
| 100 mm | 0,4 s (argent) | 23 m | 19 m | 12 m | 7 m | 6 m |
| 300 mm | 1,0 s (or) | 43 m | 81 m | 60 m | 10 m | 7 m |

**Densité linéaire d'étincelles** (∝ 1/v) : en haut, elle est **4,5×** celle du départ pour 75 mm, **7×** pour 150 mm, **10×** pour 200 mm et 30× ou plus pour 300 mm. Concrètement :
- au départ, une traînée **longue, étirée et pâle** ;
- puis elle **se raccourcit et se densifie** ;
- dans la dernière seconde, un **paquet lumineux compact qui « hésite »** au sommet ;
- enfin l'éclatement, qui sort de ce paquet.

C'est le « bunching » observé en haut des palmiers.

**Trajectoire de la traînée :**
- Shimizu, essais de bombes noires : **le *kyokudo* empêche la bombe de tourner et la fait voler plus droit**. Les bombes à *kyokudo* tombaient dans une zone étroite ✅.
- → Pour les bombes à traînée, rendre un **tronc rectiligne** avec un léger tremblement ; pas de spirale.
- La spirale « qui s'élargit » proposée par FWsim (« Shell Rotation ») correspond plutôt aux bombes sans stabilisation, ou relève d'un choix esthétique 🟡.
- Par vent, le tronc **s'incline et s'arque** : les étincelles dérivent avec le vent pendant leur vie, et la bombe dérive surtout à la descente (cf. 01 §4.5).

**Persistance après l'éclatement** ⚠️ :
- Un tronc or reste visible **0,5–1,5 s** après l'éclatement : la partie haute fait la « base » du palmier, la partie basse s'éteint d'abord.
- Une traînée argent disparaît en **< 0,5 s**.

**Luminosité relative** ⚠️ :
- Une traînée de montée or vaut environ une seule étoile de chrysanthème à traînée or, de même diamètre de comète.
- Une traînée argent est plus brillante ; la tête d'une comète argent est souvent le point le plus lumineux du ciel avant l'éclatement.
- La lueur de mèche seule est 1 à 2 ordres de grandeur en dessous.

### 4.4 Ordres de grandeur angulaires pour le spectateur 🧮

| Position | Élévation de l'éclatement | Hauteur du tronc |
|---|---|---|
| 100 mm (115 m) vu à 200 m | **30°** | 0 → 30° en 3,3 s |
| 150 mm (155 m) vu à 250 m | 32° | — |
| 75 mm (95 m) vu à 150 m | 32° | — |

- **Vitesse angulaire** au départ (60–80 m/s à 200 m) : ~**17–23 °/s**. Dans la dernière seconde : **≈ 2–4 °/s**. On voit très nettement l'**accélération inverse** : la bombe « jaillit » puis « flotte ».
- **Épaisseur apparente** d'une traînée de comète (gerbe de ~0,5–2 m) à 200 m : **~9–35 minutes d'arc**, c'est-à-dire une ligne fine mais nette. Le filet de mèche (quelques cm) est sous la minute d'arc, à la limite de résolution de l'œil : un point qui monte, pas une ligne.

---

## 5. Le son de la montée

### 5.1 Le « boum » de départ ✅

- Il est émis au mortier pendant les ~35 ms où la bombe est dans le tube (Ding : bouche atteinte vers 0,035 s), donc **quasi simultané avec le flash**.
- Il arrive au spectateur **d / c** plus tard, avec c ≈ 331,3 + 0,606·T(°C) m/s, soit 343 m/s à 20 °C (cf. 05).
- Niveaux mesurés lors d'un grand spectacle japonais (Mio et al. 2017, PMC5373909) :

  | Grandeur | Départ | Éclatement |
  |---|---|---|
  | Niveau à ~100 m du pas de tir | **82 dB** (3 gō, jour), **85 dB** (4 gō, nuit) | **~101 dB** |
  | Basses fréquences à ~100 m | **98–104 dB**, pic vers **16–25 Hz** | — |
  | Valeur extrapolée au pas de tir | **~130–133 dB** (basses fréquences 146–152 dB) | — |
  | Valeur extrapolée au point d'éclatement | — | 156–158 dB |

  - Le départ est donc **un coup sourd, grave**, moins fort mais plus « dans le ventre » que l'éclatement, qui couvre tout le spectre.
  - Le spectre du départ présente un léger creux vers 160–200 Hz.
  - **Les sifflets de montée** font un pic ~10 dB au-dessus du reste vers **2,5 kHz**.
- Wharton (HSL 1995) utilise même le **bruit de départ mesuré à 25 m** comme indicateur de l'énergie de chasse : plus le départ est fort, plus la bombe monte haut, pour 75–125 mm ✅. https://www.jpyro.co.uk/wp-content/uploads/j01_01_h3edr.pdf
- Shimizu range le « son du tir » parmi les cinq sons des feux d'artifice et lui donne un **rôle de percussion** ✅.

### 5.2 Chronologie pour un spectateur 🧮

Les retards ci-dessous valent d/343. Distance oblique de l'éclatement = √(D² + H²).

| Spectateur à D du mortier | « Boum » de départ entendu après le flash | Son de l'éclatement après l'éclatement visible (H = 95 / 155 / 250 m) |
|---|---|---|
| 150 m | **0,44 s** | 0,52 / 0,63 / 0,85 s |
| 200 m | **0,58 s** | 0,65 / 0,74 / 0,93 s |
| 300 m | **0,87 s** | 0,92 / 0,98 / 1,14 s |

**Exemple : 100 mm à 200 m.**
- Flash à 0.
- « Boum » à 0,58 s.
- Traînée de montée pendant 3,3 s.
- Éclatement **vu** à 3,3 s, **entendu** à ~3,97 s (distance oblique 231 m).

Rappel de Shimizu : pour une bombe de 6" à ~250 m vue de ~600 m, la détonation arrive **au moment où la fleur est pleinement ouverte**, vers 2 s ✅.

**Lors d'une salve**, les départs entendus forment un roulement de « boums » sourds décalés de ~0,5–0,9 s par rapport aux flashs. C'est une signature très reconnaissable du spectacle vu de loin ⚠️.

### 5.3 Sifflet de montée ⚠️/🧮

- Ton quasi pur (pic vers 2–3 kHz ✅ PMC5373909) pendant toute la montée ; Shimizu indique 4 s pour un *kyokudo* sifflet.
- **Effet Doppler** : pour un spectateur à D du mortier, la vitesse d'éloignement vaut v·h/r, avec r = √(D² + h²).
  - Elle est nulle au départ, puisque la bombe file perpendiculairement à la ligne de visée.
  - Elle culmine à **~6–9 m/s** à mi-montée (100 mm vu à 200 m).
  - Le décalage reste donc **≤ 2–3 %** (moins d'un demi-ton) : c'est **négligeable** devant l'évolution propre du sifflet (cf. 04 §6). Il ne devient sensible que pour un spectateur presque sous la verticale.
- Le son est entendu avec le retard d/c **de la position de la bombe au moment de l'émission**, retard qui augmente pendant la montée : il faut l'intégrer par segments.

---

## 6. Paramètres proposés pour le moteur 🧮

```
montee:
  temps_eclatement_s (t_b):                 # du tir à l'éclatement, chinois F4 standard
    30: 1.8   50: 2.3   75: 2.9   100: 3.3   125: 3.7   150: 4.2   200: 5.0   300: 6.3
  formule: t_b = 1.8 * (D_mm/30)**0.55       # variante « Finale » : 1.6*sqrt(D_pouces)
  majoration_japonais_warimono_s: +0.3 .. +0.8 (hauteurs JP)
  sigma_t_b_s: 0.2 (pro) | 0.4 (économique)
  latence_systeme_tir_s: 0.0 .. 0.1          # PFT < 0.5 = latence (convention Finale)
  balistique:
    Cd: 0.45 (0.4..0.8)  ; calage: résoudre v0 pour que h(t_b) = H_b
    v0_attendu_m_s: 60..130
    temps_dans_mortier_s: 0.03..0.05
    vitesse_au_moment_eclatement_m_s: 10..15 (75–125) | 5..10 (150–200) | 0..5 (300)
  depart:
    flash: durée 20..100 ms, jaune-orangé, panache 1..3 m (75–150), éclaire la fumée par en dessous
    etincelles_chasse: 30..150 particules orange, vie 0.2..0.5 s, suivent la bombe sur 5..30 m
    fumee_levee: bouffée 2..5 m → 5..10 m, gris clair, suit le vent de surface, vie 20..60 s
    debris: 0..20 m autour du mortier, quelques braises 0.5..2 s
  meche_seule:
    luminance: très faible (désactivable), étincelles orange, vie 0.1..0.3 s
    spirale: rayon = rayon bombe ; rotation 3..15 tr/s, amortie en 1..2 s ; éjection tangentielle 2..6 m/s
  traine_montee (comète attachée):
    allumage: dès la sortie du mortier (flamme de chasse)
    or:     vie étincelle 0.5..1.5 s, luminance ~1 étoile, tronc 15..60 m, persistance 0.5..1.5 s après éclatement
    argent: vie 0.2..0.5 s, luminance ×2..5, « comète » 6..25 m
    densite_lineaire ∝ 1/v (paquet lumineux au sommet)
    rotation: supprimée (stabilisation par le kyokudo) → tronc droit + léger bruit
    variantes: glitter, crackling, strobe (tête 5..15 Hz), whistle (2..3 kHz, toute la montée),
               petites fleurs (3..8 éclosions de 5..15 m réparties sur 20..90 % de la montée),
               comètes séparées, marrons de montée
  son:
    depart: « boum » grave (énergie < 200 Hz, pic 16..25 Hz), ~82..85 dB à 100 m, retard D/c
    eclatement: ~101 dB à 100 m, large bande, retard sqrt(D²+H²)/c
    c = 331.3 + 0.606*T_celsius
```

---

## 7. Lacunes et incertitudes

- **Aucune table officielle de prefire par calibre** n'a été trouvée : ni Finale (seulement trois valeurs, dont une non vérifiée), ni FWsim (qui affiche le « rising time » sans le publier), ni FireOne, Pyrodigital, Explo, Galaxis ou Mongoose. Le plus fiable serait de **lire les défauts directement dans Finale 3D** (Effects > Create effect, taper « 75mm Red Peony », etc.) ou dans la base d'effets de FWsim Pro, puis de les comparer aux PFT du catalogue fournisseur.
- **Pas de mesure vidéo publique et chiffrée** du temps jusqu'à l'éclatement par calibre. Les seules mesures directes : environ 3 s pour un 3 gō (horodatage à 1 s près) et 4 s pour les bombes de concert d'Osaka.
- **Rapport CERL MRL 90-41** (Contestabile 1990) : il contient vitesses de bombe, temps jusqu'à l'éclatement et jusqu'au sol pour 205, 255 et 305 mm, mais le PDF NRCan est mort (404) et n'est pas archivé.
- **Kosanke**, « Measurement of Aerial Shell Velocity » (1994) et « Aerial Shell Burst Height as a Function of Mortar Length » (J. Pyro 15, 2002) : non consultés, payants.
- **Flash de départ, panache, fumée et débris** : aucune mesure trouvée. Tous les chiffres du §4.1 sont des estimations à caler sur vidéo.
- **Longueurs et luminances des traînées de montée** : calculées à partir des durées de vie d'étincelles de 04, pas mesurées.
- Les **masses des bombes chinoises** utilisées dans le modèle (0,22 / 0,45 / 1,4 / 3 / 9 kg) sont estimées ; Brass donne 400 g brut pour un 100 mm. Leur effet sur les temps reste faible (±0,2 s).

---

## 8. Sources

- Finale 3D, documentation « Prefire » : https://finale3d.com/documentation/prefire/
- Finale 3D, VDL timing terms : https://finale3d.com/documentation/vdl-timing-adjustment-terms-pft-lft-dly-dur-cds/
- Finale 3D, VDL Effect Glossary (Tail, Rising, Comet, Horsetail) : https://finale3d.com/documentation/vdl-effect-glossary/
- Forum Finale, « 1.4g mortar timing » (défauts 1" = 1,59 s, 1,75" = 2,05 s ; DLY + LFT = PFT) : https://finale3d.com/groups/english/forum/topic/1-4g-mortar-timing/
- Forum Finale, « Cake effects breaking early » (éclatement juste avant l'apogée, défauts selon le calibre) : https://finale3d.com/groups/english/forum/topic/cake-effects-breaking-early/
- Forum Finale, « Shell Effects » (prefire court + gros calibre = éclatement en montée) : https://finale3d.com/groups/english/forum/topic/shell-effects/
- Forum Finale, « Pre-Fire Durations » (sans réponse) : https://finale3d.com/groups/english/forum/topic/pre-fire-durations/
- FWsim, journal des mises à jour v4 (rising time, launch sparks, Shell Rotation, Automatic heights and delays) : https://fwsim.com/updates-v4.html
- COBRA, « What is a Pre-Fire Time? » : https://help.cobrafiringsystems.com/hc/en-us/articles/8686896849435-What-is-a-Pre-Fire-Time
- Skylighter, « Aerial Shell Making Charts » (retards de mèche par calibre ; seules les durées sont reprises) : https://www.skylighter.com/blogs/fireworks-information/aerial-shell-making-charts
- Pyrotalk, « Dominator 62MM Pre-Load Lift Time » : https://www.pyrotalk.com/bulletin/archive/index.php/t-8381.html
- rec.pyrotechnics, « Shell lift and timing » : https://rec.pyrotechnics.narkive.com/sDKjkK6d/shell-lift-and-timing
- Brass S., *Informatik zur Planung und Durchführung von Feuerwerken*, Univ. Halle 2018 (100 mm : 120–140 m, 2,5–3,5 s ; bombette ~2 s ; calcul à rebours des temps de montée) : https://users.informatik.uni-halle.de/~brass/feuerwerk.pdf
- Ding D., thèse de doctorat, Univ. nationale de Yokohama (vitesse initiale des bombes n°3 par caméra rapide : 70–135 m/s ; sortie du mortier vers 0,035 s ; flamme et fumée à la bouche) : https://ynu.repo.nii.ac.jp/record/4839/files/11913887-03.pdf
- Ding D., Yoshida T., STEM 69(1) 16–21 (2008), rotation et effet Magnus (cf. 01) : https://www.jes.or.jp/mag/stem/Vol.69/documents/Vol.69,No.1,p.16-21.pdf
- Poulton T.J., Kosanke K.L., « Fireworks and Their Hazards », *Fire Engineering* 1995 : https://www.fireengineering.com/firefighting/fireworks-and-their-hazards/
- Shimizu T., *Fireworks: The Art, Science and Technique* : §1.3 (son du tir, 6" à ~250 m), §2–4 (« music of fire », éclatement 4 s après le tir, sifflet 4 s), §17.2 (poka), ch. 20 (*kyoku-do* : seuls la typologie et les observations sont repris), §27 (*kyokudo* et rotation, bombes noires). http://www.freepyroinfo.com/Pyrotechnic/Pyrotechnic_Books/Fireworks_the_Art,_Science_and_Technique_by_Takeo_Shimizu.pdf
- Pachiseven (Japon), noms 昇曲導 / 銀竜 / 昇小花 / 銀笛 : https://pachiseven.jp/columns/column_detail/19332
- Mio et al., étude de bruit d'un grand spectacle japonais (départ ou éclatement, dB, basses fréquences, spectre, sifflets) : https://pmc.ncbi.nlm.nih.gov/articles/PMC5373909
- Wharton R.K., *J. Pyrotechnics* 1 (1995), bruit de départ à 25 m et hauteur : https://www.jpyro.co.uk/wp-content/uploads/j01_01_h3edr.pdf
- Christian Science Monitor 1998 (200–400 ft/s) : https://www.csmonitor.com/1998/0630/063098.home.home.1.html
- Wikipedia, « Comet (pyrotechnics) » (comète fixée sur la bombe = traînée de montée) : https://en.wikipedia.org/wiki/Comet_(pyrotechnics)
- Glossaire montreal-fireworks (rising tail, palm) : https://montreal-fireworks.com/pyro_glossary.html
- Source faible : asmr.education (8" ≈ 4,5 s ; 1–5 s) : https://asmr.education/faq/fireworks/firework-timing-control-synchronization
- Catalogue de l'utilisateur, dans le dépôt : `/home/user/La-passerelle-fwsim/base_de_donnees/catalogue_effets.csv` (descriptions Finale avec PFT : 100 mm cylindrique à 2,80 s, compacts 20–30 mm à 1,59–1,75 s)
- Scripts de calcul : `/tmp/claude-0/-home-user-La-passerelle-fwsim/6b2c1201-7a07-5544-bfa5-21fa40b06cb3/scratchpad/calc/montee.py`, `montee2.py`, `montee3.py`, `montee4.py`
