# 05 — Fumée, lumière et atmosphère dans un feu d'artifice (notes pour le simulateur)

Notes de recherche pour un rendu physiquement crédible. Rédigées pour un artificier professionnel.
Convention de fiabilité :
- **[SOURCÉ]** : chiffre ou fait tiré directement d'une publication ou d'une source identifiée (URL donnée).
- **[CALCUL]** : valeur calculée par moi à partir de principes physiques standard (Mie, Fresnel, Köhler, vitesse du son). Le calcul est reproductible, mais les hypothèses d'entrée sont indiquées.
- **[ESTIMATION]** : ordre de grandeur raisonné, non mesuré directement. À traiter comme un réglage artistique plausible, pas comme une vérité.

Limite volontaire : aucune formulation (pourcentages, rapports) ni procédé de fabrication. On parle uniquement des *produits* de combustion et de leurs effets visuels.

---

## 1. De quoi est faite la fumée

### 1.1 Nature chimique
- **Sels de potassium (le gros de la fumée blanche).** La poudre noire (charges de levée, charges d'éclatement, amorçage) produit de la fumée blanche composée principalement de nanoparticules de **K₂CO₃** et de **K₂SO₄** (et peut-être de K₂S). Le constituant dominant dépend de la teneur en soufre de la poudre (carbonate si elle est pauvre en soufre, sulfate si elle est riche). Le K₂CO₃ gazeux a été détecté en phase gaz par spectrométrie de masse. **[SOURCÉ]** Koshi, « Smoke generation in black powder combustion », *Sci. Tech. Energetic Materials* 79(3), 2018 : https://www.jes.or.jp/mag/stem/Vol.79/documents/Vol.79,No.3,p.59-69.pdf
- **Fraction solide des produits de la poudre noire.** Une mesure classique donne ≈ 56 % de produits solides (carbonate, sulfate, sulfure de potassium…) pour ≈ 43 % de gaz (CO₂, N₂, CO) et ≈ 1 % d'eau. Autrement dit, plus de la moitié de la masse brûlée devient du solide. Une partie retombe ou se dépose, et une partie forme la fumée. **[SOURCÉ, chiffre historique]** https://ectonhillfsa.org.uk/ALevelChemistry/ChemistryWorkshops/CW4_SS1_Chemistry_of_Black_Powder.pdf
- **Chlorures (KCl, et autres chlorures métalliques).** Les compositions colorées à oxydant chloré et à donneur de chlore produisent des chlorures (KCl, chlorures de Sr, Ba ou Cu, par exemple). Lors de feux d'artifice, les aérosols sont fortement enrichis en Cl⁻, K⁺ et Mg²⁺. **[SOURCÉ]** Manila, ACP 2021 : https://acp.copernicus.org/articles/21/6155/2021/acp-21-6155-2021.html
- **Oxydes métalliques.** Les combustibles métalliques donnent MgO et Al₂O₃ (fumée blanche très diffusante, très visible). Les étincelles donnent des oxydes de Ti et de Fe. Le panache de Montréal était enrichi en K, Al, Ti et Mg (Joly et al., *Atmos. Environ.* 44, 2010, 4325-4329, résumé ici : https://profbillanderson.com/2013/06/25/fireworks-and-air-quality/). **[SOURCÉ]**
- **Marqueurs de couleur.** À Milan, en 1 h : Sr ×120, Mg ×22, Ba ×12, K ×11, Cu ×6 (Sr est le meilleur traceur). À Manille : Cu ×65, Sr ×24, Ba ×18, K⁺ ×16, sulfate ×10. **[SOURCÉ]** Vecchi et al., *Atmos. Environ.* 42 (2008) 1121 : https://flore.unifi.it/bitstream/2158/326870/1/The%20impact%20of%20fireworks%20on%20airborne%20particles.pdf ; Manila : lien ACP ci-dessus.
  → Pour le rendu, ces résidus sont **incolores ou blancs**. La fumée ne garde pas la couleur de l'étoile : elle **diffuse** la lumière qu'elle reçoit (voir §5).
- **Carbone (charbon, liants, papier et carton des bombes).** À Milan, la part de PM10 attribuée aux feux d'artifice (jusqu'à 33,6 µg/m³, soit ≈ 50 % du PM10 total) contenait 2,8 µg/m³ de carbone élémentaire et 8,1 µg/m³ de carbone organique. Le carbone représente donc ≈ 1/3 de la masse attribuée aux feux. **[SOURCÉ]** Vecchi 2008.
  → C'est la composante **grise ou brunâtre**, absorbante. On la voit surtout dans la fumée de levée, de pots à feu et de déchets de carton brûlé. Les sels, eux, donnent une fumée blanche.
- **Composition ionique typique (Manille, nuit du Nouvel An 2019).** K⁺ et sulfate non marin représentent **70,9 %** de la masse hydrosoluble (K⁺ 30 %, sulfate 41 %). Cu, Sr, Ba, Al et Pb réunis ne font que 2,1 %. **[SOURCÉ]** ACP 2021.

### 1.2 Taille des particules
- **Formation par nucléation, à l'échelle de la milliseconde.** Le modèle de Koshi prédit une nucléation en phase gaz très rapide (constante de temps inférieure à la milliseconde) et un maximum de densité de particules en quelques ms, suivis de croissance par coagulation. Les particules de fumée ont des tailles « de l'ordre de la longueur d'onde visible » et des diamètres en général < 1 µm. La voie liquide (gouttelettes de sels fondus qui se fragmentent puis refroidissent) est plus lente et donne de plus grosses particules. **[SOURCÉ]** Koshi 2018 (les valeurs numériques exactes du PDF étaient illisibles à l'extraction, seuls les ordres de grandeur sont repris).
  → **Pour le rendu : la fumée apparaît instantanément** le long de la trajectoire de chaque étoile (« fantôme » du motif) et autour du point d'éclatement. Il n'y a pas de délai de formation visible.
