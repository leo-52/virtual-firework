# 04 — Physique des étincelles et des effets spéciaux (pour le simulateur)

Notes de recherche destinées au moteur de particules et au rendu. L'objectif est un rendu physiquement fidèle : ce qu'on voit, à quelle échelle de temps et de taille, avec quelles couleurs.

**Légende de fiabilité**
- **[S]** = sourcé : mesure ou affirmation explicite dans une source citée.
- **[D]** = dérivé : calcul physique fait ici à partir de données sourcées (hypothèses indiquées).
- **[E]** = estimation ou pratique de terrain : ordre de grandeur plausible, mais sans mesure publiée trouvée. À calibrer sur vidéo et à faire valider par le pyrotechnicien.
- **[I]** = incertain ou ambigu : la source existe mais son interprétation est douteuse.
- **[S faible]** = sourcé, mais par une source amateur ou commerciale.

**Périmètre sécurité** : seulement des mécanismes et des observables. Aucune formulation, aucun ratio, aucun procédé de fabrication. Les familles d'ingrédients sont citées uniquement quand elles expliquent un mécanisme.

---

## 0. Principes physiques communs à toutes les étincelles

### 0.1 Qu'est-ce qu'une étincelle ?
- Une étincelle est une petite particule solide ou liquide incandescente. Sa couleur et sa luminosité dépendent surtout de sa **température**, car elle rayonne quasiment comme un corps noir. **[S]** (Kosanke, *Pyrotechnic Spark Generation*)
- Une particule inerte simplement chauffée dans une flamme refroidit très vite (en quelques dixièmes de seconde) puis disparaît. Exemple : de l'acier inox dans une fontaine ne reste visible que **sur quelques pieds** (environ 1 m). **[S]** (Kosanke)
- Pour qu'une étincelle dure, il faut qu'elle **continue à brûler dans l'air** : la particule réactive s'oxyde et produit sa propre chaleur. L'étincelle reste visible à peine plus longtemps que sa réserve de matière réactive. **[S]**
- **Taille typique des particules d'étincelle** en pyrotechnie : **≈ 0,15 mm à 2 mm** de diamètre. **[S]** (Kosanke)
- Les étincelles sont limitées à trois familles de couleurs : **rouge-orangé, or/jaune, argent/blanc**. Toute autre couleur exige une combustion en phase vapeur (cas rares : zinc bleuté-vert, certains alliages de terres rares). **[S]** (Kosanke & Kosanke 1999, via Wikipedia *Spark (fire)* ; Memmel et al. 2022)

### 0.2 Température → couleur → luminosité
Tableau de Kosanke (d'après Shimizu). Ce sont des couleurs perçues pour un corps noir ; la luminosité relative suit une échelle perceptive logarithmique. **[S]**

| T (°C) | Couleur perçue | Luminosité relative perçue |
|---|---|---|
| 500 | rouge orangé (à peine visible) | 1 |
| 850 | orange rougeâtre | 3 |
| 1500 | orange | 5 |
| 2200 | orange jaunâtre | 7 |
| 3000 | blanc | 8 |

- **Pour le rendu** : il n'existe pas d'étincelle « rouge vif » ni d'étincelle « blanche terne » de même taille, puisque la couleur et la luminosité sont liées. Il faut donc piloter **couleur et intensité à partir d'une seule variable T(t)**, via Planck → CIE XYZ → sRGB. **[S]** (le principe) / **[D]** (l'implémentation)
- **Effet de taille** : à distance, une étincelle est une source ponctuelle. Une particule de 0,85 mm offre 4 fois plus de surface qu'une particule de 0,42 mm, mais ne **paraît qu'environ 60 % plus brillante** (perception logarithmique). **[S]** (Kosanke) → Pour le moteur, la luminosité apparente doit croître avec la surface de façon **compressée**, par exemple en log, ou via un tone-mapping HDR adapté.
- **Charbon de bois** : il rougeoie entre ≈ 480 °C et ≈ 1400 °C environ. **[S]** (PBS Rough Science, source vulgarisée)

### 0.3 Ce qui fixe la température d'une étincelle
La température dépend du **taux de production d'énergie** (vitesse d'oxydation × énergie libérée) face aux pertes (convection et rayonnement). **[S]** (Kosanke, Fig. 1)

- **Charbon** : étincelles **orange**, parce que l'oxydation libère peu d'énergie, et non parce que le charbon serait peu réactif. **[S]**
- **Aluminium** : étincelles **blanches**, parce que l'énergie d'oxydation est très élevée, et non parce que l'aluminium serait très réactif (il l'est peu). **[S]**
- **Règle composite (Kosanke, Fig. 3)** : pour un même matériau, plus le taux d'oxydation à l'air est **lent**, plus les étincelles sont **longues, ternes et rouges**. Plus il est **rapide**, plus elles sont **courtes, brillantes et blanches**. **[S]**

  Conséquence pour le simulateur : on peut corréler **durée de vie ↔ couleur ↔ luminosité** au sein d'une même famille d'effet.

- **Bilan thermique mesuré** (étincelle unique, Inoue et al. 2020) : environ **40 mW** produits par une étincelle de senko-hanabi (type charbon/sels de potassium) contre **50 mW** pour une étincelle de fer. La fusion du sulfate de potassium absorbe environ **40 %** de la chaleur de l'étincelle senko, ce qui explique sa température plus basse. **[S]**

### 0.4 Dynamique : traînée et vitesse limite
Calcul **[D]** avec une sphère, de l'air à 20 °C et une corrélation de traînée Schiller-Naumann. Pour les étincelles de scorie (charbon et sels fondus), on prend une masse volumique de 2000 kg/m³ ; pour les grosses particules d'oxyde de fer, 4500 kg/m³ ; pour les étoiles, 1500 kg/m³. τ = v_lim/g est le **temps de relaxation** : c'est le temps pour « oublier » la vitesse d'éjection.

| Objet | d | v_lim (m/s) | τ (s) |
|---|---|---|---|
| étincelle fine | 0,1 mm | ≈ 0,5 | ≈ 0,05 |
| étincelle de charbon | 0,2 mm | ≈ 1,2 | ≈ 0,12 |
| étincelle de charbon grosse | 0,5 mm | ≈ 3,2 | ≈ 0,33 |
| étincelle grosse (Ti, glitter) | 1 mm | ≈ 6 | ≈ 0,6 |
| très grosse étincelle | 2 mm | ≈ 10 | ≈ 1,0 |
| étoile | 10 mm | ≈ 19 | ≈ 2,0 |
| étoile | 15 mm | ≈ 24 | ≈ 2,4 |
| étoile (marron n°10) | 22 mm | ≈ 29 | ≈ 2,9 |

