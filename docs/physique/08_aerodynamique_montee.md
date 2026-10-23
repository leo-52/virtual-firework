# 08 — Aérodynamique de la montée des bombes (notes pour le simulateur)

Suite de `01_bombe_balistique.md`, centrée sur la **phase de montée** : équations du mouvement, hauteurs et temps, comportement latéral (rotation, dispersion, vent), bombes cylindriques et calage de l'éclatement par rapport à l'apogée.

Ces notes ne contiennent **aucune formulation, aucune masse de charge (chasse ou éclatement) et aucune procédure de fabrication**. Les seules données d'entrée sont la masse, le diamètre et la longueur des bombes finies, ainsi que la vitesse de sortie du mortier.

Légende de fiabilité (la même que dans la note 01) :
- ✅ **Sourcé** : mesure ou calcul publié, référence au §12.
- 🟡 **Ordre de grandeur / règle de métier** : source secondaire ou large dispersion.
- 🧮 **Calculé** : mes propres calculs, avec les scripts
  - `/tmp/claude-0/-home-user-La-passerelle-fwsim/6b2c1201-7a07-5544-bfa5-21fa40b06cb3/scratchpad/calc/montee.py` (sortie : `/tmp/claude-0/-home-user-La-passerelle-fwsim/6b2c1201-7a07-5544-bfa5-21fa40b06cb3/scratchpad/calc/montee_out.txt`)
  - `/tmp/claude-0/-home-user-La-passerelle-fwsim/6b2c1201-7a07-5544-bfa5-21fa40b06cb3/scratchpad/calc/montee_calib.py` (sortie : `/tmp/claude-0/-home-user-La-passerelle-fwsim/6b2c1201-7a07-5544-bfa5-21fa40b06cb3/scratchpad/calc/montee_calib_out.txt`)
- ⚠️ **Incertain** : hypothèse, extrapolation ou sources contradictoires.

---

## 0. Résumé pour l'implémentation (TL;DR)

| Grandeur | Valeur recommandée | Fiabilité |
|---|---|---|
| C_D d'une bombe sphérique | Modèle de Mercer en fonction de Re : **0,50 sous Re ≈ 4·10⁵, 0,40 au-dessus**, transition douce. Kosanke utilise une valeur moyenne unique de **0,36** (0,40 pour un 3" → 0,31 pour un 12") | ✅ |
| C_D d'une bombe cylindrique qui culbute | **0,9 rapporté à A = ½(πd²/4 + d·L)** ; cela équivaut à ≈ 1,0 sur la section frontale, soit environ 2 fois la sphère | ✅ (forme) / 🧮 (calé sur un vol Kosanke de 4") |
| Hauteur en fonction du temps (montée) | **Forme fermée** h(t) = H · ln[cos(Λ(1−t/T)) / cos Λ] / (−ln cos Λ). On prend **Λ ≈ 0,95–1,05 pour une sphère** et **≈ 1,10–1,25 pour un cylindre** | 🧮 (exacte à C_D constant, écart < 1 % avec C_D(Re)) |
| Courbe normalisée moyenne pour une sphère (h/H à t/T = 0,1…1) | 0,22 · 0,41 · 0,56 · 0,68 · 0,79 · 0,87 · 0,93 · 0,97 · 0,99 · 1 | 🧮 |
| Temps passé à moins de 21 m (70 ft) de l'apogée | **≈ 4,2 s quel que soit le calibre** (≈ 2,9 s à moins de 10 m) | ✅ (Kosanke) / 🧮 |
| Moment d'éclatement idéal | **1,5 à 2 s avant l'apogée** : la bombe est alors 11 à 20 m plus bas et monte encore à 15–20 m/s | ✅ (Kosanke) / 🧮 |
| Retard entre l'arrivée du feu de la mèche et la rupture de l'enveloppe | ~40 ms (75 mm) à ~110 ms (250 mm) | ✅ |
| Rotation d'une sphère | 0 à 15 tr/s. L'axe est aléatoire et **fixe** pendant le vol. Environ 10–20 % des bombes ne tournent pas | ✅ (Ding 2008) |
| Rotation d'un cylindre | Culbute à ~5 tr/s, rythme **constant** pendant tout le vol (une seule mesure, 4") | ✅ / ⚠️ |
| Dispersion du point d'apogée en tir vertical, sans vent | Écart radial moyen ≈ **5 à 15 % de H**. Pour un 150 mm à 180 m : ~15–28 m en moyenne, 95 % des cas sous ~50 m | 🧮 (calé sur la dérive mesurée des bombes noires) / ⚠️ |
| Dérive des bombes noires au point de chute | **0,38 m par mm de calibre** pour une sphère, **0,24 m/mm** pour un cylindre (moyennes). 1 % des bombes dérivent jusqu'à 3 fois la moyenne | ✅ (Kosanke 1992) |
| Dérive de l'apogée par le vent (3–5 m/s mesurés à 2 m) | **6 à 33 m pour une sphère, 9 à 46 m pour un cylindre**, selon le calibre et le profil de vent (jour / nuit stable) | 🧮 |
| Inclinaison θ du mortier | Déplacement de l'apogée ≈ **1,65·H·tan θ** (sphère) ou **1,5·H·tan θ** (cylindre). Perte de hauteur : −2 % à 10°, −10 % à 20°, −22 % à 30° | 🧮 (cohérent avec Weinman 2009) |
| Hélice des étincelles de mèche | Rayon ≤ d/2 (3,5 à 10 cm). Pas = v/f, soit ~6 m à la sortie du mortier et ~0,3–0,6 m près de l'apogée | 🧮 |

---

## 1. Équations du mouvement recommandées

### 1.1 Translation ✅ (Kosanke 1992 ; Mercer 2002 ; Ding 2007-2008 ; Weinman 2009)

```
m dv/dt = m g − ½ ρ C_D(Re) A |u| u + F_Magnus        u = v − w(z)   (vitesse par rapport à l'air)
dx/dt   = v
Re      = |u| d / ν          ν ≈ 1,5·10⁻⁵ m²/s ; ρ ≈ 1,20 kg/m³ (20 °C, niveau de la mer)
```

- **Poussée d'Archimède** : elle vaut ρ/ρ_bombe ≈ 0,1 % de g. On la néglige. Ding l'inclut, mais elle n'a aucun effet visible.
- **Masse volumique de l'air** : à 1 000 m d'altitude, ρ ≈ 1,11 kg/m³, et les bombes montent environ 4 % plus haut. Kosanke prend 1,28 kg/m³ (0 °C), une valeur « conservatrice ». Weinman met à jour ρ et μ le long de la trajectoire, mais l'effet sur ~200 m de montée est inférieur à 2 %.
- **Pas de temps** : Kosanke montre que Δt = 0,01 s suffit avec un schéma d'Euler amélioré (6,78 s / 965 ft, contre 6,79 s / 966 ft à 0,001 s). En RK4, on peut prendre 0,01–0,02 s ; mon script utilise 2 ms.

### 1.2 C_D de la sphère en fonction du nombre de Reynolds ✅

**Modèle de Mercer (J. Pyrotech. 16, 2002)**, calé sur les données de tir de Shimizu (écart type de 6,9 % sur les hauteurs) :

```
si Re ≥ R_T : C_D = C_min + ½(C_max − C_min) · exp(−(Re − R_T)/ΔR)
si Re < R_T : C_D = C_max − ½(C_max − C_min) · exp(−(R_T − Re)/ΔR)
C_min = 0,40 ; C_max = 0,50 ; R_T = 4·10⁵ ; ΔR = 5·10⁴
```

⚠️ Le texte du PDF est abîmé à cet endroit. J'ai ajouté le facteur ½ pour que la fonction soit continue en R_T.

**Ordres de grandeur du nombre de Reynolds** 🧮 :
- 75 mm : 2,8·10⁵ à 60 m/s, 9·10⁴ à 20 m/s ;
- 200 mm : 1,2·10⁶ à 90 m/s.

Les gros calibres passent donc la première moitié de la montée au-delà de la transition, avec un C_D d'environ 0,4. Tous les calibres finissent la montée vers 0,5.