- **Distribution en nombre, mesures dans l'air ambiant :**
  - Budapest (7 ans de feux de la Saint-Étienne) : un mode supplémentaire apparaît à **203 nm**. La concentration en nombre dans la gamme 100-1000 nm est multipliée par **20-25**. Le pic total atteint 369 000 cm⁻³ 5 min après la fin du feu, puis l'air revient à l'état initial en **≈ 45 min** au site de mesure. **[SOURCÉ]** https://pubmed.ncbi.nlm.nih.gov/37062402/
  - Taïwan (Yanshui) : mode d'accumulation principal à **180 nm**, mode Aitken secondaire à 63 nm. **[SOURCÉ]** https://aaqr.org/articles/aaqr-15-09-oa-0569
  - Varanasi (Diwali) : pic submicronique unique entre 80 et 130 nm. **[SOURCÉ]** https://link.springer.com/article/10.1007/s10661-019-7735-2
  - Milan : la plus forte hausse en nombre touche la classe **0,5-1 µm (×6,7 en 1 h)**, contre ×1,7 pour < 0,5 µm. Ensuite, entre le pic et 1h30 plus tard : −70 % pour 0,5-1 µm et −20 % pour < 0,5 µm. **[SOURCÉ]** Vecchi 2008.
  - Manille (impacteur MOUDI) : pendant l'événement, 87 % du sulfate et du K⁺ se trouvent entre 0,32 et 1,8 µm, un décalage vers les grandes tailles submicroniques par rapport au fond (0,18-1 µm). 77 % de la masse hydrosoluble est submicronique. **[SOURCÉ]** ACP 2021.
- **Résumé pour le rendu.** En masse comme en effet optique, la fumée est dominée par des particules de **≈ 0,2 à 0,8 µm**, c'est-à-dire le mode d'accumulation, la taille la plus efficace pour diffuser la lumière visible. **[SOURCÉ + CALCUL]**
- **Sédimentation : négligeable** à l'échelle d'un spectacle. Une particule de 1 µm tombe à ~3×10⁻⁵ m/s, soit ~10 cm/h. La fumée ne « tombe » pas : elle est transportée par l'air et se dilue. Seuls les débris (carton, étoiles non brûlées, scories) tombent. **[CALCUL, loi de Stokes]**

### 1.3 Quantité de fumée produite
- **Facteurs d'émission PM10 par kg de composition** (Camilleri & Vella, *Propellants Explos. Pyrotech.* 41(2), 2016, 273-280, mesures sur des engins maltais) **[SOURCÉ, via le résumé et une citation secondaire]** :
  - charges d'éclatement (poudre noire) : **0,054 kg/kg**
  - étoiles : **0,12 à 0,25 kg/kg** (blanc 0,123, rouge 0,175, bleu 0,176, vert 0,254)
  - flash crackers (marrons d'air) : **0,43 kg/kg**
  - mèches : 0,204 kg/kg
  Source : https://um.edu.mt/library/oar/handle/123456789/16627 et Koshi 2018.
  → Il est contre-intuitif que la poudre noire d'éclatement produise *moins* de PM10 par kg que les étoiles et les marrons. Les marrons et les combustibles métalliques sont donc de gros producteurs de fumée fine.
- **Facteurs nationaux (Allemagne, UBA).** ≈ **48 kg de PM10 par tonne de produit** (masse brute, emballage compris) pour le Nouvel An, et 62 kg/t pour le reste de l'année. Le PM2,5 vaut ≈ 40 à 49 kg/t. Ces facteurs viennent de mesures commanditées par la VPI (combustion d'artifices entiers en enceinte, Keller & Schragen 2021). La consommation était de 32 916 t en 2023, et le total annuel avoisine **2050 t de particules**. **[SOURCÉ]** https://iir.umweltbundesamt.de/2025/sector/ippu/other_product_use/fireworks/start ; https://www.umweltbundesamt.de/en/press/pressinformation/fireworks-produce-2050-tonnes-of-particulate-matter
  (Note : la page UBA donne l'unité « g/t », mais 2050 t de PM pour ~33 000 t de produit, soit ≈ 6 %, confirme que l'ordre de grandeur est bien ≈ 50 kg/t.)
