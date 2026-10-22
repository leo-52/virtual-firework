# 03 — Couleurs des feux d'artifice : physique, colorimétrie, perception, valeurs de rendu

Notes de recherche pour le simulateur (rendu). Rédigées pour un artificier : les compositions ne sont **jamais** données
(ni proportions ni procédés). Seules les espèces émettrices et les familles d'ingrédients sont citées, qualitativement.

Légende de fiabilité :
- **[S]** sourcé solidement (publication à comité de lecture, brevet avec mesures, ouvrage de référence, norme CIE)
- **[C]** calculé par moi à partir de données sourcées (script Python, fonctions colorimétriques CIE 1931 2° officielles, CVRL)
- **[I]** incertain / estimation / source grand public / observation courante non mesurée

---

## 0. Résumé pour le moteur de rendu

1. Deux familles de lumière, à traiter différemment :
   - **Émission moléculaire/atomique en phase gazeuse** (étoiles de couleur) : spectre de bandes étroites → couleur très saturée,
     souvent **hors du gamut sRGB** (rouge, vert). Couleur quasi constante pendant toute la combustion de l'étoile.
   - **Incandescence de particules solides/liquides** (étincelles or/argent, blanc, « bruit » de fond) : spectre continu de type
     corps noir (ou corps gris) → couleur sur le **lieu de Planck** (rouge sombre → orange → jaune → blanc) déterminée par la seule
     température. Une étincelle qui refroidit descend le lieu de Planck **et** perd énormément de luminance.
2. Le continuum d'incandescence qui se superpose aux bandes est ce qui **lave** les couleurs vers le blanc (pureté en baisse).
3. À l'œil, les étoiles sont des sources ponctuelles très brillantes : couleur bien perçue sur le cœur, plus éblouissement (bloom).
   En photo/vidéo, le cœur **sature les trois canaux** → centre blanc, frange colorée. Ce sont deux « looks » différents à proposer.