**Les autres valeurs publiées sont cohérentes** ✅ :
- Kosanke (1992), C_D effectif calé sur 15 tirs de Shimizu : 0,397 pour un 3", 0,368 pour un 6", 0,310 pour un 12", soit 0,36 en moyenne. Avec une seule valeur de 0,36, l'écart est de 0,3 s sur le temps et de 34 ft sur l'apogée.
- Ding (2007) : 0,4–0,5.
- Shimizu : une valeur unique de 0,472.
- Weinman (2009) : les bombes ne sont ni rondes ni lisses, ce qui **déplace la crise de traînée vers les Re plus bas**. Le C_D se stabilise alors « entre 0,2 et 0,4 ». Leur modèle recalé sur 85 tirs prédit les temps de vol à 0,7–1 % près.

**Analogie avec les balles de sport** 🟡 :
- sphère lisse : crise de traînée vers Re ≈ 3,5·10⁵ ;
- balle de baseball (coutures) : vers ~1,5–2·10⁵ ;
- balle de golf (alvéoles) : vers ~5·10⁴, avec C_D ≈ 0,25 au-delà.

Une bombe en papier contre-collé, avec sa mèche en saillie, se situe entre la balle de baseball et la sphère lisse.

⚠️ **Conséquence** : selon le C_D retenu (0,30 à 0,55), la vitesse de sortie nécessaire pour une hauteur donnée varie de ±12 % (voir §3.3). Pour le simulateur, **on règle la hauteur (le paramètre visible) et on en déduit v0**, pas l'inverse.

### 1.3 Bombe cylindrique ✅/🧮

- Les cylindres n'ont aucune stabilisation et **culbutent** (Mercer, Kosanke).
- Aire de référence moyenne proposée par Mercer : **A = ½ (π d²/4 + d·L)**. Mercer attend un C_D entre 0,5 et 1,0, sans mesure.
- Kosanke (1990) suppose un C_D de cylindre égal à **2 fois celui de la sphère** (sur la section frontale).
- 🧮 **Calage** sur le seul vol de cylindre publié avec une trajectoire mesurée : 4" RAP, Ø 92 mm × 89 mm, apogée 340 ft (104 m) en 4,0 s, à 1 400 m d'altitude (Kosanke 1994). On obtient **C_D = 0,80 / 0,92 / 1,00 sur l'aire de Mercer** pour une masse supposée de 0,40 / 0,454 / 0,50 kg, avec v0 ≈ 72 m/s. ⚠️ La masse de la bombe de ce vol n'est pas publiée.
- **Valeur retenue : C_D = 0,9 sur l'aire de Mercer.**

### 1.4 Rotation et effet Magnus ✅ (forme) / ⚠️ (coefficients)