- **Règle pratique pour le simulateur** **[ESTIMATION, à partir de ce qui précède]** :
  - fumée fine (PM, optiquement active) ≈ **10-25 % de la masse de composition** pour les effets colorés, ≈ 5 % pour la poudre d'éclatement, et jusqu'à ~40 % pour les marrons ;
  - produits solides totaux (dont les grosses particules qui retombent vite) : environ la moitié de la masse de composition.
  - Exemple : une bombe dont la composition active pèse ~0,5 kg libère **~50-100 g de fumée fine** à l'éclatement, plus la fumée de levée au sol, de l'ordre de 5-10 % de la masse de poudre de levée. Je n'ai pas trouvé de source fiable sur la masse active par calibre : il faut la paramétrer à partir des données métier de l'artificier.

---

## 2. Dynamique : montée, dérive, dilution, persistance

### 2.1 Panache chaud de l'éclatement
- Les gaz d'éclatement sont très chauds, mais leur masse est faible. Ils entraînent l'air ambiant et refroidissent en quelques secondes. Ordre de grandeur pour une « bulle thermique » instantanée d'énergie Q ≈ 1 MJ, soit une flottabilité totale B = gQ/(ρ c_p T) ≈ 30 m⁴/s² :
  - montée maximale dans une atmosphère nocturne stable (N ≈ 0,01-0,02 s⁻¹) : z_max ≈ 2,7·(B/N²)^{1/4} ≈ **40-60 m** ;
  - vitesse de montée de l'ordre de **0,2-1 m/s** après les premières secondes.
  **[CALCUL, théorie des thermiques de Morton-Taylor-Turner. Ordre de grandeur seulement]**
  → **Pour le rendu :** le nuage d'éclatement **monte lentement**, de quelques dizaines de mètres au plus, puis **dérive avec le vent à l'altitude d'éclatement**. Il ne part pas vers le ciel comme un panache d'incendie.
- **Fumée de levée et feux au sol** (mortiers, compacts, fontaines) : un nuage dense et bas sur le pas de tir, légèrement ascendant, qui suit le vent de surface. En nuit stable il reste piégé sous ~100 m. **[SOURCÉ, qualitatif]** : à Milan, la couche de mélange nocturne faisait < 100 m d'après le radon (Vecchi 2008). Disney a remplacé la poudre de levée par l'air comprimé (Disneyland, 2004) précisément pour supprimer la fumée de levée au niveau du sol : https://www.nbcnews.com/id/wbna5431104

### 2.2 Vent et cisaillement
- La loi de puissance du profil de vent est u(z) = u_ref·(z/z_ref)^α, avec α ≈ 1/7 en atmosphère neutre, α ≈ 0,11 sur l'eau, et α plus grand en atmosphère stable (fréquent la nuit). **[SOURCÉ]** https://en.wikipedia.org/wiki/Wind_profile_power_law
  → **[CALCUL]** Avec α = 1/7, le vent à 200 m vaut ≈ 1,5× le vent à 10 m. Avec α ≈ 0,3 (nuit stable, valeur non confirmée), il vaut ≈ 2,5×. La fumée haute dérive donc plus vite que la fumée de levée, et souvent dans une direction un peu différente (rotation du vent avec l'altitude, effet d'Ekman : **[ESTIMATION]** 10-40°).
- **Effets observés selon le vent** **[SOURCÉ, comptes rendus de spectacles et météorologues]** :
  - vent vers le public : fumée dans les yeux, grosses bombes du final masquées (compte rendu de Montréal : « smoke blowing directly at the audience… the two very large shells fired right at the end were obscured by the smoke ») : https://montreal-fireworks.com/ReportBlog/2010/06/29/poland-june-26th-2010-surex-family-fireworks
  - vent nul : la fumée stagne et cache les éclatements suivants. Une inversion de température (« cap ») piège la fumée près du sol : https://spectrumlocalnews.com/nc/triangle-sandhills/news/stories/2023/06/28/f/fireworks-and-weather--a-perfect-balance ; https://www.theweathernetwork.com/en/news/weather/forecasts/canada-day-long-weekend-fireworks-display
  - vent fort : la fumée est vite évacuée, mais les retombées incandescentes dérivent.
  - un **vent modéré, latéral ou de dos pour le public** est l'idéal visuel. Les photographes recommandent de se placer « au vent » (upwind) : https://www.alanranger.com/blog-on-photography/how-to-photograph-fireworks

