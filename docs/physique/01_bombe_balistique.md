# 01 — Anatomie d'une bombe et balistique (notes pour le simulateur)

Rédigé pour un artificier professionnel. Ces notes décrivent des **comportements observables et des grandeurs physiques** utiles au rendu et à la physique des particules.
Volontairement absent : toute formulation (pourcentages, rapports), toute masse de charge (chasse ou éclatement) et toute procédure de fabrication ou d'assemblage. Les familles de compositions ne sont citées que pour leur rôle, de façon qualitative.

Légende de fiabilité :
- ✅ **Bien sourcé** : mesure publiée (revue à comité de lecture, ouvrage de référence) ou plusieurs sources concordantes.
- 🟡 **Ordre de grandeur / règle empirique** : source secondaire, règle de métier, ou large dispersion.
- 🧮 **Calcul propre** : modèle physique que j'ai calibré sur des données publiées. Ce n'est pas une mesure.
- ⚠️ **Incertain** : hypothèse, ou source faible ou indirecte.

---

## 0. Résumé pour l'implémentation (TL;DR)

| Grandeur | Valeur à utiliser | Fiabilité |
|---|---|---|
| Cx (C_D) d'une bombe sphérique en vol | 0,4–0,5 (Re < 3·10⁵), 0,35–0,45 au-delà ; pas de « crise de traînée » nette en vol réel | ✅ |
| Cx d'une étoile (sphère qui brûle) | 0,5 (meilleur ajustement mesuré) | ✅ |
| Masse volumique d'une étoile | 1 500–1 600 kg/m³ | ✅ |
| Vitesse de sortie de mortier | ~70–130 m/s selon le calibre (≈ 112 m/s comme valeur « typique ») | ✅/🟡 |
| Temps de montée jusqu'à l'apogée | ~4,5 s (75 mm) → ~7 s (300 mm) | 🧮 (cohérent avec les retards de 3–6 s cités) |
| Vitesse d'éjection des étoiles | ~55–80 m/s (150 mm, mesuré) ; ~50 m/s (75 mm) à ~180 m/s (300 mm) d'après les diamètres d'ouverture | ✅ (150 mm) / 🧮 (autres calibres) |
| Expansion de la sphère | 50 % du rayon final en ~0,5–0,7 s, 90 % en ~1,2–2,2 s, puis quasi-gel | 🧮 (validé sur Shimizu) |
| Durée d'une pivoine ou d'un chrysanthème | 2–4 s ; étoiles lentes (saule, palmier) 7–8 s | ✅ (Shimizu) |
| Dispersion des temps de combustion entre étoiles | σ/moyenne ≈ 5 % | ✅ |
| Combustion en vol / combustion au sol | ×1,6 | ✅ |
| Transmission du feu, du centre aux étoiles (bombe de 12") | ~0,4 ms, donc allumage quasi simultané | ✅ (Shimizu, valeur « supposée ») |
| Rotation de la bombe pendant le vol | 0–15 tr/s, axe aléatoire | ✅ |

**Modèle d'étoile recommandé.** Ce modèle reproduit à ±10 % les portées mesurées par Shimizu (voir §4.4) :
```
m dv/dt = m g − ½ ρ_air C_D A |v − w| (v − w)     (w = vent local)
ρ_air = 1,2 kg/m³ ; C_D = 0,5 ; ρ_étoile ≈ 1 550 kg/m³
rayon r(t) = r0 · (1 − t / t_combustion)   (régression linéaire de la surface)
A = π r², m = ρ_étoile · 4/3 π r³
v_initiale = v_bombe(au moment de l'éclatement) + v_éjection · n̂
```

---

## 1. Anatomie d'une bombe : les éléments et leur rôle

### 1.1 Les éléments ✅ (sources : Wikipédia « Fireworks », Poulton & Kosanke 1995, Shimizu, Ishikawa 2007, Wakabayashi 2006)

- **Mortier.** Tube de lancement : PEHD, époxy renforcé de fibres (FRE), carton, ou acier, devenu rare et souvent interdit à cause des éclats. Il guide la bombe et contient les gaz de la charge de chasse. Sa longueur et le jeu entre la bombe et le tube influencent la vitesse de sortie : une partie des gaz fuit autour de la bombe. Selon Shimizu, un mortier trop court laisse une partie de la poudre de chasse expulsée sans brûler, et la bombe monte alors trop bas.
- **Charge de chasse (lift charge).** Poudre noire en grains sous la bombe. La combustion pousse la bombe hors du tube. Elle allume aussi l'extrémité extérieure de la mèche à retard. Shimizu note que la poudre en grains propulse plus haut que la poudre pulvérulente, parce que la flamme se propage entre les grains.
- **Mèche à retard (time fuse).** Elle brûle pendant la montée et met le feu à la charge d'éclatement près de l'apogée. Les retards cités vont de **3 à 6 s** selon le calibre (Poulton & Kosanke). Une mèche plus longue convient aux gros calibres. Une mèche trop « rapide » ou trop courte produit un **éclatement précoce**.
- **Enveloppe (casing).**
  - Japonaise : deux hémisphères de papier ou de carton, renforcés par un **contre-collage (pasting)** de nombreuses couches de papier kraft. Sur les bombes de 240 mm étudiées, l'enveloppe fait 8,5 à 9,5 mm d'épaisseur et pèse environ 1,07 kg (Ishikawa 2007).
  - Occidentale ou italienne : cylindre de carton, éventuellement en plastique.
- **Charge d'éclatement (burst charge).** Elle est au centre (sphérique) ou en couche (cylindrique). Elle fait monter la pression dans l'enveloppe jusqu'à la rupture et donne aux étoiles leur vitesse radiale. Elle allume aussi les étoiles. Plusieurs familles existent : à base de poudre noire, de perchlorate ou, historiquement, de chlorate. Elles sont souvent enrobées sur un support léger (graines, balles de riz, liège) pour accélérer la combustion.
- **Étoiles (stars).** Granulés pyrotechniques sphériques (Japon) ou cylindriques (Occident). Elles sont souvent « amorcées » par une couche extérieure facile à allumer. Ce sont elles qui produisent la lumière visible.
- **Contre-collage (pastings).** Bandes de papier collées sur l'enveloppe. **Plus l'enveloppe est solide, plus la pression monte avant la rupture, et plus les étoiles partent vite.** Le diamètre de la fleur augmente avec. Shimizu, §26.10 : « Le diamètre d'une fleur dépend principalement de la nature de la charge d'éclatement et du contre-collage, c'est-à-dire de la résistance de la sphère. »

### 1.2 Sphérique (warimono / pokamono) ou cylindrique ✅/🟡

- **Warimono (割物)** : bombe japonaise « qui s'ouvre en fleur ». L'enveloppe est épaisse et très contre-collée, avec une charge d'éclatement centrale importante. Les étoiles sont disposées **en une couche régulière contre la paroi**, et les éjections sont radiales et symétriques. Une fleur dure en général 2 à 4 s (Shimizu §16).
- **Pokamono (ポカ物)** : enveloppe plus mince et charge d'éclatement faible. La bombe s'ouvre en deux, comme une coquille, et **libère** son contenu sans lui donner beaucoup de vitesse radiale : saules, comètes, parachutes, sifflets, marrons, etc. À calibre égal, elle pèse **environ moitié moins** qu'un warimono (Shimizu §17). Elle monte un peu plus vite, mais on lui met la même mèche, par simplicité.
- **Cylindriques (occidentales, italiennes, « canister »)** : plus faciles à fabriquer, avec des étoiles souvent en vrac. Elles **empilent facilement plusieurs coups (multi-break)**, reliés par des mèches de transmission. Les bombes boules ont la réputation de donner un affichage **plus symétrique** (brevet US10337842, partie « background »). L'ouverture d'un cylindre est moins sphérique : on voit souvent des « cônes » d'étoiles aux deux bouts ou une ceinture équatoriale. ⚠️ Je n'ai pas trouvé de mesure quantitative de cette anisotropie.
- **Pourquoi une sphère donne une sphère.** Trois raisons :
  1. Les étoiles sont disposées uniformément sur une coquille sphérique à égale distance de la charge centrale.
  2. La pression interne est quasi uniforme, puisque la flamme traverse la bombe en ~0,4 ms selon Shimizu.
  3. L'enveloppe se fragmente en de nombreux morceaux en quelques millisecondes (Wakabayashi 2006).
  Chaque étoile reçoit donc à peu près la même impulsion radiale.
- **Multi-coups (multi-break).** Plusieurs compartiments ou petites bombes se suivent dans le temps et dans l'espace. Les bombes japonaises « bouquet » (千輪 *senrin*, hanwari) dispersent de petites bombes au premier éclatement, qui s'ouvrent ensuite.

### 1.3 Comment la disposition des étoiles donne le motif ✅/🟡
- **Pivoine ou chrysanthème (peony / chrysanthemum)** : une couche sphérique d'étoiles sans traînée (pivoine) ou avec traînée d'étincelles (chrysanthème).
- **Pistil (芯 *shin*)** : une **seconde sphère d'étoiles, intérieure et concentrique**, souvent d'une autre couleur. Les **doubles pétales** (八重芯 *yae-shin*) en ont deux ou trois. ⚠️ Mécanisme supposé : les étoiles intérieures sont plus proches de la charge, reçoivent moins d'impulsion ou sont plus petites, et forment une sphère de plus petit rayon. Je n'ai trouvé aucune donnée chiffrée sur le rapport des rayons. Pour le rendu, un rapport R_pistil/R_pétale de 0,4 à 0,7 est plausible (⚠️ à ajuster à l'œil).
- **Anneau, cœur, smiley, trèfle (ring, pattern shells)** : les étoiles sont disposées **dans un plan**, selon la forme voulue, souvent sur un carton. Elles partent dans ce plan et le motif est **la projection d'une figure plane**. Comme la bombe tourne en vol et que son orientation au moment de l'éclatement est aléatoire, le motif est vu sous un angle aléatoire. Vu par la tranche, il devient une ligne. **On en tire souvent plusieurs à la fois** pour qu'au moins un soit lisible (HowStuffWorks ; Red Apple). Pour le simulateur : tirer une normale de plan aléatoire, éventuellement biaisée vers la verticale si la bombe porte un stabilisateur, et projeter.
- **Densité apparente d'une sphère (« Bon », Shimizu).** Des étoiles réparties uniformément sur une sphère, une fois projetées, se **concentrent sur le bord** du disque. La densité projetée est proportionnelle à 1/√(1−(r/R)²). Shimizu observe que la moitié des étoiles se trouve dans la couronne extérieure r > 0,76 R, alors que cette couronne ne représente qu'un quart de la surface du disque. La théorie d'une coquille infiniment mince place cette frontière à 0,87 R. L'effet « anneau lumineux » d'une pivoine est donc **géométrique** et sort tout seul d'un rendu 3D correct ✅.
- **Palmier, comète** : peu d'étoiles, grosses et à longue traînée. Elles sont souvent associées à une **traînée montante** qui figure le tronc.
- **Crossette** : des étoiles qui se divisent en quatre après un court trajet.
- **Dahlia** : une bombe d'un calibre donné chargée d'étoiles prévues pour un calibre plus gros, donc moins d'étoiles, plus grosses, qui vont plus loin.

---

## 2. Grandeurs par calibre

### 2.1 Correspondance des tailles japonaises (号 *gō*) ✅
1 gō ≈ 1 sun ≈ 3,03 cm de diamètre de mortier. Exemples : 3 gō ≈ 9 cm, 5 gō ≈ 15 cm, 10 gō (尺玉 *shakudama*) ≈ 30 cm.

### 2.2 Masses de bombes ✅
| Calibre | Masse | Source |
|---|---|---|
| 57 mm (n°2, enveloppe vide) | 0,024 kg | Ooki 2006a |
| 84 mm (n°3, vide) | 0,070 kg | Ooki 2006a |
| 142 mm (n°5, vide) | 0,209 kg | Ooki 2006a |
| 272 mm (n°10, vide) | 0,920 kg | Ooki 2006a |
| ~80 mm (3 gō, complète) | 0,24 kg | Ding & Yoshida 2008 |
| 5" (Japon, complète) | 0,40–0,65 kg | Shimizu, tableau 27 (Osaka 1965) |
| 6" | 1,15–1,5 kg | Shimizu, tableau 27 |
| 170 mm | 1,84 kg | Wakabayashi 2006 |
| 7" | 2,0–2,6 kg | Shimizu, tableau 27 |
| 8,5" | 3,2 kg | Shimizu, tableau 27 |
| 235–240 mm | 3,6–4,3 kg | Wakabayashi 2006 ; Ishikawa 2007 |
| 10" | 3,5–5,3 kg | Shimizu, tableau 27 |
| 12" (≈ 尺玉) | 8,3–9,2 kg | Shimizu, tableau 27 |
| 24" (二尺玉) | 60–67,5 kg | Shimizu, tableau 27 |
| 120 cm (40 gō) | ~420 kg | Honda Kids |

Pour une bombe cylindrique occidentale, compter une masse plus élevée à diamètre égal, puisque le volume est plus grand pour une même section (⚠️ non chiffré ici). Une pokamono pèse environ la moitié d'une warimono (Shimizu).

Selon Poulton & Kosanke, la matière pyrotechnique représente **environ la moitié de la masse** d'une bombe. Sur les bombes japonaises de 240 mm, Ishikawa mesure 70–75 % d'« explosifs » au total (étoiles et charges confondues).

### 2.3 Hauteur d'éclatement et diamètre d'ouverture

**Table japonaise de référence** 🟡 (source commerciale de fabricants, reprise par pricey.jp et la ville de Niigata ; ordres de grandeur concordants) :

| gō | Ø bombe | Hauteur d'éclatement | Ø fleur |
|---|---|---|---|
| 3 | ~9 cm | ~120 m | ~60 m (une autre source donne ~70 m pour le 2,5 gō, ce qui est incohérent) |
| 4 | ~12 cm | ~160 m | ~130 m |
| 5 | ~15 cm | ~190 m | ~170 m |
| 6 | ~18 cm | ~220 m | ~220 m |
| 7 | ~21 cm | ~250 m | ~240 m |
| 8 | ~24 cm | ~280 m | ~280 m |
| 10 | ~30 cm | ~330 m | ~320 m (~300 m selon d'autres sources) |
| 20 | ~60 cm | ~500 m | ~480 m |
| 30 (三尺) | ~90 cm | ~600 m | ~600–650 m |
| 40 | ~120 cm | ~700 m | ~700–800 m |

**Shimizu, tableau 2 : « diamètres standard d'une fleur ronde (Bon) »** ✅ (valeurs de conception visées par l'artificier japonais) :
5" → 100 m ; 6" → 130 m ; 7" → 170 m ; 8" → 200 m ; 9,5" → 240 m ; 12" → 300 m ; 24" → 500 m.

**Shimizu, tableau 27 : mesures photographiques réelles (Osaka 1965)** ✅. La dispersion est énorme :

| Calibre | Hauteur d'éclatement (m) | Ø chrysanthème (m) |
|---|---|---|
| 5" | 95–300 | 40–180 |
| 6" | 110–310 | 110–240 |
| 7" | 150–370 | 100–250 |
| 8,5" | 160–420 | 200–360 |
| 10" | 270–450 | 160–340 |
| 12" | 130–440 | 180–390 |
| 24" | 480–550 | 490–500 |

→ **Pour le simulateur, il faut introduire une variabilité réaliste d'un tir à l'autre**, de l'ordre de ±20–30 % en hauteur. Shimizu cite comme causes la chasse partiellement soufflée, le jeu dans le mortier, l'humidité et la longueur de mèche.

**Règles de métier occidentales** 🟡 (Poulton & Kosanke, *Fire Engineering* 1995) :
- Hauteur d'éclatement ≈ **120 ft par pouce** de calibre, soit ≈ 1,44 m par mm. Exemple : une bombe de 6" éclate vers 700 ft ≈ 215 m.
- Diamètre d'ouverture ≈ **90 ft par pouce** de bombe sphérique, soit ≈ 1,08 m par mm. Exemples : 6" → ~500 ft ≈ 150 m ; 10" → ~900 ft ≈ 270 m.
- Pour les gros calibres, la règle de hauteur surestime par rapport à la table japonaise : 300 mm donnerait ~430 m, contre ~330 m.

Autre repère : Shimizu indique qu'une bombe de 6" monte à environ 250 m et que la fleur est **pleinement développée en ~2 s**.

### 2.4 Vitesse de sortie du mortier et temps jusqu'à l'apogée
- ✅ Poulton & Kosanke (1995) : la charge de chasse est dimensionnée pour une vitesse de sortie d'environ **250 mph ≈ 112 m/s**, à peu près **quel que soit le calibre**.
- ✅ Ding & Yoshida 2008 : pour un 3 gō tiré avec une chasse réelle de spectacle, la vitesse de sortie peut **dépasser 70 m/s** et l'apogée **dépasser 110 m**. Avec une chasse réduite en essai, ils mesurent 35 m/s et 73 m/s.
- ✅ Ooki 2006b : pour une étoile seule tirée d'un petit mortier, vitesse de 27 à 117 m/s selon la chasse, avec **une forte dispersion d'un tir à l'autre** (combustion irrégulière de la chasse).
- ✅ Retard de mèche cité : 3 à 6 s selon le calibre (Poulton & Kosanke).
- 🧮 **Calcul propre** (sphère, C_D = 0,5, ρ_air = 1,2 kg/m³, masses du §2.2). Vitesse de sortie v0 qu'il faut pour atteindre la hauteur de la table japonaise, et temps de montée correspondant :

| Calibre (masse) | H visée | v0 nécessaire (C_D 0,4 / 0,5 / 0,8) | t_apogée (C_D 0,5) |
|---|---|---|---|
| ~80 mm (0,24 kg) | 120 m | 68 / 74 / 100 m/s | 4,4 s |
| 120 mm (0,75 kg) | 160 m | 77 / 84 / 111 m/s | 5,1 s |
| 150 mm (1,3 kg) | 190 m | 86 / 95 / 128 m/s | 5,5 s |
| 180 mm (2,0 kg) | 220 m | 95 / 106 / 148 m/s | 5,8 s |
| 210 mm (3,0 kg) | 250 m | 103 / 115 / 163 m/s | 6,2 s |
| 240 mm (4,0 kg) | 280 m | 114 / 128 / 190 m/s | 6,4 s |
| 300 mm (8,5 kg) | 330 m | 116 / 128 / 178 m/s | 7,1 s |

  Ces résultats concordent avec la vitesse d'environ 112 m/s de Kosanke et avec des retards de 4 à 7 s.
  Pour une bombe de 50 mm (~60 g), v0 = 100 m/s donne ~120 m d'apogée en ~4,1 s.
- **La traînée est essentielle.** Sans air, v0 = 112 m/s donnerait 640 m d'apogée en 11,4 s. Avec l'air, l'apogée tombe à 150–330 m, atteinte en 4–7 s. Il faut absolument intégrer la traînée quadratique.
- **Vitesse terminale d'une bombe qui retombe sans éclater (« bombe noire », dud)** 🧮 : ~32 m/s (50 mm), ~40 m/s (80 mm), ~50 m/s (150 mm), ~63 m/s (300 mm). Poulton & Kosanke donnent « plus de 100 mph », soit ≈ 45 m/s ✅.

### 2.5 Calage de la mèche par rapport à l'apogée ✅/🟡
- L'éclatement est prévu **à l'apogée ou juste avant**, là où la vitesse de la bombe est minimale. Un éclatement à l'apogée donne la fleur la plus symétrique.
- Défauts typiques (Shimizu §26) :
  - **Éclatement précoce** : mèche trop rapide ou trop courte, ou pokamono trop faible qui éclate à la sortie du mortier.
  - **Éclatement après l'apogée** : la bombe redescend déjà.
  - **Bombe noire** : la mèche ou l'allumage de la charge d'éclatement fait défaut, et la bombe retombe entière.
  - **Explosion dans le mortier** : des gaz chauds entrent par un trou d'épingle près de la mèche.
- 🧮 Vitesse de la bombe au moment de l'éclatement si la mèche est en avance de Δt : environ **(g + traînée)·Δt**, soit ~6 à 10 m/s pour Δt = 0,5 s et ~15 à 20 m/s pour Δt = 1 s, juste avant l'apogée. Cette vitesse s'ajoute à l'éjection des étoiles (voir §4.5).
- ⚠️ Je n'ai pas trouvé de mesure de la dispersion des retards de mèche. Hypothèse raisonnable pour le simulateur : σ ≈ 3–5 % du retard.

### 2.6 Étoiles : taille, masse, nombre ✅

| Bombe | Ø étoile | Masse d'une étoile | Nombre d'étoiles | Source |
|---|---|---|---|---|
| n°2 (~6 cm) | ~10 mm | 0,8–1,0 g | — | Ooki 2006b |
| n°3 (~9 cm) | ~12 mm | 1,7 g | — | Ooki 2006b |
| n°4 (~12 cm) | ~13,5 mm | 1,9–2,2 g | — | Ooki 2006b |
| n°5 (~15 cm) | ~14–15 mm | 2,5–2,8 g | — | Ooki 2006b |
| 6" (motif en anneau) | 12,2–13,8 mm | 1,5–2,2 g | — | Shimizu, tableau 19 |
| n°6 (~18 cm) | ~17 mm | 3,8 g | — | Ooki 2006b |
| 170 mm, trois couleurs | 16,5 mm | 3,6 g | 238 | Wakabayashi 2006 |
| 235 mm, trois couleurs | 21 mm | 6,4 g | 286 | Wakabayashi 2006 |
| 240 mm, chrysanthème / papillon / trois couleurs | 17–21 mm | 4,2–6,4 g | 286–322 | Ishikawa 2007 |
| 240 mm, palmier | ~27 mm | 52 g | 44 | Ishikawa 2007 |
| n°10 (~30 cm) | 22 mm | 8,5 g (ρ = 1 510 kg/m³) | — | Ooki 2006b |

- **Masse volumique d'une étoile : 1 500–1 600 kg/m³.** Ooki mesure 1 510 kg/m³. Le tableau 19 de Shimizu donne 1,5 g pour 12,2 mm, soit ≈ 1 580 kg/m³.
- 🧮 **Règle géométrique du nombre d'étoiles** (une seule couche contre la paroi d'un warimono) : N ≈ 4π R_moy² / d², où R_moy = (Ø intérieur − d)/2.
  - Vérification sur 170 mm (Ø intérieur 158 mm, d = 16,5 mm) : 231 étoiles calculées pour 238 mesurées.
  - Sur 235 mm (Ø intérieur 210 mm, d = 21 mm) : 254 calculées pour 286 mesurées.
  - Extrapolation : ~100 étoiles pour un 3 gō (d ≈ 10–12 mm), ~300 pour la couche extérieure d'un 10 gō (d ≈ 25 mm). Il faut y ajouter les couches de pistil.
- Les bombes occidentales cylindriques ou chinoises de série contiennent souvent **plus d'étoiles, plus petites et en vrac** (⚠️ non chiffré).
- Dispersion entre étoiles d'une même fabrication : σ/moyenne ≈ **2 % sur le diamètre, 5 % sur la masse, 5 % sur le temps de combustion** (Ooki 2006b) ✅.

### 2.7 Combustion des étoiles ✅
- Temps de combustion **mesurés sur plaque** pour des étoiles de bombes n°2 à n°6 : **0,8 à 2,4 s**. Vitesse de régression linéaire : 3 à 6 mm/s (Ooki 2006b).
- **En vol, la combustion dure 1,6 fois plus longtemps que sur plaque**, probablement à cause du refroidissement de la flamme par l'écoulement d'air. Exemple : étoile argent de bombe n°6, 1,47 s sur plaque et 2,42 s en vol.
- Le temps de combustion est **à peu près proportionnel au diamètre**.
- Shimizu : étoile « rapide » 2–4 s, étoile « lente » (palmier, saule, *hiki*) 7–8 s, et rien entre les deux pour des raisons esthétiques. Fleur de warimono : 2–4 s.

---

## 3. Dynamique de l'éclatement

### 3.1 Séquence observée en caméra rapide ✅ (Wakabayashi 2006, bombes de 170 et 235 mm, 7 200 images/s)
1. **Gonflement** : juste avant la rupture, l'enveloppe se dilate à **~20 m/s**, surtout dans le plan équatorial, celui du joint des hémisphères.
2. **La rupture commence au joint** des deux hémisphères, la partie la moins résistante. Les flammes jaillissent d'abord par cette fente : **l'éclatement n'est pas sphérique pendant les toutes premières fractions de milliseconde**.
3. La flamme envahit le champ de 0,8 m en 0,5–0,6 ms, soit un **front de flamme à 600–800 m/s**. Il s'agit des gaz et non des étoiles.
4. La pression interne continue de monter après la rupture : l'enveloppe se fragmente **en nombreux morceaux en quelques millisecondes**. La pression interne culmine à **7,5–8,8 MPa** pour des bombes de 240 mm, avec une largeur à mi-hauteur d'environ 0,8–0,9 ms (Ishikawa 2007).
5. **Ré-inflammation (combustion secondaire) vers ~10 ms**. Ensuite les étoiles, plus denses donc plus lentes à accélérer, partent **derrière les fragments d'enveloppe**, dans toutes les directions et de façon **globalement à symétrie sphérique**.

**Pour le rendu :**
- Un **flash** central bref : il commence en moins d'une milliseconde et vit quelques dizaines de ms au plus. ⚠️ Je n'ai pas trouvé de mesure de sa durée ni de sa luminance à distance.
- Un **petit nuage de fumée** au centre, puis éventuellement des débris d'enveloppe incandescents.
- Le **son** arrive avec un retard égal à la distance divisée par ~340 m/s. Shimizu le rappelle : une bombe de 6" éclate à environ 250 m, et un spectateur placé à environ 600 m entend la détonation au moment où la fleur est pleinement ouverte, vers 2 s.

### 3.2 Allumage des étoiles : simultané ? ✅/⚠️
- Shimizu : dans un warimono de 12 pouces, la transmission du feu du centre jusqu'aux étoiles extérieures prend **environ 0,4 ms**, si la charge est bien granulée. **L'allumage est donc pratiquement simultané** à l'échelle visuelle.
- Les étoiles sont allumées **dans la bombe**, par la flamme de la charge d'éclatement, **avant ou pendant l'éjection**. Des photos d'essais statiques sur une bombe de 8" (Skylighter / *Best of AFN III*) montrent des étoiles déjà allumées qui s'éteignent ensuite.
- **Étoiles aveugles (« blind stars », étoiles soufflées)** : une étoile allumée peut **s'éteindre dans les premiers instants** si elle part trop vite. La flamme est rabattue vers l'arrière et ne renvoie plus assez de chaleur à la surface non brûlée. Shimizu appelle « **vitesse critique de vent** » la vitesse d'air au-delà de laquelle une composition s'éteint, et note que la sphère est la forme la moins stable. Une étoile qui survit aux premiers dixièmes de seconde brûle en général jusqu'au bout, parce que la traînée la ralentit très vite. Remède cité : un éclatement plus « doux ». Sashimura 2007 montre aussi qu'au-delà d'une certaine chasse, des étoiles tirées directement ne s'allument plus.
  - **Pour le simulateur :** une petite proportion d'étoiles qui ne s'allument jamais. ⚠️ Fraction non publiée : quelques % pour une bonne bombe, davantage pour une bombe « violente » ou bas de gamme. On peut aussi ajouter un léger retard d'apparition aléatoire de 0 à 50 ms (⚠️ hypothèse), et tenir compte de l'effet de réallumage décrit ci-dessous.
- La **gerbe d'étincelles** d'une étoile à traînée (chrysanthème) dépend de sa vitesse dans l'air : certaines compositions ne « divisent » leurs étincelles **qu'en vol**, et pas au sol (Shimizu §10). La traînée d'étincelles est donc plus longue et plus dense au début, quand l'étoile va vite.

### 3.3 Imperfections de symétrie ✅/⚠️
- Les sources documentées sont :
  - la rupture initiale au joint des hémisphères (Wakabayashi) ;
  - l'excentricité de construction (Shimizu, à propos de la dispersion des bombes noires) ;
  - un éclatement avant ou après l'apogée, qui ajoute la vitesse de la bombe ;
  - un contre-collage inégal ;
  - pour les cylindres, une géométrie non sphérique.
- La dispersion des masses d'étoiles (σ ≈ 5 %) donne une dispersion des distances parcourues, puisque la longueur de freinage est proportionnelle à ρd (voir §4.2).
- ⚠️ Je n'ai trouvé aucune mesure directe de la dispersion des vitesses d'éjection. Valeur suggérée pour le simulateur : σ_v/v ≈ 5–10 % pour un warimono de qualité, 15–25 % pour une bombe cylindrique ou bas de gamme. Il est aussi utile de prévoir un léger biais équatorial ou polaire, réglable.

---

## 4. Vol des étoiles

### 4.1 Traînée ✅
- **C_D des étoiles = 0,5**. C'est le meilleur ajustement à une trajectoire filmée d'étoile de 22 mm lancée verticalement à 91 m/s (Ooki 2006b ; essais à 0,0, 0,3, 0,5 et 0,7).
- C_D des bombes sphériques :
  - 0,7–0,8 en chute libre, en tour de 22 m (Re ≈ 4–11·10⁴) ;
  - 0,4 en soufflerie pour une bombe n°5 (Ooki 2006a) ;
  - **0,4–0,5 pour Re < 3·10⁵ et 0,35–0,45 au-delà**, d'après les tirs filmés (Ding 2007).
  Shimizu concluait qu'**en vol réel il n'y a pas de crise de traînée nette**, à cause de la rotation, des trajectoires hélicoïdales et de la turbulence.
- Nombre de Reynolds d'une étoile de 15 mm à 100 m/s : Re ≈ 10⁵, ce qui reste dans le régime où C_D ≈ 0,4–0,5. Sur une loi C_D(Re) complète (Zohdi 2016, d'après Chow) : C_D = 0,5 pour 400 < Re ≤ 3·10⁵.

