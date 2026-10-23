# Physique d'une bombe d'artifice — synthèse pour le simulateur PrevoFX

Synthèse (2026-10-22) de 5 recherches documentaires, détaillées dans ce dossier :
`01_bombe_balistique.md`, `02_etoiles_combustion.md`, `03_couleurs.md`,
`04_etincelles_effets.md`, `05_fumee_atmosphere.md`, `06_artifices_chinois.md` (fournisseurs standard), `07_montee.md`, `08_aerodynamique_montee.md`.
Sources principales : Shimizu (*Fireworks: The Art, Science and Technique*), articles japonais
mesurés (*Sci. Tech. Energetic Materials* : Ooki 2006, Ding 2007-2008, Wakabayashi 2006,
Sashimura 2007, Inoue 2017-2022), Kosanke (*Journal of Pyrotechnics*), Juknelevičius/Klapötke
(colorimétrie), études de qualité de l'air (fumée).

**Périmètre volontaire** : comportements physiques et rôle des familles de matériaux.
AUCUNE formulation (proportions), aucun procédé de fabrication ou d'assemblage.

Fiabilité : ✅ mesuré/publié · 🧮 calculé à partir de mesures · ⚠️ estimation à valider.

---

## 1. La bombe, de l'intérieur

| Élément | Rôle physique |
|---|---|
| Mortier | Guide la bombe, contient les gaz de la chasse. Le jeu bombe/tube fait fuir du gaz -> dispersion de vitesse de sortie. |
| Charge de chasse (poudre noire en grains) | Pousse la bombe (~70-130 m/s en sortie ✅, « ~112 m/s quel que soit le calibre » selon Kosanke) et allume la mèche. |
| Mèche à retard | Brûle pendant la montée (3-6 s ✅) et met le feu à la charge d'éclatement près de l'apogée. |
| Enveloppe + contre-collage | Résistance de la bombe : **plus elle est solide, plus la pression monte avant la rupture, plus les étoiles partent vite** (Shimizu ✅). |
| Charge d'éclatement | Fait monter la pression (pic ~8 MPa sur une 240 mm ✅), rompt l'enveloppe, donne aux étoiles leur vitesse radiale et les allume (flamme à travers toute la bombe en ~0,4 ms ✅ -> allumage quasi simultané). |
| Étoiles | Pastilles de composition (1 couche contre la paroi dans une bombe japonaise), souvent **amorcées** (couche extérieure facile à allumer). |

- **Warimono** (japonaise, s'ouvre en fleur) : enveloppe épaisse, forte charge -> sphère symétrique.
  **Pokamono** : enveloppe mince, s'ouvre en deux et LIBÈRE le contenu (saules, comètes, parachutes).
  **Cylindrique** (occidentale/italienne) : étoiles en vrac, ouverture moins sphérique, multi-coups faciles.
- **Pistil** = 2e sphère intérieure (rapport de rayons ~0,4-0,7 ⚠️). **Motifs plans** (cœur, anneau) :
  étoiles disposées dans un plan ; la bombe TOURNE en vol (0-15 tr/s, axe aléatoire ✅) -> orientation
  aléatoire à l'éclatement (d'où des motifs tirés par plusieurs).
- **Anneau lumineux d'une pivoine** : purement géométrique (une sphère projetée concentre les étoiles
  sur le bord) -> sort tout seul d'un rendu 3D.

### Séquence de l'éclatement ✅ (caméra 7200 i/s, Wakabayashi 2006)
gonflement de l'enveloppe -> rupture au JOINT des hémisphères (pas sphérique la 1re ms) -> gaz à
600-800 m/s -> fragmentation en quelques ms -> les étoiles partent derrière les fragments, de façon
globalement sphérique. Visuel : flash central bref (< ~50 ms ⚠️), petit nuage de fumée central.

## 2. Le vol des étoiles (le cœur de la simulation)