- **Mesure d'étoile** : une étoile de 22 mm (8,5 g, 1510 kg/m³) tirée verticalement à **91 m/s** donne une trajectoire mieux ajustée avec **C_D ≈ 0,5**. **[S]** (Ooki et al. 2006)
- **Conséquences visuelles [D]** :
  - Une étincelle de 0,2 à 0,5 mm qui quitte une étoile allant à 50–100 m/s perd sa vitesse relative en **0,1–0,3 s**. Elle reste ensuite presque **sur place** et tombe lentement, à 1–3 m/s. La traînée d'une étoile est donc une **ligne quasi figée dans l'air**, qui s'efface par l'arrière (les étincelles les plus anciennes meurent) et qui **s'affaisse** lentement.
  - L'étoile, elle, garde son élan environ 2 s. Sa trajectoire est une parabole fortement amortie.
  - Comme la particule perd de la masse en brûlant, v_lim diminue au cours de la vie de l'étincelle : elle « flotte » de plus en plus.
  - L'air chaud autour de la particule (viscosité plus forte, densité plus faible) réduit encore un peu v_lim pour les petites particules. **[D]**
- **Modèle recommandé** : `dv/dt = g − (3 ρ_air C_D(Re) / (4 ρ_p d)) |v−w| (v−w)`, où w est le vent, avec `d(t)` décroissant et `T(t)` explicite. Pour les étincelles, une version simplifiée suffit : `dv/dt = g − (v−w)/τ(d)`. **[D]**

### 0.5 Particules simples et particules composites
- **Particule simple** (cas typique : le titane) : la particule de métal brûle seule jusqu'à épuisement. La **durée** de l'étincelle est fixée par la **taille** et la vitesse de combustion : plus la particule est grosse, plus elle vit longtemps, mais elle s'allume plus difficilement. **[S]** (Kosanke)
- **Particule composite** (charbon et la plupart des effets dorés) : de petits grains réactifs (charbon, métal fin) sont pris dans une **goutte de scorie fondue** majoritairement inerte (sels de potassium). La scorie limite l'accès à l'air, donc **ralentit** l'oxydation. C'est ce mécanisme qui allonge les queues et rend les étincelles plus rouges. **[S]**

  Exemple : un grain de charbon d'environ 0,5 mm (le plus gros utilisable) brûle **en moins d'une seconde** dans une flamme de gaz, avec une couleur **jaune-orangé vif**. Pris dans une scorie, il donne au contraire des étincelles **plus longues, rouge-orangé terne**. **[S]** (Kosanke)

- **Taille des étincelles composites** : elles sont **plus grosses** quand la vitesse d'air sur la composition est **faible**, c'est-à-dire quand l'étoile est lente, et quand la composition brûle **lentement**. Une étoile rapide (juste après l'éclatement) produit donc des étincelles plus fines, plus courtes et plus brillantes. Une étoile ralentie produit des étincelles plus grosses et plus durables. **[S]** (Kosanke, Fig. 5) → Effet à reproduire : la **texture de la traînée évolue le long de la trajectoire**.
- **Le nombre d'étincelles est à peu près proportionnel au nombre de particules.** Des particules fines donnent beaucoup d'étincelles courtes, des grosses en donnent peu mais longues. **[S]** (Kosanke, *Use of Titanium*)

---

## 1. Étincelles de charbon (queues de chrysanthème, willow/saule, kamuro, comètes or)

### 1.1 Mécanisme
- À la surface de l'étoile en combustion, le charbon non brûlé et les produits fondus (sulfate et carbonate de potassium inertes, polysulfures de potassium réactifs) forment des **gouttelettes de scorie**. Elles sont arrachées par le vent relatif et continuent de brûler dans l'air : les polysulfures s'oxydent en sulfate, et le charbon s'oxyde en CO₂, un gaz qui ne protège pas le carbone. **[S]** (Kosanke, Tab. 4 ; Lecture Notes)
- Les étincelles de charbon sont des **gouttelettes liquides**, comme la phase sombre des paillettes (glitter). **[S]** (Jennings-White 1998)
- **Senko-hanabi**, le modèle « de labo » de l'étincelle charbon/soufre/nitrate : la scorie est à **≈ 850–940 °C** (≈ 1120–1210 K). **[S]** (Maeda, cité par JPyro n°32 et Oglesby)
  - Les gouttes éjectées se fragmentent en cascade : **jusqu'à 8 générations**, chacune plus petite, ce qui donne les « aiguilles de pin » ramifiées. **[S]** (Inoue, Villermaux et al., PRL 118, 074502, 2017)
  - Mécanisme : oxydation par l'air → décomposition de composés instables dans la goutte → **nucléation de bulles de gaz** → éclatement (micro-explosion) → ligaments → gouttes filles. **[S]**
  - Durée de vie d'une goutte : τ ≈ d²/α, où α est la diffusivité thermique. Avec d ~ 10⁻⁴ m et α ~ 10⁻⁶ m²/s, on obtient **τ ~ 10 ms par génération**. Vitesse de vol de l'ordre du **m/s**, soit un vol d'environ **1 cm** par génération. **[S]** pour la loi et les ordres de grandeur ; **[D]** pour le chiffre. Les étincelles atteignent 10–20 cm, parfois jusqu'à 40 cm. **[S]** (JPyro 32)
  - Avant d'éclater, la température de l'étincelle **monte** jusqu'à un maximum proche du point de fusion de K₂SO₄. **[S]** (Inoue 2020)

### 1.2 Étincelles de charbon d'une étoile ou d'une comète (ordres de grandeur)
- Diamètre : **≈ 0,15–1 mm**. **[S]** pour la plage générale (Kosanke)
- Température : **≈ 1100–1500 K** environ. **[E]**, déduit de la scorie de senko (≈ 1150–1200 K), de l'estimation de Kosanke pour une gouttelette de scorie (≈ 1200 °C ≈ 1470 K) et de la couleur rouge-orangé à orange observée.
- Couleur : **rouge-orangé → orange-or**. Les queues dites « or » vont vers l'orange-jaune, les « rouges » sont plus froides. **[S]** (qualitatif)
- **Durée de vie** d'une étincelle :
  - queue de chrysanthème ordinaire : **≈ 0,3–1,5 s** **[E]**
  - willow et kamuro : **≈ 2–5 s**, et plus pour les « hanging » willows **[E]**

  Repères : un charbon nu de 0,5 mm brûle en moins de 1 s (**[S]**) ; l'enrobage par la scorie allonge fortement cette durée.

- **Évolution de couleur le long de la queue** :
  - L'étincelle naît dans la flamme de l'étoile à ≈ 2000 K (la flamme de poudre noire est à ≈ 1700 °C **[S]**, Kosanke *Titanium*), puis elle refroidit vers son équilibre de combustion (~1200–1400 K) en quelques dizaines de ms.
  - Elle brûle ensuite de façon quasi stationnaire.
  - En fin de vie, quand la matière réactive est épuisée ou enfermée dans la scorie, elle refroidit et passe du rouge sombre à l'invisible.

  **Profil T(t) conseillé [E]** : pic bref → plateau → déclin final sur 10–20 % de la vie. La queue apparaît alors **jaune-orangé près de l'étoile, rouge sombre à l'extrémité**.