### 4.2 Pourquoi les petites étoiles ralentissent vite ✅ (physique standard) 🧮 (valeurs)
- Sans gravité, on a dv/dt = −K v², avec **K = 3 C_D ρ_air / (4 ρ_étoile d)**, où d est le diamètre. Cela donne :
  - v(t) = v0 / (1 + K v0 t) ;
  - **R(t) = (1/K) · ln(1 + K v0 t)** ;
  - v(R) = v0 · e^(−K R).
  (Zohdi 2016, écrit avec le rayon : K = 3C_Dρ_a/(8ρR).)
- **Longueur de freinage L = 1/K = 4 ρ_étoile d / (3 C_D ρ_air)** ≈ 3 400 × d avec ρ = 1 550 kg/m³ et C_D = 0,5. Cela donne :
  - d = 10 mm → L ≈ 34 m ;
  - d = 15 mm → L ≈ 52 m ;
  - d = 20 mm → L ≈ 69 m ;
  - d = 25 mm → L ≈ 86 m.

  **La portée croît comme le logarithme de v0 mais linéairement avec la taille de l'étoile.** C'est ce qui fixe le diamètre de la fleur, et c'est pourquoi un dahlia (grosses étoiles) s'ouvre plus large qu'une pivoine (petites étoiles) de même calibre.