**Décroissance de la rotation** (Ding & Yoshida 2008, d'après Dennis) :

```
I dω/dt = −T,   T = ½ ρ (d/2)⁵ C_T ω²,   I = (8/15) π ρ_p (d/2)⁵   (sphère homogène)
⇒ ω(t) = ω0 / (1 + t/τ),   τ = 16 π ρ_p / (15 ρ C_T ω0)
```

Ding mesure C_T ≈ 35–70 pour un 3 gō, ce qui donne **τ ≈ 1–2 s**.

⚠️ **Les sources se contredisent** :
- Kosanke (1994) mesure un cylindre de 4" qui culbute à **5,3 tr/s « essentiellement constant pendant tout le vol »** (9 s) ;
- pour une balle de baseball de taille et de masse voisines de celles d'un 3", Nathan estime une constante de décroissance de **20–25 s**.

Hypothèse : le contenu en vrac d'une vraie bombe (étoiles, charge) amortit la rotation de l'enveloppe par frottement interne, comme dans un œuf cru. La bombe d'essai de Kosanke était inerte. **Pour le simulateur : τ tiré entre 1,5 et 10 s.** Le résultat dépend peu de ce choix (§5.3).

**Force de Magnus.** Ding utilise C_L = 1,6–2,0 (Yamamoto), mais dans une forme d'équation mal lisible dans le PDF. Je recommande la formulation des balles de sport, mieux documentée 🟡 :

```
F_L = ½ ρ A |u|² C_L(S) · (ω × u)/|ω × u|,   S = (d/2)|ω| / |u|   (paramètre de rotation)
C_L = 1,5 S (S < 0,1) ;  C_L = 0,09 + 0,6 S (S ≥ 0,1)     (Sawicki, Hubbard & Stronge 2003, baseball)
```

🧮 Ordres de grandeur pour un 75 mm à 10 tr/s :
- à 60 m/s : S ≈ 0,04, la portance vaut ~6 % de la traînée ;
- près de l'apogée, à 10 m/s : S ≈ 0,24, C_L ≈ 0,23, mais la force reste faible parce que u² est petit.

L'effet de Magnus est donc **une courbure lente**, pas un écart brutal. Pour retrouver la dérive mesurée par Kosanke, il a fallu multiplier ce C_L par ~1,5 (§5.3). ⚠️ Ce facteur absorbe aussi les autres causes de dérive, notamment le décollement dissymétrique de la couche limite proposé par Schneider (2000).

### 1.5 Vent ✅/🟡

- On calcule la traînée sur la vitesse **relative à l'air** (Kosanke 1992, équation 5).
- Profil vertical en loi puissance : **U(z) = U_réf (z/z_réf)^α**.
  - Takahashi, cité par Shimizu : α = 1/n, avec n ≈ 3 sur terre et 2,5 sur mer (plage 2,2–3,5), z_réf = 2 m, formule valable jusqu'à ~120 m.
  - Littérature éolienne (exposant de Hellmann) : α ≈ 0,1–0,2 en atmosphère neutre ou de jour ; **α > 0,2 la nuit en atmosphère stable**, soit 0,27 sur l'eau, ~0,34–0,40 sur une côte ou un terrain ouvert, jusqu'à 0,6 au-dessus d'une ville.
  - **Un feu d'artifice se tire la nuit** : le profil de Shimizu (α ≈ 1/3) est donc le bon choix par défaut.
- Règle de Kosanke 🟡 : le vent « à hauteur de poitrine » vaut environ la moitié de celui à 15 m (50 ft).
- ⚠️ La nuit, un **courant-jet de basse couche** peut apparaître vers 100–300 m. Le vent en altitude peut alors dépasser largement l'extrapolation. Aucune donnée spécifique aux feux d'artifice.

---

## 2. Données des bombes et coefficient balistique β = m/(C_D·A)

### 2.1 Sphériques (masses et diamètres publiés)

| Calibre | Ø réel | Masses publiées | Sources |
|---|---|---|---|
| 75 mm (3") | 69–71 mm | 103–155 g (Weinman, factices calibrées) ; 177–240 g (Wharton, bombes réelles) ; 0,24 kg (Ding, 3 gō) ; 0,3 lb = 136 g (Kosanke, nominal) | ✅ |
| 100 mm (4") | 94 mm (3,70") | 246–527 g (Wharton) ; 0,8 lb = 363 g (Kosanke, nominal d'après Shimizu) | ✅ |
| 125 mm (5") | 117 mm (4,6") | 755–768 g (Wharton) ; 1,5 lb = 680 g (Kosanke) | ✅ |
| 150 mm (6") | 136–142 mm | 0,80–1,24 kg (Weinman) ; 1,13 kg (Kosanke, 5,56–5,62") ; 1,25 kg (Shimizu, Ø 14,2 cm) ; 1,15–1,5 kg (Shimizu, tableau 27) | ✅ |
| 200 mm (8") | 193 mm (7,6") | 2,30 / 2,87 / 3,45 kg (Weinman : léger / moyen / lourd) ; 5,5 lb = 2,5 kg (Kosanke) | ✅ |
| 300 mm (12") | 290 mm | 8,27 kg (Shimizu via Mercer) ; 8,3–9,2 kg (Shimizu, tableau 27) ; 18 lb = 8,2 kg (Kosanke) | ✅ |

### 2.2 Cylindriques ✅

Source : Kosanke 1992, tableau 6 (bombes inertes d'essai), et valeurs nominales de Kosanke 1990.

| Calibre | Ø | Longueur | Masse |
|---|---|---|---|
| 75 mm | 67 mm | 69 mm | 180 g (0,4 lb nominal) |
| 100 mm | 92 mm | 89 mm | 460 g (1,0 lb nominal) |
| 125 mm | 114 mm | 102 mm | 910 g (2 lb nominal) |
| 150 mm | 141 mm | 127 mm | 1,80 kg (4 lb nominal) |
| 200 mm | 193 mm | ~170 mm ⚠️ | ~4,0 kg ⚠️ (10 lb nominal pour une bombe plus longue) |

### 2.3 Coefficients balistiques et vitesses terminales 🧮

Hypothèses : C_D = 0,45 pour une sphère (moyenne de montée), 0,90 sur l'aire de Mercer pour un cylindre. La vitesse terminale de chute est calculée avec C_D = 0,5 pour la sphère.

| Type | Calibre | Masse (kg) | A (cm²) | β (kg/m²) | v_t (m/s) |
|---|---|---|---|---|---|
| Sphère | 75 | 0,13 / **0,18** / 0,24 | 38,5 | 75 / **104** / 139 | 33 / **39** / 45 |
| Sphère | 100 | 0,25 / **0,40** / 0,53 | 69,4 | 80 / **128** / 170 | 34 / **43** / 50 |
| Sphère | 125 | 0,55 / **0,72** / 0,77 | 107,5 | 114 / **149** / 159 | 41 / **47** / 48 |
| Sphère | 150 | 0,85 / **1,15** / 1,25 | 158,4 | 119 / **161** / 175 | 42 / **49** / 51 |
| Sphère | 200 | 2,30 / **2,87** / 3,45 | 292,6 | 175 / **218** / 262 | 51 / **57** / 62 |
| Sphère | 300 | 7,0 / **8,3** / 9,2 | 660,5 | 236 / **279** / 310 | 59 / **64** / 67 |
| Cylindre | 75 | 0,18 | 40,7 | 49 | 28 |
| Cylindre | 100 | 0,46 | 74,2 | 69 | 34 |
| Cylindre | 125 | 0,91 | 109,2 | 93 | 39 |
| Cylindre | 150 | 1,80 | 167,6 | 119 | 44 |
| Cylindre | 200 | 4,0 | 310,3 | 143 | 48 |

À calibre égal, **un cylindre a un β inférieur d'environ 30 à 50 % à celui d'une sphère, malgré une masse plus élevée**. Il doit donc partir plus vite pour monter aussi haut. Il ralentit plus tôt et atteint son apogée plus tôt.

---

## 3. Vitesse de sortie, apogée et temps de montée

### 3.1 Hauteurs cibles demandées 🧮

Hypothèses : tir vertical, sans vent, ρ = 1,2 kg/m³, C_D(Re) de Mercer pour les sphères et 0,9 pour les cylindres, masses « typiques » du §2.

| Type | Calibre | H apogée | **v0 (m/s)** | **t_apogée (s)** | v à 0,5 s (m/s) | Λ |
|---|---|---|---|---|---|---|
| Sphère 0,18 kg | 75 | **80** | **52** | **3,70** | 41 | 0,93 |
| Sphère 0,18 kg | 75 | **95** | **60** | **3,97** | 46 | 1,00 |
| Cylindre 0,18 kg | 75 | 80 / 95 | 70 / 86 | 3,42 / 3,62 | 45 / 53 | 1,19 / 1,25 |
| Sphère 0,40 kg | 100 | **105** | **61** | **4,22** | 48 | 0,95 |
| Sphère 0,40 kg | 100 | **115** | **65** | **4,38** | 52 | 0,98 |
| Cylindre 0,46 kg | 100 | 105 / 115 | 77 / 85 | 3,96 / 4,09 | 54 / 58 | 1,16 / 1,20 |
| Sphère 0,72 kg | 125 | 130 / 140 | 67 / 71 | 4,68 / 4,82 | 56 / 59 | 0,96 / 0,99 |
| Cylindre 0,91 kg | 125 | 130 / 140 | 82 / 88 | 4,46 / 4,58 | 61 / 65 | 1,13 / 1,16 |
| Sphère 1,15 kg | 150 | **155** | **74** | **5,09** | 62 | 0,99 |
| Sphère 1,15 kg | 150 | **180** | **84** | **5,40** | 69 | 1,04 |
| Cylindre 1,80 kg | 150 | 155 / 180 | 86 / 100 | 4,93 / 5,20 | 66 / 76 | 1,09 / 1,15 |
| Sphère 2,87 kg | 200 | **195** | **80** | **5,78** | 69 | 0,96 |
| Sphère 2,87 kg | 200 | 230 | 92 | 6,19 | 78 | 1,02 |
| Cylindre 4,0 kg | 200 | 195 / 230 | 98 / 117 | 5,49 / 5,82 | 77 / 90 | 1,11 / 1,18 |

Lecture du tableau :
- **Les hauteurs cibles demandent v0 ≈ 52–92 m/s pour une sphère et 70–117 m/s pour un cylindre.** C'est cohérent avec les mesures publiées : 57 m/s pour un cylindre de 3" tiré d'un mortier de finale court, ~72 m/s pour un cylindre de 4", 91–98 m/s comme valeur « typique » chez Kosanke et Weinman, 104–152 m/s pour les sphères de Shimizu.
- Les hauteurs cibles (75 mm → 80–95 m, etc.) se situent **dans la moitié basse des mesures publiées**. Pour un 75 mm, ces mesures donnent 62–121 m chez Wharton (16 tirs), 124 m de moyenne chez Kosanke-Schwertley (110–140 m), 163 m chez Dixon (141–186 m) et 108 m chez Shimizu. Pour un 150 mm : 237 m de moyenne (217–266 m) chez Kosanke-Schwertley, 208–263 m chez Shimizu. Elles correspondent donc à des bombes lourdes ou « européennes » ✅/🟡.

### 3.2 Recette analytique (C_D constant, à utiliser directement dans le moteur) 🧮

Avec k = ρ C_D A / (2m) = g / v_t² :

```
v_t  = sqrt(2 m g / (ρ C_D A))            vitesse terminale
cos Λ = exp(−g H / v_t²)                  (H = apogée voulue)
T    = Λ · v_t / g                         temps de montée
v0   = v_t · tan Λ                         vitesse de sortie nécessaire
h(t) = (v_t²/g) · ln[ cos(Λ − g t / v_t) / cos Λ ]          0 ≤ t ≤ T
v(t) = v_t · tan(Λ − g t / v_t)
```

Vérification sur un 150 mm sphérique (v_t = 51,6 m/s avec C_D = 0,45), H = 180 m :
- formule : Λ = 1,03 → T = 5,42 s et v0 = 85,7 m/s ;
- simulation avec C_D(Re) : 5,40 s et 83,8 m/s.

**L'écart est inférieur à 2 %.** On peut donc piloter la montée par (calibre, H), sans intégrer d'équation différentielle.

### 3.3 Sensibilité 🧮

**Au C_D** (sphère, masse typique, H haute) : v0 en m/s / T en s.

| Calibre / H | C_D 0,30 | Mercer | C_D 0,45 | C_D 0,55 |
|---|---|---|---|---|
| 75 / 95 m | 52 / 4,14 | 60 / 3,97 | 58 / 4,01 | 63 / 3,93 |
| 100 / 115 m | 58 / 4,56 | 65 / 4,38 | 64 / 4,42 | 68 / 4,33 |
| 150 / 180 m | 76 / 5,62 | 84 / 5,40 | 86 / 5,41 | 95 / 5,27 |
| 200 / 230 m | 84 / 6,38 | 92 / 6,19 | 95 / 6,15 | 104 / 6,01 |

**Le temps de montée T est peu sensible (±4 %)**, alors que v0 l'est davantage (±12 %).

**À la masse** : pour un 100 mm de 0,25 / 0,40 / 0,53 kg visant 115 m, il faut v0 = 79 / 65 / 60 m/s, et T vaut 4,13 / 4,38 / 4,49 s.

### 3.4 Validation de l'intégrateur 🧮 contre les publications ✅

| Cas | Publié | Mon modèle |
|---|---|---|
| Kosanke 1993 : 3", 0,3 lb, 300 ft/s, C_D 0,40 | 440 ft / 4,5 s | 447–466 ft / 4,46–4,58 s (ρ 1,28–1,19) |
| Kosanke 1993 : 6", 2,5 lb, 340 ft/s, C_D 0,37 | 760 ft / 6,0 s | 763–790 ft / 6,06–6,19 s |
| Kosanke 1993 : 12", 18 lb, 360 ft/s, C_D 0,31 | 1 100 ft / 7,6 s | 1 106–1 138 ft / 7,56–7,70 s |
| Kosanke 1992 : 6,85", 4,65 lb, 390 ft/s | 966 ft / 6,79 s | 983 ft / 6,85 s |
| Kosanke 2004 : bombe noire, vent uniforme de 5 mph, déplacement au sol | 15 / 16 / 17 m (3/6/12") | 14,9 / 16,4 / 15,4 m |
| Shimizu (via Mercer) : Ø 14,2 cm, 1,25 kg, 119,6 m/s | 263 m / 6,9 s | 275 m / 6,4 s (C_D de Mercer) |
| Weinman 2009 : 3" à 5°, 91 m/s, altitude 2 500 ft | ~500 ft (lu sur la figure) | 419 ft avec le C_D de Mercer. Leur C_D(Re), recalé, est donc plus bas (~0,3) aux Re élevés ⚠️ |

**Fourchettes de hauteur réelles** ✅ : il faut prévoir **±7–18 % d'écart type** sur la hauteur d'un tir à l'autre.
- Kosanke-Schwertley : σ = 15 m sur 124 m (3"), 20/171 (4"), 16/237 (6"), 27/289 (8"), 59/333 (10"), 41/355 (12").
- Shimizu : σ = 9–18 m, et σ = 0,29–0,56 s sur le temps de montée.
- Sur 8 tirs de 255 mm, Kosanke a mesuré entre 206 et 422 m.

---

## 4. Courbes hauteur-temps (montée)

### 4.1 Courbe normalisée (h/H en fonction de t/T) 🧮

Calcul sur 20 cas (5 calibres × 2 hauteurs × sphère ou cylindre).

| t/T | 0 | 0,1 | 0,2 | 0,3 | 0,4 | 0,5 | 0,6 | 0,7 | 0,8 | 0,9 | 1,0 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Sphère (moyenne)** | 0 | **0,223** | **0,407** | **0,559** | **0,684** | **0,785** | **0,865** | **0,925** | **0,967** | **0,992** | 1 |
| **Cylindre (moyenne)** | 0 | **0,252** | **0,443** | **0,593** | **0,712** | **0,806** | **0,879** | **0,933** | **0,970** | **0,993** | 1 |
| Enveloppe des 20 cas | 0 | 0,218–0,272 | 0,400–0,467 | 0,552–0,615 | 0,678–0,730 | 0,780–0,819 | 0,862–0,887 | 0,923–0,938 | 0,966–0,973 | 0,992–0,993 | 1 |
| Vide (parabole), pour comparaison | 0 | 0,190 | 0,360 | 0,510 | 0,640 | 0,750 | 0,840 | 0,910 | 0,960 | 0,990 | 1 |
| Formule §3.2, Λ = 1,0 | 0 | 0,228 | 0,413 | 0,565 | 0,688 | 0,788 | 0,866 | 0,926 | 0,967 | 0,992 | 1 |
| Formule §3.2, Λ = 1,2 | 0 | 0,259 | 0,452 | 0,602 | 0,719 | 0,811 | 0,882 | 0,935 | 0,971 | 0,993 | 1 |

**Vitesse normalisée v/v0, sphère** (typique) : 1 · 0,82 · 0,68 · 0,56 · 0,45 · 0,36 · 0,28 · 0,21 · 0,14 · 0,07 · 0.
**Cylindre** : 1 · 0,75 · 0,58 · 0,46 · 0,36 · 0,28 · 0,22 · 0,16 · 0,10 · 0,05 · 0.

Lecture :
- La moitié de la hauteur est atteinte à ~27 % du temps de montée (25 % pour un cylindre). Le dernier dixième de hauteur prend ~40 % du temps.
- La courbe est **presque universelle**. Elle ne dépend que de Λ = atan(v0/v_t).

### 4.2 Courbes en mètres (sphères, cas de référence) 🧮

| Bombe | | t/T = 0 | 0,1 | 0,2 | 0,3 | 0,4 | 0,5 | 0,6 | 0,7 | 0,8 | 0,9 | 1,0 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **75 mm**, v0 60 m/s, T 3,97 s | t (s) | 0 | 0,40 | 0,79 | 1,19 | 1,59 | 1,99 | 2,38 | 2,78 | 3,18 | 3,57 | 3,97 |
| | h (m) | 0 | 22 | 39 | 54 | 65 | 75 | 82 | 88 | 92 | 94 | **95** |
| | v (m/s) | 60 | 49 | 40 | 33 | 27 | 21 | 16 | 12 | 8 | 4 | 0 |
| **100 mm**, v0 65 m/s, T 4,38 s | t | 0 | 0,44 | 0,88 | 1,31 | 1,75 | 2,19 | 2,63 | 3,07 | 3,50 | 3,94 | 4,38 |
| | h | 0 | 26 | 47 | 65 | 79 | 90 | 100 | 106 | 111 | 114 | **115** |
| | v | 65 | 54 | 44 | 36 | 29 | 23 | 18 | 13 | 9 | 4 | 0 |
| **125 mm**, v0 71 m/s, T 4,82 s | t | 0 | 0,48 | 0,96 | 1,45 | 1,93 | 2,41 | 2,89 | 3,38 | 3,86 | 4,34 | 4,82 |
| | h | 0 | 31 | 57 | 79 | 96 | 110 | 121 | 130 | 135 | 139 | **140** |
| **150 mm**, v0 84 m/s, T 5,40 s | t | 0 | 0,54 | 1,08 | 1,62 | 2,16 | 2,70 | 3,24 | 3,78 | 4,32 | 4,86 | 5,40 |
| | h | 0 | 41 | 74 | 102 | 124 | 142 | 156 | 167 | 174 | 179 | **180** |
| | v | 84 | 68 | 56 | 46 | 37 | 29 | 23 | 16 | 11 | 5 | 0 |
| **200 mm**, v0 80 m/s, T 5,78 s | t | 0 | 0,58 | 1,16 | 1,73 | 2,31 | 2,89 | 3,47 | 4,05 | 4,63 | 5,20 | 5,78 |
| | h | 0 | 42 | 78 | 108 | 132 | 152 | 168 | 180 | 188 | 193 | **195** |
| | v | 80 | 67 | 56 | 47 | 38 | 31 | 24 | 18 | 11 | 6 | 0 |

Pour les autres hauteurs, il suffit de mettre la courbe normalisée du §4.1 à l'échelle, avec T tiré du §3.1 ou de la formule du §3.2.

**Les 0,1 premières secondes** ✅ : la bombe sort dans la **colonne de gaz de chasse** qui monte à peu près à sa vitesse. La traînée y est donc presque nulle, et l'écart angulaire observé à ce stade ne vient pas de l'aérodynamique (Kosanke 2001). Kosanke (1994) : la flamme de bouche masque la bombe pendant ~0,1 s, et la bombe a déjà parcouru ~7,6 m (25 ft) quand on la voit. 🧮 Pour le rendu : on peut appliquer la traînée seulement après ~3–8 m (⚠️ effet sur l'apogée inférieur à 2 %).

---

## 5. Comportement latéral

### 5.1 Rotation et oscillation (wobble, coning)

- **Sphère** ✅ (Ding & Yoshida 2008, caméra rapide) :
  - la rotation existe **ou non, au hasard** ;
  - elle va de **3 à 15 tr/s** avec une chasse d'essai réduite, et probablement plus de 15 tr/s avec une chasse de spectacle ;
  - l'axe est **quelconque entre la verticale et l'horizontale**, et **ne change pratiquement pas pendant le vol** ;
  - cause : la bombe est décentrée dans le tube et le jeu n'est pas uniforme, si bien que les gaz fuient de façon dissymétrique.
- **Pas de nutation aérodynamique sur une sphère** 🧮. Une sphère n'a ni moment de rappel ni centre de poussée décalé : elle ne « cône » pas. Un léger balourd ne produit qu'une **précession libre lente**, invisible à distance. **Pour le rendu, une rotation propre autour d'un axe fixe suffit.**
- **Cylindre** ✅/🧮 :
  - Kosanke (1994) mesure un cylindre de 4" qui culbute à **5,3 tr/s, rythme constant** sur tout le vol, en observant l'occultation périodique d'une torche fixée sur la bombe ;
  - avec L ≈ d, les moments d'inertie axial (≈ 0,125 m d²) et transverse (≈ 0,146 m d²) sont presque égaux, ce qui donne une rotation libre peu contrainte ;
  - un cylindre court n'a pas d'orientation de vol stable et culbute (Mercer) ;
  - **pour le rendu** : rotation autour d'un axe transverse aléatoire à 3–8 tr/s (⚠️ plage extrapolée d'une seule mesure), plus une composante de roulis aléatoire.

### 5.2 Dispersion mesurée des bombes noires (sans vent, mortier vertical) ✅

Source : Kosanke 1992, 75 bombes sphériques et ~50 groupes de 10 cylindres.

**Dérive moyenne par rapport au point balistique : 0,38 m/mm (32 ft/in) pour les sphères de 3" à 10", 0,24 m/mm (20 ft/in) pour les cylindres de 3" à 6".**

| Sphère | 75 mm (2 séries) | 100 | 125 | 150 | 150 incliné de 24° | 200 | 250 |
|---|---|---|---|---|---|---|---|
| Dérive moyenne (m) | 45 / 19 | 39 | 41 | 44 | 51 | 82 | 105 |

- **Distribution** : elle ressemble à deux demi-gaussiennes raccordées à la moyenne (coefficient de variation de 42 % sous la moyenne, 97 % au-dessus).
  - Fonction de répartition empirique, en % de la moyenne : 25 % → 7 % ; 50 % → 25 % ; 75 % → 45 % ; 100 % → 64 % ; 125 % → 72 % ; 150 % → 79 % ; 200 % → 91 % ; 250 % → 97 % ; 300 % → 100 %.
  - **~1 % des bombes dérivent jusqu'à 3 fois la moyenne**, soit 100 ft/in. Une limite de 0 % hors zone demanderait ~150 ft/in.
- **Reproductibilité** : deux séries de 75 mm tirées à un jour d'intervalle diffèrent d'un facteur 2. Shimizu a observé la même chose et l'attribue à la turbulence.
- **Mortier long** (6", 0,75 m contre 1,65 m) : la bombe monte plus haut (+2,5 s de vol), mais la **dérive est inchangée** : 49 ± 7 m contre 47 ± 6 m (Kosanke 1996).
- **Bombe « capsule »** (cylindre à deux bouts bombés, 6") : 72 ± 8 m, contre 59 m attendus pour une sphère. Elle dérive **un peu plus**, pas moins.
- **Cylindres de 4"** (régression multivariable) : la dérive **augmente avec la chasse** et devient presque nulle quand la chasse est trop faible. Elle **diminue légèrement avec la longueur et la masse**.
- **Tirs inclinés à 30° maximum** (Weinman 2009, 85 tirs) : les écarts sont plus grands dans l'axe du tir qu'en travers. En travers, 2,03 σ reste inférieur à 0,84 m/mm (70 ft/in, l'ancienne distance NFPA 1123), donc σ < 0,41 m/mm.
- **Données canadiennes (Contestabile, CERL 1989)**, bombes de 6" de forme intermédiaire : 12 / 28 / 54 m pour une chasse croissante (cité par Kosanke 1992). ⚠️ Le rapport CERL MRL 90-41 lui-même reste introuvable en ligne.
- **Débat sur les causes** :
  - effet Magnus de la rotation (Kosanke ; Eckhardt & André 2000, à propos d'un accident) ;
  - décollement dissymétrique de la couche limite, même sans rotation (Schneider 2000) ;
  - **déviation dès la sortie du tube à cause du jeu** (Norton 2001) : angle maximal = atan(jeu / longueur du tube), soit 0,7° à 2,4° sans contact avec la paroi et jusqu'à 4,8° avec un rebond. Kosanke (2001) confirme des écarts de **2,5 à 4°** dès les 2,4 premiers mètres.

### 5.3 Dispersion du point d'éclatement (apogée) : modèle et calage 🧮 ⚠️

Aucune mesure publiée ne porte directement sur la dispersion des points d'éclatement. Je l'ai donc estimée par Monte Carlo. Chaque tir combine :
- un écart d'angle de sortie gaussien sur chaque axe (σ) ;
- une rotation présente dans 80–90 % des cas, de 3 à 15 tr/s, avec un axe isotrope et une décroissance de constante τ ;
- la portance de Sawicki multipliée par un facteur.

**Calage** sur la dérive moyenne des bombes noires de Kosanke (0,38 m/mm), dans ses conditions : 3", 6" et 10", v0 ≈ 91–100 m/s, ρ = 1,06.

| σ angle par axe | τ | C_L × | Rotation | Dérive au sol (m/mm) 3" / 6" / 10" | Écart moyen à l'apogée (m) 3" / 6" / 10" |
|---|---|---|---|---|---|
| 1,2° | 3 s | 1,0 | 80 % | 0,23 / 0,25 / 0,24 | 10 / 20 / 31 |
| **2,0°** | **3 s** | **1,5** | **90 %** | **0,39 / 0,41 / 0,38** ← calage | **16 / 33 / 49** |
| 2,5° | 3 s | 1,5 | 90 % | 0,42 / 0,43 / 0,39 | 17 / 35 / 51 |
| 2,0° | 5 s | 2,0 | 90 % | 0,49 / 0,54 / 0,50 | 21 / 44 / 66 |

L'angle seul (C_L = 0, σ = 1,2°) ne produit que ~0,1 m/mm. **Le jeu dans le tube n'explique donc qu'une partie de la dérive.**

**Résultat pour les hauteurs cibles** (paramètres calés, sphères) :

| Calibre / H | Écart radial moyen à l'apogée | 95 % des cas sous | σ par axe | En % de H | Dérive au sol d'une bombe noire |
|---|---|---|---|---|---|
| 75 / 95 m | **11 m** | 21 m | 8 m | 11 % | 20 m |
| 100 / 115 m | **14 m** | 27 m | 11 m | 12 % | 27 m |
| 125 / 140 m | **19 m** | 36 m | 15 m | 13 % | 36 m |
| 150 / 180 m | **28 m** | 51 m | 22 m | 15 % | 52 m |
| 200 / 230 m | **39 m** | 71 m | 30 m | 17 % | 75 m |

**Hypothèse basse** (angle seul, σ = 1,2°) : 4–7 m d'écart moyen, soit 4–5 % de H.

**Recommandation pour le simulateur** : tirer le point d'éclatement avec **un écart radial moyen de 5 % de H (bombe soignée, tube long et ajusté) à 15 % de H (bombe courante)**, en suivant la forme de distribution de Kosanke (§5.2). Pour un cylindre, appliquer un facteur ×0,6 (rapport 0,24/0,38 des dérives au sol). ⚠️ L'écart à l'apogée vaut environ la moitié de la dérive au sol ; ce rapport vient du modèle, pas d'une mesure.

### 5.4 Dérive par le vent pendant la montée 🧮

Vent mesuré à 2 m (U2), profil U2·(z/2)^α plafonné à 120 m. α = 0,14 correspond à une atmosphère neutre ou de jour, α = 1/3 à la nuit stable (Shimizu).

| Bombe (H) | U2 = 3 m/s, α 0,14 | U2 = 3 m/s, α 1/3 | U2 = 5 m/s, α 0,14 | U2 = 5 m/s, α 1/3 | Bombe noire au sol (5 m/s, α 1/3) |
|---|---|---|---|---|---|
| Sphère 75 (95 m) | 6 m | 10 m | 10 m | 18 m | 62 m |
| Cylindre 75 | 9 | 16 | 15 | 26 | 91 |
| Sphère 100 (115 m) | 7 | 12 | 11 | 20 | 71 |
| Cylindre 100 | 9 | 17 | 15 | 28 | 98 |
| Sphère 125 (140 m) | 7 | 14 | 12 | 23 | 83 |
| Sphère 150 (180 m) | 9 | 18 | 15 | 30 | 106 |
| Cylindre 150 | 11 | 23 | 19 | 38 | 127 |
| Sphère 200 (230 m) | 10 | 20 | 16 | 33 | 113 |
| Cylindre 200 | 14 | 28 | 23 | 46 | 154 |

Règles pratiques 🧮 :
- **Déplacement de l'apogée ≈ (2 à 3,3) × U2 [m par m/s] de jour, et (3,5 à 6,6) × U2 la nuit par profil stable.** Il faut multiplier par 1,3–1,5 pour un cylindre.
- La dérive est **bien plus forte à la descente qu'à la montée**, ce qui confirme Ding 2007 et Kosanke 1992. Au sol, elle vaut 3 à 4 fois celle de l'apogée.
- Une fois la bombe éclatée, les étoiles et la fumée suivent le vent à l'altitude d'éclatement (voir note 01, §4.5).
- Compensation par inclinaison (Kosanke 2004, pour ramener le point de chute d'une bombe noire) 🟡 : 2,4° (3"), 1,4° (6") et 0,9° (12") par tranche de 2,2 m/s (5 mph) de vent. Aucun angle ne compense à la fois l'apogée, la chute d'une bombe noire et les débris. Avec 40 mph (18 m/s), un 6" incliné de 6,6° éclate à l'aplomb du mortier, mais les débris lourds retombent à 250 m sous le vent ✅.

### 5.5 Inclinaison du mortier 🧮 (validé ✅ par Weinman 2009 et Kosanke 1992)

Pour chaque angle : déplacement horizontal de l'apogée x et hauteur atteinte z, en mètres. Le facteur f est défini par x = f·z·tan θ.

| Bombe (H vertical) | 2° | 5° | 10° | 15° | 20° | 30° | f |
|---|---|---|---|---|---|---|---|
| Sphère 75 (95 m) | 6 / 95 | 14 / 94 | 27 / 92 | 40 / 89 | 51 / 85 | 70 / 74 | 1,66–1,68 |
| Sphère 100 (115 m) | 7 / 115 | 17 / 114 | 33 / 112 | 48 / 108 | 62 / 103 | 85 / 89 | 1,66–1,68 |
| Sphère 150 (180 m) | 10 / 180 | 26 / 179 | 51 / 175 | 74 / 169 | 96 / 161 | 132 / 140 | 1,63–1,65 |
| Sphère 200 (230 m) | 13 / 230 | 34 / 228 | 66 / 224 | 97 / 216 | 125 / 206 | 171 / 178 | 1,66–1,68 |
| Cylindre 100 (115 m) | 6 / 115 | 15 / 114 | 30 / 112 | 44 / 108 | 57 / 104 | 79 / 91 | 1,51–1,54 |
| Cylindre 150 (180 m) | 10 / 180 | 25 / 179 | 48 / 175 | 71 / 170 | 91 / 162 | 126 / 141 | 1,54–1,57 |

- Le facteur f > 1 vient de la **courbure de la trajectoire** : la vitesse verticale tombe à zéro alors que la vitesse horizontale persiste. Lecture sur les figures de Weinman 2009 (3" et 6" à 5°) : x/H ≈ 0,14–0,15, soit f ≈ 1,6–1,7 ✅.
- Kosanke 1992 : la portée maximale d'une bombe noire est obtenue vers **53°** et non 45°, à cause de la traînée.
- Pratique de tir 🟡 : éventails à ±15–30° ; inclinaison de 10–15° vers la zone de retombée sur les sites canadiens allongés (note 01, §5.3).

### 5.6 Hélice des étincelles de mèche 🧮

- Le point d'où sortent les étincelles (sortie de la mèche) tourne avec la bombe. Il décrit une **hélice** de rayon r = (d/2)·sin(angle entre la mèche et l'axe de rotation), donc ≤ 3,5 cm (75 mm) à 9,7 cm (200 mm), et de **pas p = v/f**.

| v | f = 3 tr/s | f = 8 tr/s | f = 15 tr/s |
|---|---|---|---|
| 60 m/s (sortie du mortier) | 20 m | 7,5 m | 4 m |
| 20 m/s (mi-montée) | 6,7 m | 2,5 m | 1,3 m |
| 5 m/s (près de l'apogée) | 1,7 m | 0,6 m | 0,3 m |

- Les étincelles partent avec la vitesse de la bombe plus une vitesse tangentielle 2πf·r (1–9 m/s), puis sont freinées en quelques dixièmes de seconde. **La traînée de mèche forme donc un fin tire-bouchon**, invisible à distance pendant la montée rapide et perceptible près de l'apogée, quand le pas devient comparable au diamètre de la gerbe.
- **Pour le rendu** : émettre les particules depuis un point qui tourne à f autour de l'axe de rotation de la bombe. L'hélice apparaît alors d'elle-même. Les vidéos de Ding montrent des trajectoires d'étoiles témoins qui spiralent ✅.
- **À plus grande échelle**, la trajectoire elle-même se courbe sous l'effet de Magnus : la bombe s'écarte de quelques mètres à la mi-montée (Ding : ~4 m mesurés à 45 m de hauteur pour un 3 gō lent, dont 1,2 m attribué à Magnus et le reste au vent).

---

## 6. Bombes cylindriques : culbute, traînée, dispersion

| Aspect | Cylindre (canister) | Sphère | Fiabilité |
|---|---|---|---|
| Attitude en vol | **Culbute** (~5 tr/s constant, une seule mesure) | Rotation 0–15 tr/s autour d'un axe fixe | ✅ |
| C_D effectif | ~0,9 sur ½(πd²/4 + dL), soit ≈ 1,0 frontal | 0,4–0,5 | ✅ (forme) / 🧮 |
| β à calibre égal | 30–50 % plus bas | — | 🧮 |
| v0 pour la même apogée | **+20 à +30 %** | — | 🧮 (§3.1) |
| Temps de montée pour la même apogée | **−5 à −8 %**, apogée atteinte plus tôt | — | 🧮 |
| Hauteur pour la même v0 | Nettement plus bas. Pour v0 = 91 m/s : apogée 122 m en 4,2 s pour un cylindre de 100 mm (0,46 kg), contre 171 m en 5,1 s pour une sphère (0,40 kg) | — | 🧮 |
| Forme de h(t) | Montée plus « sèche » : h/H = 0,25 à 0,1 T, contre 0,22 | — | 🧮 |
| Sensibilité au vent | ×1,3–1,5 | — | 🧮 (§5.4) |
| Dérive aléatoire (bombe noire) | **0,24 m/mm**, moindre : la culbute moyenne l'effet Magnus et la vitesse est plus faible | 0,38 m/mm | ✅ (Kosanke 1992) |
| Pression dans le mortier (contexte) | ~2,5 fois celle d'une sphère | — | ✅ (Kosanke 1990, modèle de Shimizu) |

**Vérification indépendante** : Wharton 1995 cite un cylindre de 100 mm à 105 m (Kosanke), en accord avec la relation de 1,4 m par mm des sphères. Kosanke 1994 mesure ce cylindre de 4" à 104 m d'apogée en 4,0 s ✅. Le modèle (100 mm cylindre, H = 105 m) donne T = 3,96 s 🧮.

---

## 7. Calage de l'éclatement par rapport à l'apogée

### 7.1 Une longue fenêtre presque immobile ✅/🧮

- Près de l'apogée, la vitesse est faible et c'est la gravité qui domine : h ≈ H − ½ g (t − T)². La fenêtre est donc **identique pour tous les calibres** :
  - **±21 m (70 ft) : 4,2 s.** Kosanke 1993 publie 4,1 / 4,2 / 4,2 s pour 3", 6" et 12" ; mon calcul donne 4,17 s ;
  - ±10 m : 2,85 s ;
  - ±5 m : 2,0 s.
- **Recommandation de Kosanke** : régler la mèche pour un éclatement **1,5 à 2 s avant l'apogée**. Il n'y a pas de perte esthétique, et c'est une marge de sécurité si la mèche brûle lentement ou si la chasse est faible. Temps conseillés : 2,5–3,0 s pour un 3" (apogée en 4,5 s), 4,0–4,5 s pour un 6" (6,0 s), 5,5–6,0 s pour un 12" (7,6 s). Retards de mèche courants : 3–6 s (Poulton & Kosanke).

### 7.2 État de la bombe à l'éclatement 🧮 (identique à ±1 m et ±1 m/s pour tous les calibres et les deux formes)

| Éclatement à | −2,0 s | −1,5 s | −1,0 s | −0,5 s | apogée | +0,5 s | +1,0 s |
|---|---|---|---|---|---|---|---|
| Hauteur sous l'apogée | −20 m | −11 m | −5 m | −1 m | 0 | −1 m | −5 m |
| Vitesse de la bombe (verticale) | 20–21 m/s ↑ | 15 m/s ↑ | 10 m/s ↑ | 5 m/s ↑ | 0 | 5 m/s ↓ | 10 m/s ↓ |

Conséquences pour le rendu :
- Cette vitesse **s'ajoute à celle de chaque étoile** et s'amortit avec la même constante que l'éjection.
- À −2 s, avec 20 m/s face à des étoiles à 50–80 m/s, la fleur **dérive vers le haut** d'environ v_bombe × 0,5–1 s, soit 10–20 m. Elle est un peu plus petite et elliptique, et **moins dense en bas** (Kosanke 1993).
- Kosanke illustre le cas extrême où la vitesse de la bombe égale celle des étoiles : la fleur s'ouvre à partir d'un point excentré.

### 7.3 Dispersion des temps et des hauteurs d'éclatement ✅/⚠️

- **Retard d'éclatement** (entre l'arrivée du feu de la mèche et la rupture de l'enveloppe), sept fabricants (Kosanke 2002) : ~41 ms (75 mm), 51 (100), 60 (125), 70 (150), 89 (200), 108 (250). Valeurs individuelles de 21 à 134 ms, avec quelques **ratés lents de 104 à 329 ms**. C'est négligeable à l'échelle de la montée, mais utile pour enchaîner le flash et le son.
- **Dispersion des hauteurs d'éclatement** : σ ≈ 7–18 % (§3.4). Elle combine la dispersion de v0 (σ ≈ 5–8 % chez Shimizu) et celle du retard de la mèche. ⚠️ Je n'ai trouvé **aucune mesure de la dispersion propre des mèches à retard** (time fuse). Les mesures de Kosanke 2004 portent sur les amorces de mise à feu (shell leader), avec un écart type de 0,4 à 1 s pour 1 à 3,5 s, ce qui n'est pas transposable.
- **Pour le simulateur** : prendre σ(v0)/v0 ≈ 5 % et σ(retard)/retard ≈ 3–5 % (⚠️ hypothèse). Avec un éclatement visé 1,5 s avant l'apogée, cela donne naturellement ~70 % d'éclatements en montée, quelques-uns après l'apogée, et une dispersion de hauteur d'environ ±10 %.
- **Défauts à représenter** (note 01, §2.5) : éclatement précoce, éclatement après l'apogée, bombe noire. Une mèche lente fait éclater après l'apogée, encore dans la fenêtre de ±21 m si le retard reste sous ~2 s.

---

## 8. Queue montante (rising tail), *kyokudo* et stabilité

- **Effet stabilisant** ✅ (Shimizu, cité en note 01) : les bombes munies d'un *kyokudo* (曲導 : petites fleurs, sifflets ou traînées attachés le long de la montée) tournent moins. Par vent fort, elles sont tombées dans une zone étroite.
  - Mécanisme 🧮 : un appendice fixé à l'arrière crée un **centre de poussée derrière le centre de gravité**, comme les plumes d'un volant de badminton. La bombe vole « tête » en avant et la culbute est amortie.
- **Contre-exemple partiel** ✅ (Yamamoto/Shimizu, cité par Kosanke 1992) : des bombes de 3" à 5 sun portant une **fusée fumigène** (pour le suivi) ont dérivé de 25 à 54 m, comme les sphères ordinaires (−15 % à +33 %). L'appendice ne supprime donc pas la dérive.
- **Effet sur la hauteur** ⚠️ (non mesuré) : l'appendice ajoute de la masse (quelques %) et de la traînée. Avec la même vitesse de sortie, il faut s'attendre à quelques % de hauteur en moins. Pour le simulateur : −3 à −8 % de H si une comète montante est présente.
- **Rendu de la queue** : la comète ou la traînée montante suit exactement la trajectoire du §4. Ses étincelles héritent de la vitesse de la bombe et forment le « tronc » des palmiers. Avec une bombe stabilisée, la traînée est **droite**, sans tire-bouchon de rotation.
- **Effets associés lancés avec la bombe principale** ✅ (Kosanke 2003) : placés au-dessus de la bombe dans le mortier, ils pèsent jusqu'à ~½ de sa masse pour un 3" et ~1/10 pour un 12". Ils ne réduisent pas sensiblement l'altitude de la bombe hôte quand leur masse reste modeste.

---

## 9. Recette d'implémentation (pseudo-code)

```
entrées : calibre, forme (sphère | cylindre), H_nominal (catalogue), inclinaison θ, azimut,
          vent U2 (+ profil α : 1/3 la nuit), qualité (q ∈ [0, 1])

1. Tirages aléatoires
   H   = H_nominal · N(1, 0,08)                        # σ 7–18 % mesuré
   β   = m/(C_D·A)  (§2.3) ;  v_t = sqrt(2 g β / ρ)
   Λ   = acos(exp(−g H / v_t²)) ;  v0 = v_t tan Λ ;  T = Λ v_t / g

2. Erreurs de lancement
   écart d'angle : N(0, σθ) sur chaque axe, σθ = 1,2° (q = 1) … 2,0° (q = 0)
   rotation (sphère) : p = 0,85 ; f0 ∈ U(3, 15) tr/s ; axe isotrope fixe ; ω(t) = ω0/(1 + t/τ), τ ∈ U(1,5 ; 10) s
   rotation (cylindre) : culbute f ∈ U(3, 8) tr/s autour d'un axe transverse aléatoire

3. Intégration (RK4, dt = 0,01 s) : gravité + ½ρ C_D(Re) A |u| u + Magnus (C_L Sawicki × 1,5) + vent w(z)
   (sinon, mode léger : h(t) analytique du §3.2 + écart latéral tiré de §5.3 + dérive de vent du §5.4)

4. Éclatement : t_b = T − 1,5 s ± N(0 ; 0,04·T) ; hériter de v_bombe(t_b) (§7.2)

5. Rendu de la montée : point d'émission de la mèche tournant à f (hélice de pas v/f) ;
   éventuelle queue montante (trajectoire droite, H × 0,95)
```

---

## 10. Ce qui reste incertain

1. **C_D réel aux Re élevés** : 0,30 (recalage de Weinman) ou 0,40 (Mercer, Ding). Cela n'affecte que la v0 déduite, pas la courbe h(t) une fois H et T fixés.
2. **Décroissance de la rotation** : τ = 1–2 s (Ding, vraies bombes) contre rotation constante (Kosanke, bombe inerte) et 20–25 s (balle de baseball).
3. **C_L des bombes** : la valeur de Yamamoto (1,6–2,0) est donnée dans une convention ambiguë. J'ai utilisé Sawicki ×1,5, calé globalement.
4. **Dispersion des points d'éclatement** : aucune mesure directe. Mon modèle estime ~½ de la dérive au sol ; l'hypothèse basse (angle seul) donne ~4–5 % de H.
5. **Dispersion des mèches à retard** : non trouvée.
6. **Cylindres** : C_D calé sur un seul vol de masse inconnue ; culbute mesurée sur une seule bombe ; dimensions du 200 mm extrapolées.
7. **Vent nocturne en altitude** : courant-jet de basse couche et cisaillement de direction ignorés ; Weinman et Kosanke refusent eux-mêmes de publier leurs effets de vent faute de calage.
8. **Rapport CERL MRL 90-41** (Contestabile) : toujours introuvable. Ses données (pressions, vitesses, hauteurs de bombes de 205 à 305 mm) ne sont connues qu'à travers Kosanke et Wharton.

---

## 11. Données brutes utiles (pour recalage futur) ✅

**Tirs de Shimizu « en conditions normales »** (repris par Mercer 2002, tableau 3).

| Ø mortier (cm) | 9,2 | 9,2 | 15,5 | 15,5 | 30,5 |
|---|---|---|---|---|---|
| Ø bombe (cm) | 8,4 | 8,4 | 14,2 | 14,2 | 29 |
| Masse (kg) | 0,22 | 0,115 | 1,25 | 0,61 | 8,27 |
| v0 (m/s) | 122,2 (σ 6,5) | 104,9 ⚠️ | 119,6 (σ 10) | 151,9 ⚠️ | 114,8 |
| H (m) | 149 (σ 13) | 132 (σ 12) | 263 (σ 18) | 208 (σ 9) | 340 |
| Montée (s) | 4,8 (σ 0,38) | 3,8 (σ 0,29) | 6,9 (σ 0,34) | 5,4 (σ 0,56) | 8,2 |

⚠️ Dans le PDF, l'alignement des vitesses sur les colonnes est incertain : il n'y a que 8 valeurs pour 10 colonnes.

**Autres mesures** :
- Wharton 1995 : 16 tirs, 75–125 mm, hauteurs de 62 à 224 m. Sur tout l'échantillon de la littérature : environ 1,4 m par mm.
- Kosanke-Schwertley 1990 : hauteurs d'éclatement moyennes de 124 / 171 / 237 / 289 / 333 / 355 m pour 3 / 4 / 6 / 8 / 10 / 12", à 300 m d'altitude. La règle « 100 ft/in » sous-estime d'environ 150 ft.
- Dixon 2000 : 3" Yung Feng, 163 m en moyenne (141–186 m). La hauteur ne dépend pas de la longueur du mortier au-delà de 0,46 m.

---

## 12. Sources

- Kosanke K.L. & B.J., « Computer Modeling of Aerial Shell Ballistics », *Pyrotechnica XIV* (1992) ; *Selected Pyrotechnic Publications* Part 2, p. 80–92. https://www.jpyro.co.uk/wp-content/uploads/K02_080_fqp4.pdf
- Kosanke K.L. & B.J., « Aerial Shell Drift Effects », *Proc. 1st Int. Symp. Fireworks* (1992) ; SPP Part 2, p. 67–79. https://www.jpyro.co.uk/wp-content/uploads/K02_067_pr5m.pdf
- Kosanke K.L. & B.J., « Shimizu Aerial Shell Ballistic Predictions (Parts 1 & 2) », *PGI Bull.* 72–73 (1990) ; SPP Part 2, p. 13–. https://www.jpyro.co.uk/wp-content/uploads/K02_013_xuec.pdf
- Kosanke K.L., Schwertley L.A., Kosanke B.J., « Report of Aerial Shell Burst Height Measurements », *PGI Bull.* 68 (1990). https://www.jpyro.co.uk/wp-content/uploads/K02_001_free.pdf
- Kosanke K.L., « Determination of Aerial Shell Burst Altitudes », *PGI Bull.* 64 (1989). https://www.jpyro.co.uk/wp-content/uploads/k01_109_qlef.pdf
- Kosanke K.L. & B.J., « Timing Aerial Shell Bursts for Maximum Safety and Performance », *PGI Bull.* 84 (1993) ; SPP Part 3, p. 1–3. https://www.jpyro.co.uk/wp-content/uploads/K03_001_75ew.pdf
- Kosanke K.L. & B.J., « Measurement of Aerial Shell Velocity », *American Fireworks News* 157 (1994) ; SPP Part 3, p. 56–61. https://www.jpyro.co.uk/wp-content/uploads/K03_056_men2.pdf
- Kosanke K.L. & B.J., Bauer A.L., Mutascio E.R., « Aerial Shell Drift Effects: (A) Long Mortars, (B) Capsule-Shaped Shells », *J. Pyrotech.* 3 (1996) ; SPP Part 4, p. 44–48. https://www.jpyro.co.uk/wp-content/uploads/K04_044_mwau.pdf
- Kosanke K.L. & B.J., « Aerial Shell Burst Delay Times », *Fireworks Business* 225 (2002) ; SPP Part 6, p. 93–94. https://www.jpyro.co.uk/wp-content/uploads/K06_093_mthr.pdf
- Kosanke K.L. & B.J., « When Is Wind Speed Excessive for the Safe Display of Fireworks? », *Fireworks Business* 248 (2004) ; SPP Part 7, p. 130–. https://www.jpyro.co.uk/wp-content/uploads/K07_130_xmeu.pdf
- Kosanke K.L. & B.J., « Aerial Shell Augmentation Effects », *AFN* 260 (2003) ; SPP Part 7, p. 12–. https://www.jpyro.co.uk/wp-content/uploads/K07_012_aug&.pdf
- Kosanke K.L. & B.J., « Manual Firing Delay Times for Aerial Shells » (contexte NFPA 1123 : 3–6 s) ; SPP Part 7, p. 92–95. https://www.jpyro.co.uk/wp-content/uploads/K07_092_djao.pdf
- Weinman L., Kosanke K.L. & B.J., Widmann J., « A New Aerial Shell Ballistic Model Experimentally Verified », 11th Int. Symp. Fireworks (2009) ; SPP p. 907–916. https://www.jpyro.co.uk/wp-content/uploads/bk2022a.pdf
- Mercer J.E., « Thermodynamics of Black Powder and Aerodynamics of Propelled Aerial Shells », *J. Pyrotech.* 16 (2002) 37–. https://www.jpyro.co.uk/wp-content/uploads/j16_37_h65rf.pdf (seules les parties « aérodynamique » et « données de tir » ont été utilisées)
- Norton R.K., « Fireworks Shell Drift due to Shell-to-Bore Clearance », *J. Pyrotech.* 13 (2001) 31–34. https://www.jpyro.co.uk/wp-content/uploads/j13_31_ii7gy.pdf
- Kosanke K.L., « An Observation Regarding: Fireworks Shell Drift due to Shell-to-Bore Clearance », *J. Pyrotech.* 14 (2001) 72–73. https://www.jpyro.co.uk/wp-content/uploads/j14_72_jj84d.pdf
- Wharton R.K., « Observations on the Heights Attained by Spherical Firework Shells », *J. Pyrotech.* 1 (1995). http://www.jpyro.co.uk/wp-content/uploads/j01_01_h3edr.pdf
- Dixon R., « Shell Altitude vs. Mortar Length », *J. Pyrotech.* 11 (2000) 70–72 ; commentaire de Jennings-White C., *J. Pyrotech.* 12 (2000) 68. https://www.jpyro.co.uk/wp-content/uploads/j11_70_j76fd.pdf , https://www.jpyro.co.uk/wp-content/uploads/j12_68a_jjyft.pdf
- Ding D., Ooki Y., Higaki M., Yoshida T., « Numerical calculation for exterior ballistics of fireworks shell », *Sci. Tech. Energetic Materials* 68(1) 14–20 (2007). https://www.jes.or.jp/mag/stem/Vol.68/documents/Vol.68,No.1,p.14-20.pdf
- Ding D., Yoshida T., « A study of Magnus force acting upon a launched rotating spherical aerial shell », *STEM* 69(1) 16–21 (2008). https://www.jes.or.jp/mag/stem/Vol.69/documents/Vol.69,No.1,p.16-21.pdf
- Ooki Y. et al., « Air resistance of spherical fireworks shells », *STEM* 67(1) 39–42 (2006). https://www.jes.or.jp/mag/stem/Vol.67/documents/Vol.67,No.1,p.39-42.pdf
- Schneider R.L., « Aerodynamics of aerial display shells: shell drift », 5th Int. Symp. Fireworks, Naples (2000) 461–465 (résumé seul). https://www.osti.gov/etdeweb/biblio/20070600
- Eckhardt D., André H., « Results and conclusions from the investigation of an accident with a display shell », 5th Int. Symp. Fireworks (2000) 83–103 (résumé seul). https://www.osti.gov/etdeweb/biblio/20070576
- Shimizu T., *Fireworks: The Art, Science and Technique* (profil de vent de Takahashi, *kyokudo*, tableau 27) ; voir la note 01.
- Nathan A.M., « The effect of spin on the flight of a baseball », *Am. J. Phys.* 76 (2008) ; brouillon sur la décroissance de la rotation : https://baseball.physics.illinois.edu/spindown-rev1.pdf (τ ≈ 20–25 s, extrapolé du golf)
- Sawicki G.S., Hubbard M., Stronge W.J., « How to hit home runs: Optimum baseball bat swing parameters for maximum range trajectories », *Am. J. Phys.* 71 (2003) 1152 (loi C_L(S), citée de mémoire 🟡)
- Exposant de Hellmann (stabilité jour / nuit) : https://en.wikipedia.org/wiki/Wind_gradient ; Windserver, « Extrapolation of Wind Profiles Using Indirect Measures of Stability » (2008) : https://www.windserver.com/Publications/2008_WhitePaper_ExtrapolationofWindProfilesUsingIndirectMeasuresofStability.pdf
- Poulton T.J., Kosanke K.L., « Fireworks and Their Hazards », *Fire Engineering* (1995) (retards de 3–6 s, ~112 m/s, 120 ft/in).
- Rapport CERL MRL 90-41 (Contestabile et al., 1990) : non retrouvé. Seules les données citées par Kosanke 1992 (tableau 8) et Wharton 1995 sont utilisées.