### 2.3 Accumulation, hauteur de couche, persistance
- **Hauteur de la couche de fumée.** À Manille, le lidar HSRL voit la couche d'aérosols monter à ≈ **440 m** à minuit, puis redescendre à 118 ± 20 m, avec un vent de ~1 m/s et une humidité relative de 93-94 %. À Wuhan, le panache dépasse 450 m. À Pékin (Liulihe), la pollution reste sous ~400 m. **[SOURCÉ]** ACP 2021 ; recherches lidar listées ici : https://doaj.org/article/0a39c55533d94eed8d12bb682a6bf397
- **Concentrations dans le panache, au niveau du public.**
  - Montréal (International des Feux 2007, échantillonneurs individuels sous le panache prévu) : PM2,5 **> 1000 µg/m³ pendant ~45 min**, avec des pics brefs de **~10 000 µg/m³**, contre un fond de 10-40 µg/m³. **[SOURCÉ]** Joly et al. 2010, résumé : https://profbillanderson.com/2013/06/25/fireworks-and-air-quality/
  - Ville européenne (étude de Budapest) : PM10 multiplié par **123** au pic et par 58 en moyenne horaire. **[SOURCÉ]** https://pubmed.ncbi.nlm.nih.gov/37062402/
  - Échelle de la ville, stations fixes : pic horaire de PM2,5 de 384 µg/m³ à Manille, élévation pendant ~14 h ; à Hong Kong, retour au fond en ~3 h ; à Wuhan, en > 15 h. **[SOURCÉ]**
- **Décroissance au site.** À Budapest, retour à l'état initial en ≈ 45 min. À Milan, −70 % pour 0,5-1 µm en 1h30. **[SOURCÉ]** La disparition locale vient surtout de la **dilution et du transport**, pas du dépôt.
- **Pourquoi un voile se forme pendant le spectacle** **[CALCUL / ESTIMATION]** :
  - chaque bombe dépose 50-100 g de fumée fine dans un volume de ~100-200 m de diamètre. Avec un vent faible (1-2 m/s), ce volume n'est renouvelé qu'en 1-2 min, alors que le rythme de tir est de plusieurs bombes par minute, et de dizaines lors d'un final ;
  - la couche nocturne stable limite le mélange vertical à quelques centaines de mètres ;
  - on obtient donc une concentration qui croît à peu près linéairement tant que (débit de fumée) > (ventilation ≈ u × hauteur × largeur du panache). Par vent nul, le voile s'épaissit pendant tout le spectacle, et le final est tiré dans un nuage.
- **Exemple d'ordre de grandeur** **[CALCUL]**, avec le coefficient d'extinction massique dérivé au §4 (≈ 3 m²/g à sec) :
  - 1 mg/m³ (niveau de Montréal) donne σ_ext ≈ 0,003 m⁻¹, soit une visibilité de Koschmieder V = 3,9/σ ≈ **1,3 km** ;
  - 10 mg/m³ donne σ ≈ 0,03 m⁻¹, soit V ≈ **130 m** et une épaisseur optique τ ≈ 3 sur 100 m : on ne voit plus rien à travers ;
  - **dans le nuage, à l'altitude d'éclatement**, les concentrations sont plus élevées qu'au sol, d'où les éclatements « dans le brouillard » en fin de spectacle par temps calme.

### 2.4 Humidité : croissance hygroscopique
- **Humidité de déliquescence** (passage solide → gouttelette) **[SOURCÉ]** : KCl ≈ **84-85 %** HR (efflorescence vers 56 %), K₂SO₄ ≈ **96 %**, K₂CO₃ ≈ 44-50 %, mélange KCl+K₂SO₄ avec prise d'eau dès 84 % : https://pmc.ncbi.nlm.nih.gov/articles/PMC5327490/ ; https://pubs.rsc.org/en/content/articlelanding/2018/cp/c8cp00599k
- **Hygroscopicité mesurée (Manille, κ moyen 0,056-3,2 µm)** : 0,11 avant, **0,18 pendant**, 0,15 après le feu. **[SOURCÉ]** ACP 2021. (Il s'agit de l'aérosol ambiant total, la fumée pure de sels est plus hygroscopique.)
- **Facteur de croissance du diamètre GF = (1 + κ·HR/(1−HR))^{1/3}** **[CALCUL, κ-Köhler]** :

