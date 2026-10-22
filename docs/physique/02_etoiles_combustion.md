# 02 — Étoiles pyrotechniques : combustion, luminosité, fin de vie

Notes de recherche pour le simulateur (rendu + particules). Rédigé en français.
**Légende de fiabilité :**
- **[SOURCÉ]** : valeur mesurée et publiée (source citée, lue dans le texte original).
- **[DÉRIVÉ]** : calcul fait par moi à partir de valeurs sourcées (hypothèses indiquées).
- **[INCERTAIN]** : ordre de grandeur plausible, source secondaire ou indirecte, ou contradiction entre sources.

> Périmètre sécurité : aucune formulation (pas de pourcentages ni de rapports d'ingrédients), aucun procédé de fabrication. Les familles d'ingrédients ne sont décrites que par leur rôle, de façon qualitative. Certaines sources citées contiennent des compositions : elles n'ont **pas** été recopiées.

---

## 1. Types, formes, dimensions, masse, densité

### 1.1 Types
[SOURCÉ] Shimizu distingue trois types (Shimizu, *Selected Pyrotechnic Publications*, Part 4, ch. 2 « Construction of Chrysanthemum Shells ») :
- **Étoile pompée (cylindrique)** : cylindre plein, en général hauteur ≈ diamètre. Courante dans les comètes et chandelles romaines, et dans les tests (cylindres de Ø 11 mm × 10 mm chez Sashimura 2007).
- **Étoile coupée (cube)** : cubes découpés dans une galette. Courantes dans les bombes « occidentales » (cylindriques et sphériques).
- **Étoile roulée (ronde)** : grossit par couches concentriques autour d'un noyau, souvent un petit cube de 3 à 5 mm. C'est le standard des bombes japonaises *warimono* (chrysanthème/pivoine). C'est aussi la seule structure qui permet facilement des **couches successives** (changement de couleur, relais sombres).
  Source : https://www.jpyro.co.uk/wp-content/uploads/Sh4_002_do09.pdf

**Implication pour la simulation :** pour une étoile ronde, une combustion en couches sphériques concentriques est un bon modèle. Un cube ou un cylindre s'arrondit pendant la combustion, car les arêtes brûlent par deux ou trois faces. Visuellement, la différence est imperceptible à distance de spectateur.

### 1.2 Diamètres selon le calibre de la bombe

**[SOURCÉ] Étoiles rondes japonaises (Ooki et al. 2006, Sunaga Fireworks), mesures réelles :**

| Calibre (n° japonais ≈ pouces) | Étoile | Diamètre moyen (mm) | Masse moyenne (g) |
|---|---|---|---|
| n°2 | pivoine rose / argent / bleue | 10,0 / 10,2 / 10,3 | 0,98 / 0,83 / 1,01 |
| n°2,5 | rouge / argent / bleue | 10,7 / 10,8 / 10,7 | 1,15 / 0,97 / 1,18 |
| n°3 | couronne argent / bleue | 11,8–12,3 / 12,2 | 1,7 / 1,7 |
| n°4 | pivoine rouge / argent | 13,4 / 13,5 | 2,2 / 1,9 |
| n°5 | violette / argent | 14,3 / 15,2 | 2,5 / 2,75 |
| n°6 | pivoine argent | 16,9 | 3,8 |
| n°10 (≈ 30 cm) | étoile du test de tir | **22,0** | **8,5** |

Source : Ooki, Ding, Higaki, Yoshida, *Sci. Tech. Energetic Materials* 67(1), 43-47 (2006). https://www.jes.or.jp/mag/stem/Vol.67/documents/Vol.67,No.1,p.43-47.pdf

**[SOURCÉ] Étoiles coupées occidentales (côté du cube), table WPA / Skylighter :**

| Bombe | Étoiles couleur | Étoiles à traîne (charbon, etc.) |
|---|---|---|
| 3" (75 mm) | ≤ 1/4" (≤ 6 mm) | 1/4–3/8" (6–10 mm) |
| 4" (100 mm) | 1/4–3/8" (6–10 mm) | 3/8–1/2" (10–13 mm) |
| 5" (125 mm) | 3/8–1/2" (10–13 mm) | 1/2–5/8" (13–16 mm) |
| 6" (150 mm) | 3/8–1/2" (10–13 mm) | 1/2–3/4" (13–19 mm) |
| 8" (200 mm) | ≥ 1/2" (≥ 13 mm) | ≥ 5/8" (≥ 16 mm) |

La même source précise que des étoiles trop grosses donnent une gerbe clairsemée qui brûle trop longtemps, et que des étoiles trop petites s'éteignent avant que la fleur soit développée.
Sources : https://www.skylighter.com/blogs/fireworks-information/aerial-shell-making-charts ; https://www.westernpyro.org/uncategorized/speaking-of-fulcanelli/

**[DÉRIVÉ] Règle pratique :** le diamètre de l'étoile vaut environ **7 à 10 % du diamètre de la bombe** pour les petits calibres (3–4"), et environ **6 à 8 %** pour les gros (n°10 : 22 mm pour environ 300 mm). La croissance est sous-linéaire.

### 1.3 Densité
- [SOURCÉ] Étoiles et grains testés par Sashimura (2007), en g/cm³ : nues pressées **1,41–1,62** ; amorcées **1,16–1,48** ; brins pressés **1,69–2,10** ; poudre tassée en tube **0,95–1,15**. https://www.jes.or.jp/mag/stem/Vol.68/documents/Vol.68,No.5,p.141-145.pdf
- [SOURCÉ] Étoile n°10 d'Ooki : ρ = **1510 kg/m³**.
- [DÉRIVÉ] À partir des masses et diamètres d'Ooki : environ 1,5 à 1,9 g/cm³ selon le type.
- **Valeur de simulation recommandée : ρ ≈ 1,5 g/cm³ (plage 1,2–1,9).** La masse d'une étoile ronde vaut m = ρ·π·D³/6. Pour D = 10 mm : environ 0,8 g. Pour D = 22 mm : environ 8,4 g. Ces valeurs concordent avec Ooki.

### 1.4 Dispersion de fabrication
[SOURCÉ] Ooki 2006 (étoiles d'un même lot) : écart-type relatif de **1,8 %** sur le diamètre, de **5,3 %** sur la masse (≈ 3 × celui du diamètre, comme attendu pour m ∝ D³) et de **5,1 %** sur la durée de combustion. Sur cette dernière, environ 3,3 % ne s'explique pas par le diamètre : il vient de la combustion elle-même et de la mesure.
[SOURCÉ] Sashimura 2007 : écart-type relatif sur la durée de 2 à 40 % selon le type et la couleur (moyenne ≈ 12 %). Les étoiles nues sont les plus dispersées (≈ 22 % en moyenne) et les étoiles amorcées les moins dispersées (≈ 10 %).
**Simulation :** durée de vie individuelle = T_moy × N(1 ; σ). Prendre σ ≈ 5 % pour un produit professionnel bien amorcé, et 10 à 20 % pour un produit médiocre.

---

## 2. Combustion : régression de surface et vitesse linéaire

### 2.1 Mécanisme
[SOURCÉ] Une composition pyrotechnique brûle couche par couche. La combustion se propage tant que l'énergie renvoyée à la couche suivante dépasse son énergie d'activation (« inégalité de propagation » : ΔH·F_fb > E_a). Le renvoi de chaleur se fait par conduction, par convection (gaz chauds dans les porosités) et par rayonnement (surtout par les particules incandescentes de la flamme). Quand l'inégalité est à peine satisfaite, la combustion est faible et s'éteint facilement. Kosanke & Kosanke, « Control of Pyrotechnic Burn Rate » : http://www.jpyro.co.uk/wp-content/uploads/K03_062_pqsl.pdf
- Une étoile **brûle en surface et régresse vers le centre**, de façon presque parallèle à la surface (combustion à « front plan » d'une poudre compactée).
- [SOURCÉ] Une étoile est un objet pressé et dense, sans chemins de feu. Sa vitesse est donc lente : un pulvérin compacté brûle à environ 1 cm/s, contre plus de 1000 fois plus vite pour le même produit en grains (Kosanke). La fissuration d'une étoile peut ainsi provoquer une combustion très rapide, voire une explosion.

### 2.2 Vitesses linéaires (régression radiale)
**[SOURCÉ] Ooki 2006, étoiles rondes posées sur une plaque :**

| Type d'étoile | Vitesse linéaire moyenne (mm/s) |
|---|---|
| Pivoine bleue | 3,4 |
| Pivoine rose | 4,0 |
| Pivoine rouge | 5,0 |
| Pivoine violette | 3,0 |
| Pivoine argent | 6,0 |
| Couronne argent (type *kamuro*, longue durée) | 3,7 |

- Plage : **3,0 à 6,0 mm/s**. Il s'agit d'une vitesse de **rayon** : on vérifie que D/(2·t) ≈ v. Par exemple 10,2 mm / (2 × 0,78 s) = 6,5 mm/s.
- Durées sur plaque (étoiles n°2 à n°6) : **0,8 à 2,4 s**.
- Pour un même type, la durée est presque proportionnelle au diamètre. La vitesse linéaire **diminue légèrement quand le diamètre augmente** (pivoines argent, Fig. 2).

**[SOURCÉ] Sashimura 2007, cylindres Ø 11 × 10 mm**, durée de combustion statique selon la couleur :
- étoile nue : rouge 2,6 s · vert 2,8 s · bleu 2,6 s · jaune 7,0 s · violet 3,1 s ;
- étoile amorcée : rouge 1,15 s · vert 2,2 s · bleu 1,2 s · jaune 4,2 s · violet 1,2 s ;
- en vol (étoile nue tirée au mortier) : rouge 1,7 · vert 2,7 · bleu 1,5 · jaune 3,3 · violet 1,5 s.
- [DÉRIVÉ] Soit environ 1 à 5 mm/s en régression radiale. Le jaune (sodium) est nettement le plus lent.

**[SOURCÉ] Effet de la pression locale :** loi de Vieille, R = a·P^b. Pour diverses compositions à flamme, l'exposant b vaut environ **0,24 à 0,44** (Kosanke, tableau 4). Pour un propergol riche en combustible, b ≈ 0,5 (Kakami et al., STEM 67(3) 2006). À 300–500 m d'altitude, P ≈ 0,95 atm, donc l'effet est négligeable (environ −1 à −2 %). Le paramètre est sans intérêt pour la simulation, sauf pour un étage d'altitude extrême.

**[SOURCÉ] Effet de la température ambiante :** la vitesse augmente légèrement avec la température initiale (mèche visco : environ +8 % entre −5 et +35 °C, Kosanke Fig. 14). Effet de second ordre.

**[SOURCÉ] Effet de taille :** les gros blocs brûlent légèrement plus vite, car une part plus grande du rayonnement de flamme revient vers la surface. L'écart mesuré est d'environ +10 % entre des tubes de 0,8 et de 1,6 cm (Kosanke). Ooki observe plutôt l'inverse sur les pivoines argent. **[INCERTAIN]** : à négliger.

### 2.3 Durée de vie selon le diamètre (modèle de simulation)
[DÉRIVÉ] Avec une régression radiale constante v :
- r(t) = r₀ − v·t ;  T = r₀ / v = D₀ / (2v)
- masse : m(t) = m₀·(1 − t/T)³
- débit massique : ṁ(t) = ρ·4π·r(t)²·v = 3·m₀/T · (1 − t/T)²
- surface brûlante : S(t) ∝ (1 − t/T)²

Ordres de grandeur avec v = 4 mm/s :

| D₀ | T (s) |
|---|---|
| 6 mm | 0,75 |
| 10 mm | 1,25 |
| 13 mm | 1,6 |
| 16 mm | 2,0 |
| 22 mm | 2,75 |

Ces valeurs sont cohérentes avec Ooki : 0,8 à 2,4 s sur plaque, et **1,3 à 2,9 s en vol**.

### 2.4 Effet de la vitesse dans l'air : **contradictoire, donc [INCERTAIN]**
- [SOURCÉ] **Ooki 2006 :** les étoiles tirées au mortier de 25 mm brûlent **1,6 fois plus longtemps** que sur la plaque. Exemples : pivoine argent n°2, 0,78 s sur plaque contre 1,26 s en vol ; couronne argent n°3, 1,68 contre 2,94 s ; bleue n°3, 1,83 contre 2,93 s. Les auteurs l'attribuent au **refroidissement de la flamme par l'écoulement d'air**.
- [SOURCÉ] **Sashimura 2007 :** pour des étoiles **nues**, la durée **en vol est plus courte** que la durée statique. Pour le rouge : 1,74 contre 2,64 s. Explication : au mortier, toute la surface est allumée d'un coup par les gaz chauds de la charge, alors qu'une torche n'allume qu'un point. Pour des étoiles **amorcées**, les durées statique et en vol sont proches (rouge 1,15 contre 1,42 s ; bleu 1,16 contre 1,34 s).
- [SOURCÉ] La littérature générale de combustion indique qu'un écoulement d'air peut accélérer la combustion à faible vitesse (meilleur transfert de chaleur), puis la ralentir ou l'éteindre localement à forte vitesse (pertes convectives). Juknelevičius et al. (2021) rappellent qu'en usage réel, les compositions brûlent à diverses vitesses d'air : le mélange avec l'air change la stœchiométrie et la température de flamme, et **les étoiles peuvent s'éteindre en vol**. https://epub.ub.uni-muenchen.de/75968/1/prep.202000114.pdf
- **Recommandation de simulation :** T_vol = T_statique × k, avec k ∈ [0,9 ; 1,6] (par défaut ≈ 1,2–1,3), plus un léger ralentissement de la régression tant que la vitesse relative est supérieure à environ 50 m/s. **Ne pas** rendre la vitesse de combustion fortement dépendante de la vitesse de vol : les mesures se contredisent.

### 2.5 Allumage et extinction à grande vitesse (étoiles aveugles)
- [SOURCÉ] Sashimura et al. 2007 (« Ignitability of cylindrical firework stars », STEM 68(5) 146-151) : des étoiles nues, amorcées ou partiellement amorcées ont été tirées au mortier avec des vitesses de bouche de **15 à 160 m/s**. **Au-delà d'une charge limite, donc d'une vitesse limite, les étoiles ne s'allument pas** : elles sont soufflées. L'amorçage relève nettement cette limite. https://www.jes.or.jp/mag/stem/Vol.68/documents/Vol.68,No.5,p.146-151.pdf
- [SOURCÉ] Sur la même plaque, les comportements diffèrent : certaines compositions ne s'auto-entretiennent pas, car le renvoi de chaleur est insuffisant et la « résistance au vent » faible (Juknelevičius 2021, thèse VU 2022).
- [INCERTAIN] En vol réel, une **étoile aveugle** (non allumée, ou éteinte juste après l'éclatement) vient d'un amorçage insuffisant, d'une éjection trop violente, d'une étoile humide ou d'une composition « à la limite ». Elle reste invisible, ou s'allume en retard au cours du ralentissement.
- **Simulation :** probabilité d'aveugle par étoile de 0 à 3 % pour un produit pro, plus pour un produit bas de gamme (paramètre « qualité »). Option : extinction prématurée, avec une probabilité qui augmente si la vitesse d'éjection dépasse environ 120–150 m/s (**[INCERTAIN]**, choix de modélisation et non une mesure).

### 2.6 Ballistique utile au couplage combustion / mouvement
- [SOURCÉ] Ooki 2006 : une étoile n°10 (22 mm, 8,5 g, ρ = 1510 kg/m³), tirée verticalement à 91 m/s, suit une trajectoire bien reproduite avec un **C_D = 0,5** (sphère). L'étude néglige la diminution du diamètre ; les auteurs signalent qu'il faudrait la prendre en compte.
- [SOURCÉ] Vitesses de bouche des étoiles tirées directement : 26 à 117 m/s selon la charge (Ooki) ; 15 à 160 m/s (Sashimura).
- [DÉRIVÉ] Longueur caractéristique de freinage : L = 4ρ_s·D / (3ρ_air·C_D) ≈ 33 m pour D = 10 mm (ρ_s = 1500, C_D = 0,5). On a v(t) = v₀ / (1 + v₀·t/L) et une vitesse limite de chute v_t = √(g·L) ≈ 18 m/s pour 10 mm. **Comme D diminue en brûlant, L diminue** : l'étoile freine de plus en plus vite et sa vitesse de chute baisse en fin de vie (v_t ∝ √D). Pour la simulation, recalculer à chaque pas la masse m(t) et la section A(t) = π·r(t)².

---

## 3. Flamme : enveloppe, température, traîne

### 3.1 Températures de flamme
- [SOURCÉ] Flammes colorées **sans métal** : un peu plus de **≈ 1900 °C** (Meyerriecks & Kosanke 2003, citant Shimizu). https://www.jpyro.co.uk/wp-content/uploads/j18_1_fglk1.pdf
- [SOURCÉ] Compositions bleues au cuivre : température adiabatique calculée de **1840 à 2690 K** selon la composition (Juknelevičius 2021, NASA CEA). L'émetteur bleu CuCl n'émet bien qu'entre **≈ 1200 et 1500 °C** ; au-delà, il se dissocie et le bleu se délave vers le vert ou le blanc (thèse VU, chapitre stroboscopes bleus).
- [SOURCÉ] Pour l'ensemble des illuminants pyrotechniques, la flamme se situe en général entre **1200 et 3600 °C** (thèse Juknelevičius, VU 2022). https://epublications.vu.lt/object/elaba:78538139/78538139.pdf
- [SOURCÉ] Les compositions au magnésium dépassent 2000 K. Le Mg se vaporise vers 1107 °C, bien en dessous de la décomposition de son oxyde (≈ 3200 °C). Il brûle donc en **phase vapeur**, avec une large zone de diffusion très lumineuse (critère de Glassman).
- **Simulation (couleur du corps noir résiduel et du cœur de flamme)** :

| Type de flamme | Température |
|---|---|
| Couleur sans métal | 1900–2300 K |
| Bleu | ≈ 1500–2000 K « utile » |
| Couleur avec métal (Mg, magnalium) | 2300–3000 K |
| Blanc métallique (Al, Mg) | 2800–3500 K |

  Le cœur près de la surface paraît **blanchâtre ou sursaturé** (sur un capteur, comme à l'œil). La couleur saturée apparaît dans la périphérie de la flamme.

### 3.2 Taille de l'enveloppe de flamme : **[INCERTAIN]** (aucune mesure publiée trouvée)
- [SOURCÉ, qualitatif] Plus la pression est élevée, plus l'enveloppe est petite, chaude et proche de la surface (Kosanke, Fig. 15, analogie avec la bougie).
- [INCERTAIN] D'après la physique d'une flamme de diffusion autour d'une particule qui brûle, et les photos et vidéos de pivoines : la zone lumineuse d'une étoile couleur vaut **environ 2 à 4 fois le diamètre de la pastille**, soit 2 à 5 cm pour une étoile de 10 à 15 mm. Avec le Mg ou le magnalium, la zone est plus grande et plus diffuse, du fait de la combustion du métal en vapeur.
- À distance de spectateur (200 à 500 m), une étoile est **une source quasi ponctuelle**. Pour 4 cm à 300 m, l'angle vaut environ 0,13 mrad, soit environ 0,5′ d'arc, à la limite de résolution de l'œil. **La taille perçue est dominée par l'éblouissement, le halo optique, la diffusion atmosphérique et le flou de bougé du regard ou de la caméra**, pas par la taille réelle de la flamme. Rendu conseillé : point HDR + noyau de bloom proportionnel à l'intensité, et non une sphère géométrique.

### 3.3 Flamme soufflée, traîne de flamme et de fumée derrière une étoile mobile
- [SOURCÉ, qualitatif] En vol, les effets saule et paillettes **n'apparaissent qu'avec le déplacement dans l'air**. Une étoile qui brûle au sol ne produit pas l'effet et laisse un gros résidu de cendres (Skylighter, « Use a star gun »). https://www.skylighter.com/blogs/how-to-make-fireworks/use-a-star-gun
- [INCERTAIN, physique générale] En écoulement forcé, la flamme est **plaquée sur la face au vent et étirée sous le vent** en forme de goutte ou de comète courte. La longueur de traîne lumineuse d'une étoile **couleur** (sans étincelles) reste petite, de l'ordre de quelques diamètres de flamme. Ce que le spectateur perçoit comme une « traînée » vient surtout :
  1) de la **persistance rétinienne et de l'exposition caméra** (une étoile à 30 m/s parcourt 1 m en 1/30 s) ;
  2) pour les étoiles à charbon ou métal, des **étincelles** éjectées, qui ont leur propre durée de vie (autre fiche).
- Simulation : traîne de flamme = segment orienté selon −v_rel, longueur ≈ k·|v_rel|·τ_flamme avec τ_flamme ≈ 5–20 ms (**[INCERTAIN]**). Gradient : blanc vers couleur, puis transparent. Ajouter ensuite le flou de mouvement de l'obturateur virtuel.
- Fumée : voir § 6. Elle forme un **sillage** continu derrière chaque étoile, éclairé par l'étoile elle-même : halo coloré visible surtout dans les gerbes denses et par vent faible.

### 3.4 Scintillement (flicker) et turbulence
- [SOURCÉ] Sashimura 2007 : **l'intensité de la flamme fluctue fortement dans le temps**, alors que la **durée totale varie peu**. Les profils d'intensité spectrale (raie K à 767 nm, SrCl à 673 nm) montrent des oscillations rapides, de grande amplitude, irrégulières, dues à une combustion non uniforme. Les compositions tassées en tube présentent même des disparitions temporaires de la flamme visible.
- [SOURCÉ] Juknelevičius 2021 : sur des pastilles de 16,8 mm, la combustion n'est pas toujours régulière (combustion « en cigarette », flamme qui court sur la surface). La pureté de couleur varie au cours de la combustion : maximum dans les 1 à 3 premières secondes, puis baisse liée au **laitier** (scorie) qui s'accumule à la surface.
- [SOURCÉ, analogie] Une flamme de diffusion **flottante** au repos pulse à f ≈ 1,68·D^(−1/2) Hz (D en m) : environ 17 Hz pour D = 1 cm (Malalasekera et al. 1996, d'après Hamins et al. 1992). https://repository.lboro.ac.uk/articles/journal_contribution/A_review_of_research_and_experimental_study_on_the_pulsation_of_buoyant_diffusion_flames_and_pool_fires/9547682 — **[INCERTAIN]** : une étoile en vol est en convection forcée, pas en régime de flottabilité. La pulsation n'est donc pas directement transposable.
- **Simulation :** multiplier l'intensité par (1 + a·bruit(t)), avec un bruit 1/f ou un Perlin dont l'énergie se situe entre 5 et 30 Hz, et a ≈ 0,1–0,3 en écart-type. Phase indépendante pour chaque étoile. Bruit plus faible pour les étoiles amorcées et de qualité « pro ». Pour les compositions au Mg, ajouter de rares pics brefs (gouttes de métal qui s'enflamment).

---

## 4. Luminosité

### 4.1 Grandeurs physiques
- Intensité lumineuse I_v (cd), directionnelle. Pour une étoile, quasi isotrope.
- **Efficacité lumineuse spécifique** L_sp (cd·s/g) : énergie lumineuse émise par gramme brûlé. On en tire **I_v(t) ≈ L_sp × ṁ(t)**. C'est la relation la plus utile pour relier combustion et rendu.

### 4.2 Valeurs mesurées
| Source / système | Masse et géométrie | Durée | I_v | L_sp |
|---|---|---|---|---|
| [SOURCÉ] 10 flammes bleues au cuivre (Juknelevičius 2021) | pastilles de 10 g, Ø 16,8 mm | 7–43 s (combustion par une face) | **10–390 cd** | **26–454 cd·s/g** |
| — dont meilleure pureté (≈ 56 %) | idem | | 108 cd | 75 cd·s/g |
| — dont bleu avec magnalium | idem | | 388 cd | 454 cd·s/g (pureté 30 % seulement) |
| [SOURCÉ] Vert sans baryum, au bore (Klapötke/Sabatini, ChemComm 2014) | **pastilles de 0,6 g** (taille d'une étoile !) | 4–7 s | **25–89 cd** | 250–593 cd·s/g |
| [SOURCÉ] Fusée de signal verte au baryum et Mg (référence US Navy citée) | fusée | | | ≈ 4300 cd·s/g |
| [SOURCÉ] Signal rouge Sr + Mg (Sabatini, cité par Klapötke 2020) | « étoile » de signal à main M126A1 | 3 s | **≈ 32 000 cd** | — |
| [SOURCÉ] Exigence fusée rouge IS Red 2 (brevet US) | fusée | 16–23 s | ≥ 3500 cd | — |
| [SOURCÉ] Illuminants pyrotechniques (thèse VU) | — | — | jusqu'à > 50 000 cd | — |
| [SOURCÉ] Compositions bleues « fireworks » (thèse VU, résumé) | — | — | 100–500 cd, pureté 30–65 % | — |

Sources : https://epub.ub.uni-muenchen.de/75968/1/prep.202000114.pdf · https://epub.ub.uni-muenchen.de/22524/1/oa_22524.pdf · https://epub.ub.uni-muenchen.de/72908/1/zaac.201900132.pdf · https://epublications.vu.lt/object/elaba:78538139/78538139.pdf · brevet US 8 216 403 / 8 277 583 (IS Red 2)

### 4.3 Intensité d'une étoile de feu d'artifice : **[DÉRIVÉ]**, aucune mesure directe trouvée
Une étoile de 10 mm (0,8 g) qui brûle en 1,25 s a un débit massique moyen de 0,65 g/s, et un débit **initial ≈ 3·m₀/T ≈ 2 g/s**. On en tire :

| Famille d'étoile | L_sp supposé (cd·s/g) | I_v moyenne | Pic initial |
|---|---|---|---|
| Bleu (sans métal) | 50–300 | **30–200 cd** | ≈ 100–600 cd |
| Rouge / vert / violet (sans métal) | 150–600 | **100–400 cd** | ≈ 300–1200 cd |
| Couleur au magnalium / Mg | 500–2000 | **0,3–1,5 kcd** | ≈ 1–4 kcd |
| Blanc métallique (Al/Mg, « mag star ») | 1000–5000+ | **≈ 1–5 kcd** | ≈ 2–10 kcd |

Pour une étoile n°10 (22 mm, 8,5 g, environ 2,8 s), multiplier par environ 4–5 (le débit massique ∝ D²).
Ordres de grandeur relatifs, **plus fiables que les valeurs absolues** : le bleu est le plus faible, environ 2 à 5 fois en dessous du rouge ou du vert, et une étoile métallique est environ 5 à 20 fois plus brillante qu'une étoile couleur sans métal. Il existe un **compromis brillance / saturation** : ajouter du métal augmente I_v mais **réduit la pureté** (Juknelevičius : la pureté passe de ≈ 56 % à ≈ 30 % quand on ajoute du magnalium).

### 4.4 Évolution de la brillance au cours de la vie d'une étoile
[SOURCÉ] Sashimura 2007 (profils d'intensité spectrale d'étoiles rouges) :
1. **Étoile nue :** (a) fluctuations dues à une combustion non uniforme ; (b) **montée lente jusqu'au maximum**, car la flamme se propage lentement sur la surface à partir du point d'allumage ; (c) **dans la seconde moitié, l'intensité baisse avec le temps** à mesure que la surface non brûlée diminue.
2. **Étoile amorcée :** l'amorce « prend » plus vite. La montée jusqu'au pic est **beaucoup plus courte** et la durée totale aussi. La raie K (présente dans l'amorce et dans l'étoile) apparaît avant la bande SrCl (étoile seule) : **l'amorce brûle d'abord, puis le feu passe à la composition colorée** avec un court délai. La valeur exacte est illisible dans le PDF ; **[INCERTAIN]** : de l'ordre de 0,1 à 0,3 s.

**Modèle d'enveloppe recommandé (simulation)** :
```
t ∈ [0, t_ign]   : rampe d'allumage (amorce). Intensité 0 → ~0,6·I0, teinte orangée/blanchâtre
                   (amorce type poudre noire → émission K/Na + incandescence).
                   t_ign ≈ 0,05–0,15 s (amorcée) ; 0,2–0,5 s (nue).
t ∈ [t_ign, T]   : I(t) = I0 · (1 − τ)^2 · (1 + bruit), τ = (t − t_ign)/(T − t_ign)
                   (surface ∝ r², voir § 2.3) ; atténuer l'exposant vers 1–1,5 si l'on veut
                   une fin moins « molle » (combustion non sphérique, flamme
                   qui ne rétrécit pas proportionnellement).
t → T            : fin = extinction rapide (voir § 5.3).
```
Pour une étoile cubique ou cylindrique, l'enveloppe est proche, avec un léger plateau au début.

### 4.5 Variation entre étoiles d'une même bombe
- Durée : σ ≈ 5 % (Ooki), jusqu'à 10–20 % pour des étoiles nues ou un produit médiocre (Sashimura). **[SOURCÉ]**
- Allumage : toutes les étoiles s'allument par le flash de la charge d'éclatement, en quelques ms à quelques dizaines de ms. Le décalage d'allumage est perceptible surtout quand certaines étoiles s'allument « en retard » pendant leur vol. **[INCERTAIN]** : distribuer t_ign selon une loi log-normale de médiane 0,05 s, avec une queue jusqu'à 0,3 s pour 1 à 5 % des étoiles.
- Intensité : la dispersion de masse est faible (5 %), mais la fluctuation instantanée est forte. Ajouter un facteur d'intensité propre à chaque étoile, σ ≈ 10 %. **[INCERTAIN]**
- Fin de vie : comme les durées sont dispersées, la gerbe s'éteint « en grappe » et non toutes les étoiles au même instant. Avec σ = 5 % sur 2 s, l'extinction s'étale sur environ ±0,1–0,2 s. C'est visuellement important : une extinction parfaitement synchrone paraît fausse, une extinction très étalée paraît bas de gamme.

---

## 5. Structure en couches : amorce, changement de couleur, relais sombre, fin

### 5.1 Amorçage (« prime »)
- [SOURCÉ] L'amorce est une couche extérieure facile à allumer, de type poudre noire. Shimizu décrit une finition en trois couches, de la plus lente (intérieure) à la plus rapide (extérieure), pour garantir l'allumage. Rôle : assurer l'allumage par le flash d'éclatement et résister au soufflage. Sashimura confirme qu'elle **relève la vitesse limite d'allumage**.
- Visuel : un bref éclat **orangé, jaune ou blanchâtre** juste à l'ouverture, avant la couleur. Il est souvent masqué par le flash de la charge d'éclatement.

### 5.2 Étoiles à changement de couleur et relais sombres
- [SOURCÉ] Shimizu décrit une étoile ronde rouge → bleu → flash, construite de l'extérieur vers l'intérieur : amorce, couche rouge, **relais sombre** (*changing relay*, composition d'amorce sombre), couche bleue, relais, noyau. **Rôle du relais : rendre le changement de couleur plus net**, par un court temps sombre ou très peu lumineux entre deux couleurs.
- Les couches brûlent en séquence, de l'extérieur vers l'intérieur. Le **délai de chaque couche ≈ épaisseur / vitesse de régression**.
  - [DÉRIVÉ] Une couche couleur de 2 mm à 4 mm/s dure environ 0,5 s. Un relais sombre de 0,3 à 0,5 mm dure environ 0,1 s.
  - Comme la surface diminue vers l'intérieur, **les couches internes sont moins lumineuses** (I ∝ r²) et, à épaisseur égale, durent aussi longtemps. Les fabricants compensent en partie en ajustant les épaisseurs.
- **Synchronisme :** dans une bombe de qualité, toutes les étoiles changent de couleur presque ensemble. C'est un critère de qualité clé chez les Japonais. La dispersion d'épaisseur ajoute du jitter au moment du changement. **[INCERTAIN]** : σ du moment de transition ≈ 3–8 % du temps écoulé.
- Transition : non instantanée, sur environ 30–100 ms (front de combustion non parfaitement sphérique, mélange des deux flammes). Avec un relais sombre, l'intensité baisse à environ 5–20 % pendant 0,05–0,2 s. **[INCERTAIN]**
- Noyau : peut produire une fin spéciale (flash, crépitement, *strobe*).

### 5.3 Fin de l'étoile
- [SOURCÉ] La fin d'une étoile couleur standard est une **décroissance rapide** de l'intensité (surface → 0, Sashimura). Pour le rendu, le dernier quart de la vie donne une fin « en douceur » sur environ 10–20 % de T, suivie d'une coupure.
- [INCERTAIN, observation courante] Les petites étoiles finissent souvent par une **courte chute nette** (le dernier fragment s'éteint ou se fragmente). Des étoiles mal calibrées finissent parfois par une goutte de laitier incandescent orangé qui tombe : Juknelevičius signale du laitier rougeoyant sur la plaque, en quantité importante pour certaines compositions. En vol, ce laitier peut se détacher, faire une petite étincelle orange et tomber.
- **Simulation :** en fin de vie, fondu de la couleur vers un orange sombre (laitier, corps noir de 1200–1600 K) sur environ 50–150 ms pour une partie des étoiles (par exemple 20 à 40 %, **[INCERTAIN]**). Les autres s'éteignent net.
- Étoiles « qui tombent allumées » : si T dépasse le temps de chute, l'étoile atteint le sol en brûlant (*fallout*). C'est un défaut de sécurité réel, à signaler dans un outil pro.

### 5.4 Étoiles aveugles
Voir § 2.5. Trois cas pour la simulation :
(a) jamais allumée : invisible, mais présente physiquement, et peut retomber ;
(b) allumée en retard ;
(c) éteinte prématurément, en particulier pendant la phase de vitesse maximale.

---

## 6. Fumée et résidus d'une étoile

- [SOURCÉ] **Facteurs d'émission de PM10** par kg de composition (Camilleri & Vella 2016, *Propellants Explos. Pyrotech.* 41, 273-280) :

| Type | PM10 (kg/kg) |
|---|---|
| Étoiles rouges | **0,175** |
| Étoiles bleues | **0,176** |
| Étoiles vertes | **0,254** |
| Étoiles blanches | **0,123** |
| Charges d'éclatement (poudre noire) | 0,054 |
| Marrons d'air (flash) | 0,43 |

  Éléments mesurés dans les PM10 : Ba ≈ 0,055 kg/kg (étoiles vertes), Cu ≈ 0,012 (bleues), Sr ≈ 0,006 (rouges). https://um.edu.mt/library/oar/handle/123456789/90946
- [SOURCÉ] Environ 80 % des particules émises par la matière active sont des PM2,5. Les fumées de poudre noire sont majoritairement submicroniques (cité par la source Helmholtz ; UBA, réévaluation à 2050 t/an en Allemagne). https://www.umweltbundesamt.de/en/press/pressinformation/fireworks-produce-2050-tonnes-of-particulate-matter
- [SOURCÉ, qualitatif] Les compositions au potassium produisent plus de fumée solide (KCl et sels de K) que les compositions à base de perchlorate d'ammonium, dont les produits sont surtout gazeux (HCl, H₂O, N₂) (Juknelevičius 2021).
- [DÉRIVÉ] Une étoile de 1 g laisse environ **0,12 à 0,25 g de particules fines**, plus des gaz (CO₂, H₂O, N₂, HCl…) et un éventuel laitier. Pour une bombe de 3" à environ 60–100 étoiles d'environ 1 g, cela fait **environ 10 à 25 g de PM** répartis le long des trajectoires. S'y ajoute la fumée de la charge d'éclatement, souvent dominante en volume visible au centre.
- **Simulation fumée :**
  - émission ∝ ṁ(t) (donc forte au début et décroissante) ;
  - particules submicroniques : diffusion de Mie, gris-blanc, fortement **éclairées par les étoiles voisines** (couleur empruntée à la source) ;
  - durée de vie visuelle de dizaines de secondes à minutes, advectée par le vent ; elle s'accumule au fil d'un spectacle et **diminue le contraste** des bombes suivantes (effet réel bien connu, important sous vent faible) ;
  - les étoiles blanches et métalliques laissent moins de PM10 par kg, mais donnent une fumée d'oxydes (Al₂O₃, MgO) très blanche.

---

## 7. Rôle qualitatif des familles d'ingrédients (sans formulation)

| Famille | Rôle | Effet visible pour la simulation |
|---|---|---|
| **Oxydant** (perchlorates, chlorates, nitrates) | Fournit l'oxygène. Fixe largement la vitesse de combustion et la température. Les oxydants « chauds » (perchlorates) donnent une flamme plus chaude et plus rapide (Conkling & Mocella). Les nitrates de Sr ou de Ba sont à la fois oxydant et source de couleur. | Vitesse de combustion, chaleur. Le potassium (sous-produit) ajoute une émission violacée / IR (raies 766/769 nm, 404 nm). |
| **Combustible organique / liant combustible** (résines, gommes, amidon, dextrine, charbon de bois, soufre) | Produit chaleur et gaz. Le liant tient la pastille et brûle aussi. Le charbon de bois à grains grossiers produit des **étincelles orangées** (étoiles à traîne, saule). Avec un bilan d'oxygène trop négatif, on obtient de la **suie** : taches jaunes dans la flamme et perte de pureté (Juknelevičius, composition riche en cire). | Une flamme couleur propre exige peu de suie. L'excès de carbone donne une flamme jaune-orangée de corps noir. |
| **Agent colorant** (sels de Sr, Ba, Cu, Na, Ca…) | Source des espèces émettrices en phase gazeuse : SrCl et SrOH (rouge), BaCl (vert), CuCl (bleu), Na (jaune 589 nm), CaCl et CaOH (orange). **L'anion influence la température** : les nitrates et chlorates la montent, les carbonates et oxalates la baissent et ralentissent la combustion (Wikipedia, *Pyrotechnic colorant*). | Couleur. Coordonnées CIE 1931 (x, y) des émetteurs purs, d'après Meyerriecks & Kosanke 2003 : SrCl (0,720 ; 0,280), SrOH (0,679 ; 0,321), BaCl (0,094 ; 0,811), CuCl (0,156 ; 0,073), Na (0,576 ; 0,423), CaCl (0,661 ; 0,338), CaOH (0,630 ; 0,369), CuOH (0,290 ; 0,666). |
| **Donneur de chlore** (organochlorés, PVC, caoutchouc chloré, chlorates et perchlorates eux-mêmes) | Forme les **monochlorures** émetteurs (SrCl, BaCl, CuCl), plus saturés que les hydroxydes ou oxydes. Pour un émetteur atomique (Li, Na), le chlore peut au contraire dégrader la couleur. | Pureté de couleur. Sans chlore, un « vert » au baryum devient blanchâtre ou jaune-vert (BaOH, BaO), et le bleu au cuivre est quasi impossible. |
| **Liant** (amidon de riz glutineux, dextrine, résines) | Cohésion mécanique, densité. Joue aussi le rôle de combustible. | Résistance au choc d'éclatement (étoile cassée = plusieurs petites étoiles plus courtes). |
| **Métaux** : Mg, Al, magnalium (Mg-Al), Ti | Forte chaleur, donc **forte brillance**. Le **Mg** brûle en phase vapeur : grande flamme lumineuse et couleur relativement préservée. L'**Al** forme des particules solides incandescentes (Al₂O₃, Al fondu), d'où un **rayonnement de corps noir qui délave la couleur** ; il donne aussi les étincelles blanc-argent. Le **magnalium** est un compromis courant en couleur. Le Ti donne des étincelles blanc bleuté. Le CO (bilan d'oxygène négatif, oxalates) réduit les particules de MgO et ravive la couleur. | Brillance ×5 à ×20 (§ 4.3) au prix d'une pureté réduite. Teinte du cœur plus blanche. Étincelles possibles. |
| **Additifs ralentisseurs / catalyseurs** | La plupart des additifs **ralentissent** la combustion. Certains catalyseurs l'accélèrent ; la granulométrie fine accélère (Kosanke). | Dispersion de durée selon les fabricants. |

Pureté de couleur atteignable [SOURCÉ] : 28–58 % pour des bleus de feu d'artifice (Juknelevičius), environ 70–86 % pour de bons verts ou rouges en pastille de laboratoire (Klapötke), plus de 80 % exigé pour des signaux militaires. **Une étoile de feu d'artifice est donc rarement monochromatique** : prévoir une composante de blanc ou de corps noir dans le spectre rendu (≈ 20–60 % selon la couleur, le bleu étant le moins pur).

---

## 8. Résumé paramétrique pour le moteur

| Paramètre | Valeur par défaut | Plage | Fiabilité |
|---|---|---|---|
| Densité étoile | 1,5 g/cm³ | 1,2–1,9 | SOURCÉ |
| Diamètre étoile (bombe 3"/4"/6"/10") | 8 / 10 / 12 / 22 mm | voir § 1.2 | SOURCÉ |
| Régression radiale (couleur) | 4 mm/s | 3–6 (bleu/violet 3–3,5 ; rouge 5 ; argent 6 ; jaune Na 1–2) | SOURCÉ |
| Durée de vie T = D/(2v) | 1,2 s (10 mm) | 0,8–3 s | SOURCÉ |
| Facteur vol / statique | 1,2 | 0,9–1,6 | INCERTAIN (sources contradictoires) |
| σ durée intra-bombe | 5 % | 3–20 % | SOURCÉ |
| Rampe d'allumage | 0,1 s | 0,05–0,5 s | SOURCÉ (qualitatif) / INCERTAIN (valeur) |
| Profil d'intensité | I0·(1−τ)² | exposant 1–2 | DÉRIVÉ |
| I_v moyenne couleur sans métal | 200 cd | 30–400 cd (bleu le plus bas) | DÉRIVÉ |
| I_v étoile métal / blanche | 2 kcd | 0,3–10 kcd | DÉRIVÉ |
| Flicker | 15 % rms, 5–30 Hz | 5–30 % | SOURCÉ (qualitatif) |
| T flamme couleur | 2100 K | 1800–2700 K | SOURCÉ |
| T flamme métal | 3000 K | 2500–3500 K | SOURCÉ / INCERTAIN |
| Taille de flamme | 3 × D | 2–4 × D | INCERTAIN |
| C_D | 0,5 | 0,4–0,6 | SOURCÉ |
| PM émises | 0,18 g/g | 0,12–0,25 | SOURCÉ |
| Aveugles | 1 % | 0–5 % | INCERTAIN |
| Relais sombre | 0,1 s à ~10 % d'intensité | 0,05–0,2 s | INCERTAIN |

---

## Sources principales
1. Ooki Y., Ding D., Higaki M., Yoshida T., « Burning and air resistance of fireworks stars », *Sci. Tech. Energetic Materials* 67(1) 43-47 (2006). https://www.jes.or.jp/mag/stem/Vol.67/documents/Vol.67,No.1,p.43-47.pdf
2. Sashimura Y. et al., « Burning characteristics of firework stars and compositions », *STEM* 68(5) 141-145 (2007). https://www.jes.or.jp/mag/stem/Vol.68/documents/Vol.68,No.5,p.141-145.pdf (le texte japonais du PDF est illisible à l'extraction ; tableaux et résumé anglais exploités).
3. Sashimura Y. et al., « Ignitability of cylindrical firework stars », *STEM* 68(5) 146-151 (2007). https://www.jes.or.jp/mag/stem/Vol.68/documents/Vol.68,No.5,p.146-151.pdf
4. Kosanke K.L. & B.J., « Control of Pyrotechnic Burn Rate » (Selected Pyrotechnic Publications, Part 3 ; 2nd Int. Symp. Fireworks 1994). http://www.jpyro.co.uk/wp-content/uploads/K03_062_pqsl.pdf
5. Shimizu T., « Construction of Chrysanthemum Shells », *Selected Pyrotechnic Publications of Dr. Takeo Shimizu*, Part 4, ch. 2. https://www.jpyro.co.uk/wp-content/uploads/Sh4_002_do09.pdf
6. Meyerriecks W. & Kosanke K.L., « Color Values and Spectra of the Principal Emitters in Colored Flames », *J. Pyrotechnics* 18 (2003). https://www.jpyro.co.uk/wp-content/uploads/j18_1_fglk1.pdf
7. Juknelevičius D. et al. (incl. Klapötke), « An Experimental Comparison of Selected Blue Flame Pyrotechnics », *Propellants Explos. Pyrotech.* 46, 107-113 (2021). https://epub.ub.uni-muenchen.de/75968/1/prep.202000114.pdf
8. Juknelevičius D., thèse « Illuminating pyrotechnic compositions and their specific features », Université de Vilnius. https://epublications.vu.lt/object/elaba:78538139/78538139.pdf
9. Sabatini J.J., Klapötke T.M. et al., vert sans baryum (ChemComm 2014). https://epub.ub.uni-muenchen.de/22524/1/oa_22524.pdf ; Dufter, Klapötke et al., *ZAAC* 2020. https://epub.ub.uni-muenchen.de/72908/1/zaac.201900132.pdf
10. Camilleri R. & Vella A.J., « Emission factors for aerial pyrotechnics… Malta », *PEP* 41(2) 273-280 (2016). https://um.edu.mt/library/oar/handle/123456789/90946
11. Skylighter, tables de construction de bombes et article « star gun ». https://www.skylighter.com/blogs/fireworks-information/aerial-shell-making-charts ; https://www.skylighter.com/blogs/how-to-make-fireworks/use-a-star-gun ; WPA : https://www.westernpyro.org/uncategorized/speaking-of-fulcanelli/
12. Wikipedia, « Pyrotechnic colorant » et « Fireworks » (rôle des familles, délavage par les particules incandescentes). https://en.wikipedia.org/wiki/Pyrotechnic_colorant ; https://en.wikipedia.org/wiki/Fireworks
13. Malalasekera, Versteeg, Gilchrist (1996), revue sur la pulsation des flammes (f = 1,68·D^−0,5). https://repository.lboro.ac.uk/articles/journal_contribution/A_review_of_research_and_experimental_study_on_the_pulsation_of_buoyant_diffusion_flames_and_pool_fires/9547682

**Lacunes identifiées (non trouvées en accès libre) :** aucune mesure directe en candela d'étoiles de feu d'artifice en vol ; aucune mesure de la taille de l'enveloppe de flamme ou de la longueur de la traîne de flamme ; aucune loi quantitative de la vitesse de combustion en fonction de la vitesse d'air pour des étoiles. Shimizu (*Fireworks: The Art, Science and Technique*) et Kosanke (*Pyrotechnic Chemistry*, J. Pyrotechnics 2004) traitent probablement une partie de ces points, mais ils ne sont pas consultables en ligne.