**Traînée QUADRATIQUE** ✅ : `m dv/dt = m g − ½ ρ_air C_D A |v−w| (v−w)`, C_D = 0,5 (mesuré sur
étoile réelle), ρ_étoile ≈ 1500 kg/m³, w = vent. Le diamètre de l'étoile DIMINUE en brûlant
(modèle validé à ±5 % sur les portées de Shimizu ; à diamètre constant : +15-20 % d'erreur).

- **Longueur de freinage** L ≈ 3400 × diamètre (10 mm -> 34 m ; 20 mm -> 69 m). La portée croît
  LINÉAIREMENT avec la taille d'étoile mais seulement en LOG de la vitesse de départ -> c'est la taille
  des étoiles qui fixe la taille de la fleur (dahlia = grosses étoiles = plus large).
- **Vitesse d'éjection** : 57-71 m/s mesurés sur bombes de 6" ✅ ; ~50-80 m/s (75-150 mm), 100-180 m/s
  (200-300 mm) 🧮.
- **Expansion** : 50 % du rayon final en 0,5-0,7 s, 90 % en 1,2-2,2 s, puis quasi-gel 🧮✅
  (« pleinement développée en ~2 s », Shimizu).
- **Chute** : vitesse limite ≈ √(g·L) ≈ 18 m/s (10 mm) à 30 m/s (gros calibres), qui BAISSE quand
  l'étoile rapetisse. Affaissement en fin de combustion : ~10 m (3"-6") à 20-27 m (8"-12") 🧮.
- **Vitesse héritée** de la bombe (éclatement avant l'apogée -> fleur décalée vers le haut, « en cône »),
  amortie comme le reste. **Vent** : une fois ralenties (1-2 s), étoiles et fumée suivent le vent
  d'altitude (≈ 1,5-2,5 × le vent au sol).
- Étincelles (0,1-0,5 mm) : elles oublient leur vitesse en 0,05-0,3 s -> **une traînée est une ligne
  quasi figée dans l'air** qui s'efface par l'arrière et s'affaisse lentement (1-3 m/s) : c'est le saule.

## 3. Une étoile qui brûle

- Brûle de la surface vers le centre à **3-6 mm/s** ✅ (bleu/violet les plus lents ~3, rouge ~5,
  argent ~6, jaune sodium 1-2). Durée ≈ diamètre / (2 × vitesse) : 0,8-2,4 s posée, **×1,6 en vol** ✅
  (l'air refroidit la flamme ; résultat contesté pour les étoiles non amorcées).
- **Dispersion entre étoiles d'une même bombe : ~5 %** ✅ (produit pro) -> l'extinction d'une pivoine
  est un fondu de 0,2-0,4 s, pas une coupure ; 10-20 % pour un produit médiocre.
- **Brillance ∝ débit de matière brûlée** : `I(t) ≈ efficacité (cd·s/g) × ṁ(t)`, et ṁ ∝ surface ∝
  (1−t/T)² -> **l'étoile faiblit en rapetissant** alors que sa COULEUR tient jusqu'au bout.
- **Profil de vie** ✅ : rampe d'allumage (amorce : 0,05-0,15 s, brève lueur orangée/blanchâtre),
  plateau qui décroît, fin rapide. **Scintillement fort et irrégulier** pendant toute la vie
  (combustion non uniforme) : ~10-30 % rms, 5-30 Hz ⚠️ (valeurs d'analogie).
- Flamme : ~1900-2300 K (couleur sans métal), 2300-3500 K avec métal ✅. Taille 2-4 × la pastille ⚠️ ;
  à 150 m une étoile est un POINT : sa taille perçue vient de l'éblouissement (œil/caméra), pas de la flamme.
- **Étoiles aveugles** : soufflées si éjectées trop vite (vitesse critique, l'amorçage la relève) ✅ ;
  0-3 % pour du pro ⚠️. **Changement de couleur** : couches successives (durée ≈ épaisseur / vitesse),
  avec parfois un **relais sombre** (~0,1 s) pour une transition nette ✅.
- Rôle des familles (qualitatif) : oxydant (vitesse, chaleur), combustible/liant, agent colorant
  (sels de Sr, Ba, Cu, Na, Ca), **donneur de chlore** (forme les émetteurs SrCl/BaCl/CuCl, plus purs),
  métaux Mg/Al/magnalium (brillance ×5-20 mais couleur délavée).

## 4. Les couleurs

| Couleur | Émetteur | Mesure (linéaire, max = 1) |
|---|---|---|
| Rouge | SrCl (617-646 nm), SrOH plus orangé | (1 ; 0 ; 0,03) — hors gamut sRGB |
| Vert « classique » baryum | BaCl, + BaOH sans chlore | (0,52 ; 1 ; 0,05) = **vert-JAUNE** (λ ~560 nm) ✅ |
| Vert haute pureté | BaCl | (0 ; 1 ; 0,28) — fortement hors gamut |
| Bleu cuivre | CuCl (403-456 nm), fenêtre de T étroite | (0,21 ; 0,27 ; 1) ; « bleu brillant » délavé (0,59 ; 0,45 ; 1) |
| Jaune sodium | raies D 589 nm | ambre (1 ; 0,27-0,40 ; 0) — pas un jaune citron |
| Violet | CuCl + SrCl | (1 ; 0,02 ; 0,76) |
| Blanc / argent / or | incandescence de particules | corps noir : or 1800-2200 K, argent 3300-4000 K |

- Le **bleu est le plus difficile** (pureté 28-58 % mesurée) et le plus faible en intensité (2-5× moins
  que rouge/vert). Plus de chaleur/métal = plus de lumière mais couleur lavée (compromis mesuré ✅).
- **Étincelles = corps noir** : couleur ET intensité pilotées par la température. Une étincelle qui
  refroidit de 2000 à 1500 K perd ~98 % de sa luminance : elle **s'éteint avant d'avoir l'air rouge**
  (sauf grosses particules).
- **Œil / caméra** : en photo le cœur sature les 3 canaux -> centre BLANC, frange colorée ; l'œil voit
  le cœur en couleur avec un éblouissement. Les étincelles mourantes et la fumée tombent en vision
  crépusculaire (couleurs ternes, rouges faibles qui disparaissent vite).

## 5. Étincelles et effets

| Effet | Mécanisme | Repères |
|---|---|---|
| Charbon (or : chrysanthème, saule, kamuro) | gouttelettes de scorie arrachées par le vent relatif, qui continuent de brûler | 1100-1500 K, rouge-orangé à or ; vie 0,3-1,5 s (chrysanthème) à 2-5 s+ (saule) ⚠️ ; étincelles plus FINES quand l'étoile va vite, plus GROSSES quand elle ralentit -> la texture de la traînée change le long du trajet ✅ |
| Titane / aluminium (argent) | particule de métal qui brûle seule | ~2400 K+ ; Ti finit par micro-explosion ; Al branche rarement |
| Fer + carbone (« fleurs ») | bulles de CO qui font éclater la goutte | ~2050 K, éclate après ~10 ms, 2-3 générations, flash juste avant ✅ |
| Paillettes (glitter) | goutte terne puis FLASH retardé | délai 20 ms-2 s (pearl -> twinkler) ⚠️, flash blanc-jaune de quelques ms, ×20-100 |
| Strobe | combustion oscillante couvaison/flash | 1-10 Hz (jusqu'à 20), flash ~2000 K, sombre ~1100 K, étoiles NON synchrones ✅ |
| Crépitant (œufs de dragon) | réaction de type thermite intermittente, un « pop » par grain | délai 1-3 s ⚠️, flash blanc < 5 ms, salve étalée 0,5-2 s |
| Crossette | la comète se brise en ~4 après un court trajet | flash au point de division |
| Sifflet | résonateur quart d'onde thermo-acoustique | 2-5 kHz, hauteur qui DESCEND (le tube s'allonge en brûlant) ✅ |

## 6. Fumée et atmosphère

- Composition : surtout **sels de potassium** (carbonate, sulfate, chlorure) + oxydes blancs (MgO,
  Al₂O₃) + un peu de carbone (gris/brun). Elle est **blanche/grise**, ne garde pas la couleur des étoiles.
- Se forme **instantanément** (ms) le long de CHAQUE trajet d'étoile (« fantôme » du motif) et au centre.
  Particules 0,2-0,8 µm : ne tombent pas, dérivent avec le vent, montent seulement de 20-60 m 🧮.
- Quantité de fumée fine : 12-25 % de la masse des étoiles, ~5 % de la poudre d'éclatement, ~40 % des
  marrons ✅.
- **Optique** : quasi grise, très diffusante vers l'AVANT -> **elle prend exactement la couleur de ce
  qui l'éclaire**, y compris ses propres étoiles ; éclairée par-derrière elle est 5-15× plus lumineuse
  (halo, « nuage éclairé de l'intérieur ») 🧮.
- **Voile** : par vent faible et nuit stable, la fumée s'accumule tout le spectacle (contraste qui
  baisse, final « dans le brouillard ») ✅ ; une nuit humide (> 85 %) donne une fumée beaucoup plus
  blanche et épaisse.
- Lumière au public : grosse bombe ~0,5-5 lux à 300 m (clair de lune fort) ⚠️ ; reflet sur l'eau
  13-58 % sous incidence rasante 🧮. Son : 343 m/s (0,44 s à 150 m).

---

## 6 bis. Fournisseurs standard (Chine : Liuyang / Liling) — ce que l'on tire réellement en Europe

Chaque fabricant a ses recettes (c'est de l'artisanat, même à l'échelle industrielle), et la charge
d'éclatement est adaptée à chaque effet. Ce qui est normé et mesuré (normes GB 19594-2015, GB 24284) :

| Calibre (mortier) | Hauteur nominale | Plage admise | Ø de fleur (pivoine) |
|---|---|---|---|
| 75 mm (bombe 72 mm) | ~95 m | 50–120 m | 50–60 m |
| 100 mm | ~115 m | 60–140 m | 70–80 m |
| 125 mm | ~135 m | 80–190 m | 90–110 m |
| 150 mm | ~155 m | 100–220 m | 110–130 m |
| 200 mm | ~195 m | 130–260 m | 150–170 m |

- Par rapport aux tables japonaises : hauteur −15 à −25 %, diamètre −25 à −35 % à mortier égal
  (un « 6# » chinois = un 5 gō japonais). La norme impose Ø fleur ≤ hauteur.
- **Le moteur est calé sur ce standard** (pivoine 75 mm ≈ 80 m, envergure ≈ 50-60 m) ✅.
- Dispersion : hauteur σ ≈ 12 % (pro) à 18 % (économique), mesuré (Wharton 1995) ; ≥ 98 % d'étoiles
  allumées exigé (donc 0-2 % d'aveugles) ; durée d'effet catalogue 2 s ±20 % (4"), 2,5 s ±20 % (5").
- Symétrie (estimations) : direction de chaque étoile ±5-8° (sphérique chinoise) contre ±2-4°
  (japonaise) ; bombe CYLINDRIQUE : fleur aplatie (rapport d'axes 1,3-1,6), plus brouillonne.
- Puissance d'éclatement par effet : pivoine/chrysanthème FORTE ; couronne/saule/kamuro plus DOUCE
  (~0,6-0,8× la vitesse d'éjection, chute longue) ; feuilles mortes TRÈS douce (fragments plats,
  1-3 m/s, dérivent au vent) ; motifs : assez douce pour garder la forme.
- **Motifs plans** : la bombe culbute (brevets chinois : présentation au public impossible à garantir).
  Orientation uniforme -> **29 % des tirs à moins de 45° de la face**, ~7 % de cœurs lisibles ET à
  l'endroit -> on les tire par 3 à 5.
- Couleurs : aucune mesure comparative publiée ; défauts typiques cités par les fabricants eux-mêmes :
  rouges rosâtres, bleus qui blanchissent ; changements de couleur moins synchrones (σ ~0,15 s contre
  ~0,05 s en japonais).
- Grammaire des catalogues : « effet A **to** effet B **with** pistil / traînée / crépitement »,
  souvent avec un effet de MONTÉE (rising tail, rising flowers, whistle).

## 7. Comparaison avec le moteur PrevoFX (B382)

| Point | Réel (sources) | Moteur | Écart |
|---|---|---|---|
| Expansion de la pivoine | 50 % en ~0,5-0,7 s, 90 % en 1,2-2,2 s | frein linéaire k = 0,7×2 = 1,4/s -> 50 % à 0,5 s, 90 % à 1,6 s | ✅ **conforme** (le réglage « punch » validé tombe pile) |
| Forme du freinage | quadratique (très brutal les 0,1-0,2 premières s) | linéaire (exponentiel) | léger : le début réel est encore plus « explosif » |
| Chute en fin de vie | vitesse limite ~18 m/s (étoile de 10 mm) -> affaissement ~10 m | **B383 corrigé** : chute séparée de l'éjection, vitesse limite 18 m/s × √(échelle du calibre) pour les étoiles lourdes (gravStar ≥ 0,9) ; pivoine 75 mm : −7,4 m en fin de vie (avant −4,5 m), envergure inchangée. `?chute=0` = avant | ✅ |
| Étoile qui rapetisse | traînée/masse recalculées, freinage croissant | taille de traînée constante | second ordre |
| Dispersion des durées d'étoiles | ~5 % (pro japonais, « de l'art ») ; fournisseurs standard plus dispersés | **B383 : 10 %** (choix user, niveau fournisseur standard) | ✅ |
| Brillance en fin de vie | ∝ surface (1−t/T)², couleur tenue | `1 − 0,85·A²`, couleur tenue | ✅ esprit conforme (le réel faiblit plus tôt et plus progressivement) |
| Scintillement de combustion | 10-30 % rms, irrégulier | B382 : ~10 % rms à 14 Hz | ✅ bas de fourchette |
| Allumage / amorce | 0,05-0,15 s de lueur orangée-blanche | cœur blanc les 15 premiers % de vie | ✅ proche |
| Vert | baryum classique = vert-JAUNE (0,52 ; 1 ; 0,05) | `GRN` (0,3 ; 1 ; 0,45) = émeraude bleuté | ⚠️ couleur à valider par l'artificier |
| Rouge | (1 ; 0 ; 0,03) | `RED` (1 ; 0,14 ; 0,18) | plus rosé que le réel |
| Bleu | (0,21 ; 0,27 ; 1) à (0,59 ; 0,45 ; 1) délavé | `BLU` (0,4 ; 0,55 ; 1) | ✅ dans la fourchette |
| Étincelles de charbon | corps noir : s'éteignent en perdant leur éclat bien avant le rouge | `COPPER` + refroidissement (B363) | à vérifier effet par effet |
| Fumée éclairée par ses propres étoiles | oui (physique) | non (B381 : seulement par les AUTRES bombes, car le rendu faisait des taches) | limite de rendu, pas de physique |
| Montée d'une 75 mm | ~2,9 s tir -> éclatement (profession), éclatement avant le sommet à ~10 m/s | **B387** : balistique à traînée quadratique, 80 m en 2,9 s, v0 ≈ 51 m/s, élan transmis aux étoiles | ✅ |
| Motifs plans | orientation aléatoire (bombe qui tourne) | aléatoire, avec un tirage « bon sens » (face public ±19°, debout) de 55 % (B130) | ✅ esprit conforme (taux à confirmer : user évoque 3/10) |
| Étoiles aveugles, flash d'éclatement, pistil | 0-3 % ; flash < 50 ms ; pistil 0,4-0,7 R | — / flash présent / pistils par effet | options possibles |

**Règle** : tout changement de PHYSIQUE (trajectoires, durées, nombres) se fait avec l'accord
de l'artificier ; ce tableau sert à proposer, pas à imposer.