- **Vitesse terminale de chute** v_t = √(4 ρ_étoile d g / (3 C_D ρ_air)) : ~18 m/s pour 10 mm, ~26 m/s pour 20 mm, ~31 m/s pour 30 mm. Elle **diminue pendant la combustion**, puisque d diminue.
- Exemple de courbe de décélération 🧮 (d = 20 mm, v0 = 150 m/s, sans régression de la surface) :

| t (s) | 0,25 | 0,5 | 1 | 1,5 | 2 | 3 |
|---|---|---|---|---|---|---|
| R (m) | 30 | 50 | 78 | 98 | 113 | 135 |
| v (m/s) | 96 | 71 | 46 | 35 | 29 | 24 |

### 4.3 Vitesse d'éjection des étoiles

**Mesuré ✅ (Shimizu, tableau 19 : bombes de 6", étoiles disposées en anneau) :**

| Famille de charge d'éclatement | Ø étoile | Combustion | **Vitesse de départ** | **Portée horizontale** |
|---|---|---|---|---|
| Type chlorate (historique) | 12,2 mm | 2,0 s | **71 m/s** | 55 m |
| Type perchlorate | 12,2 mm | 2,0 s | **64 m/s** | 50 m |
| Type poudre noire | 12,2 mm | 2,0 s | **57 m/s** | 45 m |
| Type perchlorate, enveloppe moins contre-collée | 13,8 mm | 2,6 s | n.d. | 67–80 m |

- Une charge plus « vive » donne une vitesse plus élevée. Selon Shimizu, augmenter d'environ 20 % le nombre de couches de contre-collage permet à une charge moins vive d'atteindre la même vitesse de départ des étoiles. **Il s'agit de la même énergie mieux confinée.**
- Shimizu met en garde contre une charge trop puissante sur les gros calibres : la fleur devient trop grande, sa **densité d'étoiles chute** et elle paraît « vide ». **Le diamètre est choisi par l'artificier et ne se maximise pas.**

**Déduit 🧮 de ces données.** Modèle du §0 (C_D 0,5, ρ = 1 550 kg/m³, régression linéaire de la surface), en visant les diamètres « Bon » de Shimizu :

| Calibre | Ø étoile supposé | Combustion supposée | v_éjection nécessaire | 50 % du rayon | 90 % du rayon |
|---|---|---|---|---|---|
| 3" (R ≈ 35–41 m) | 10 mm | 1,6 s | ~50–75 m/s | 0,45 s | 1,2 s |
| 5" (Bon 100 m) | 13 mm | 2,3 s | ~57 m/s | 0,6 s | 1,6 s |
| 6" (Bon 130 m) | 13,8 mm | 2,6 s | ~80 m/s | 0,6 s | 1,8 s |
| 7" (Bon 170 m) | 16,5 mm | 2,8 s | ~105 m/s | 0,6 s | 1,9 s |
| 8" (Bon 200 m) | 19 mm | 3,0 s | ~120 m/s | 0,65 s | 2,0 s |
| 9,5" (Bon 240 m) | 21 mm | 3,0 s | ~155 m/s | 0,6 s | 2,0 s |
| 12" (Bon 300 m) | 25 mm | 3,5 s | ~180 m/s | 0,7 s | 2,25 s |

→ **Fourchette conseillée : 50–80 m/s pour 75–150 mm, 100–180 m/s pour 200–300 mm.** ⚠️ Ces vitesses dépendent fortement de la taille et du temps de combustion supposés. Les diamètres « commerciaux » de la table japonaise, plus grands que ceux de Shimizu, demanderaient 140–230 m/s, ce qui est probablement surestimé.

Le modèle de Zohdi (2016) fait un bilan d'énergie : v = √(2E/M). Ses paramètres d'exemple (100 kJ pour 0,5 kg, soit 632 m/s) **ne sont pas réalistes** pour une bombe d'artifice. Il ne faut retenir que la forme de la relation.

**Lien entre la vitesse d'éjection, la force de la charge et la masse des étoiles ⚠️ (raisonnement physique, pas de mesure publiée) :**
- À énergie transmise donnée, v ∝ √(E/M_étoiles).
- À taille d'étoile égale, des étoiles plus lourdes partent moins vite, mais elles **portent plus loin** car L ∝ ρd.
- Une étoile plus grosse a une section plus grande et reçoit à peu près la même pression. Son accélération dans la bombe vaut ∝ P·A/m ∝ 1/d. À charge égale, **les grosses étoiles partent un peu moins vite, mais vont plus loin.**

### 4.4 Validation du modèle d'étoile 🧮✅
J'ai simulé le cas du tableau 19 de Shimizu (d = 12,2 mm, ρ = 1 580 kg/m³, C_D = 0,5, combustion de 2,0 s, régression linéaire du rayon) :

| v0 | Portée simulée | Portée mesurée par Shimizu |
|---|---|---|
| 71,4 m/s | 52 m | 55 m |
| 63,5 m/s | 49 m | 50 m |
| 56,7 m/s | 46 m | 45 m |

**L'accord est à ±5 %.** Sans régression du rayon (étoile de taille constante), le modèle surestime la portée d'environ 15–20 %. **Il faut donc modéliser la diminution du diamètre pendant la combustion.**

### 4.5 Gravité, vitesse héritée de la bombe, vent ✅/🧮
- **Affaissement (droop)** 🧮. À la fin de la combustion, une étoile éjectée à l'horizontale est descendue de ~10 m (3", 6") à ~20–27 m (8"–12") sous le point d'éclatement. Concrètement, **la fleur « fond » vers le bas pendant sa dernière seconde** : les étoiles s'approchent de leur vitesse terminale de 15–30 m/s vers le bas. Les étoiles longues (saule, *kamuro*) dessinent alors la « retombée ».
- **Vitesse héritée.** v_étoile = v_bombe + v_éjection·n̂. Comme la traînée agit sur la vitesse **par rapport à l'air**, la part héritée est elle aussi amortie avec la même constante. Le centre de la fleur dérive d'environ v_bombe × 0,5–1 s, puis se fige. Un éclatement trop tôt, avec une bombe encore montante à 10–20 m/s, donne une fleur légèrement décentrée vers le haut et un peu « en cône ». Shimizu, figure 4.2 : une bombe qui éclate en montant produit un « saule en éventail ».
- **Vent.** Une fois ralenties à leur vitesse terminale, en ~1–2 s, les étoiles **suivent le vent** : toute la fleur, fumée comprise, dérive à la vitesse du vent à cette altitude. Profil de vent proposé par Takahashi et cité par Shimizu :
  - **U/U0 = (H/H0)^(1/n)**, avec H0 = 2 m ;
  - n ≈ 3,0 au-dessus du sol et 2,5 au-dessus de la mer, plage 2,2–3,5 ;
  - formule valable jusqu'à ~120 m, au-delà de quoi U est constant ou diminue.

  Exemple : 3 m/s au sol donnent ~11–12 m/s à 120 m.
- **Dérive d'une bombe noire au sol** (empirique, Shimizu) : **D ≈ 10·U0** (D en m, U0 = vent au sol en m/s, mesuré à 1,5 m de hauteur). La dispersion des points de chute sans vent couvre 100–250 m de diamètre.
- Ding 2007 : la dérive due au vent est **plus importante à la descente qu'à la montée**, et elle est proportionnelle à la vitesse du vent. **Une inclinaison du mortier de 1 à 4° déplace nettement le point de chute**, de plusieurs dizaines de mètres pour un 3 gō.

### 4.6 Évolution visuelle de la sphère (synthèse) ✅/🧮
1. **0 à ~50 ms** : flash central, apparition des étoiles déjà allumées.
2. **0 à ~0,6 s** : **expansion très rapide**, jusqu'à la moitié du rayon final. Les traînées d'étincelles sont longues, puisque les étoiles vont vite.
3. **0,6 à ~2 s** : ralentissement logarithmique, avec 90 % du rayon atteint en 1,2–2,2 s selon le calibre. Shimizu : « fleur pleinement développée en ~2 s » pour une bombe de 6".
4. **Ensuite** : **quasi-gel** de la sphère. Elle ne fait plus que dériver avec le vent et tomber à la vitesse terminale. Les étoiles s'éteignent avec une dispersion d'environ ±5 % du temps de combustion. La fin d'une pivoine est donc un **fondu de ~0,2–0,4 s**, pas une coupure franche.

Shimizu décrit précisément ce phénomène : « le mouvement des étoiles est très rapide au début, puis devient de plus en plus lent avec une brillance croissante ».

---

## 5. Montée de la bombe

### 5.1 Traînée montante, comète, effets de montée ✅/🟡
- Toute bombe montante émet au moins **la lueur et les étincelles de sa mèche à retard**. ⚠️ C'est généralement faible ; aucune source ne donne de chiffre de luminance.
- Les bombes « à queue » (**rising tail**, « tronc » des palmiers) portent une **comète ou un tube d'effet** fixé à l'extérieur, qui laisse une traînée or ou argent pendant la montée (glossaires, Wikipédia « Palm »).
- Les Japonais appellent ces accessoires **曲導 *kyokudo*** : petites fleurs, sifflets, marrons ou traînées argentées qui se déclenchent **le long de la trajectoire de montée**. **Le *kyokudo* empêche aussi la bombe de tourner** et la fait voler plus droit : dans des essais de Shimizu par vent fort, les bombes munies d'un *kyokudo* sont toutes tombées dans une zone étroite.

### 5.2 Rotation de la bombe ✅ (Ding & Yoshida 2008)
- Une bombe sphérique tourne **ou non, de façon aléatoire**, à **~3–15 tr/s**, et probablement plus avec une chasse de spectacle. L'axe de rotation est **aléatoire**, entre la verticale et l'horizontale, et reste fixe pendant le vol.
- Causes probables : bombe décentrée dans le mortier et jeu non uniforme, qui font fuir les gaz de manière dissymétrique.
- La rotation décroît sous l'effet de la viscosité de l'air, en ~1–2 s pour les cas filmés (coefficient de couple C_T ≈ 35–70 pour un 3 gō).
- **Effet Magnus** (C_L ≈ 1,6–2,0) : sur une bombe noire de 3 gō (70 m/s, 10 tr/s), il provoque une **dérive de 13–15 m** au point de chute selon l'inclinaison de l'axe. L'effet sur la hauteur atteinte est négligeable. Les 85 m calculés par Eckhardt pour un 8 gō sont surestimés, faute d'avoir modélisé l'amortissement de la rotation.
- Les **étoiles à mèche visible** décrivent une **hélice** pendant la montée, dans les vidéos de Ding. Pour le rendu, une légère spirale de la lueur de mèche est réaliste.
- Shimizu : dans une pokamono, la rotation peut déplacer le contenu et provoquer un raté. Pour un motif plan (cœur, anneau), **l'orientation au moment de l'éclatement est donc aléatoire**, sauf si la bombe est stabilisée.

### 5.3 Inclinaison du mortier (lean) ✅/🟡
- Au Canada, sur les sites allongés, les mortiers sont inclinés de **10 à 15°** vers la zone de retombée, avec une distance de sécurité d'au moins 200 m ; les tirs verticaux se font sur un site circulaire de 175 m de rayon (Wikipédia « Fireworks », section Canada).
- Les éventails de mortiers inclinés (souvent ±15–30° en spectacle) sont une pratique courante. ⚠️ Je n'ai pas trouvé de référence normative pour ces valeurs.
- Une inclinaison θ décale l'éclatement d'environ H·tan θ, en un peu moins à cause de la traînée. Exemple : 10° à 200 m de hauteur, soit ~30 m.

### 5.4 Distances de sécurité (pour le contexte de scène) 🟡
- NFPA, et règlements de l'Oregon et de Richmond (Virginie) : 70 ft par pouce de calibre autrefois, **100 ft par pouce** aujourd'hui, soit ≈ 1,2 m par mm de calibre.

---

## 6. Ce qui reste incertain (à calibrer à l'œil sur vidéo)
- La dispersion des vitesses d'éjection au sein d'une même bombe : aucune mesure trouvée.
- La durée et la luminance du flash d'éclatement.
- La fraction d'étoiles aveugles.
- Le rapport des rayons pistil / pétale.
- L'anisotropie quantitative des bombes cylindriques (italiennes, chinoises).
- La dispersion des retards de mèche.
- Les vitesses d'éjection pour les très gros calibres : elles sont extrapolées et dépendent des tailles d'étoiles supposées.
- Les données du rapport canadien CERL MRL 90-41 (Contestabile et al., 1990) : pressions, vitesses de bombe, hauteur et temps d'éclatement pour des calibres de 205, 255 et 305 mm. Elles existent, mais le PDF n'était plus accessible (erreur 404).
- Non consultés directement : Lancaster, *Fireworks: Principles and Practice* ; la série *Pyrotechnic Reference* de Kosanke (notamment « Computer modeling of aerial shell ballistics » et « Shimizu aerial shell ballistic predictions », dans *Selected Pyrotechnic Publications* Part 2) ; Conkling ; Mercer (*J. Pyrotechnics* 16, 2002). Ce sont les meilleures pistes pour affiner les chiffres.

---

## 7. Sources
- Ooki Y., Ding D., Higaki M., Nemoto Y., Yoshida T., « Air resistance of spherical fireworks shells », *Sci. Tech. Energetic Materials* 67(1) 39–42 (2006). https://www.jes.or.jp/mag/stem/Vol.67/documents/Vol.67,No.1,p.39-42.pdf
- Ooki Y., Ding D., Higaki M., Yoshida T., « Burning and air resistance of fireworks stars », *STEM* 67(1) 43–47 (2006). https://www.jes.or.jp/mag/stem/Vol.67/documents/Vol.67,No.1,p.43-47.pdf
- Ding D., Ooki Y., Higaki M., Yoshida T., « Numerical calculation for exterior ballistics of fireworks shell », *STEM* 68(1) 14–20 (2007). https://www.jes.or.jp/mag/stem/Vol.68/documents/Vol.68,No.1,p.14-20.pdf
- Ding D., Yoshida T., « A study of Magnus force acting upon a launched rotating spherical aerial shell », *STEM* 69(1) 16–21 (2008). https://www.jes.or.jp/mag/stem/Vol.69/documents/Vol.69,No.1,p.16-21.pdf
- Wakabayashi K. et al., « Burst phenomenon of spherical firework shell (I) », *STEM* 67(3) 91–95 (2006). https://www.jes.or.jp/mag/stem/Vol.67/documents/Vol.67,No.3,p.91-95.pdf
- Ishikawa K. et al., « Study on the simultaneous explosion of fireworks shells by the gap tests in sand », *STEM* 68(4) 102–110 (2007). https://www.jes.or.jp/mag/stem/Vol.68/documents/Vol.68,No.4,p.102-110.pdf
- Sashimura Y. et al., « Ignitability of cylindrical firework stars », *STEM* 68(5) 146–151 (2007). https://www.jes.or.jp/mag/stem/Vol.68/No.5.05.html
- Shimizu T., *Fireworks: The Art, Science and Technique* (éd. angl.). Utilisé : §1.3 (« Bon », tableau 2 des diamètres standard), §2, §7 (vitesse critique de vent), §10.3, §16–17 (warimono / poka), tableau 19 (vitesses de départ des étoiles), §26 (accidents, bombes noires, D = 10·U0, profil de vent), tableau 27 (Osaka 1965). http://www.freepyroinfo.com/Pyrotechnic/Pyrotechnic_Books/Fireworks_the_Art,_Science_and_Technique_by_Takeo_Shimizu.pdf
- Poulton T.J., Kosanke K.L., « Fireworks and Their Hazards », *Fire Engineering* (juin 1995). https://www.fireengineering.com/firefighting/fireworks-and-their-hazards/
- Zohdi T.I., « On firework blasts and qualitative parameter dependency », *Proc. R. Soc. A* 472:20150720 (2016). https://pmc.ncbi.nlm.nih.gov/articles/PMC4786048
- Skylighter / *Best of AFN III*, « Fireworks Stars Blown Blind ». https://www.skylighter.com/blogs/fireworks-information/stars-blown-blind
- Tableau commercial japonais (号数, Ø, hauteur, Ø d'ouverture). https://www.pricey.jp/web/articles/2131 ; voir aussi https://www.walkerplus.com/article/1084540/ et https://sp.jorudan.co.jp/hanabi/columns/shakudama.html
- Honda Kids (40 gō : ~420 kg, ~700 m). https://www.honda.co.jp/kids/explore/fireworks/
- Wikipédia, « Fireworks » (types d'effets, mortiers, règles canadiennes). https://en.wikipedia.org/wiki/Fireworks
- HowStuffWorks, « How Do Fireworks Explode in Specific Shapes? ». https://science.howstuffworks.com/innovation/everyday-innovations/firework-shapes.htm
- Brevet US10337842 (bombe multi-coups ; comparaison boules / cylindres dans la partie « background »). https://patents.google.com/patent/US10337842
- Contestabile E. et al., « Evaluation of Large Diameter Fireworks Shells and Mortars », CERL MRL 90-41 (1990). Lien NRCan d'origine aujourd'hui mort : https://download-telecharger.services.geo.ca/pub/nrcan_rncan/publications/STPublications_PublicationsST/325/325940/gid_325940.pdf
- Scripts de calcul (🧮) : /tmp/claude-0/-home-user-La-passerelle-fwsim/6b2c1201-7a07-5544-bfa5-21fa40b06cb3/scratchpad/calc/shell.py et /tmp/claude-0/-home-user-La-passerelle-fwsim/6b2c1201-7a07-5544-bfa5-21fa40b06cb3/scratchpad/calc/star.py