| HR | κ = 0,2 (ambiant mélangé) | κ = 0,5 | κ ≈ 1 (sel de K pur, ~KCl) |
|---|---|---|---|
| 50 % | 1,06 | 1,14 | 1,26 |
| 70 % | 1,14 | 1,29 | 1,49 |
| 80 % | 1,22 | 1,44 | 1,71 |
| 90 % | 1,41 | 1,77 | 2,15 |
| 95 % | 1,69 | 2,19 | 2,71 |

  (κ ≈ 1 pour KCl est une valeur approchée **[ESTIMATION]**. Sous l'humidité de déliquescence, un cristal sec ne grossit pas : il y a de l'hystérésis.)
- **Conséquence optique** **[CALCUL]** : à 0,3 µm, l'efficacité Q_ext augmente rapidement avec la taille. Un facteur de croissance de 1,5-2 multiplie la section efficace de diffusion par ~3-6. **Par nuit humide (HR > 80-85 %), la même masse de fumée donne un voile beaucoup plus blanc, plus épais et plus persistant.** C'est un paramètre global d'« humidité » qui mérite un réglage dans le simulateur.

---

## 3. Fumées « propres » et « sales » (qualitatif)
- **Compositions à faible fumée :** les compositions à base de nitrocellulose, avec ou sans matériaux riches en azote et pauvres en carbone (nitroguanidine, etc.), donnent surtout CO₂, H₂O et N₂, donc très peu de résidu solide. Elles sont utilisées en intérieur (salles, scènes, stades) et dans certains spectacles extérieurs pour « une meilleure netteté des effets ». **[SOURCÉ, brevets et presse]** https://patents.google.com/patent/US6599379 ; https://patents.google.com/patent/US8486207 ; https://www.nbcnews.com/id/wbna25464853 ; https://doaj.org/article/37cca84731994b82956a24a092f1da4c
  Revers mentionné : les impuretés sodées de la nitrocellulose peuvent jaunir les couleurs. **[SOURCÉ, brevet]**
- **Lancement à l'air comprimé** (Disney, 2004) : supprime la fumée de *levée* au sol, mais pas celle de l'éclatement. **[SOURCÉ]** https://www.nbcnews.com/id/wbna5431104
- **Classement visuel pour le simulateur** **[ESTIMATION, d'après les facteurs d'émission du §1.3 et la chimie des produits]** :
  - *très fumigènes* : marrons et bombettes flash (oxydes métalliques très fins, blancs), effets à combustible métallique (pluies argentées, étincelles blanches), fumée de levée de poudre noire ;
  - *moyens* : étoiles colorées classiques (sels de K, chlorures et oxydes, blanc à gris clair) ;
  - *grisâtres / brunâtres* : effets riches en charbon (queues de comète dorées, saule ou willow, bombes « brocade » : étincelles de charbon + suie), carton brûlé ;
  - *faibles* : effets à nitrocellulose « low smoke ».
- **Couleur intrinsèque de la fumée** : blanche (sels, MgO, Al₂O₃), légèrement grise ou brune en présence de carbone (absorbant, albédo plus bas). Les fumigènes colorés (colorants) de jour sont une autre famille d'artifices, hors du sujet ici.

---

## 4. Optique de la fumée : paramètres de diffusion (Mie)

Calcul Mie exact (BHMIE de Bohren & Huffman, réimplémenté en Python) pour des sphères d'indice **n = 1,49** (≈ KCl / K₂SO₄, non absorbantes) et ρ = 2,0 g/cm³ à **λ = 550 nm** **[CALCUL]** :

**Particules isolées :**
| d (µm) | Q_ext | g (asymétrie) | Extinction massique (m²/g) | P(0°)/P(180°) |
|---|---|---|---|---|
| 0,1 | 0,02 | 0,06 | 0,18 | 1,4 |
| 0,2 | 0,33 | 0,27 | 1,2 | 3,8 |
| 0,3 | 1,09 | 0,61 | 2,7 | ~100 |
| 0,5 | 3,2 | 0,74 | 4,9 | ~110 |
| 0,8 | 4,1 | 0,75 | 3,9 | ~95 |
| 1,0 | 3,2 | 0,65 | 2,4 | ~50 |

**Distributions log-normales (en nombre), n = 1,49 :**
| CMD (µm), σ_g | Extinction massique (m²/g) | g | Phase / isotrope à 0° · 10° · 30° · 60° · 90° · 150° · 180° |
|---|---|---|---|
| 0,10 ; 1,8 | 2,5 | 0,61 | 8 · 7 · 3,8 · 1,0 · 0,33 · 0,20 · 0,26 |
| 0,15 ; 1,8 | 3,2 | 0,67 | 11 · 9,5 · 4,0 · 0,87 · 0,26 · 0,17 · 0,25 |
| 0,20 ; 1,7 | 3,4 | 0,68 | 12 · 10 · 4,1 · 0,83 · 0,25 · 0,16 · 0,24 |
| 0,30 ; 1,6 | 3,7 | 0,70 | 14 · 11,5 · 4,1 · 0,72 · 0,21 · 0,17 · 0,27 |

