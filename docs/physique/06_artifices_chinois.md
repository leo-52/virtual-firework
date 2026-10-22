# 06 — Bombes chinoises « standard » (Liuyang / Liling) : différences avec les bombes japonaises

Notes pour le simulateur, rédigées pour un artificier professionnel qui tire surtout du produit chinois acheté via des catalogues européens (F4 / EN 16261).
Ces notes complètent 01 (balistique, avec les données japonaises de Shimizu), 02 (étoiles), 03 (couleurs) et 04 (effets).

**Périmètre sécurité.** Aucune formulation (ni pourcentage ni rapport), aucune masse de charge, aucune procédure de fabrication ou d'assemblage. Les familles d'ingrédients ne sont évoquées que qualitativement. Les tableaux de masses de charges de GB 19594 (tableau 3) n'ont volontairement **pas** été recopiés.

Légende de fiabilité (la même que dans 01) :
- ✅ **Sourcé** : norme officielle, mesure publiée ou plusieurs sources concordantes.
- 🟡 **Ordre de grandeur** : catalogue, fabricant, règle de métier, source secondaire.
- 🧮 **Calcul ou synthèse propre** à partir de valeurs sourcées.
- ⚠️ **Incertain** : hypothèse, anecdote, source faible.

---

## 0. TL;DR pour l'implémentation