4. Pipeline conseillé : couleurs en **linéaire** (idéalement XYZ ou Rec.2020 linéaire, sinon sRGB linéaire), intensités HDR
   (le cœur d'une étoile vaut 10–100× le seuil de saturation), puis tone-mapping + bloom. Le passage au blanc doit venir du
   tone-mapping/saturation, **pas** d'une couleur de base blanchie.

---

## 1. D'où viennent les couleurs : espèces émettrices et spectres

Source principale de la table : Wikipedia « Pyrotechnic colorant » (synthèse de Conkling / Kosanke / Douda)
https://en.wikipedia.org/wiki/Pyrotechnic_colorant **[S]**

| Couleur | Émetteur principal | Longueurs d'onde | Remarques |
|---|---|---|---|
| Rouge | **SrCl** (bandes moléculaires) | 617–623, 627–635, 640–646 nm | nécessite un donneur de chlore. [S] |
| Rouge (orangé) | **SrOH** | 600–613 nm (bandes supplémentaires plus rouges probables [I]) | domine sans chlore ; identification SrOH confirmée par Gaydon & Charton 1956 (substitution isotopique SrOD). [S] |
| Rouge (nuisible) | SrO | bandes orangées | « émetteur orange néfaste » ; sa réduction améliore le rouge (Sabatini, travaux sur rouges sans chlore). [S] |
| Vert | **BaCl** | 511–515, 524–528, 530–533 nm | nécessite un donneur de chlore. [S] |
| Vert-jaune | BaOH, BaO, Ba atomique | bandes jaune-vert (positions exactes BaOH non vérifiées [I]) ; raie atomique Ba 553,5 nm [S] | sans chlore, seuls BaOH et BaO → vert plus jaune et moins pur. [S] |
| Bleu | **CuCl** | bandes fortes 403–456 nm, plus faibles 460–530 nm | très sensible à la température. [S] |
| Parasites du bleu | CuOH, CuO, Cu atomique | vert-jaune 535–555 nm, orange-rouge 580–655 nm | apparaissent quand CuCl est détruit (trop chaud / trop oxydant). [S] |
| Orange | CaCl | 591–599 et 603–608 nm | [S] |
| Jaune | **Na** (raies D) | 589,0 / 589,6 nm | extrêmement intense ; une trace de sodium « écrase » les autres couleurs. Dans les torches magnésium/nitrate de sodium, l'essentiel du visible vient des raies D **élargies** autour de 589 nm (rapport DTIC sur spectres de torches). [S] |
| Violet / pourpre | mélange CuCl (bleu) + SrCl/SrOH (rouge) | bandes bleues + rouges | couleur additive (non spectrale) ; difficile car le rouge domine visuellement. [S] |
| Blanc | incandescence de MgO, Al₂O₃ (gouttelettes/particules d'oxyde) + parfois raies (Na) | continuum | particules très chaudes (≥ ~3000 K). [S/I] |
| Or / argent (étincelles) | incandescence de carbone (charbon), fer, Ti, Al | continuum corps noir/gris | couleur = température. [S] |
| Infra-rouge (hors visible) | C (particules), CO₂ 4,3 µm, Cs 852/894 nm | — | sans intérêt pour le rendu visible sauf « fumée lumineuse ». [S] |

Points physiques clés **[S]** (même source + Juknelevicius et al. 2021, cf. §2) :
- **Ionisation** : trop chaud → Ba⁺ émet à 455,4 nm (bleu) au lieu du vert BaCl ; on ajoute un élément facilement ionisable
  (potassium) comme « tampon » d'ionisation. Douda (1964, « Theory of colored flame production », DTIC ADA951815) traite
  justement la dégradation de couleur par ionisation.
- **Donneurs de chlore** (famille : composés organochlorés, perchlorates/chlorates, PVC, paraffine chlorée…) : ils fournissent
  Cl/HCl pour former les monochlorures émetteurs (SrCl, BaCl, CuCl), plus purs que les hydroxydes/oxydes.
  À l'inverse le chlore **dégrade** les émetteurs atomiques (Na, Li).
- **Incandescence** : toute particule solide (MgO, Al₂O₃, BaO, KOH/K₂CO₃ condensés, suie, scories) émet un continuum qui
  blanchit la couleur. L'aluminium élève la température mais crée beaucoup de particules incandescentes ; le magnésium
  pose moins ce problème (MgO peut rester en phase gazeuse en présence de CO).

### Pourquoi le bleu est difficile [S]
- L'émetteur CuCl est fragile : il n'existe que dans une **fenêtre de température** étroite. Trop froid → peu d'émission ;
  trop chaud → dissociation de CuCl, apparition de CuOH/CuO/Cu (vert, orange) et du continuum → bleu blanchâtre ou verdâtre.
- Juknelevicius, Hahma, Webb, Klapötke, Ramanavicius, *Propellants Explos. Pyrotech.* 2021, 46, 107–113,
  « An Experimental Comparison of Selected Blue Flame Pyrotechnics » (accès libre) :
  https://epub.ub.uni-muenchen.de/75968/1/prep.202000114.pdf
  - 10 flammes bleues mesurées au spectromètre : pureté d'excitation **28–58 %** (pic à 65 % dans les 1–3 premières secondes),
    longueur d'onde dominante **445–481 nm**.
  - Températures adiabatiques calculées (NASA CEA) : **1840 K** (le bleu le plus pur) à **2690 K** (le plus lumineux et moins pur).
    → corrélation nette : plus chaud / plus lumineux = moins saturé.
  - Les flammes bleues profondes sont **peu lumineuses** (≈ 100 cd pour une pastille de 16 mm) ; ajout d'un métal (Mg/Al) →
    388 cd mais pureté 30 %.
  - Phénomène notable pour le rendu : la **fumée** réfléchit la lumière de la flamme et augmente la luminosité apparente.
  - La pureté baisse au cours de la combustion d'une pastille (formation de scories) — **[S]**, mais pour des pastilles de labo,
    pas des étoiles en vol.

### Espèces : rouge et vert, mesures modernes [S]
- Vert baryum classique : pureté spectrale « dans les 60 % » à cause des particules incandescentes (MgO, BaO).
  Vert au bore (BO₂, sans baryum) : longueur d'onde dominante **560–562 nm**, pureté 69 % → **85–86 %**.
  Klapötke, Krumm, Rusan, Sabatini, *Chem. Commun.* 2014, 50, 9581 : https://epub.ub.uni-muenchen.de/22524/1/oa_22524.pdf
- Brevet US 8282749 (vert sans baryum) : λ dominante ≈ **558 nm** pour le vert baryum, ≈ 562 nm pour le vert bore, « différence
  minime à l'œil ». https://patents.google.com/patent/US8282749
- Rouge strontium sans chlore (Sabatini) : λ dominante **608 nm**, pureté 72 % ; brevet rouge sans perchlorate : 607–608 nm,
  pureté ≥ 86,8 % (illuminant C comme blanc de référence). Glück/Klapötke, *Z. Anorg. Allg. Chem.* 2020 :
  https://epub.ub.uni-muenchen.de/72908/1/zaac.201900132.pdf ; https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9856181

---

## 2. Coordonnées chromatiques mesurées (CIE 1931 2°)

### 2.1 Données mesurées publiées [S]
Brevet **US 6312537** (Los Alamos, compositions à haute teneur en azote, peu fumigènes) — mesures spectrophotométriques
(Ocean Optics S2000, 200–850 nm, étalonnage lampe halogène, intégration par bandes de 5 nm → XYZ CIE 1931 ; reproductibilité
± 0,01). https://patents.google.com/patent/US6312537B1/en

| Couleur | x | y | Commentaire |
|---|---|---|---|
| Rouge **traditionnel** | 0,653 | 0,315 | référence de comparaison du brevet |
| Rouge haute pureté (typique) | 0,685–0,710 | 0,289–0,295 | ~au bord du lieu spectral |
| Vert **traditionnel** | 0,366 | 0,522 | nettement jaune-vert ! |
| Vert haute pureté (typique) | 0,17–0,23 | 0,66–0,73 | vert émeraude |
| Bleu **traditionnel** | 0,218 | 0,185 | |
| Bleu meilleur | 0,177–0,182 | 0,108–0,116 | revendication : x < 0,20 et y < 0,18 |
| Pourpre (Cu + Sr) | 0,352 / 0,446 | 0,179 / 0,214 | du violet au magenta |
| Bleu-vert / turquoise (Cu + Ba) | 0,185–0,219 | 0,47–0,59 | |

Juknelevicius 2021 (bleus) : x = 0,221–0,328 ; y = 0,173–0,261 ; les meilleurs vers (0,22–0,24 ; 0,17–0,18). [S]

### 2.2 Ce que ces valeurs donnent en sRGB [C]
Calcul : xy → XYZ → sRGB linéaire (D65). Si hors gamut, désaturation en ligne droite vers le blanc D65 jusqu'à entrer dans le
gamut (« kept » = fraction de saturation conservée). Valeurs normalisées : canal max = 1. Pureté d'excitation recalculée
**par rapport à D65** (les publications utilisent souvent l'illuminant C → valeurs un peu différentes).

| Couleur mesurée | λ dom. | pureté (D65) | sRGB linéaire (max=1) | hex sRGB | hors gamut ? |
|---|---|---|---|---|---|
| Rouge traditionnel (0,653 ; 0,315) | ~618 nm | ~91 % | (1,000 ; 0,000 ; 0,028) | #FF002F | oui, garde 89 % |
| Rouge haute pureté (0,697 ; 0,291) | ~632 nm | ~97 % | (1,000 ; 0,000 ; 0,063) | #FF0047 | oui, garde 72 % |
| Vert traditionnel (0,366 ; 0,522) | ~562 nm | ~69 % | (0,521 ; 1,000 ; 0,051) | #BFFF40 | non |
| Vert haute pureté (0,204 ; 0,693) | ~532 nm | ~78 % | (0,000 ; 1,000 ; 0,278) | #00FF90 | **oui, garde 42 %** |
| Bleu traditionnel (0,218 ; 0,185) | ~468 nm | ~52 % | (0,205 ; 0,265 ; 1,000) | #7D8DFF | non |
| Bleu meilleur (0,182 ; 0,116) | ~465 nm | ~74 % | (0,084 ; 0,097 ; 1,000) | #5258FF | non |
| Bleu Juknelevicius #1 (0,240 ; 0,173) | ~440 nm | ~49 % | (0,366 ; 0,194 ; 1,000) | #A37AFF | non (bleu-violet) |
| Bleu « brillant » avec métal (0,276 ; 0,246) | ~427 nm | ~26 % | (0,591 ; 0,454 ; 1,000) | #CAB4FF | non (bleu lavande délavé) |
| Pourpre (0,352 ; 0,179) | ~420 nm (complémentaire) | ~44 % | (1,000 ; 0,022 ; 0,758) | #FF29E2 | non |
| Magenta (0,446 ; 0,214) | — | ~43 % | (1,000 ; 0,000 ; 0,371) | #FF00A4 | léger |
| Turquoise (0,219 ; 0,587) | ~528 nm | ~53 % | (0,000 ; 1,000 ; 0,326) | #00FF9B | oui, garde 53 % |

Constats importants :
- **Rouge et vert purs sont hors gamut sRGB** (le vert BaCl à ~520–530 nm l'est fortement). Un écran sRGB ne peut pas les
  reproduire ; Display-P3 et surtout Rec.2020 font mieux. Le **bleu pyrotechnique est dans le gamut** (il est peu pur).
- Le « vert traditionnel » mesuré est un **vert-jaune** (λ dom. 558–562 nm) : cohérent avec Klapötke (vert baryum ≈ 558 nm).
  Un vert « #00FF00 » est donc trop « vert pur » pour un vert baryum classique ; un vert tirant vers le jaune est plus fidèle.
- Les bleus réels sont **violacés et/ou délavés** (bleu lavande quand ils sont lumineux).

### 2.3 Points du lieu spectral (raies/bandes seules) [C]
Fonctions colorimétriques CIE 1931 2° officielles (CVRL, http://www.cvrl.org/database/data/cmfs/ciexyz31_1.csv).

| λ | x | y | sRGB (désaturé dans le gamut) | Correspond à |
|---|---|---|---|---|
| 440 nm | 0,164 | 0,011 | #7F00FF (violet) | cœur des bandes CuCl |
| 460 nm | 0,144 | 0,030 | #4700FF | |
| 515 nm | 0,039 | 0,812 | #00FFB2 | BaCl (a) |
| 525 nm | 0,114 | 0,826 | #00FFA0 | BaCl (b) |
| 555 nm | 0,337 | 0,659 | #78FF00 | BaO/Ba 553 nm |
| **589 nm** | 0,569 | 0,430 | **#FF8900** (orange-ambre) | **Na D** |
| 606 nm | 0,652 | 0,348 | #FF3400 | SrOH |
| 630 nm | 0,708 | 0,292 | #FF0045 | SrCl |

Note : la lumière du sodium pur s'affiche en sRGB comme **orange-ambre**, pas comme un jaune citron (#FFFF00). Les étoiles
« jaunes » au sodium paraissent jaune-orangé ; avec un peu de continuum elles s'éclaircissent (voir §3).

---

## 3. Pureté de couleur vs température et continuum

### Mécanisme [S]
- La couleur d'une étoile = bandes émises (signal) + continuum d'incandescence (bruit blanc-jaune). La **pureté** mesure la
  part du signal. Toute particule condensée chaude (oxydes métalliques, sels de potassium, suie, scories) ajoute du continuum.
- Il existe un **compromis luminosité ↔ pureté** : plus de combustible métallique → flamme plus chaude et plus lumineuse mais
  plus de particules incandescentes et dissociation/ionisation des émetteurs → couleur lavée vers le blanc. Mesuré pour le
  bleu (§1), cité pour le rouge et le vert (projet SERDP sur rouges au lithium : « nature opposée de la pureté spectrale et de
  l'intensité lumineuse » https://serdp-estcp.mil:443/projects/details/80666237-de6a-4a09-a6dd-80f3438f511c).
- Trop chaud : dissociation des monochlorures (SrCl, BaCl, CuCl), ionisation (Ba⁺, Sr⁺) → émission à d'autres longueurs d'onde.
  Trop froid : émission faible, suie (taches jaunes dans la flamme bleue observées par Juknelevicius 2021).

### Modèle simple de dilution par continuum [C]
Spectre modèle = bandes gaussiennes de l'émetteur + corps noir 2500 K représentant x % de la luminance Y.

| Émetteur | 0 % continuum | 20 % | 40 % |
|---|---|---|---|
| Na D (589) | #FF8900, pureté 100 % | #FF8C00, 94 % | #FF8F00, 87 % |
| SrCl + SrOH (rouge) | #FF0032, 100 % | #FF000F, 95 % | #FF3506 (rouge orangé), 90 % |
| BaCl (vert) | #00FFA3, 95 % | #00FF82, 79 % | #5AFF07 (vert-jaune), 73 % |
| CuCl (bleu) | #4000FF, 95 % | #4A00FF, 92 % | #5800FF, 85 % |

Lecture : le continuum (jaune-orangé à 2500 K) **déplace le vert vers le jaune** et le **rouge vers l'orange** bien avant de le
« blanchir ». Pour le bleu, un modèle à continuum seul surestime la pureté : en réalité les émissions CuOH (vert) et le continuum
plus chaud ramènent le bleu vers x≈0,2–0,28, y≈0,17–0,26 (valeurs mesurées §2). → Pour le rendu, **utiliser les valeurs
mesurées** plutôt que ce modèle, et éventuellement un paramètre « qualité / pureté » qui interpole entre les colonnes
« traditionnel » et « haute pureté » de la table §2.2.

---

## 4. Étincelles et incandescence : températures et couleurs (corps noir)

### Températures (fiabilité variable)
| Source | Température | Fiabilité |
|---|---|---|
| Incandescence du charbon (de rouge sombre à blanc) | ~480 °C à ~1400 °C (750–1670 K) | [I] PBS Rough Science https://www.pbs.org/weta/roughscience/series2/challenges/fireworks/page4.html |
| Étincelles « or » de charbon | ordre de **1500–2000 K** estimé d'après la couleur | [I] — aucune mesure publiée trouvée |
| Étincelles « or » d'aluminium grossier | ~1500 °C (~1800 K) | [I] presse grand public (NBC News) |
| Étincelles blanches d'aluminium | ~3000 °C (~3300 K) | [I] presse grand public (NBC News) |
| Particule d'aluminium isolée brûlant dans l'air | surface ~**2350 K**, flamme en plateau ~**3800 K** | [S] Penn State, « Flame structure measurement of single isolated aluminum particle » https://pure.psu.edu/en/publications/flames-structure-measurement-of-single-isolated-aluminum-particle/ |
| Étincelles de titane | **3300–3600 °C** (estimation, incluant erreurs d'étalonnage ; éclatement quand la particule atteint ~son point d'ébullition) | [S/I] rapport NASA NTRS 19910023391 (conditions probablement O₂, à vérifier) |
| Mg / Al / Ti : « températures de combustion » | Al 3500 °C, Mg 3200 °C, Ti 2900 °C | [I] PBS (valeurs de flamme, pas de surface) |
| Flammes colorées (bleu) | 1840–2690 K (adiabatique calculé) | [S] Juknelevicius 2021 |
| Étincelles de *senko-hanabi* vs fer meulé | senko-hanabi **plus froides** que les étincelles de fer ; 40 mW vs 50 mW de puissance par étincelle ; la fusion de K₂SO₄ consomme ~40 % de la chaleur ; la température d'une étincelle **augmente** jusqu'à l'éclatement | [S] Inoue, Watanabe, Inokuchi, *Sci. Tech. Energetic Materials* 80(4) 136–141, 2019 https://www.jes.or.jp/mag/stem/Vol.80/documents/Vol.80,No.4,p.136-141.pdf (valeurs numériques en K non extraites du PDF) |

Kosanke, « Pyrotechnic Spark Generation », *J. Pyrotechnics* 1999, p. 49–62 est la référence de fond (non accessible en ligne) :
couleurs d'étincelles limitées à rouge/orange, or (jaune) et argent (blanc) ; métal plus réactif → étincelle plus chaude ;
durée de vie ∝ taille de la particule. Résumé dans https://en.wikipedia.org/wiki/Spark_(fire) **[S]**.
Des couleurs hors corps noir exigent une combustion en phase vapeur (zinc : étincelles blanc-bleuté/verdâtre ; erbium :
alternance orange/vert). **[S]**

### Couleur du corps noir et luminance relative [C]
CIE 1931 2°, sRGB D65, normalisé canal max = 1 ; **Y rel.** = luminance par unité de surface émettrice, relative à 2000 K
(émissivité égale). C'est la donnée clé pour faire « s'éteindre » une étincelle qui refroidit.

| T (K) | x | y | sRGB linéaire (max=1) | hex | Y rel. (2000 K = 1) | Perçu |
|---|---|---|---|---|---|---|
| 1000 | 0,653 | 0,345 | (1 ; 0,009 ; 0) | #FF1700 | 6×10⁻⁶ | rouge sombre, quasi invisible |
| 1200 | 0,625 | 0,368 | (1 ; 0,058 ; 0) | #FF4400 | 3×10⁻⁴ | rouge |
| 1400 | 0,599 | 0,386 | (1 ; 0,108 ; 0) | #FF5C00 | 0,005 | rouge-orange |
| 1500 | 0,586 | 0,393 | (1 ; 0,133 ; 0) | #FF6600 | 0,017 | orange |
| 1600 | 0,573 | 0,399 | (1 ; 0,158 ; 0) | #FF6F00 | 0,046 | orange |
| 1800 | 0,549 | 0,408 | (1 ; 0,208 ; 0) | #FF7E00 | 0,25 | orange doré |
| 2000 | 0,527 | 0,413 | (1 ; 0,257 ; 0,008) | #FF8B16 | 1 | or |
| 2200 | 0,506 | 0,415 | (1 ; 0,304 ; 0,028) | #FF962F | 3,1 | or clair |
| 2400 | 0,486 | 0,415 | (1 ; 0,350 ; 0,053) | #FFA041 | 8,0 | jaune-or |
| 2600 | 0,468 | 0,412 | (1 ; 0,394 ; 0,083) | #FFA851 | 18 | jaune |
| 2800 | 0,452 | 0,409 | (1 ; 0,436 ; 0,116) | #FFB060 | 36 | jaune pâle |
| 3000 | 0,437 | 0,404 | (1 ; 0,477 ; 0,154) | #FFB86D | 65 | blanc chaud |
| 3300 | 0,417 | 0,396 | (1 ; 0,534 ; 0,215) | #FFC180 | 141 | blanc chaud |
| 3600 | 0,400 | 0,388 | (1 ; 0,588 ; 0,282) | #FFCA91 | 268 | blanc |
| 4000 | 0,381 | 0,377 | (1 ; 0,654 ; 0,377) | #FFD3A5 | 545 | blanc |
| 5000 | 0,345 | 0,352 | (1 ; 0,792 ; 0,628) | #FFE6D0 | 1980 | blanc |

Remarques :
- Sous ~2500 K, le corps noir en sRGB n'a **presque pas de bleu** : c'est normal, ce sont des oranges saturés. La perception
  « or » vient de la forte luminance + adaptation, d'où l'intérêt du tone-mapping HDR (un orange HDR très lumineux, une fois
  tone-mappé avec désaturation des hautes lumières, donne un « or » jaune-blanc crédible).
- La luminance varie **énormément** avec T (≈ ×60 entre 1500 et 2000 K, ≈ ×65 entre 2000 et 3000 K). Une étincelle qui
  refroidit de quelques centaines de kelvins **disparaît** visuellement : le changement de couleur vers le rouge est
  accompagné d'une chute de luminosité si rapide qu'on ne voit le rouge sombre que pour les grosses particules ou près.
- Les particules d'oxyde (Al₂O₃, MgO) ne sont pas des corps noirs parfaits (émissivité spectrale variable, corps « gris » ou
  sélectifs) ; pour un rendu, le corps noir suffit. [I]

---

## 5. Évolution de la couleur pendant la vie d'une étoile / d'une étincelle

- **Étoiles de couleur** : la couleur est fixée par la chimie de la flamme, donc **à peu près constante jusqu'à l'extinction** ;
  l'intensité varie (allumage, plateau, déclin). La pureté peut être un peu meilleure au début (pic de pureté dans les
  premières secondes mesuré sur des pastilles bleues) puis baisser légèrement (scories). [S pour les pastilles, I pour des
  étoiles en vol]
- **Étoiles à changement de couleur** : couches successives → saut quasi instantané de couleur (souvent avec un court
  intervalle sombre ou blanc). [I, connaissance du métier]
- **Fin de vie d'une étoile** : le dernier fragment/scorie peut rougeoyer orange un court instant (incandescence des résidus).
  [I]
- **Étincelles de charbon (saule, queue de comète, « willow »)** : or, puis or-orangé et rouge-orangé en s'éteignant ; la
  combustion de surface maintient la température pendant la vie de l'étincelle, l'extinction est donc assez progressive mais
  la luminance s'effondre selon la table §4. [I/S qualitatif]
- **Étincelles métalliques (Ti, Al, fer)** : blanches/jaunes ; elles peuvent **éclater** (étincelles branchues) : pour le
  senko-hanabi et le fer, la température **monte** avant l'éclatement (Inoue 2019) [S], pour le titane l'éclatement est
  attribué à l'atteinte du point d'ébullition (NASA) [S/I]. Elles ne refroidissent donc pas toujours de façon monotone.
- **Paillettes / glitter** : flash retardé, jaune-blanc (souvent sodium + incandescence) — hors du cadre détaillé ici. [I]
- Modèle de rendu conseillé pour une étincelle : T(t) décroissante en fin de vie (ex. exponentielle vers ~1000 K sur les
  derniers 10–30 % de la durée de vie), couleur = table corps noir, luminance = Y rel.(T) × aire. Pour une étincelle
  « à éclatement », légère hausse de T avant l'éclatement.

---

## 6. Perception : œil vs caméra

### 6.1 Œil humain
- **Photopique / mésopique / scotopique** : la vision mésopique (cônes + bâtonnets) couvre environ **0,01–3 cd/m²**
  (https://en.wikipedia.org/wiki/Mesopic_vision) ; la norme CIE 191:2010 retient ≈ 0,005–5 cd/m². En mésopique, couleurs
  désaturées, rouges assombris, bleus relativement plus lumineux (**effet Purkinje** ; pic de sensibilité 555 nm en
  photopique → 507 nm en scotopique) https://en.wikipedia.org/wiki/Purkinje_effect [S]
- **Application aux feux** [I, raisonnement] : le spectateur est adapté au ciel nocturne (mésopique), mais l'image d'une
  étoile sur la rétine est extrêmement lumineuse (photopique) → les étoiles actives sont vues en couleur et saturées. En
  revanche les **étincelles mourantes, les traînées faibles et la fumée éclairée** tombent en mésopique : les rouges faibles
  disparaissent plus vite que dans une photo, les bleus/verts faibles restent visibles mais délavés. Après une salve très
  brillante (blanc/magnésium), l'œil se désadapte quelques secondes : les effets faibles suivants paraissent plus ternes.
- **Petites sources** : pour des stimuli de très petite taille angulaire, la discrimination bleu-jaune (cônes S) s'effondre
  (« tritanopie des petits champs ») [S : https://aria.cvs.rochester.edu/papers/williams-etal_VR1981b.pdf ;
  https://pmc.ncbi.nlm.nih.gov/articles/PMC4811883]. Conséquence plausible [I] : les petites étoiles bleues lointaines
  paraissent blanchâtres, les étincelles jaune-or peu distinctes du blanc ; rouge/vert restent bien distincts.
- **Éblouissement / halo** : diffusion intraoculaire (cornée, cristallin), diffraction par les cils et la pupille →
  voile lumineux et « étoile » de rayons autour des sources brillantes ; référence classique pour le rendu :
  Spencer, Shirley, Zimmerman, Greenberg, « Physically-Based Glare Effects for Digital Images », SIGGRAPH 1995 ; Ritschel et
  al., « Temporal Glare », Eurographics 2009. [S, connaissance; non relu ici]
- **Halo coloré** : la lumière diffusée par la fumée et par l'œil garde la teinte de la source (le halo autour d'une étoile
  rouge est rouge), alors que le cœur paraît plus clair/blanchi. La fumée éclairée augmente la luminosité apparente
  (Juknelevicius 2021 mesure cet effet de réflexion par la fumée). [S/I]

### 6.2 Caméra / photo / vidéo
- **Cœur blanc, franges colorées** [S, forums techniques + physique du capteur] : le centre d'une source colorée est
  beaucoup plus lumineux que ses bords ; les filtres de Bayer ne sont pas à bande étroite, donc une lumière rouge excite
  aussi un peu les photosites verts/bleus. Quand le cœur dépasse la saturation, **les trois canaux clippent → blanc** ; la
  périphérie, moins intense, n'a qu'un canal saturé → elle garde la teinte. Même un laser monochromatique paraît blanc s'il
  est assez fort. https://scienceforums.net/topic/114221-colored-light-spectrum ;
  https://www.fredmiranda.com/forum/topic/660757/1&year=2008
- Surexposition (ISO élevé, grande ouverture) → couleurs « brûlées » vers le blanc ; la balance des blancs automatique
  combat les couleurs saturées ; **blooming** du capteur (débordement de charge) → traînées blanches. [S, sources pratiques]
- **Bleus qui virent au violet** en photo [C/I] : les bandes CuCl à 430–450 nm tombent dans une zone que sRGB rend violette
  (§2.3) et beaucoup de capteurs ont une petite sensibilité du canal rouge dans le violet ; d'où des bleus « pourpres » en
  photo, alors que l'œil voit un bleu plus franc.
- **Rouge profond** (SrCl 630–645 nm) : bien enregistré par les capteurs (filtre IR coupant vers 650–700 nm), rendu comme rouge
  pur saturé ; en vidéo compressée, les rouges saturés « bavent » (sous-échantillonnage chroma 4:2:0). [I]
- **Poses longues** : les traînées d'étincelles sont intégrées dans le temps → les fins de vie orange/rouges, peu visibles à
  l'œil (Purkinje + luminance faible), deviennent visibles sur la photo. [I]

---

## 7. Valeurs pratiques pour le moteur de rendu

### 7.1 Couleurs de base (émission, linéaire, avant exposition/tone-mapping)
Choix : partir des **mesures** (§2), gamut-mapper vers sRGB, puis légèrement corriger la teinte pour l'aspect visuel connu.
Toutes valeurs en **sRGB linéaire normalisé (canal max = 1)** ; multiplier par l'intensité HDR. Y = luminance relative de la
couleur normalisée (0,2126 R + 0,7152 G + 0,0722 B), utile pour équilibrer les intensités : à intensité lumineuse (cd) égale,
il faut un facteur ≈ 1/Y sur l'énergie RGB.

| Couleur (nom pyro) | sRGB linéaire | hex (sRGB encodé) | Y | Base / justification | Fiabilité |
|---|---|---|---|---|---|
| Rouge (strontium, qualité courante) | (1,00 ; 0,00 ; 0,03) | #FF002F | 0,21 | mesure « rouge traditionnel » (0,653 ; 0,315) | [S→C] |
| Rouge profond (haute pureté) | (1,00 ; 0,00 ; 0,06) | #FF0047 | 0,22 | mesures 0,69–0,70 / 0,29 ; hors gamut (garde 72 %) | [S→C] |
| Rouge orangé (SrOH dominant, sans chlore / trop chaud) | (1,00 ; 0,03 ; 0,00) | #FF3400 | 0,23 | lieu spectral 606 nm, λ dom. Sabatini 608 nm | [C] |
| Orange (calcium / Sr+Na) | (1,00 ; 0,15 ; 0,00) | #FF6C00 | 0,32 | CaCl 591–608 nm, désaturé | [C/I] |
| Jaune (sodium) | (1,00 ; 0,27 ; 0,00) à (1,00 ; 0,40 ; 0,05) | #FF8D00 → #FFAA3E | 0,4–0,5 | Na D 589 nm + 0–40 % de continuum (§3) ; les étoiles jaunes réelles tirent vers le second | [C] |
| Vert (baryum, qualité courante) | (0,52 ; 1,00 ; 0,05) | #BFFF40 | 0,83 | mesure « vert traditionnel » (0,366 ; 0,522), λ dom. ~560 nm | [S→C] |
| Vert émeraude (haute pureté) | (0,00 ; 1,00 ; 0,28) | #00FF90 | 0,74 | mesures (0,20 ; 0,69) ; hors gamut (garde 42 %) | [S→C] |
| Bleu (cuivre, courant) | (0,21 ; 0,27 ; 1,00) | #7D8DFF | 0,31 | mesure « bleu traditionnel » (0,218 ; 0,185) | [S→C] |
| Bleu profond (meilleur) | (0,08 ; 0,10 ; 1,00) | #5258FF | 0,16 | mesure (0,182 ; 0,116) | [S→C] |
| Bleu « brillant » délavé (avec métal) | (0,59 ; 0,45 ; 1,00) | #CAB4FF | 0,52 | mesure (0,276 ; 0,246), pureté ~26 % | [S→C] |
| Pourpre / violet (Cu+Sr) | (1,00 ; 0,02 ; 0,76) | #FF29E2 | 0,29 | mesure (0,352 ; 0,179) | [S→C] |
| Magenta / fuchsia | (1,00 ; 0,00 ; 0,37) | #FF00A4 | 0,24 | mesure (0,446 ; 0,214) | [S→C] |
| Turquoise / aqua (Cu+Ba) | (0,00 ; 1,00 ; 0,33) | #00FF9B | 0,74 | mesure (0,219 ; 0,587) | [S→C] |
| Blanc (Mg / Al, « magnésium ») | (1,00 ; 0,88 ; 0,78) à (1,00 ; 1,00 ; 1,00) | #FFF1E4 → #FFFFFF | ~0,9–1 | particules ≥ 3300–3800 K + saturation de l'œil ; un blanc légèrement chaud | [I] |
| Argent (étincelles Ti/Al) | corps noir 3300–4000 K : (1 ; 0,53–0,65 ; 0,22–0,38) | #FFC180 → #FFD3A5 | — | à rendre en HDR fort : le tone-mapping le blanchit | [C/I] |
| Or (étincelles charbon) | corps noir 1800–2200 K : (1 ; 0,21–0,30 ; 0–0,03) | #FF7E00 → #FF962F | — | idem, cœur HDR → jaune-or après tone-mapping | [C/I] |
| Rouge-orangé « fin de vie » | corps noir 1200–1500 K | #FF4400 → #FF6600 | — | luminance ÷ 50 à ÷ 3000 par rapport à 2000 K | [C] |

### 7.2 Recommandations de pipeline [I, pratique graphique]
1. Stocker chaque couleur en **xy + luminance** (ou en spectre simplifié) ; convertir vers l'espace de travail (Rec.2020 linéaire
   si possible, sinon sRGB linéaire) → permet de garder rouges/verts plus saturés sur écrans HDR/P3.
2. Rendre les étoiles en **additif HDR** : cœur (petit) à intensité très élevée (≥ 10× le blanc de référence), halo/bloom
   gaussien large d'intensité 1–5 % portant la couleur pure.
3. **Tone-mapping avec désaturation des hautes lumières** (type ACES/AgX ou « hue-preserving + path to white ») : c'est lui qui
   produit naturellement le cœur blanc et la frange colorée. Mode « photo » : clip par canal (cœur blanc dur, teintes qui
   glissent : rouge→orange→jaune→blanc, bleu→violet→blanc). Mode « œil » : désaturation douce + glare (Spencer 1995) +
   assombrissement mésopique des éléments faibles (réduire la saturation et le canal rouge pour les luminances < ~1 cd/m²).
4. Étincelles : T(t) → couleur corps noir + luminance Y rel.(T) (table §4), pas une simple interpolation de couleurs à
   luminance constante.
5. Fumée : éclairage par les étoiles (même teinte) — très important pour l'ambiance et mesuré comme non négligeable.
6. Une touche de « continuum » (mélange 10–30 % vers le corps noir 2500–3000 K) et un paramètre de pureté par couleur
   permettent de distinguer produits « bas de gamme » (couleurs lavées, vert-jaune, bleu lavande) et « haut de gamme ».

---

## 8. Sources

- Wikipedia, Pyrotechnic colorant : https://en.wikipedia.org/wiki/Pyrotechnic_colorant
- Wikipedia, Spark (fire) : https://en.wikipedia.org/wiki/Spark_(fire)
- Wikipedia, Purkinje effect : https://en.wikipedia.org/wiki/Purkinje_effect ; Mesopic vision : https://en.wikipedia.org/wiki/Mesopic_vision
- Juknelevicius et al., PEP 2021, bleus : https://epub.ub.uni-muenchen.de/75968/1/prep.202000114.pdf
- Klapötke et al., Chem. Commun. 2014, verts au bore : https://epub.ub.uni-muenchen.de/22524/1/oa_22524.pdf
- Glück/Klapötke, ZAAC 2020, rouges : https://epub.ub.uni-muenchen.de/72908/1/zaac.201900132.pdf
- Brevet US 6312537 (chromaticités mesurées rouge/vert/bleu/pourpre) : https://patents.google.com/patent/US6312537B1/en
- Brevet US 8282749 (vert ~558/562 nm) : https://patents.google.com/patent/US8282749
- Brevet rouge sans perchlorate (607–608 nm, pureté ≥ 86,8 %) : https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9856181
- Douda 1964, Theory of colored flame production (DTIC) : https://apps.dtic.mil/sti/pdfs/ADA951815.pdf
- Spectres de torches Mg/NaNO₃ (DTIC) : https://apps.dtic.mil/sti/pdfs/ADA019367.pdf
- Gaydon & Charton 1956 (SrOH) : https://arch.neicon.ru/xmlui/handle/123456789/1902895
- Inoue et al. 2019, senko-hanabi et étincelles de fer : https://www.jes.or.jp/mag/stem/Vol.80/documents/Vol.80,No.4,p.136-141.pdf
- NASA NTRS 19910023391 (étincelles de titane) : https://ntrs.nasa.gov/api/citations/19910023391/downloads/19910023391.pdf
- Penn State, particule d'aluminium : https://pure.psu.edu/en/publications/flames-structure-measurement-of-single-isolated-aluminum-particle/
- PBS Rough Science (incandescence du charbon) : https://www.pbs.org/weta/roughscience/series2/challenges/fireworks/page4.html
- SERDP (compromis pureté/intensité) : https://serdp-estcp.mil:443/projects/details/80666237-de6a-4a09-a6dd-80f3438f511c
- Tritanopie des petits champs : https://aria.cvs.rochester.edu/papers/williams-etal_VR1981b.pdf ; https://pmc.ncbi.nlm.nih.gov/articles/PMC4811883
- Saturation des capteurs : https://scienceforums.net/topic/114221-colored-light-spectrum ; https://www.fredmiranda.com/forum/topic/660757/1&year=2008
- Fonctions colorimétriques CIE 1931 (CVRL) : http://www.cvrl.org/database/data/cmfs/ciexyz31_1.csv
- Non consultés directement (références de fond) : Kosanke, « Pyrotechnic Spark Generation », J. Pyrotech. 1999 ; Shimizu,
  « Fireworks: The Art, Science and Technique » ; Conkling & Mocella, « Chemistry of Pyrotechnics ».

Script de calcul (colorimétrie, corps noir, gamut mapping) :
/tmp/claude-0/-home-user-La-passerelle-fwsim/6b2c1201-7a07-5544-bfa5-21fa40b06cb3/scratchpad/scripts/colori.py
(usage : `python3 -I colori.py ciexyz31_1.csv`)