- **Valeurs à retenir pour le moteur de rendu** :
  - fumée saline : **albédo de diffusion simple ≈ 0,98-1,0** ; **g ≈ 0,6-0,7**. Une Henyey-Greenstein simple suffit, ou une double HG (lobe avant g ≈ 0,75 plus un léger lobe arrière g ≈ −0,3 de poids ~5-10 %) pour reproduire le petit rebond près de 180° ;
  - extinction massique **≈ 3 m²/g** à sec, et 2-3 fois plus à forte humidité (§2.4) ;
  - fumée carbonée (type suie, n = 1,75 + 0,6i) : **albédo ≈ 0,3-0,5**, extinction massique 5-9 m²/g pour 0,1-0,3 µm. Elle est sombre et absorbante. À ajouter en fraction faible, par exemple 5-20 % de la masse selon l'effet, pour griser la fumée.
- **Diffusion avant forte.** Une fumée éclairée **par-derrière** (éclatement derrière le nuage, dans l'axe du regard) apparaît **5 à 15 fois plus brillante** que la même fumée éclairée de côté (90°), et ~50 fois plus que vue « en rétro » (lumière derrière l'observateur). **[CALCUL]**
  → C'est la raison de l'**auréole lumineuse** qui entoure un éclatement vu à travers la fumée, et de l'effet « nuage illuminé de l'intérieur ».
- **Dépendance spectrale.** Pour d ≈ 0,6 µm, l'extinction ne varie que de ±15 % entre 450 et 650 nm, ce qui est quasi neutre. Pour d ≈ 0,3 µm, le rapport bleu/rouge vaut ~2,9 (exposant d'Ångström ~2,9), et pour d ≈ 0,15 µm, ~4 (proche de Rayleigh). **[CALCUL]**
  → La fumée « mûre » du mode d'accumulation est **quasi grise** : elle prend fidèlement la **couleur de la lumière qui l'éclaire**. Une fumée très fraîche et très fine, éclairée de côté par une lumière blanche, peut paraître légèrement bleutée sur fond noir. Inversement, une lumière qui *traverse* beaucoup de fumée est légèrement jaunie ou rougie. L'effet reste faible, et il est **[CALCUL]** non vérifié par observation.
- **Air pur (Rayleigh).** σ ≈ 1,2×10⁻⁵ m⁻¹ à 550 nm au niveau de la mer, soit une épaisseur optique de ~0,001 sur 100 m. C'est négligeable devant la fumée (10⁻³ à 10⁻¹ m⁻¹). **[CALCUL, valeur standard]**
  → La « lueur de l'air » autour des éclatements vient presque entièrement de **l'aérosol (fumée + brume urbaine)** et de **l'éblouissement de l'œil ou de l'objectif** (glare, flare), pas des molécules d'air.

---

## 5. Pourquoi la fumée prend la couleur des éclatements, et ce que voit le public
- La fumée est non absorbante et quasi grise (§4). Sa luminance est donc L ≈ Σ_sources (I_source/d²)·σ_s·p(θ)·(longueur de trajet)/(4π) : elle **reflète exactement le spectre des étoiles qui l'éclairent**. Une bombe rouge éclatant dans un nuage rend le nuage rouge, et un chrysanthème vert le rend vert. Les zones éclairées par plusieurs couleurs se mélangent de façon **additive**. **[CALCUL / physique standard]**
- **La nuit, une faible épaisseur optique suffit à rendre la fumée visible.** Le ciel est noir et la source très brillante, si bien qu'un traînée d'étoile de τ ≈ 0,01-0,1 apparaît nettement quand elle est éclairée. **[ESTIMATION]**
  - Ordre de grandeur pour la traînée d'une étoile : ~1 g de fumée sur ~50 m de trajet et ~1 m de largeur, soit τ ≈ 0,06 en travers. **[ESTIMATION]**
  - Conséquence : **la fumée sert avant tout de milieu diffusant (in-scattering)**. Son rôle d'écran (extinction des éclatements suivants) ne devient important qu'après accumulation (τ > 0,3-1).
- **Évolution perçue au cours du spectacle** **[SOURCÉ pour le qualitatif]** : les premières minutes sont les plus nettes ; ensuite la fumée « adoucit le contraste, aplatit les couleurs et rend le ciel boueux » (photographie, Alan Ranger, lien §2.2). Le compte rendu de Montréal (§2.2) décrit le final masqué. Le rendu doit donc faire évoluer :
  1. le niveau de noir du ciel, relevé par la lumière diffusée : perte de contraste ;
  2. la saturation, diluée par la lumière diffusée multicolore ;
  3. les halos, plus grands et plus intenses ;
  4. pour les éclatements situés derrière un nuage épais, une transmission directe e^{−τ} réduite et une source qui devient une tache diffuse colorée.