- **Branchement** : les étincelles composites de charbon **ne branchent généralement pas** à grande échelle (Kosanke). Le senko-hanabi est l'exception, et le branchement n'y est visible que de près. **[S]**

### 1.3 Pourquoi les willow et kamuro « pendent » longtemps et s'affaissent [D]
1. Les étoiles sont **à combustion lente**, sur plusieurs secondes, et chargées en charbon. Elles produisent **de grosses étincelles composites lentes à brûler**, donc longues, rouge-or et peu brillantes (règle de Kosanke).
2. À la vitesse de vol, les étincelles se détachent puis s'arrêtent en ~0,1–0,3 s (τ). Chacune reste là où elle a été lâchée et tombe à **v_lim ≈ 1–4 m/s**. Sur 3–5 s de vie, elle descend de **5–15 m**.
3. L'étoile elle-même, freinée en environ 2 s, finit par **tomber à v_lim ≈ 20 m/s**. Sa traînée devient alors verticale.

   L'ensemble forme le dôme puis les « branches de saule » qui pendent. Les traînées dessinent la parabole amortie de l'étoile, recouverte d'une **chute lente et uniforme** des étincelles.
4. Le **kamuro** est plus **dense** (beaucoup d'étoiles, traînées épaisses), avec souvent des paillettes. Le **willow** a des traînées plus longues et plus fines, très tombantes. **[S]** pour les définitions (Wikipedia *Fireworks*, fireworks.com) ; le contraste de densité est **[E]**.

   Ordre de grandeur de durée totale d'un willow : **5–10 s**, voire plus. **[E]** (Slate indique « au moins 10 s » pour mériter le nom : source grand public)

### 1.4 Densité d'étincelles [E]
- Une étoile de 10–17 mm (1–4 g) brûle en **0,8–2,4 s** posée sur une plaque. **[S]** (Ooki 2006)
  - Vitesse de combustion linéaire : **3–6 mm/s**. **[S]**
  - Le temps de combustion est proportionnel au diamètre. **[S]**
  - La dispersion entre étoiles d'un même lot est faible (écart-type relatif ≈ 5 %). **[S]**
  - **En vol, la combustion dure ≈ 1,6 fois plus longtemps** que sur plaque. **[S]**
- Si une fraction notable de la masse part en étincelles de 0,2–0,4 mm (≈ 10–60 µg chacune), on obtient **10³–10⁴ étincelles émises par seconde et par étoile**, dont seulement une partie est vivante à un instant donné. **[E]**

  **Conseil rendu** : émettre **N ≈ 300–3000 particules/s par étoile** dans le simulateur, chacune pondérée en luminosité (agrégation). Puis ajouter un « ruban » (trail) pour la continuité visuelle.

---

## 2. Étincelles métalliques

### 2.1 Tableau de synthèse

| Métal | Couleur | T étincelle | Durée / taille | Branchement | Notes |
|---|---|---|---|---|---|
| **Titane** | blanc argent, parfois jaunâtre selon le milieu | ~2400 K dans l'air, ~3000 K en milieu perchlorate **[S]** (OSTI 2311766) | t_b ≈ 3,14·10³ · d^1,85 ms (d en mm, 15–280 µm) **[S]** ; extrapolation 0,3 mm → ≈ 0,3 s, 0,8 mm → ≈ 2 s **[D]** | oui (micro-explosions en fin de vie) **[S]** | éb. 3287 °C, s'allume facilement, ne se vaporise pas **[S]** |
| **Aluminium** (atomisé ou paillettes, « flitter ») | blanc, parfois jaune **[S]** | ≈ 2700–3000+ K **[E]** (flamme d'alumine) | Beckstead : t_b ∝ d^1,5–1,8, ≈ 40–50 ms pour 100 µm dans l'air **[D]** ; les grosses paillettes durent plus longtemps | **en général non** **[S]** (Memmel 2022) | réactivité faible, énergie élevée **[S]** |
| **Magnalium** (Mg/Al) | blanc | ≈ 3000 K **[E]** | courte | **oui, abondant** **[S]** | Mg bout à 1090 °C, donc se vaporise ; Mg/Al seul vers 1200–1500 °C **[S]** |
| **Fer / acier** (avec carbone) | or-jaune (« comme un cierge magique ») **[S]** | **≈ 2050 K** **[S]** (Memmel, Fe) | particules de 80–160 µm → étincelles de 11–16 cm (meulage) **[S]** | **oui, si carbone** ; le fer pur ne branche pas **[S]** | « fire flowers », « pine needles » |
| **Fer-aluminium, ferro-titane** | or | — | — | oui (Fe/Al) **[S]** | glitter et firefly possibles **[S]** |
| **Zinc** | blanc bleuté-verdâtre (vapeur) | — | — | — | bout à 907 °C **[S]** |
| **Zirconium** | blanc | plus chaud que Ti **[S]** | — | oui (micro-explosions) **[S]** | |

Couleurs selon Kosanke (Lecture Notes) : C = orange, Fe = jaune, Al et Ti = jaune pâle à blanc, Zr et Mg = blanc. L'**électronégativité** prédit assez bien la couleur. **[S]**

### 2.2 Titane (« étincelles argent »)
- Le titane brûle presque comme une particule simple : peu de scorie y reste attachée. C'est l'archétype de l'étincelle métallique à longue traînée blanche (salute à titane, gerbes argent). **[S]** (Kosanke)
- Des particules **plus grossières** donnent des étincelles **plus longues mais moins nombreuses** : il y a un compromis entre la durée et le nombre. **[S]**
- Dans les compositions qui laissent une scorie importante, l'oxydation ralentit et l'étincelle **vire vers le jaune**. **[S]** (Lecture Notes)
- **Fin de vie** : une particule de Ti brûlant dans l'air **explose** (micro-explosion ou fragmentation) près de l'eutectique Ti–O. Les températures restent sous les points d'ébullition. **[S]** (Molodetsky, Dreizin et al. 1998)
- **Rendu** : traînée blanche nette, presque pas de rougissement, puis mort brutale, souvent par un petit éclatement en 3–10 fragments éphémères. **[E]**

### 2.3 Fer et acier : étincelles ramifiées (« fire flowers »)
Mécanisme mesuré par Kimura & Inoue (2022, caméra rapide et pyrométrie bicolore) **[S]** :
1. Le fer s'oxyde en surface, la particule fond et la couche d'oxyde s'épaissit par **diffusion de l'O₂** dans la goutte.
2. L'oxyde de fer réagit avec le carbone dissous. Cette réaction endothermique produit des **bulles de CO**.
3. Les petites bulles proches de la surface s'échappent : c'est le « **puffing** » (mini-éclatements), d'autant plus fréquent qu'il y a plus de carbone.
4. Une bulle au centre gonfle la goutte puis la **fait éclater** : ligaments puis gouttes filles.
5. Les gouttes filles contiennent encore du fer et se rallument : **deuxième et troisième éclatements**. La cascade s'arrête quand tout le fer est oxydé, et la particule **se solidifie aussitôt** et s'éteint.

**Ordres de grandeur** :
- goutte mère : r ~ 10⁻⁵ m ; temps de vol jusqu'à l'éclatement ~ **10⁻² s** ; loi t_burst ≈ r²/D (diffusion de l'O₂, nombre de Fourier ≈ 1), **indépendante de la teneur en carbone** **[S]**
- gouttes filles : r ≈ 1/10 de la mère, temps plus courts **[S]**
- vitesse d'éjection des filles : u ~ √(σ/(ρ b)), où b est le rayon de la bulle et σ la tension de surface **[S]**
- après chaque éclatement, la température **chute brièvement** (surface froide exposée) puis **remonte** **[S]**
- la luminosité **augmente juste avant** un événement de branchement ; le fer sans carbone, lui, **s'éteint progressivement** **[S]** (Memmel 2022)
- fontaine à alliage de néodyme : branchements successifs **sur environ 50 ms** ; les étincelles d'une fontaine « ice » commerciale finissent le plus souvent par **un seul** branchement **[S]**
- en pyrotechnie, les grosses particules de **fonte** donnent les plus belles « boules de dentelle » en fin de combustion. Les autres métaux (Ti, magnalium) branchent aussi, mais moins joliment. **[S]** (Kosanke)

**Modèle conseillé [D/E]** :
- Chaque particule « fer » porte un **compte à rebours** t_b ∝ d².
- À l'échéance : **flash de surbrillance** (+50–100 % pendant 1–3 ms), puis émission de **5–20 filles**. Leur diamètre est d/5 à d/10, leur vitesse relative isotrope de quelques m/s, et leur durée de vie (d/10)² fois plus courte. On recommence sur 2–3 générations au maximum.
- Couleur or, T ≈ 2000 K.

### 2.4 Aluminium et magnalium
- **Aluminium** : sa faible réactivité oblige à le chauffer dans une flamme chaude. Son énergie d'oxydation très élevée donne une étincelle blanche. Il **branche rarement**. Les grosses paillettes produisent du « **flitter** », de grosses étincelles blanches qui flottent. **[S]** (Kosanke ; Oglesby). Selon Oglesby, des paillettes très grandes (≈ 3 mm) donnent presque toujours du flitter. **[S]**
- **Magnalium** : son magnésium se vaporise facilement, ce qui donne des étincelles plus courtes, blanches, qui branchent ou crépitent. **[S]**
- **Firefly** (« luciole ») : une étincelle de scorie contenant **carbone + aluminium**. Elle vit longtemps, puis passe **soudainement d'un or terne à un argent brillant**. **[S]** (Shimizu ; Kosanke ; Lecture Notes)
  - **Rendu** : changement d'état T₁ ≈ 1300 K → T₂ ≈ 2500 K après un délai aléatoire. **[E]** pour les valeurs

### 2.5 Autres métaux (couleurs « exotiques », recherche récente)
- Les étincelles d'erbium, d'ytterbium-cuivre et de lithium-silicium alternent des segments **corps noir (or)** et des segments **vapeur colorée** (vert YbO/YbOH vers 480–530 nm, rouge Li à 671 nm). **[S]** (Memmel et al. 2022 ; Lederle 2019–2020)
- Températures mesurées (ajustement de Planck) **[S]** :
  - Fe 2054 K
  - Ce 2770 K
  - La 2669 K
  - Y 2930 K
  - ferrocérium 2815 K
  - phase or de Yb-Cu ≈ 1550 K
- Ces effets restent marginaux dans les spectacles. Ils sont utiles comme option de rendu « étincelles bicolores ».

---

## 3. Paillettes (glitter) — le « flash retardé »

### 3.1 Mécanisme (consensus qualitatif, chimie encore débattue)
- Définition : « une étincelle liquide qui se termine par un flash retardé ». La première phase est **terne**, de même couleur et luminosité qu'une étincelle or de charbon. Puis survient une **augmentation de lumière brève mais énorme**. **[S]** (Jennings-White 1998)
- **Formation de la goutte (spritzel)** : à moins de **5 mm** de l'étoile, un noyau accumule le brouillard de matière fondue jusqu'à former une goutte de **≥ 0,05 mm**. Cette goutte contient de l'aluminium fondu enrobé de sels fondus. **[S]** (Oglesby)
- **Phase de retard** : la goutte tombe en brûlant faiblement, à **≈ 850 °C** selon Oglesby (≈ 1200 °C selon les Lecture Notes de Kosanke). Les réactions sulfure → sulfate se poursuivent avec l'oxygène de l'air. L'aluminium est **à peine consommé** pendant ce temps. **[S]**
- **Flash** : quand l'oxydant formé dans la goutte (sulfate) atteint une **concentration critique** (ou une température critique selon Shimizu), il réagit violemment avec l'aluminium. C'est une mini-réaction de type poudre-éclair. **[S]**
- **Durée du retard** : elle augmente avec les additifs qui forment des sulfates à haut point de fusion (alcalino-terreux), qui ralentissent la montée en oxydant ou gênent le mélange interne. Avec une **plus grosse particule d'aluminium atomisé**, le délai est plus long et le flash plus gros. **[S]** (Oglesby ; Jennings-White ; Lecture Notes)
- **L'aluminium est indispensable.** Le magnalium à forte teneur en Al marche aussi ; les alliages Zr/Al et Zn/Al ne marchent pas. **[S]** (Lecture Notes)

### 3.2 Apparence
- **Couleur du flash** : **blanc à jaune pâle**. Les particules d'Al plus grosses donnent des flashs plus blancs, les plus fines plus jaunes, surtout en présence de sodium. Les essais de glitter coloré sont décevants, sauf le **jaune** (sodium). **[S]**
- **Taille du flash** (« spritz size ») : diamètre de la zone lumineuse. Avec l'aluminium seul, les gouttes font **0,1–3 mm**. Le magnalium donne **beaucoup moins de flashs mais plus gros et plus brillants**. **[S]** (Oglesby ; ses « 3–30 mm » pour le magnalium désignent plausiblement la taille du **flash** plutôt que celle de la goutte → **[I]** à confirmer)
- **Débris** : le flash peut projeter des « **spurels** », éperons de débris incandescents visibles de près (de quelques pieds à ~30 m), et des « **spurets** », plus nombreux et plus fins. **[S]** (Oglesby)
- **Flashs asymétriques** en « virgule » quand la goutte est mal mélangée. **[S]** (Winokur, cité par Oglesby)
- **Son** : chaque flash produit un petit « **pfft** » ou grésillement (« spritz »). Avec certains mélanges, il est audible à **≈ 300 m**. **[S]** (Oglesby)
- **Typologie** (Oglesby) **[S]** :
  - **pearl** : retard court, flashs ellipsoïdaux **près de l'étoile**, en « perles en larme »
  - **tremolante** : retard moyen, quelques flashs près de l'étoile, la plupart **dans le sillage**
  - **twinkler** : retard long, aucun flash près de l'étoile, **longue traîne de flashs épars**. L'étoile est souvent consumée avant que la moitié des flashs aient eu lieu.
  - le **retard terminal** désigne la dernière grosse goutte d'une étoile, qui donne un **flash particulièrement gros et tardif**
- **Pourquoi ça scintille [D]** :
  - Chaque goutte a son propre délai, distribué de façon aléatoire (taille, composition locale).
  - Le flash est beaucoup plus bref que le délai.
  - Le contraste de luminosité entre phase terne et flash est d'un à deux ordres de grandeur.

  Le résultat est un champ de points qui s'allument au hasard et brièvement : l'œil voit un pétillement.

### 3.3 Paramètres de simulation [E sauf mention]
| Paramètre | Valeur suggérée |
|---|---|
| Phase terne | T ≈ 1100–1300 K, faible luminosité, chute libre (v_lim 1–5 m/s) |
| Délai avant flash | pearl : 20–100 ms ; tremolante : 0,1–0,5 s ; twinkler : 0,5–2 s. Distribution log-normale avec un écart-type relatif de ~30–50 % |
| Durée du flash | 2–20 ms (≈ une image vidéo), montée très rapide puis décroissance exponentielle |
| Intensité du flash | ×20 à ×100 par rapport à la phase terne ; T_eff ≈ 2800–3200 K (blanc), ou blanc-jaune |
| Taille apparente du flash | 1–5 cm pour Al, jusqu'à ~10–30 cm pour les gros flashs de magnalium [I] |
| Émission de gouttes | dizaines à centaines par seconde et par étoile |
| Option | 3–8 « spurels » éphémères (≈ 50 ms) au moment du flash, pour les vues rapprochées |

---

## 4. Strobe — combustion oscillante

### 4.1 Mécanisme
- La composition alterne une **phase sombre** de couvaison (« smoulder ») et une **phase flash**, de façon périodique. Toutes les compositions connues ont été trouvées **empiriquement**, et le mécanisme reste mal compris. **[S]** (Corbel et al., *Angew. Chem.* 2013)
- **Observation de Shimizu** **[S]** :
  1. Une réaction lente et non lumineuse fait croître une couche de **scorie** en surface.
  2. Des **points chauds** apparaissent, grossissent et fusionnent.
  3. La scorie réagit violemment : c'est le **flash**.
  4. Le cycle recommence sur la couche suivante.
- **Juste avant le flash, des fragments de la couche de surface sont éjectés.** Du gaz se forme sous la surface. La pastille se consume **couche par couche**, presque linéairement. **[S]** (Corbel)
- **Chaque cycle consomme une épaisseur définie** de composition, **≈ 1,4–1,5 mm** dans l'exemple mesuré. **[S]** (Harrison 2024)
- **Températures** (thermocouple W-Re, mesure au millième de seconde) **[S]** (Harrison 2024) :
  - **flash ≈ 2000 K**
  - **couvaison ≈ 1125 K**
- Le phénomène tient à un équilibre délicat. Si le flash est trop énergique, il disperse trop de matière, la surface refroidit et l'étoile **s'éteint**. S'il est trop faible, la combustion devient **continue**. **[S]** (Harrison)

### 4.2 Fréquences, rapport cyclique, variabilité
- **Plage utile en pyrotechnie : ≈ 1–10 Hz** (Jennings-White). **[S]** Exemples mesurés :
  - étoile blanche de 8 mm : **6 Hz** **[S]** (Juknelevičius, thèse Vilnius 2020)
  - strobes bleus : **4–8 Hz** ; d'autres formulations de 5 à 15 Hz ; référence à 1–2 Hz **[S]** (Juknelevičius et al., *EurJIC* 2017)
  - strobes jaunes : **7–20 Hz** **[S]** (Glück, Klapötke, Küblböck 2018)
  - composition de labo à métal grossier, volontairement lente : **0,42–0,45 Hz** **[S]** (Harrison 2024)
  - strobes militaires « très lents » : ≈ 1 flash par minute **[S]** (brevet US 10207959, DTIC)
- **Facteurs d'influence** **[S]** (Lecture Notes ; Juknelevičius) :
  - la fréquence **augmente** avec plus de métal, un métal plus fin, et une meilleure rétroaction thermique (étoile cubique, plus grosse) ;
  - même composition : bâtonnet de 5 mm ≈ **3,5–3,8 Hz**, pastille de 13 mm ≈ **8 à > 10 Hz** ;
  - trop de liant donne une combustion continue.
- **Désynchronisation** : plusieurs zones de réaction progressent en même temps et produisent des **flashs qui se chevauchent** sur une grosse pastille. **[S]** Dans une bombe, les étoiles strobe sont **indépendantes**, donc pas en phase : le champ clignote de façon **aléatoire**, et non en bloc. **[D]**
- **Rapport cyclique** : le flash est **bref** devant la phase sombre. **[S]** (qualitatif : « flashs d'égale intensité séparés de durées sombres à peu près égales »)
  - Durée de flash estimée à **5–30 ms**, soit un rapport cyclique de ≈ 3–15 % à 5 Hz. **[E]**
  - Pendant la phase sombre, l'étoile est quasi invisible, avec au plus une faible lueur rouge sombre de scorie à ~1100 K. **[D]**

### 4.3 Paramètres de simulation
| Paramètre | Valeur |
|---|---|
| f par étoile | tirage dans 3–12 Hz (aérien typique) **[E, encadré par S]** |
| Jitter cycle à cycle | ±10–20 % sur la période **[E]** |
| Phase initiale | aléatoire uniforme |
| Dérive | f peut varier de ±20 % au cours de la vie de l'étoile (géométrie qui change) **[E]** |
| Flash | 5–30 ms, T ≈ 2000–3000 K (blanc ; ou coloré selon l'émetteur), intensité constante d'un flash à l'autre **[S qualitatif]** |
| Sombre | très faible lueur ou rien ; aucune traînée d'étincelles |
| Mouvement | l'étoile continue de voler ; à 30–60 images/s, un flash ne tombe parfois sur aucune image → **intégrer temporellement** (motion blur ou accumulation) pour ne pas perdre de flashs |

---

## 5. Crépitants (« dragon eggs », microstars crépitantes)

### 5.1 Mécanisme
- Une **réaction thermitique** entre un alliage Mg/Al et des oxydes métalliques (oxydes de plomb historiquement, oxyde de bismuth comme substitut non toxique, oxydes de cuivre). La combustion est **intermittente** : le Mg réagit lentement d'abord, puis l'oxyde se décompose, des gaz s'accumulent, et l'aluminium réagit brutalement, ce qui fait **exploser le grain**. **[S]** (Koch, JPyro 24, 2006 ; Wikipedia *Magnalium* ; AFN)
- Variante sans oxyde (Mg / perchlorate / PTFE) **[S]** (Koch 2006) :
  - flamme rose-violet ;
  - étincelles **orange à l'éjection** qui deviennent **blanc éblouissant à l'explosion** ;
  - le crépitement est une série de **petites explosions intermittentes**, bien distinctes du « fffff » de la flamme.
- **Le crépitement collectif vient du fait que les microétoiles explosent à des instants différents.** **[S]** (sources amateurs)

### 5.2 Timing et apparence
- **Délai entre allumage et explosion** : **≈ 1–3 s**. Plus l'alliage est grossier, plus le délai est long et la détonation forte ; plus il est fin, plus le délai est court et les « pops » nombreux et faibles. **[S faible]** (forums et AFN, sources amateurs)
- Pendant le délai, le grain **couve faiblement** : petite flamme ou lueur orange, peu lumineuse. **[E]**
- **Pop** : un flash blanc très bref (**≲ 5 ms**), diamètre visuel **≈ 5–30 cm** à la taille d'un grain de 2–5 mm, et un claquement sec large bande. **[E]**
- **Un grain = un pop.** Pour les gros grains, une seule forte détonation. **[S faible]**
- **Étalement temporel d'une salve** : les microétoiles allumées ensemble éclatent sur une **fenêtre de ≈ 0,5–2 s**. On entend un « crrrr » dont la densité monte puis décroît. **[E]**
- Cadence typique dans une bombe crépitante : de dizaines à centaines de pops par seconde au pic. **[E]**

### 5.3 Simulation
- Une particule « crépitante » : chute libre pendant le délai, avec un délai tiré dans une loi normale tronquée (μ ≈ 1–1,5 s, σ ≈ 0,3–0,5 s) **[E]**.
- Elle émet un **sprite flash** blanc, sans traînée, et déclenche un **événement audio** court (1–3 ms, large bande). Le son arrive avec le **retard de propagation** (≈ 2,9 ms/m) : à 300 m, il est décalé de ≈ 0,9 s par rapport au flash.
- Option : un « nuage » de mini-étincelles orange-blanc projetées à quelques m/s.

---

## 6. Autres effets (description physique courte)

### 6.1 Comètes
- Grosse étoile (souvent cylindrique ou en pastille) lancée **seule** depuis un mortier ou un tube, ou **attachée** à l'extérieur d'une bombe pour faire une traînée de montée. Elle laisse une **longue traînée d'étincelles** de charbon (or) ou de métal (argent/titane). **[S]** (Wikipedia *Comet (pyrotechnics)*)
- Les comètes « matrice » contiennent de petites étoiles noyées : la matrice brûle faiblement et allume les étoiles, qui font l'effet visible. **[S]**
- **Physique [D]** :
  - masse et diamètre élevés, donc v_lim élevée et grande portée ;
  - **traînée = ligne d'étincelles quasi immobile** (§0.4), avec un gradient de couleur (jaune → rouge sombre) et de densité (dense près de la tête) ;
  - la tête est un peu plus brillante que la traînée.

### 6.2 Palmiers (palms)
- **Quelques grosses comètes** éjectées à l'éclatement font des « palmes ». Une **traînée de montée épaisse** fait le « tronc ». Une insertion intérieure peut ajouter des « noix de coco ». **[S]** (Wikipedia *Fireworks*)
- **Physique** : peu d'objets (≈ 6–20 **[E]**) très massifs, donc moins freinés. Les traînées longues et épaisses s'incurvent vers le bas en fin de course.

### 6.3 Brocart (brocade), crown, time rain
- **Brocart** : effet proche du willow, mais **plus brillant** et à traînée plus **argentée/scintillante**. La forme reste nette en s'éteignant et dure « quelques secondes ». Il contient souvent des paillettes (glitter) dans la traînée. **[S faible]** (retailers, Phantom)
- **Time rain** : grosses étoiles à combustion lente qui laissent une traînée de grosses étincelles scintillantes, avec un **grésillement**. **[S]** (Wikipedia)
- **Simulation** : traînée charbon (§1) + composante glitter (§3) + T légèrement plus élevée (or-blanc).

### 6.4 Crossettes (comètes qui se divisent)
- Une comète ou une grosse étoile vole sur une **courte distance**, puis une petite charge interne la **brise en plusieurs morceaux**, typiquement **4** (souvent annoncé « 4 ou plus »). Les morceaux s'écartent en **croix**. Souvent accompagné d'une **détonation ou d'un crépitement**. **[S]** (Wikipedia ; textes amateurs pour le « 4 »)
- **Paramètres [E]** :
  - délai avant la division : 0,3–1 s après l'éclatement ;
  - vitesse de séparation des fragments : ~10–30 m/s, perpendiculaire à la trajectoire ;
  - chaque fragment garde la vitesse de la comète mère plus ce Δv, et continue de produire une traînée ;
  - un petit flash au point de division.

### 6.5 Feuilles tombantes (falling leaves)
- Des « étoiles » ou fragments qui **scintillent et descendent en voletant**, avec un mouvement d'aller-retour, comme des feuilles, **sans bruit**. **[S faible]** (glossaires APA et retailers)
- **Physique [D/E]** : ce sont des objets **plats et légers**, de grand rapport surface/masse. Leur chute est lente (≈ 1–3 m/s), ils **oscillent** (flutter/tumble des plaques en chute : oscillations de 0,5–2 Hz) et leur flamme colorée est lente.

  **Simulation** : particule avec v_lim ≈ 2 m/s, plus une oscillation latérale sinusoïdale (amplitude 0,3–1 m, 0,5–1,5 Hz) et une rotation qui module la luminosité. Durée de 3–8 s.

### 6.6 Sifflets (whistles) — résonance
- Une composition qui brûle dans un tube (la « cheminée ») ouvert à une extrémité. Le **front de réaction** forme une frontière à haute impédance et sert de **source d'énergie acoustique**. La bouche est une frontière à basse impédance. C'est un **résonateur quart d'onde** à rétroaction thermo-acoustique : la combustion est fortement sensible à la pression. **[S]** (Maxwell 1952 ; étude ResearchGate ; Lecture Notes « modèle de la bouteille »)
- **Fréquence** **[S]** (Ding et al., *STEM* 80, 2019) :
  - fondamental **≈ 2–5 kHz** (un exemple mesuré : 4834 Hz, avec harmoniques entières 9668 et 14 502 Hz) ;
  - onde de pression **quasi sinusoïdale**.
- **Conditions** : le sifflement n'apparaît que si la densité de chargement dépasse un **seuil critique** et que la **longueur de cheminée** au-dessus du front dépasse un **minimum**. Au départ il n'y a que du souffle ; puis l'oscillation s'établit et **la flamme sortant du tube devient plus petite**. **[S]**
- **Évolution de la hauteur** : f ≈ c_gaz chauds / (4 L_eff). Comme le front recule, L augmente pendant la combustion, donc la **hauteur du son descend**. Une densité de chargement plus forte rend le son plus fort et un peu plus grave. **[S]** pour la dépendance à L et à la densité ; **[D]** pour la descente progressive.
- **Rendu** : petite flamme et peu d'étincelles. Le son est un ton pur glissant vers le bas. Pour une fusée sifflante, ajouter le **décalage Doppler**. **[D]**

### 6.7 Traînée de montée d'une bombe (rising tail)
- C'est soit la **mèche (fusée de temporisation)** de la bombe, qui laisse un mince filet d'étincelles orange peu visible, soit une **comète attachée** (« rising tail » franc, or ou argent). **[S]** (Wikipedia *Comet*)
- **Physique [D]** :
  - la bombe monte à quelques dizaines de m/s en décélérant ;
  - les étincelles émises restent quasi sur place (τ ≈ 0,1–0,3 s) : la traînée est une **colonne verticale** qui s'éteint par le bas (étincelles les plus anciennes) avec 0,5–2 s de persistance par étincelle ;
  - au sommet, la vitesse est faible, donc la traînée s'y densifie.
- **Rayons d'éclatement** des bombes japonaises sphériques (photos, ≈ 280 bombes) **[S]** (Kosanke, d'après Shimizu) :

  | Calibre | Rayon typique | Rayon maximum |
  |---|---|---|
  | 3" | ≈ 40 m | ≈ 65 m |
  | 5" | ≈ 64 m | ≈ 100 m |
  | 6" | ≈ 78 m | ≈ 116 m |
  | 8" | ≈ 100 m | ≈ 143 m |
  | 10" | ≈ 126 m | ≈ 165 m |
  | 12" | ≈ 150 m | ≈ 181 m |

  Utile pour caler la vitesse initiale des étoiles avec C_D ≈ 0,5 (une étoile à 90 m/s est mesurée, Ooki).

### 6.8 Effets au sol (bref, physique seulement)
- **Gerbe, fontaine** : une composition brûle dans un tube **à étranglement**. Le jet de gaz chauds entraîne des **particules de métal ou de scorie** (Ti, Fe, Al, charbon). Les étincelles sont les plus chaudes possible (meilleur chauffage). **[S]** (Kosanke : la fontaine est le dispositif le mieux adapté pour chauffer des particules)
  - Les étincelles suivent des **paraboles amorties** et retombent en « cascade ».
  - Hauteur de quelques m à ~10 m, vitesses d'éjection estimées à **~10–40 m/s** **[E]**.
  - Les fontaines « flower pot » à grosses gouttes produisent des **gouttes longues à branchements multiples** (« chaque goutte est un senko-hanabi »). **[S]** (Jennings-White)
- **Mine** : le mortier projette directement étoiles et comètes en **cône**, depuis le sol, sans bombe. **[S]** (Wikipedia)

  **Simulation** : émission conique de demi-angle ≈ 5–20°, vitesses initiales de 50 à 100 m/s **[E]**, puis la même physique d'étoiles.

---

## 7. Récapitulatif pour l'implémentation

1. **Une seule variable thermique T(t) par particule** pilote couleur (Planck) et intensité. La luminosité perçue croît « log » avec la surface.
2. **Traînée** : τ = v_lim/g, avec τ ≈ 0,05–0,3 s pour les étincelles de 0,1–0,5 mm. La traînée est une ligne figée, qui tombe lentement et s'efface par l'arrière.
3. **Étoiles** : C_D ≈ 0,5 ; v₀ jusqu'à ~90–100 m/s ; combustion de 1–4 s (×1,6 en vol par rapport à la plaque) ; dispersion de ±5 %.
4. **Charbon** : 1100–1500 K, rouge-orangé à or ; vie de 0,3–1,5 s (chrysanthème) à 2–5 s et plus (willow/kamuro) ; refroidissement final.
5. **Titane** : blanc, ~2400 K ; vie ∝ d^1,85 (≈ 0,3 s à 0,3 mm, ≈ 2 s à 0,8 mm) ; micro-explosion finale.
6. **Fer avec carbone** : or, ~2050 K ; éclatement après t ∝ r²/D (~10 ms pour r ~ 10 µm) ; 2–3 générations, filles 10 fois plus petites ; surbrillance avant éclatement ; puffing.
7. **Glitter** : phase terne (~1100–1300 K) puis flash blanc-jaune bref (ms) après un délai aléatoire (pearl ≪ tremolante < twinkler, 0,02–2 s).
8. **Strobe** : 1–10 Hz (jusqu'à 20), flash ≈ 2000 K et plus, sombre ≈ 1100 K, phases aléatoires entre étoiles, ~1,5 mm consommé par cycle.
9. **Crépitants** : délai ≈ 1–3 s, un pop par grain, flash blanc de quelques ms, salve étalée sur ~0,5–2 s ; son décalé de 2,9 ms/m.
10. **Sifflet** : ton de 2–5 kHz avec harmoniques entières, hauteur qui descend, flamme réduite.

---

## 8. Sources

### Kosanke, Shimizu, Journal of Pyrotechnics
- K.L. & B.J. Kosanke, *Pyrotechnic Spark Generation* (PGI Bull. 65, 1989 ; Selected Publications Part 1, p. 112–117). Page : https://www.jpyro.co.uk/?p=497 — PDF : http://www.jpyro.co.uk/wp-content/uploads/k01_112_fbur.pdf
- K.L. & B.J. Kosanke, *The Use of Titanium in Pyrotechnics* (Selected Publications Part 1, p. 120–123). Page : https://www.jpyro.co.uk/?p=499 — PDF : http://www.jpyro.co.uk/wp-content/uploads/k01_120_arci.pdf
- K.L. & B.J. Kosanke, *Japanese Shell Break Radii* (d'après Shimizu). PDF : http://www.jpyro.co.uk/wp-content/uploads/k01_104_kw7c.pdf
- Kosanke et al., *Lecture Notes for Pyrotechnic Chemistry* (sections étincelles, glitter, strobe, sifflets) : https://vdoc.pub/documents/lecture-notes-for-pyrotechnic-chemistry-pyrotechnic-reference-gd0puqd4sj00
- C. Jennings-White, *Glitter Chemistry*, J. Pyrotechnics 8 (1998) 53 : https://www.jpyro.co.uk/wp-content/uploads/j08_53_h29f0.pdf
- L.S. Oglesby, *Glitter: Chemistry & Techniques* (définitions spritzel, delay, spritz, pearl/tremolante/twinkler) : http://www.freepyroinfo.com/Pyrotechnic/Pyrotechnic_Books/Glitter_the_Chemistry_Techniques_by_Lloyd_Scott_Oglesby_2.pdf
- R. Harrison, *A New Model for Pyrotechnic Strobes*, J. Pyrotechnics 2024, 54–64 : https://www.jpyro.co.uk/?p=2196 — PDF : http://www.jpyro.co.uk/wp-content/uploads/2024_54_gsdt6.pdf
- E.-C. Koch, *Metal–Fluorocarbon Pyrolants VII: Crackling Effect Based on Mg/KClO₄/(C₂F₄)n*, J. Pyrotechnics 24 (2006) : https://www.jpyro.co.uk/?p=96 — PDF : http://www.jpyro.co.uk/wp-content/uploads/j24_11_hsenf.pdf
- *The Senko Hanabi Sparkler: A Study of its Reaction Mechanisms*, J. Pyrotechnics 32 : http://www.jpyro.co.uk/wp-content/uploads/J32_43_wwaqr.pdf

### Physique des étincelles (recherche)
- C. Inoue, T. Watanabe, Y. Inokuchi, *Heat balance of senko-hanabi and iron sparks*, Sci. Tech. Energ. Mater. 80(4) 136–141 (2019/2020) : https://www.jes.or.jp/mag/stem/Vol.80/documents/Vol.80,No.4,p.136-141.pdf — résumé : https://jes.or.jp/mag/stem/Vol.80/No.4.04.html
- T. Kimura & C. Inoue, *Analysis on bursting mechanism of carbon steel sparks*, STEM 83(3) 95 (2022) : https://www.jstage.jst.go.jp/article/stem/83/3/83_95/_pdf
- C. Inoue, Y. Izato, A. Miyake, E. Villermaux, *Direct Self-Sustained Fragmentation Cascade of Reactive Droplets*, PRL 118, 074502 (2017) ; communiqué : https://www.t.u-tokyo.ac.jp/en/press/foee/press/setnws_20170214110112265959648224.html
- Memmel et al., *Customizing the Appearance of Sparks with Binary Metal Alloys* (2022) : https://pmc.ncbi.nlm.nih.gov/articles/PMC9386707
- Molodetsky, Vicenzi, Dreizin, Law, *Phases of titanium combustion in air* (1998) : https://collaborate.princeton.edu/en/publications/phases-of-titanium-combustion-in-air/
- Glotov et al., combustion de grosses particules de Ti dans l'air (temps de combustion, fragmentation) : https://www.researchgate.net/publication/357908638 ; corrélation t_b(d) citée dans la littérature Ti (résultats de recherche ; à vérifier sur l'original)
- *Evolution of titanium particle combustion in potassium perchlorate and air* (OSTI) : https://www.osti.gov/pages/biblio/2311766
- Beckstead, *Correlating aluminum burning times*, Combust. Explos. Shock Waves (2005) : https://www.mathnet.ru/eng/fgv1718
- Wikipedia, *Spark (fire)* : https://en.wikipedia.org/wiki/Spark_(fire)

### Étoiles, balistique
- Y. Ooki, D. Ding, M. Higaki, T. Yoshida, *Burning and air resistance of fireworks stars*, Sci. Tech. Energ. Mater. 67(1) 43 (2006) (temps de combustion 0,8–2,4 s, 3–6 mm/s, ×1,6 en vol, C_D ≈ 0,5, v₀ = 91 m/s).

### Strobes
- Corbel et al., *Strobes: Pyrotechnic Compositions That Show a Curious Oscillatory Combustion*, Angew. Chem. Int. Ed. 52 (2013) 290 : https://repository.tno.nl/islandora/object/uuid:0ad5bb6b-0d4b-4d13-827d-53e266285b85 ; https://research-portal.uu.nl/en/publications/new-insights-into-strobe-reactions-an-intriguing-oscillatory-comb/
- D. Juknelevičius, thèse *Illuminating pyrotechnic compositions and their specific features*, Vilnius 2020 (doi:10.15388/vu.thesis.122) ; Juknelevičius et al., Eur. J. Inorg. Chem. 2017, 1113 (fréquences 1–2, 4–8, 5–15 Hz ; 6 Hz blanc ; plage de 1–10 Hz selon Jennings-White)
- Glück, Klapötke, Küblböck, *Development of a Sustainable Perchlorate-Free Yellow Pyrotechnical Strobe Formulation*, ACS Sustain. Chem. Eng. 6 (2018) 4400 (7–20 Hz) : https://epub.ub.uni-muenchen.de/67376
- Strobe très lent (≈ 1 flash/min) : https://apps.dtic.mil/sti/pdfs/AD1023843.pdf ; https://patents.justia.com/patent/10207959

### Sifflets
- D. Ding et al., étude acoustique de sifflets pyrotechniques, STEM 80(4) 130–135 : https://www.jes.or.jp/mag_eng/stem/Vol.80/documents/Vol.80,No.4,p.130-135.pdf
- *A study of the combustion behaviour of pyrotechnic whistle devices* : https://www.researchgate.net/publication/27255658

### Crépitants (sources faibles : amateurs)
- Wikipedia, *Magnalium* : https://en.wikipedia.org/wiki/Magnalium
- APC Forum, *Crackling microstars* : https://www.amateurpyro.com/forums/topic/13729-crackling-microstars/
- *The Best of AFN V* : http://www.freepyroinfo.com/Pyrotechnic/Pyrotechnic_Books/The_Best_of_Afn_V.pdf

### Définitions d'effets (grand public)
- Wikipedia, *Fireworks* : https://en.wikipedia.org/wiki/Fireworks
- Wikipedia, *Comet (pyrotechnics)* : https://en.wikipedia.org/wiki/Comet_(pyrotechnics)
- Slate, *Know Your Fireworks* : https://www.slate.com/articles/life/gallery/2011/07/know-your-fireworks.html
- fireworks.com, glossaire : https://fireworks.com/safety/fireworks-effects
- PBS Rough Science (lueur du charbon) : https://www.pbs.org/weta/roughscience/series2/challenges/fireworks/page4.html

---

## 9. Points à faire valider par le pyrotechnicien (lacunes)
- **Durées de vie réelles** des étincelles willow, kamuro et brocart (aucune mesure publiée trouvée ; les chiffres ici sont des estimations). → Mesure image par image sur vidéo 50–120 i/s de produits connus.
- **Délais du glitter** (pearl, tremolante, twinkler) et **durée des flashs**.
- **Durée du flash strobe** et rapport cyclique.
- **Délai et étalement des crépitants** pour les produits européens actuels (à base de Bi₂O₃).
- **Vitesses d'éjection** des étincelles de gerbes et fontaines.
- **Rapport nombre d'étincelles / masse d'étoile** (densité de traînée).