| Paramètre | Bombe chinoise standard (catalogue EU) | Japonaise (warimono, rappel de 01) | Fiabilité |
|---|---|---|---|
| Correspondance des calibres | « 3# » = mortier de 76 mm (bombe de 72 mm) ; « 6# » = 152 mm (bombe de 147 mm) | « 3 gō » = bombe de ~9 cm ; « 5 gō » = ~15 cm | ✅ GB 19594 |
| Hauteur d'éclatement nominale | 75 mm : 90–100 m · 100 : 110–120 · 125 : 130–140 · 150 : 150–160 · 200 : 190–200 m | 3 gō ~120 m · 5 gō ~190 m · 8 gō ~280 m | ✅ GB 24284 annexe A |
| Plage admise par la norme chinoise | 75 : 50–120 m · 100 : 60–140 · 125 : 80–190 · 150 : 100–220 · 200 : 130–260 m | — | ✅ GB 19594-2015, tableau 4 |
| Diamètre de la fleur (« rayon de couverture » ×2) | 75 : 50–60 m · 100 : 70–80 · 125 : 90–110 · 150 : 110–130 · 200 : 150–170 m | Shimizu (conception) : 5" 100 m, 6" 130 m, 8" 200 m ; tables commerciales : 5 gō ~170 m | ✅ GB 24284 / ✅ Shimizu |
| Rapport diamètre / hauteur | 0,55 (75 mm) → 0,8 (≥ 150 mm), et **≤ 1 imposé par la norme** | ~0,5 (3 gō) → ~1,0 (≥ 6 gō) | ✅ / 🧮 |
| Durée d'effet en catalogue (pivoine, chrysanthème) | 4" : 2 s ±20 % ; 5" : 2,5 s ±20 % | 2–4 s | 🟡 fiche CE F4 |
| Dispersion de hauteur d'un tir à l'autre (même référence) | σ/moyenne ≈ 6–21 % (médiane ~14 %) mesuré sur bombes sphériques du commerce | ±20–30 % (Osaka 1965) | ✅ Wharton 1995 |
| Étoiles éteintes (« taux d'allumage ») | La norme exige au moins 98 % d'étoiles allumées (96 % pour les parachutes), donc jusqu'à 2–4 % d'étoiles éteintes tolérées | quasi nul en concours | ✅ GB 19594-2004 §5.6.1 |
| Symétrie | Bonne en sphérique de qualité, médiocre en cylindrique ou en entrée de gamme | Référence mondiale | 🟡 |
| Enveloppe | Papier kraft contre-collé sur hémisphères en papier ou carton ; **plastique interdit** sur les bombes de spectacle chinoises (GB 2015) | Papier (washi ou recyclé), plastique parfois | ✅ |
| Formes spéciales | Cylindrique ≤ 6#, bouquet ≤ 5#, bombe à bruit ≤ 3# | — | ✅ GB 19594-2015 §5.1.3 |
| Lisibilité d'un motif plan (cœur, anneau, smiley) | ~29 % des tirs à moins de 45° de la face ; ~7 % « lisibles et à l'endroit » pour un cœur | idem (même physique) | 🧮 |

**À retenir pour le moteur :**
1. Ne pas réutiliser telles quelles les tables japonaises par numéro. Un « 6 pouces » chinois (152 mm) correspond à un 5 gō japonais, pas à un 6 gō.
2. À mortier égal, une bombe chinoise standard éclate un peu plus bas que dans les tables japonaises commerciales : environ −15 à −25 % sur la hauteur et **−25 à −35 % sur le diamètre**. Par exemple, un 150 mm chinois monte à ~155 m pour une fleur de ~120 m, contre ~190 m et ~170 m pour un 5 gō. L'écart avec les diamètres de conception de Shimizu est plus faible (≈ 0 à −20 % : 5" 100 contre 100 m, 6" 120 contre 130 m, 8" 160 contre 200 m). 🧮
3. Il faut plus de variabilité : sur la hauteur, sur l'avance ou le retard de l'éclatement par rapport à l'apogée, sur l'ovalisation de la fleur, et quelques étoiles éteintes.

---

## 1. Contexte industriel (ce que les pros tirent réellement)

- ✅ **Liuyang** (Hunan) fait environ 60 % de la production chinoise et environ 70 % des exportations chinoises de feux d'artifice. L'article Wikipedia porte toutefois des bandeaux « sources à améliorer ». https://en.wikipedia.org/wiki/Liuyang_fireworks
- ✅ Plus de 98 % des feux importés aux États-Unis étaient fabriqués en Chine (statistiques ITC 2009, citées par la CPSC). https://www.cpsc.gov/s3fs-public/2009fwreport.PDF
- 🟡 Au Japon même, selon le titre d'un article de Toyo Keizai, la majorité des feux tirés et des feux à main est de fabrication chinoise. Le corps de l'article (payant) précise que le 10 gō (尺玉) de qualité reste un domaine où le Japon est sans rival. https://toyokeizai.net/articles/-/231132
- 🟡 Marutamaya (Japon) explique que les fabricants japonais ne peuvent pas rivaliser avec les prix chinois à l'export. https://tokyoamericanclub.org/index.php/en/intouch-magazine/item/230-spectacles-in-the-sky
- Normes chinoises applicables :
  - **GB 19594-2004**, puis **GB 19594-2015** « 烟花爆竹 礼花弹 » (bombes de spectacle). Elle est consolidée dans **GB 10631-2025**, en vigueur depuis le 1er mai 2026 (selon Baidu Baike ⚠️ ; la consolidation des valeurs n'a pas été vérifiée).
  - **GB 24284-2009**, règles techniques de sécurité des grands spectacles pyrotechniques.
- En Europe, les bombes sont certifiées **F4** selon **EN 16261-1…4**. EN 16261-2 (exigences) date de 2021 et un prEN 16261 est en révision en 2025–26, avec une méthode d'essai « angle de montée et hauteur d'éclatement » au §8.3.4. Je n'ai pas eu accès aux valeurs limites. ⚠️ https://standardsdevelopment.elot.gr/drafts/13901

---

## 2. Construction des bombes chinoises : ce qui change visuellement

### 2.1 Forme : sphérique ou cylindrique
- ✅ GB 19594 définit deux formes de corps de bombe : **球型 (sphérique)** et **圆柱型 (cylindrique)**. Depuis 2015, les cylindriques sont limitées au **6# (152 mm)**, les « bouquets » (花束) au **5#**, les bombes à bruit (雷弹) au **3#** et les bombes aquatiques au **6#**. http://www.xpyanhuo.com/cn/Knowledge/show-635.html (texte intégral de GB 19594-2015)
  → Le gros calibre chinois (≥ 7") est **toujours sphérique**. Les cylindriques chinoises sont des 3–6", souvent à plusieurs éclatements.
- 🟡 Fabricant de Liuyang : la bombe sphérique donne une fleur « ronde, identique sous tous les angles ». La cylindrique est « un peu moins ronde, parfois ovale ou en croix molle », mais permet d'empiler 2 à 5 éclatements ou plus, chacun plus haut que le précédent. La Chine produit « l'écrasante majorité » des bombes sphériques tirées dans le monde. https://www.liuyangfireworks.net/blog/ball-shell-vs-cylinder-shell-fireworks.html
- 🟡 Brevet US (contexte) : les amateurs préfèrent les bombes sphériques, réputées plus symétriques. Les cylindriques sont plus faciles à produire et plus bruyantes. https://patents.google.com/patent/US10337842
- 🟡 Forums (calibre consommateur de 1,75", chinois) : les cylindres donnent des éclatements « grands mais brouillons, très bruyants », les sphériques une « belle fleur ronde ». https://www.pyrotalk.com/bulletin/archive/index.php/t-5641.html
- 🟡 mr-motegi (Japon) : les bombes cylindriques occidentales « ne se dispersent pas dans toutes les directions » et ne s'ouvrent pas en sphère parfaite. https://www.mr-motegi.jp/eng/fireworks/guide/guide.html

**Modèle conseillé** 🧮 :
- **Sphérique chinoise** : sphère avec une légère anisotropie, par exemple un ellipsoïde de rapport d'axes 1,0–1,15 dans une orientation aléatoire. Ajouter un bruit angulaire sur la direction de chaque étoile, plus fort que pour une warimono (voir §5).
- **Cylindrique** : distribution renforcée dans le plan équatorial du cylindre et plus pauvre aux pôles, soit un tore épais ou une sphère aplatie de rapport ~1,3–1,6, sur un axe aléatoire puisque la bombe culbute. ⚠️ Ce rapport n'est pas mesuré.

### 2.2 Enveloppe et confinement
- ✅ GB 19594-2015 §5.6.3 : « le corps de la bombe ne doit pas utiliser de plastique ni d'autres matériaux durs ». Les bombes de spectacle chinoises conformes sont donc **en papier**. §5.3.2 : « papier collé fermement, sans délaminage ni bulles ».
- 🟡 Hémisphères en papier moulé, contre-collés de **6 à 10 couches de kraft** à joints croisés selon un fabricant de Liuyang. Les copies bon marché sautent des couches et laissent des joints droits, qui peuvent fuir sous pression. https://www.liuyangfireworks.net/blog/liuyang-professional-aerial-shells.html
- 🟡 Forum APC : les hémisphères chinois en carton paille sont épais, donc avec moins de couches de contre-collage. Les japonais sont plus minces et plus petits, ce qui permet plus de couches. Les bombes de concours visent l'enveloppe la plus fine et la plus régulière possible, avec beaucoup de petits points de rupture, ce qui donne une rupture uniforme. https://www.amateurpyro.com/forums/topic/4873-japanese-shellmaking/ (accès 403, résumé via moteur de recherche ⚠️)
- Les bombes **en plastique** (hémisphères) existent surtout en **produit consommateur** (1.4G, 1,75"–2,5") et en kits amateurs, pas dans le F4 chinois conforme à GB. ⚠️

**Conséquence physique** (cf. 01 §1 : plus l'enveloppe est résistante et régulière, plus les étoiles partent vite et de façon homogène) 🧮 :
- Une enveloppe plus épaisse mais moins régulière donne des points de rupture préférentiels.
- Il en résulte une **fleur plus petite et moins régulière** qu'une warimono de concours à diamètre égal.
- On voit aussi plus souvent un « trou » ou une fleur décentrée.

### 2.3 Charge d'éclatement et chargement des étoiles
- ✅ GB 19594-2004 §5.4.1 : la charge d'ouverture (绽放药, « 开球药 ») doit être enrobée sur un **support léger (balle de riz, graines de coton…)**. C'est le même principe que la warimono japonaise, donc **pas de différence de nature**. Les écarts viennent de la régularité du chargement et du confinement.
- ✅ GB 19594 §5.6.4 : le contenu doit être « chargé serré » (装填紧密).
- 🟡 Liuyang : étoiles « en couches régulières autour de la charge centrale », en une ou plusieurs couches concentriques (pistil). Pour les motifs, les étoiles sont posées sur un disque interne. https://www.liuyangfireworks.net/blog/liuyang-professional-aerial-shells.html
- ✅ Brevet chinois CN104180722A (anneaux 3D) : il décrit les étoiles (亮珠) comme des **granulés sphériques**, c'est-à-dire des étoiles roulées. Il constate que dans les bombes ordinaires, la position des étoiles est aléatoire et la forme de la fleur incertaine. https://patents.google.com/patent/CN104180722A/zh
- ⚠️ D'après la pratique (non chiffré, pas de source primaire trouvée) :
  - Dans les sphériques chinoises de spectacle, on trouve surtout des **étoiles roulées**, parfois mélangées à des étoiles **coupées ou pressées**.
  - Le calibrage des étoiles est moins serré qu'au Japon : σ du diamètre supérieur aux 2 % mesurés par Ooki pour Sunaga.
  - Les **cylindriques et les compacts** utilisent beaucoup d'étoiles **pressées ou coupées**.
  - Forum Montréal (2004, anecdotique) : « moins d'étoiles, fleur plus petite, combustion plus rapide, couleurs ternes ». https://montreal-fireworks.com/forum/msg.php?id=1402

**Paramètres conseillés** 🧮/⚠️ :
- Nombre d'étoiles : la règle géométrique à une couche de 01 §2.6 reste valable pour une sphérique chinoise de bonne qualité. Avec des étoiles un peu plus petites, compter **~0,8–1,2 fois** le nombre japonais au même diamètre intérieur. Pour l'entrée de gamme, ~0,6–0,9 fois.
- Taille des étoiles : 75 mm ≈ 9–11 mm · 100 mm ≈ 11–13 mm · 125 mm ≈ 12–15 mm · 150 mm ≈ 14–17 mm · 200 mm ≈ 17–21 mm. C'est une extrapolation des étoiles japonaises de 02, à mortier égal. ⚠️
- Dispersion du diamètre des étoiles : σ ≈ 4–6 % (contre 2 % au Japon), et du temps de combustion : σ ≈ 8–12 % (contre 5 %). ⚠️ C'est une hypothèse de travail, non mesurée.

### 2.4 Diamètre réel des bombes (tableau 2 de GB 19594-2015) ✅

| Numéro | Mortier (mm) | Ø bombe (mm) | Tolérance (mm) |
|---|---|---|---|
| 3# | 76,2 | 72 | +2 / −5 |
| 4# | 101,6 | 97 | +2 / −5 |
| 5# | 127 | 122 | +3 / −6 |
| 6# | 152,4 | 147 | +3 / −8 |
| 7# | 177,8 | 172 | +3 / −10 |
| 8# | 203,2 | 196 | +4 / −10 |
| 10# | 254 | 246 | +4 / −12 |
| 12# | 304,8 | 296 | +6 / −12 |

Source : image du tableau 2 de GB 19594-2015 sur xpyanhuo.com. La version 2004 donnait les mêmes diamètres, avec 395 mm pour un 16#.
→ La tolérance est **asymétrique et assez large** : jusqu'à −8 mm sur un 6". Le jeu dans le mortier varie d'autant, ce qui contribue à la dispersion de la vitesse de sortie (cf. 01 : « jeu dans le mortier » parmi les causes citées par Shimizu). 🧮

**Correspondance avec le Japon** ✅ : 3 gō ≈ 9 cm, 4 gō ≈ 12 cm, 5 gō ≈ 15 cm, 6 gō ≈ 18 cm, 8 gō ≈ 24 cm, 10 gō ≈ 30 cm (bombe de ~28,5 cm). https://www.pricey.jp/web/articles/2131
Un « 4 pouces » chinois (97 mm) est donc plus petit qu'un 4 gō (~115–120 mm). À **mortier égal** : 75 mm chinois ≈ 2,5 gō ; 100 mm ≈ 3 à 3,5 gō ; 150 mm ≈ 5 gō ; 200 mm ≈ 7 gō ; 300 mm ≈ 10 gō.

---

## 3. Chiffres par calibre

### 3.1 Valeurs officielles chinoises ✅

**GB 24284-2009, annexe A, tableau A.1 « paramètres de sécurité de base des bombes »** (informatif). Fichier PDF : http://www.lnsyhbz.com/userfiles/files/%E5%A4%A7%E5%9E%8B%E7%84%B0%E7%81%AB%E7%87%83%E6%94%BE%E5%AE%89%E5%85%A8%E6%8A%80%E6%9C%AF%E8%A7%84%E7%A8%8B.pdf

| Calibre | 76 (3#) | 102 (4#) | 127 (5#) | 152 (6#) | 178 (7#) | 203 (8#) | 254 (10#) | 305 (12#) |
|---|---|---|---|---|---|---|---|---|
| Hauteur de montée (m) | 90–100 | 110–120 | 130–140 | 150–160 | 170–180 | 190–200 | 210–230 | 240–260 |
| Rayon de couverture (m) | 25–30 | 35–40 | 45–55 | 55–65 | 65–75 | 75–85 | 85–95 | 95–105 |
| → Ø de fleur (m) 🧮 | 50–60 | 70–80 | 90–110 | 110–130 | 130–150 | 150–170 | 170–190 | 190–210 |
| Ø / hauteur 🧮 | 0,58 | 0,65 | 0,74 | 0,77 | 0,80 | 0,82 | 0,82 | 0,80 |

**GB 19594-2015, tableau 4 « hauteur d'éclatement »** (exigence normative, en m) :

| Numéro | 3 | 4 | 5 | 6 | 7 | 8 | 10 | 12 |
|---|---|---|---|---|---|---|---|---|
| Hauteur minimale | 50 | 60 | 80 | 100 | 110 | 130 | 140 | 160 |
| Hauteur maximale | 120 | 140 | 190 | 220 | 240 | 260 | 280 | 300 |
| Portée max. d'un bouquet | 35 | 40 | 45 | — | — | — | — | — |

Exigences associées :
- §5.7.4 : **« le diamètre de rayonnement de l'éclatement ne doit pas dépasser la hauteur d'éclatement »**.
- §5.2.1.1 : le marquage doit indiquer la **hauteur de tir, le rayon de rayonnement et la « hauteur d'extinction des flammes »** (火焰熄火高度).
- La version 2004 prévoyait des hauteurs minimales de 50/60/80/100/140/160/200/250/280 m (3# à 16#) et un maximum de 500 m. Elle imposait aussi qu'aucun résidu ne brûle encore **sous 10 m** (défaut « 火险 »).
Sources : http://www.xpyanhuo.com/cn/Knowledge/show-635.html et http://zghpw.com/Showinfo.asp?InfoId=3999&fs=12

### 3.2 Valeurs de catalogues et de dossiers en Europe 🟡

| Source | Calibre | Hauteur | Durée / diamètre |
|---|---|---|---|
| Fiche F4 grecque (CE 1170-F4-02057), « Red heart » 4" | 100 mm | 176 m (« max., dépend de la météo ») | effet 2 s ±20 % |
| Fiche F4 (CE 1170-F4-02058), « Blue peony brocade crown, green pistil » 5" | 125 mm | jusqu'à 210 m | effet 2,5 s ±20 % |
| Liste de tir néerlandaise (importateur Vulcan, F4) | 3" | « ± 75 m » d'effet max. | distance du public 165 m |
| idem | 4" | « ± 100 m » | distance du public 200 m |
| idem (autre liste) | ≤ 2,5" | « ± 65 m » | distance du public 120 m |

Sources :
- https://www.alphastar.gr/fireworks/display-shells/shell-004.144.008/ et https://www.alphastar.gr/fireworks/display-shells/shell-004.145.006/
- https://repository.officiele-overheidspublicaties.nl/Bijlagen/TerInzageLegging/2021/til-2021-1127/1/bijlage/82830886_6729959_Schietlijst.pdf et https://repository.officiele-overheidspublicaties.nl/Bijlagen/TerInzageLegging/2024/til-2024-23848/1/bijlage/100387576_10032940_Schietlijst_(1).pdf

Lecture : les hauteurs des fiches CE sont des **maxima d'homologation**, proches du haut de la plage GB. Les « ± 75 / 100 m » des listes de tir néerlandaises sont des valeurs de planification réalistes et prudentes. Le **nominal réel se situe entre les deux**, cohérent avec GB 24284 (90–100 m pour un 3", 110–120 m pour un 4").

**Blog fabricant (Liuyang, marketing, chiffres optimistes et parfois contradictoires)** 🟡⚠️ : apogée / diamètre de fleur de 60–90 / 40–60 m (3"), 90–120 / 60–90 (4"), 120–160 / 90–120 (5"), 160–190 / 120–150 (6"), 200–240 / 160–200 (8"), 250–290 / 210–260 (10"), 290–320 / 260–310 m (12"). https://www.liuyangfireworks.net/blog/liuyang-professional-aerial-shells.html

**Règles anglo-saxonnes** (rappel de 01) 🟡 : hauteur ≈ 120 ft par pouce (≈ 1,44 m/mm), diamètre ≈ 90 ft par pouce (≈ 1,08 m/mm). Poulton & Kosanke, https://www.fireengineering.com/firefighting/fireworks-and-their-hazards/
Wharton (HSL, 1995), sur des données de la littérature : ≈ **1,4 m de hauteur par mm** de diamètre. Pour des bombes chinoises standard, c'est clairement **trop haut** : GB donne ≈ 1,0–1,25 m/mm.

### 3.3 Valeurs recommandées pour le simulateur (bombe sphérique chinoise standard) 🧮

| Calibre | Hauteur nominale (σ) | Ø fleur pivoine | Ø fleur saule / couronne | Durée visible pivoine | Durée saule / couronne |
|---|---|---|---|---|---|
| 75 mm | 95 m (σ 12 %) | 50–60 m | 40–55 m | 1,5–2 s | 3–5 s |
| 100 mm | 115 m (σ 12 %) | 70–80 m | 60–75 m | 2 s | 4–6 s |
| 125 mm | 135 m (σ 12 %) | 90–105 m | 80–95 m | 2–2,5 s | 4–6 s |
| 150 mm | 155 m (σ 12 %) | 110–125 m | 95–115 m | 2,5–3 s | 5–7 s |
| 200 mm | 195 m (σ 10 %) | 145–165 m | 130–150 m | 3–3,5 s | 6–8 s |

- Les hauteurs et diamètres reprennent GB 24284. Les σ sont tirés de Wharton (§4).
- Les durées « pivoine » viennent des fiches CE et de Shimizu. Les durées « saule / couronne » s'appuient sur Shimizu (étoiles lentes de 7–8 s pour le grand calibre japonais), réduites pour des étoiles chinoises plus petites. ⚠️
- Rendre le diamètre du saule plus petit, car la charge est plus douce et les étoiles plus lourdes et freinées (voir §6), mais la **chute** plus longue.
- Bornes absolues à appliquer (norme) : hauteur dans [min, max] du tableau GB 19594-2015, et Ø ≤ hauteur.
- Temps de montée : réutiliser le modèle de traînée de 01. Retard de mèche de 3 à 6 s selon le calibre (Kosanke), soit ~3,5–4 s pour un 75 mm et ~5–5,5 s pour un 150–200 mm. 🧮

---

## 4. Régularité et défauts (qualité)

### 4.1 Dispersion mesurée de la hauteur ✅
Wharton, *Journal of Pyrotechnics* n°1 (1995), tableau 1 : bombes **sphériques du commerce** (marché britannique, origine non précisée ⚠️), trois tirs chacune. https://www.jpyro.co.uk/wp-content/uploads/j01_01_h3edr.pdf

| Bombe | Hauteurs (m) | Moyenne | σ / moyenne 🧮 |
|---|---|---|---|
| 125 mm Green Peony | 129 / 190 / 175 | 165 | 19 % |
| 125 mm Purple Peony | 224 / 168 / 195 | 196 | 14 % |
| 125 mm Spanish White | 106 / 73 / 109 | 96 | 21 % |
| 100 mm Spanish White | 62 / 68 / 70 | 67 | 6 % |
| 100 mm Red Silk | 98 / 96 / 71 | 88 | 17 % |
| 100 mm Purple Peony | 146 / 132 / 152 | 143 | 7 % |
| 75 mm Spanish White | 68 / 62 / 76 | 69 | 10 % |
| 75 mm Purple Peony | 121 / 94 / 118 | 111 | 13 % |

Observations :
- La dispersion **intra-référence** va de 6 à 21 % (médiane ~14 %).
- L'écart **entre références** du même calibre est encore plus grand. Pour un 100 mm, les moyennes vont de 67 à 143 m, soit un facteur 2. Le type d'effet et le fabricant comptent autant que le calibre. Wharton note que les bombes « blanches » combinent une chasse élevée et un éclatement bas.
- Kosanke : sur 8 tirs de bombes de 255 mm, l'éclatement le plus haut est à 422 m et le plus bas à 206 m (cité par Wharton).
→ **Simulateur** : tirer une hauteur ~ N(nominal × f_réf, σ = 10–15 %), avec un facteur f_réf ∈ [0,7 ; 1,3] fixé une fois par référence de produit. Pour une gamme « économique », σ = 15–20 %. 🧮

### 4.2 Défauts définis par la norme chinoise ✅
GB 19594-2004 et 2015 classent comme **défauts critiques** :
- explosion dans le mortier (膛炸) ;
- éclatement à la bouche (筒口炸) ;
- éclatement bas (低炸 : n'atteint pas la hauteur d'éclatement) ;
- bombe noire (哑弹 : monte sans que la charge s'allume) ;
- détonation par sympathie ;
- résidus encore enflammés sous 10 m (火险) ;
- raté de la chasse (瞎火).

**Taux d'allumage des étoiles** (烧成率) : **≥ 98 %**, et **≥ 96 % pour les parachutes**. Jusqu'à 2 % d'étoiles qui ne s'allument pas restent donc conformes.
La mèche d'allumage manuelle doit brûler 6 à 12 s, ce qui ne concerne pas le tir électrique.
→ **Simulateur** : prévoir 0–2 % d'étoiles mortes par défaut, jusqu'à 3–5 % pour une bombe de mauvaise qualité. Elles sont éjectées mais ne brillent pas, ou s'éteignent tôt. 🧮

### 4.3 Données de conformité (contexte, produits consommateurs chinois) ✅
- CPSC (États-Unis), contrôles ciblés à l'importation : environ **46 % (2007), 49 % (2008), 38 % (2009) et 33 % (2013)** des envois contrôlés contenaient des produits non conformes. Les défauts portent surtout sur la mèche et la surcharge, pas sur le visuel. Le taux de conformité des lots testés était de 59 % en 2005, contre 83 % pour les produits certifiés AFSL. https://www.cpsc.gov/s3fs-public/2013FireworksReport_1.pdf ; https://www.govinfo.gov/content/pkg/FR-2006-07-12/pdf/E6-10881.pdf
- Pyrocommunity, à propos de la reclassification des bombes : beaucoup de produits supposés conformes ne passent pas les essais quand on les fait réellement. 🟡 https://www.pyrocommunity.com/threads/china-reclassification-of-shells.437/
- Indicateurs de qualité selon le fabricant 🟡 :
  - étoiles groupées d'un côté = chargement mal réparti ;
  - rouges rosâtres ou bleus blanchissants = oxydants bas de gamme ou contamination ;
  - hauteurs différentes pour une même référence = mèches mal calibrées. https://www.liuyangfireworks.net/blog/liuyang-professional-aerial-shells.html

### 4.4 Taux de défauts à utiliser (aucune statistique publiée trouvée) ⚠️ 🧮

| Défaut | Gamme pro (fournisseur sérieux) | Gamme économique |
|---|---|---|
| Bombe noire (monte, n'éclate pas) | 0,1–0,3 % | 0,5–1 % |
| Éclatement bas (< 60 % de la hauteur nominale) | 0,2–0,5 % | 1–2 % |
| Éclatement à la bouche ou dans le mortier | < 0,05 % | 0,1 % |
| Fleur nettement asymétrique (trou, demi-fleur) | 2–5 % | 5–15 % |
| Avance ou retard d'éclatement par rapport à l'apogée | σ ≈ 0,2–0,3 s | σ ≈ 0,4–0,6 s |

L'avance ou le retard d'éclatement se déduit de la dispersion de hauteur (σ 12 % pour une vitesse verticale qui tend vers 0) et d'une mèche chinoise dont la vitesse varie d'un lot à l'autre et même dans un rouleau (Skylighter : « ~2–3 s par pouce, variable », https://www.skylighter.com/products/canon-fuse-time-fuse-1-4-inch-chinese-10-feet).
Un éclatement 1 s avant l'apogée ajoute ~10–20 m/s vers le haut à toutes les étoiles (cf. 01 §2.5), ce qui donne une **fleur en « œuf » décalée vers le haut**.

---

## 5. Symétrie de la fleur : modèle comparé 🧮

| Source d'irrégularité | Warimono japonaise | Sphérique chinoise standard | Cylindrique chinoise |
|---|---|---|---|
| Bruit sur la direction de chaque étoile (σ angulaire) | 2–4° | 5–8° | 8–15° |
| Dispersion des vitesses d'éjection (σ/moyenne) | ~5 % | ~10 % | ~15 % |
| Anisotropie globale (rapport d'axes) | 1,00–1,05 | 1,0–1,15 | 1,3–1,6 (aplatie selon l'axe) |
| Probabilité d'un « trou » (secteur vide de 30–60°) | < 1 % | 2–5 % | 5–10 % |

Toutes ces valeurs sont estimées ⚠️. Elles reprennent les qualificatifs des sources : « parfaite » pour la japonaise, « ronde mais moins précise » pour la chinoise, « brouillonne, ovale ou en croix molle » pour la cylindrique (§2.1). Elles sont à caler à l'œil sur vidéo.

---

## 6. Puissance d'éclatement selon l'effet (qualitatif, physique observable)

- **Pivoine, chrysanthème (牡丹 / 菊花)** : ouverture **forte**, étoiles rapides. Fleur sphérique pleine. Le chrysanthème laisse une traînée (« 火焰曳拖尾 »), la pivoine donne des « points sans traînée ». ✅ Annexe A de GB 19594-2015 ; https://www.liuyangfireworks.net/blog/peony-vs-chrysanthemum-shell-fireworks.html
- **Couronne, saule, kamuro (垂冠 « couronne tombante »)** : GB le définit comme un effet qui « retombe du haut en forme de saule pleureur ». Il faut des étoiles **lentes et lourdes** (charbon, pailleté or ou argent). L'ouverture est plus **douce**, la fleur un peu plus petite, la **chute** longue. ✅ définition ; ⚠️ puissance relative.
  - « Crown » et « brocade crown » sont, dans les catalogues chinois, l'équivalent du kamuro or. Le blog Liuyang précise que brocade et kamuro ne sont **pas** synonymes : le kamuro est plus dense et plus pailleté. 🟡
  - Pour le simulateur : vitesse d'éjection ×0,6–0,8 par rapport à une pivoine du même calibre, Cx élevé, combustion de 4 à 8 s, traînée d'étincelles persistantes. 🧮
- **Feuilles mortes (飘浮型 « flottant », falling leaves)** : GB définit les objets en **papier ou en soie** qui « flottent dans l'air ».
  - Visuellement, ce sont des fragments plats qui tombent lentement en voltigeant et en scintillant, sans parachute, et qui dérivent beaucoup avec le vent.
  - Ouverture très douce. Vitesse de chute de ~1–3 m/s et forte sensibilité au vent ⚠️ (estimation, aucune mesure trouvée).
  - Sources : https://www.funtrivia.com/quiz/world/official-names-of-july-4th-pyrotechnic-effects-424726.html (« stars that twinkle and flutter down »), https://montreal-fireworks.com/forum/msg.php?id=8198
- **Crossette** : grosses étoiles qui parcourent une courte distance puis se divisent, souvent en 4, en dessinant des croix. Prévoir une division après ~0,3–0,8 s ⚠️. https://fireworks.com/safety/glossary
- **Motifs (图案型 : cœur, anneau, smiley, papillon…)** : étoiles posées **dans un plan**, sur un disque ou des anneaux de papier internes. L'ouverture est assez douce pour conserver la forme. ✅ CN104180722A ; Liuyang.
  - **L'orientation est aléatoire.** La bombe culbute et tourne sur plusieurs axes pendant la montée. Le brevet chinois CN103115529B explique que les bombes à motif « ne peuvent pas être présentées de façon fiable au public » à cause des déviations et des rotations aérodynamiques, et que les solutions antérieures (empennages, guidages) ont échoué. ✅ https://patents.google.com/patent/CN103115529B/zh
  - Inside Science / Grucci : un smiley vu par la tranche n'est qu'une **ligne droite** ; les cœurs apparaissent souvent à l'envers. ✅ https://www.aip.org/inside-science/firework-shapes-smiley-faces-hearts-and-stars-oh-my
  - **Calcul de lisibilité** 🧮, pour une normale au plan uniformément aléatoire sur la sphère :
    - P(angle entre la normale et la ligne de visée ≤ θ) = 1 − cos θ, soit **29 % à 45°**, **50 % à 60°** et 13 % à 30°.
    - Pour un motif qui doit aussi être « à l'endroit » (cœur, smiley, lettre) avec une rotation aléatoire dans le plan : × ~25 % (±45°), ce qui fait **~7 %** de cœurs « parfaits ». Un anneau (invariant par rotation) n'est concerné que par le premier facteur.
  - Les fabricants chinois compensent avec des **motifs multiples ou 3D**, comme le « six anneaux 3D » de CN104180722A. La règle de métier est de tirer les motifs **par groupes de 3 à 5** pour qu'au moins un soit lisible. 🟡
- **Plusieurs éclatements** : cylindriques chinoises de 2 à 5 éclatements ou plus, reliés par mèche. Chaque éclatement est plus haut que le précédent, avec souvent des changements de couleur entre eux. Chaque fleur est **plus petite** qu'une fleur unique du même calibre. ✅/🟡 Liuyang ; forum (« les cylindres à 3 éclatements ou plus ont des effets plus petits »).
- **Bombe-mère avec sous-bombes** (子母弹, « thousands of… », « flower cluster », proche du senrin) : défini dans GB comme une bombe contenant plusieurs petites bombes. Les sous-bombes s'ouvrent en grappe après un court délai. ✅ définition.
- **Effets pendant la montée** (带物上升型 : « rising tail », « rising flowers », « whistle ») : GB les définit comme des effets « qui accompagnent la montée : petites fleurs, sifflet, colonne lumineuse ». Ils sont **très fréquents dans les intitulés de catalogues chinois**, par exemple « Gold rising tail to red peony ». ✅
  → Le simulateur doit gérer une traînée de montée et des petits éclatements sur la trajectoire.
- **Bouquet (花束)** : étoiles ou pétards projetés directement par la chasse, comme une comète ou une gerbe. Limité à 5#, portée de 35 à 45 m. ✅
- **Compacts (cakes)** 🟡, ordres de grandeur du fabricant pour les tubes consommateurs à semi-pro :
  - tubes de 15 à 30 mm, de 9 à plus de 500 coups, de 15 à 120 s ;
  - éclatement à 15–60 m, fleurs de 5–15 m (25–60 m dans la FAQ, page incohérente) ;
  - délais entre tubes de 50 ms à quelques secondes.
  https://www.liuyangfireworks.net/blog/cake-vs-shell-fireworks-difference.html
  - Les listes de tir néerlandaises donnent une hauteur d'effet de ±30 m pour les compacts F2 (< 1") et jusqu'à 90 m pour les chandelles pro.

---

## 7. Glossaire des effets « chinois » (descriptions physiques)

| Nom de catalogue (EN / CN) | Description physique pour le rendu | Fiabilité |
|---|---|---|
| Peony / 牡丹 | Sphère de points colorés **sans traînée** | ✅ GB, Wikipedia |
| Chrysanthemum / 菊花 | Sphère d'étoiles **à traînée** d'étincelles | ✅ |
| Dahlia | Pivoine à **peu d'étoiles grosses** qui vont plus loin | ✅ |
| Pistil / 带芯 | Sphère intérieure d'une **autre couleur** | ✅ GB |
| Color changing / 变色 | Étoiles qui changent de couleur, une ou plusieurs fois | ✅ GB |
| Willow / 垂冠 (crown) | Étoiles longues, or ou argent, qui **retombent** en saule pleureur, parfois presque jusqu'au sol | ✅ |
| Kamuro / crown / brocade crown | Fleur **dense** pailletée or ou argent, longue traînée scintillante | ✅/🟡 |
| Brocade | Traînées pailletées or plus fines que le kamuro, souvent mêlées à des pivoines colorées (« blue peony brocade crown ») | 🟡 |
| Palm / coconut tree / 椰树 | Quelques **grosses comètes** à traînée épaisse (palmes) et une traînée de montée (le tronc). « Coconut » : variante à palmes plus tombantes, ou avec un éclatement intérieur | ✅/🟡 |
| Crossette | Grosses étoiles qui se **divisent en 4** après un court trajet, en motif en croix | ✅ |
| Glitter / twinkling / flitter | Traînée d'étincelles **qui s'allument avec un retard** (pailletée) ; « twinkling » = scintillement intermittent | ✅/🟡 (voir 04) |
| Strobe | Étoile à **éclairs** répétés, marche/arrêt de quelques Hz à environ 10 Hz | ✅ (fréquence : voir 04) |
| Crackling / dragon eggs / 爆裂 | Étoiles qui **crépitent** en petites détonations ; « dragon eggs » = grappes de crépitements retardés | ✅ GB / 🟡 |
| Falling leaves / 飘浮 | Fragments plats lumineux qui **voltigent** lentement et dérivent | ✅ GB / 🟡 |
| Fish / swimming / flying fish | Nombreux petits éléments autopropulsés qui **filent en serpentant** depuis le centre | ✅ |
| Ring / Saturn / heart / smiley / 图案 | Étoiles dans **un plan**, orientation aléatoire (§6) ; Saturn = anneau autour d'une sphère | ✅ |
| Time rain | Grosses étoiles lentes à **grosses étincelles pailletées** et grésillement, libérées progressivement (contrairement au brocade) | ✅ |
| Horsetail / waterfall | Étoiles lourdes à traînée, **éclatement faible** : elles tombent en panache étroit (cascade) | ✅ |
| Spider | Étoiles rapides à traînée, trajectoires **rectilignes et plates** | ✅ |
| Wave (strobe wave, chrysanthemum wave) | Libellé courant dans les catalogues chinois, sens non normalisé : effet en vagues ou ondulant, souvent à strobes | ⚠️ |
| Ghost | Libellé chinois courant : changement de couleur avec une **phase sombre** ou transparente | ⚠️ |
| Thousands of… / flower clusters / 子母弹 | Nombreuses petites sous-bombes qui s'ouvrent en grappe | ✅ (déf.) |
| Rising tail / rising flowers / whistle | Traînée, petites fleurs ou sifflement **pendant la montée** | ✅ GB |

Sources : glossaire fireworks.com https://fireworks.com/safety/glossary ; Wikipedia https://en.wikipedia.org/wiki/Fireworks ; glossaire montreal-fireworks https://montreal-fireworks.com/pyro_glossary.html ; annexe A de GB 19594-2015.
Exemples réels de libellés de catalogues F4 : « Chrysanthemum to red to silver », « Strobe chrysanthemum wave to red peony », « Blue peony brocade crown with green pistil », « Crown chrysanthemum to silver with silver crackling and silver tail », « Red wave crossette », « Golden palm tree with thousands of red peony ». https://www.alphastar.gr/fireworks/display-shells/
→ La grammaire est « effet A **to** effet B (couleur) **with** pistil / traînée / crépitement ». Elle se décompose bien en paramètres de simulation : couches successives des étoiles, pistil, traînée de montée.

---

## 8. Couleurs : chinoises ou japonaises (qualitatif)

- ⚠️ **Je n'ai trouvé aucune comparaison spectrométrique publiée** entre étoiles chinoises et japonaises du commerce.
- 🟡 Selon le fabricant de Liuyang lui-même, les défauts de couleur typiques sont des **rouges rosâtres** et des **bleus qui blanchissent** (oxydants bon marché, contamination). La couleur doit tenir jusqu'à l'extinction.
- ⚠️ Forum (2004) : couleurs « ternes », avec beaucoup de rouge et de vert dans les spectacles de produit chinois.
- ✅ Le bleu reste la couleur la plus difficile pour tout le monde. Peu de compositions bleues allient pureté et intensité, alors qu'il en existe pour le rouge, le vert et le jaune (étude PEP 2020 sur des compositions bleues de laboratoire). https://epub.ub.uni-muenchen.de/75968/1/prep.202000114.pdf
- ✅ Japon : réputation pour les **changements de couleur multiples et synchronisés** et les couches concentriques (mr-motegi).
- **Modèle conseillé** 🧮⚠️ (voir 03 pour les chromaticités) :
  - **Saturation** : chinois standard ≈ 0,85–0,95 fois la japonaise pour le rouge et le vert, ≈ 0,7–0,85 pour le bleu (bleu plus pâle, qui tire vers le blanc-violet en fin de combustion).
  - **Changements de couleur** : dispersion du moment de bascule entre étoiles σ ≈ 0,1–0,2 s, contre ~0,05 s pour une warimono, ce qui donne une transition « en vague » et non nette.
  - Une partie des étoiles finit plus tôt (dispersion du temps de combustion de ~10 %, contre 5 %).
  - Les produits haut de gamme récents se rapprochent du japonais : prévoir un curseur « qualité fournisseur ».

---

## 9. Résumé : paramètres « profil chinois standard » ou « profil japonais » 🧮

```
profil_chinois_standard:
  calibre_mortier_mm: [76, 102, 127, 152, 178, 203, 254, 305]
  ø_bombe_mm:         [72, 97, 122, 147, 172, 196, 246, 296]          # GB 19594 t.2
  hauteur_nominale_m: [95, 115, 135, 155, 175, 195, 220, 250]         # GB 24284 A.1
  hauteur_bornes_m:   [[50,120],[60,140],[80,190],[100,220],[110,240],[130,260],[140,280],[160,300]]  # GB 19594-2015 t.4
  ø_fleur_pivoine_m:  [55, 75, 100, 120, 140, 160, 180, 200]          # GB 24284 A.1 (2× rayon)
  contrainte: ø_fleur <= hauteur_eclatement
  sigma_hauteur: 0.12 (gamme pro) | 0.18 (économique)                 # Wharton 1995
  facteur_reference: U(0.7, 1.3), tiré une fois par référence produit
  sigma_avance_eclatement_s: 0.25 | 0.5
  bruit_direction_etoile_deg: 6 (sphérique) | 12 (cylindrique)
  sigma_vitesse_ejection: 0.10 | 0.15
  anisotropie: 1.0–1.15 (sphérique) | 1.3–1.6 aplatie (cylindrique)
  etoiles_mortes: 0–2 % (norme ≥ 98 % allumées) | 3–5 %
  bombe_noire: 0.2 % | 0.7 % ; eclatement_bas: 0.3 % | 1.5 %
  duree_pivoine_s: 4": 2.0±20 %, 5": 2.5±20 %                        # fiches CE F4
  saturation_bleu: ×0.75 ; sigma_bascule_couleur_s: 0.15
  motif_plan: orientation uniforme sur la sphère (lisible à 45° : 29 %)
```

---

## Sources principales
- GB 19594-2015, texte et tableaux 2 et 4 (images) : http://www.xpyanhuo.com/cn/Knowledge/show-635.html
- GB 19594-2004 (texte) : http://zghpw.com/Showinfo.asp?InfoId=3999&fs=12 ; https://www.renrendoc.com/p-24343656.html
- GB 24284-2009, annexe A : http://www.lnsyhbz.com/userfiles/files/%E5%A4%A7%E5%9E%8B%E7%84%B0%E7%81%AB%E7%87%83%E6%94%BE%E5%AE%89%E5%85%A8%E6%8A%80%E6%9C%AF%E8%A7%84%E7%A8%8B.pdf
- Wharton R.K., « Observations on the Heights Attained by Spherical Firework Shells », J. Pyrotechnics 1 (1995) : https://www.jpyro.co.uk/wp-content/uploads/j01_01_h3edr.pdf
- Poulton & Kosanke, Fire Engineering : https://www.fireengineering.com/firefighting/fireworks-and-their-hazards/
- Table japonaise gō / hauteur / diamètre : https://www.pricey.jp/web/articles/2131
- Fiches F4 : https://www.alphastar.gr/fireworks/display-shells/
- Listes de tir néerlandaises (officielle-overheidspublicaties) : voir §3.2
- Blog d'un fabricant de Liuyang (marketing) : https://www.liuyangfireworks.net/blog/liuyang-professional-aerial-shells.html ; …/ball-shell-vs-cylinder-shell-fireworks.html ; …/peony-vs-chrysanthemum-shell-fireworks.html ; …/cake-vs-shell-fireworks-difference.html
- Brevets CN104180722A et CN103115529B (Google Patents)
- Inside Science (AIP), motifs : https://www.aip.org/inside-science/firework-shapes-smiley-faces-hearts-and-stars-oh-my
- CPSC, rapports annuels sur les feux d'artifice 2007–2013
- Liuyang, Wikipedia : https://en.wikipedia.org/wiki/Liuyang_fireworks

**Lacunes connues :**
- Valeurs limites d'EN 16261-2 pour la hauteur d'éclatement : non consultées (norme payante).
- Statistiques publiques de taux de défauts sur bombes F4 : introuvables.
- Nombre et taille mesurés des étoiles de bombes chinoises : introuvables.
- Comparaison colorimétrique chinoise / japonaise : introuvable.