- **Fumée éclairée par le bas.** La fumée de levée et les feux au sol (projecteurs, flammes, cascades) éclairent le bas du nuage en orangé ou blanc. **[ESTIMATION, observation courante]**

---

## 6. Lumière émise et éclairement du décor

### 6.1 Ordres de grandeur photométriques
- **Efficacité lumineuse des compositions** **[SOURCÉ, données militaires anciennes]** :
  - torches d'éclairage blanches Mg/nitrate : **~50 000 cd·s/g** (jusqu'à 70 000) : https://apps.dtic.mil/sti/pdfs/AD0844961.pdf (rapports DTIC) ;
  - signaux verts : **4300 cd·s/g** pour un vert standard de la Navy (contenant du magnésium), et ~170 cd·s/g seulement pour un vert de meilleure pureté sans métal. « La couleur ne s'obtient qu'au prix d'une grande perte d'efficacité » : https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/4204895
  - Je n'ai trouvé **aucune mesure publiée de l'intensité (cd) d'une étoile ou d'une bombe** d'artifice de spectacle.
- **Estimation pour une bombe de 150 mm** **[ESTIMATION, incertitude d'un facteur 3-10]** : ~0,3-0,5 kg d'étoiles × ~300-2000 cd·s/g ≈ 10⁵-10⁶ cd·s, répartis sur ~1,5-3 s de combustion, soit **I ≈ 0,5-5×10⁵ cd** pendant l'éclatement. Les marrons et flashs blancs à métal donnent des éclairs beaucoup plus intenses mais très brefs (~10-50 ms).
- **Éclairement au public** E = I·cosθ/d² **[CALCUL avec l'estimation précédente]** :
  - à 300 m de l'éclatement : E ≈ 10⁵/9×10⁴ ≈ **0,5-5 lux** ;
  - à 500 m : ≈ 0,2-2 lux.
  - Comparaison : pleine lune ≈ 0,1-0,3 lux, éclairage public ≈ 5-20 lux. Une grosse bombe éclaire donc le sol, les visages et les façades **au niveau d'un clair de lune fort, voire au-delà**, avec des ombres portées nettes (source quasi ponctuelle et colorée). Un final multiple atteint des dizaines de lux, comparables à une rue éclairée.
  - Par rapport à l'adaptation scotopique de l'œil (~10⁻³ lux), c'est **énorme**. Les éclatements produisent donc un éblouissement transitoire et une perte de vision des étoiles faibles. Dans le simulateur, il faut une adaptation d'exposition (« eye adaptation ») lente.

### 6.2 Éclairage du décor
- **Sol, bâtiments, foule** : éclairage direct coloré par chaque étoile, plus une composante diffuse venant du nuage de fumée illuminé, qui agit comme une « boîte à lumière » géante et adoucit les ombres en fin de spectacle. **[ESTIMATION]**
- **Plan d'eau** : reflet spéculaire dont la réflectance de Fresnel (eau, n = 1,333) dépend fortement de l'angle d'incidence **[CALCUL]** :

| Incidence (depuis la verticale) | 0° | 45° | 60° | 70° | 75° | 80° | 85° |
|---|---|---|---|---|---|---|---|
| Réflectance | 2,0 % | 2,8 % | 6,0 % | 13 % | 21 % | 35 % | 58 % |

  Le public au bord de l'eau voit le reflet sous une incidence rasante (70-85°), donc un reflet intense (13-58 % de la luminance de l'éclatement). Les vaguelettes l'étirent en une colonne verticale scintillante. **[CALCUL + ESTIMATION]**
- **Photographie, pour calibrer l'exposition du rendu** **[SOURCÉ]** : f/8, ISO 100, pose B de 2 à 8 s sont les réglages standard. Pour un final chargé, ouvrir davantage et poser moins longtemps pour éviter « une image cramée et encombrée » : https://www.alanranger.com/blog-on-photography/how-to-photograph-fireworks ; https://www.firework-review.org.uk/fireworks/2011/04/camera_settings/
  → Les traînées d'étoiles sont **saturées** à ces réglages. La fumée et le décor éclairé tombent dans les tons moyens. Un rendu HDR avec tone mapping de type filmique est cohérent avec ce que le public connaît en photo.

---

## 7. Son (aparté)
- c ≈ 331,3·√(1 + T/273,15) m/s, soit 343 m/s à 20 °C. **[SOURCÉ]** https://www.SengpielAudio.com/SpeedOfSoundPressure.pdf
- **Délais [CALCUL]** à 20 °C : 150 m → **0,44 s** ; 300 m → 0,87 s ; 500 m → 1,46 s ; 1 km → 2,9 s. Exemple : bombe éclatant à 200 m de hauteur, public à 300 m à l'horizontale, distance ≈ 360 m, délai ≈ **1,05 s**. La lumière est instantanée (1 µs/300 m).
- À 0 °C le son est ~3,5 % plus lent qu'à 20 °C. Le vent ajoute ou retranche sa composante (±1-3 %). Une inversion nocturne réfracte le son vers le sol et le fait porter plus loin. **[physique standard]**
- Pour le simulateur : chaque éclatement déclenche son échantillon audio avec un délai d/c, ainsi qu'un départ (« boum » de levée) avec un délai selon la distance au mortier.

---

## 8. Recettes de simulation proposées (synthèse)

| Paramètre | Valeur conseillée | Statut |
|---|---|---|
| Formation de la fumée | instantanée (< 0,1 s) le long des traînées d'étoiles et au point d'éclatement | SOURCÉ (Koshi) |
| Masse de fumée fine | 10-25 % de la masse de composition (étoiles), ~5 % (poudre d'éclatement), ~40 % (flash) | SOURCÉ (Camilleri & Vella) + ESTIMATION |
| Taille effective | 0,2-0,8 µm (mode d'accumulation) | SOURCÉ |
| Extinction massique | ≈ 3 m²/g à sec, ×2-3 si HR > 85 % | CALCUL |
| Albédo / g | 0,98-1,0 / 0,65 (sels) ; 0,3-0,5 / 0,5 (fraction carbonée) | CALCUL |
| Montée du nuage | +20-60 m en ~1 min, puis dérive | CALCUL (ordre de grandeur) |
| Dérive | vent à l'altitude (u₁₀ × (z/10)^α, α = 0,14-0,3) | SOURCÉ + ESTIMATION |
| Sédimentation | nulle (sauf débris) | CALCUL |
| Couche de mélange nocturne | 100-450 m | SOURCÉ (Milan, Manille) |
| Persistance locale | voile dense pendant le spectacle, puis dissipation en ~45 min - quelques h selon le vent | SOURCÉ |
| Concentration au sol sous le panache | 1-10 mg/m³ (visibilité ~1 km → ~100 m) | SOURCÉ (Montréal) + CALCUL |
| Éclairement au public (grosse bombe) | ~0,5-5 lux, de l'ordre du clair de lune ou plus | ESTIMATION |
| Délai sonore | d / 343 m/s | SOURCÉ / CALCUL |

**Sources principales**
- Koshi 2018, formation de la fumée de poudre noire : https://www.jes.or.jp/mag/stem/Vol.79/documents/Vol.79,No.3,p.59-69.pdf
- Camilleri & Vella 2016, facteurs d'émission PM10 : https://um.edu.mt/library/oar/handle/123456789/16627
- UBA (Allemagne), facteurs PM par tonne : https://iir.umweltbundesamt.de/2025/sector/ippu/other_product_use/fireworks/start
- Vecchi et al. 2008, Milan : https://flore.unifi.it/bitstream/2158/326870/1/The%20impact%20of%20fireworks%20on%20airborne%20particles.pdf
- Manila, ACP 2021 : https://acp.copernicus.org/articles/21/6155/2021/acp-21-6155-2021.html
- Budapest, Environ. Pollut. 2023 : https://pubmed.ncbi.nlm.nih.gov/37062402/
- Yanshui (Taïwan) : https://aaqr.org/articles/aaqr-15-09-oa-0569
- Joly et al. 2010 (Montréal), résumé : https://profbillanderson.com/2013/06/25/fireworks-and-air-quality/
- Hygroscopicité de KCl : https://pmc.ncbi.nlm.nih.gov/articles/PMC5327490/
- Nitrocellulose « low smoke » : https://patents.google.com/patent/US6599379 ; https://www.nbcnews.com/id/wbna25464853
- Air comprimé (Disney) : https://www.nbcnews.com/id/wbna5431104
- Profil de vent : https://en.wikipedia.org/wiki/Wind_profile_power_law
- Photographie : https://www.alanranger.com/blog-on-photography/how-to-photograph-fireworks

**Points faibles et non vérifiés :**
- l'intensité lumineuse réelle d'une bombe en candelas (aucune mesure publique trouvée) ;
- la masse active par calibre ;
- la valeur exacte de κ pour la fumée fraîche ;
- l'exposant de vent nocturne de 0,3 ;
- la montée thermique (simple calcul d'ordre de grandeur) ;
- les valeurs numériques du modèle de Koshi (PDF à police encodée, chiffres non extraits).
