# PrevoFXSim — Setup Phase 0

Checklist d'installation à faire **une seule fois** avant qu'on attaque le POC.

Une fois tout coché, ouvre Claude Code dans le dossier du repo et écris :
> "Setup Phase 0 terminé, on attaque la Phase 1"

---

## ⏱ Temps estimé : ~2 h dont 90 % d'attente de téléchargement

---

## Étape 1 — Claude Code en local (10 min)

Objectif : pouvoir m'utiliser pour éditer directement les fichiers sur ton disque.

- [ ] Installer **Node.js LTS** : https://nodejs.org → bouton vert "LTS"
- [ ] Ouvrir **PowerShell** et taper :
  ```powershell
  npm install -g @anthropic-ai/claude-code
  ```
- [ ] Tester : `claude --version` doit afficher un numéro

---

## Étape 2 — Visual Studio Build Tools (20 min, ~10 Go)

Nécessaire pour qu'Unreal compile son C++.

- [ ] Télécharger **Visual Studio Community 2022** (gratuit) : https://visualstudio.microsoft.com/fr/vs/community/
- [ ] Au choix des composants, **cocher ces 2 workloads** :
  - ✅ "Développement Desktop en C++"
  - ✅ "Développement de jeux avec C++"
- [ ] Dans le panneau de droite, vérifier que **"Outils Unreal Engine pour Visual Studio"** est coché

---

## Étape 3 — Epic Games Launcher + Unreal Engine 5 (1-2 h, ~50 Go)

⚠️ Vérifie que tu as ~60 Go libres sur ton SSD.

- [ ] Télécharger **Epic Games Launcher** : https://store.epicgames.com/fr/download
- [ ] Créer un compte Epic Games (gratuit)
- [ ] Onglet **Unreal Engine** → **Library** → cliquer le **+** → installer la **dernière 5.x** (5.5)
- [ ] Pendant l'install tu peux faire l'étape 4

---

## Étape 4 — Cloner le repo localement (2 min)

Dans PowerShell :

```powershell
cd C:\Dev          # ou l'endroit que tu veux
git clone https://github.com/leo-52/virtual-firework.git
cd virtual-firework
git checkout claude/fix-empty-text-blocks-JFh1X
```

---

## Étape 5 — Clé API Google Maps (5 min)

Utilisée par le popup "Charger un plan 3D Google Maps ?" au démarrage. Si tu réponds "Non" tu n'en as pas besoin, mais autant la préparer.

- https://console.cloud.google.com → créer un projet → activer **"Map Tiles API"** → créer une clé API
- Note la clé quelque part — Claude te demandera de la coller dans un fichier `.env` local (jamais commité)

---

## Étape 6 — Tu reviens ici 🚀

Une fois Node + VS + UE5 installés :

```powershell
cd C:\Dev\virtual-firework
claude
```

Puis dans la session Claude Code :
> "Setup Phase 0 terminé, on attaque la Phase 1"

---

## 🎯 Plan révisé (inspiré Finale 3D / PyroOffice)

### Architecture

**Deux fenêtres OS séparées, tech différentes, reliées par HTTP :**

| Fenêtre | Tech | Rôle |
|--------|------|------|
| **Window 1 — Simu** | Unreal Engine 5 | Vue 3D live (sol, positions de tir, fusées) **+ timeline en bas** avec cues, scrub, play/pause |
| **Window 2 — Effets** | À définir (web / Electron / autre — **pas Unreal**) | Liste plate de noms d'effets ("Chrysanthème rouge 3"", "Comète argent"…). Sélection / drag pour envoyer dans la timeline |

**Pont** : plugin Unreal **Remote Control** expose une API HTTP/WebSocket.
La Window 2 envoie à Unreal :
`POST /add_cue { effect: "Comète argent", time: 7.5, position: "Pos-04" }`
Unreal ajoute le cue dans la timeline et le tire au moment voulu.

> Le choix de la stack Window 2 est laissé en suspens — on décidera après la Phase 1.

### Phases

| Phase | Objectif | Durée |
|------|---------|-------|
| **0** | Setup (cette page) | ~2 h (90 % attente) |
| **1a** | **Window 1 seule** : beau champ 1 km² (herbe + coucher de soleil) + 1 position de tir + drone + timeline UMG + popup Google Maps optionnel + plugin Remote Control + 1 effet Niagara via curl | 5-7 h |
| **1b** | **Window 2** (stack à choisir) : liste de 5 noms d'effets. Click → POST HTTP vers Unreal → cue ajouté dans la timeline | 3-5 h |
| **2** | 5-10 effets pyro variés (chrysanthème, palmier, saule, comète…) + plusieurs positions de tir | 4-6 h |
| **3** | Timeline pleinement éditable : drag/move/suppr des cues, scrub, play/pause | 6-8 h |
| **4** | Saisie d'adresse / coordonnées GPS pour le chargement Google Maps + presets de lieux | 3-4 h |
| **5** | Export vidéo MP4 + sons synchronisés | À voir |

### Phase 1a — détail (POC Unreal solo)

#### Barre d'onglets en haut de la fenêtre

| Onglet | Contenu (à préciser) |
|--------|---------------------|
| **Fichier** | Nouveau spectacle, Ouvrir, Sauvegarder, Sauvegarder sous, Quitter… |
| **Spectacle** | Réglages du show en cours : durée, musique associée, métadonnées (nom, lieu, date), liste des positions de tir, lecture/pause/stop… |
| **Paysage** | Choix du décor : champ par défaut, charger Google Maps 3D (popup X/Y), ambiance lumineuse (coucher de soleil / pleine lune / nuit étoilée), météo (?)… |
| **Options** | Préférences app : qualité graphique, contrôles drone, clé API Google, langue, raccourcis clavier (voir ci-dessous)… |

> Le contenu exact de chaque onglet sera affiné au fur et à mesure. La structure (4 onglets) est en place dès la Phase 1a même si certains sont quasi-vides au début.

#### Raccourcis clavier & souris

**Édition / Timeline**
| Raccourci | Action |
|-----------|--------|
| `Ctrl + Z` | Annuler |
| `Ctrl + Y` *(ou `Ctrl + Shift + Z`)* | Refaire |
| `Espace` | Play / Pause |
| `←` / `→` | Reculer / avancer dans la timeline de **0,1 s** |
| `Shift + ←` / `→` | Reculer / avancer de **1 s** *(à confirmer)* |
| `Home` / `End` | Aller au début / à la fin de la timeline *(à confirmer)* |
| `Ctrl + S` | Sauvegarder |
| `Suppr` | Supprimer le cue sélectionné |

**Vue 3D (caméra drone)**
| Raccourci | Action |
|-----------|--------|
| **Molette** | Zoom / dézoom |
| **Clic gauche maintenu + souris** | Rotation de la vue |
| **Clic droit maintenu + souris** | Pan / translation latérale *(à confirmer)* |
| `Z` `Q` `S` `D` | Déplacement avant/gauche/arrière/droite du drone |
| `A` / `E` | Monter / descendre le drone *(à confirmer)* |
| `Shift` (maintenu) | Mode rapide *(à confirmer)* |

> Les lignes *à confirmer* sont des propositions à valider — tu corriges si tu veux autre chose.

#### Catalogue d'effets

**Source** : catalogue commercial **SARL Jacques Prévot Artifices** (mars 2026) — `catalogue.ods` dans le repo.

**Parsé automatiquement vers `catalog.json`** (1040 items, 20 sections, 81 familles) :

| Section | Items |
|---------|-------|
| BOMBE 50/75/100/125/150 MM | 425 bombes |
| CHANDELLE 10/20/30/50 MM | 62 chandelles |
| COMPACT DROIT / ÉVENTAILLÉ / Z / NAUTIQUE / GRAND PUBLIC | 269 compacts |
| MONOCOUP / PIÈCE SUR MÂT / FUSÉE / LAMPION | 80 divers |
| FEU AUTOMATIQUE | 61 |
| SÉRIE LIMITÉE | 143 |

Champs extraits par item :
- `reference`, `designation`, `section`, `famille`, `calibre_mm`, `certification`, `categorie_f`, `masse_ma_kg`, `couleurs_detectees`, `distance_securite`
- Pour compacts : `compact_nb_tirs`, `compact_duration_s`, `compact_pattern` (droit/eventail/Z)
- Données sim (dérivées du calibre + famille, **à affiner par l'utilisateur**) :
  - `sim_ascension_s` — durée de montée
  - `sim_burst_height_m` — hauteur d'explosion
  - `sim_sky_duration_s` — durée dans le ciel

> Ces données sim sont des défauts standard pyrotechnique. L'utilisateur pourra les surcharger via un fichier `catalog_overrides.json` au fur et à mesure qu'il connaît la réalité de ses produits.

#### Comportement de la timeline

**Placement d'un effet** — deux méthodes équivalentes :
1. **Drag & drop** depuis la liste de la Window 2 vers une position dans la timeline
2. **Sélection** d'un effet dans la Window 2 puis **clic** dans la timeline à l'endroit voulu

**Édition des cues** :
- `Ctrl + C` / `Ctrl + V` : copier / coller un cue (ou groupe sélectionné)
- Drag pour déplacer un cue dans la timeline
- **Snap léger ("aimanté")** sur le début du cue : la valeur de snap par défaut est ~0,1 s, désactivable avec `Alt` pendant le drag *(à confirmer)*
- Le snap accroche aux : marques de seconde, autres cues, playhead

**Représentation visuelle d'un cue** :
- Un **trait horizontal** dont la longueur = **durée totale de l'effet, du déclenchement jusqu'à la fin des retombées** (dernières étincelles éteintes)
- À l'intérieur du trait, **un point par explosion** indique l'instant où chaque shell explose
- Toutes les durées sont **relatives au début du trait** (le trait commence à t=0 quel que soit l'endroit où on le place dans le show)

**Phases d'un cue** (peuvent être combinées) :
1. Délai de mise à feu (optionnel) — entre le déclenchement et la sortie du mortier
2. Montée — entre la sortie du mortier et l'explosion
3. Retombées — après l'explosion jusqu'à extinction

**Exemple type** (donné par l'utilisateur) :
- Bombe **lancée à t=1 s** (1 s de délai de mise à feu)
- **Explose 2 s après** le lancement (donc à t=3 s)
- **Dure 2 s** après explosion (retombées jusqu'à t=5 s)
- → **Trait de 5 s, avec un point à t=3 s**

**Exemple barrage** : 5 shells lancés en 3 s, chacun avec montée 2 s + retombées 5 s → trait ~10 s avec 5 points espacés correspondant aux 5 explosions.

Avantage : on voit d'un coup d'œil les chevauchements de retombées dans le show.

#### Réalisme : jitter temporel (~±5%)

Les artifices pro ne sont **jamais parfaitement synchronisés** — chaque dispositif a une marge d'erreur de tir (mèche, charge propulsive, etc.) typiquement de **±5%**.

**Conséquence à simuler** : si 3 chandelles identiques sont déclenchées simultanément et qu'elles sont censées tirer 1 coup toutes les 3 s pendant 24 s (8 coups chacune) :
- t=0 : les 3 partent **ensemble** (déclenchement commun)
- 1ʳᵉ salve : ~ 3 s, 3 s, 3 s (très peu de drift)
- 2ᵉ salve : ~ 6 s, 6,2 s, 5,9 s (drift commence)
- 3ᵉ salve : ~ 9 s, 9,4 s, 8,8 s
- 8ᵉ salve : peut aller de 22 s à 26 s selon le dispositif

**Implémentation** :
- Chaque "tir" d'un compact/chandelle a un timing nominal + un jitter aléatoire borné par la marge d'erreur du dispositif (paramètre `jitter_pct`, défaut 5%)
- Le jitter est **par instance** (3 chandelles = 3 séquences de jitter différentes)
- Seed déterministe par show → la lecture reste identique d'une fois sur l'autre (sinon impossible de debug)
- Configurable globalement dans les Options (ex: "Désactiver l'aléatoire pour debug")

**Sélection** :
- **Clic + drag sur fond vide** de la timeline → rectangle de sélection qui englobe tous les cues recouverts (comme dans la plupart des éditeurs)
- `Shift + clic` sur un cue : ajoute/retire de la sélection *(à confirmer)*

**Groupement en grappe** :
- Sélectionner plusieurs cues (ex: 3 bombes X) avec le rectangle → **clic droit → "Créer une grappe"** (ou bouton dans une mini-barre flottante)
- La grappe devient un seul cue manipulable d'un bloc
- La grappe se déplace, se copie, se colle, se supprime comme un cue normal
- Clic droit sur grappe → "Dégrouper" *(à confirmer)*
- Double-clic sur la grappe pour l'ouvrir et éditer les cues individuels à l'intérieur *(à confirmer)*
- Visuel de la grappe : un trait englobant du premier déclenchement à la dernière retombée, avec tous les points d'explosion visibles à l'intérieur

#### Scène par défaut

À l'ouverture du projet Unreal :
- **Beau champ** 1000 × 1000 m : herbe dense, sol naturel
- **Ambiance lumineuse** au choix : coucher de soleil OU pleine lune (probablement coucher de soleil par défaut, plus joli pour démo)
- **Une seule position de tir** visible au centre du champ (petit marqueur "Pos-01" type mortier au sol)
- Caméra drone contrôlable (ZQSD + souris) à 50 m d'altitude
- Bandeau timeline UMG en bas de l'écran (0:00 → 3:00, vide)
- **Popup au lancement** : "Charger un plan 3D Google Maps de la zone ?" → [Oui / Non, garder le champ vide]
  - **"Non"** → on reste sur le beau champ par défaut
  - **"Oui"** → ouvre une boîte de dialogue avec :
    1. Un bouton/lien **"Ouvrir Google Maps"** (lance `https://maps.google.com` dans le navigateur). Tu y cherches ton lieu, click droit sur le point → copies les coordonnées (`48.8584, 2.2945` par ex).
    2. **Deux champs séparés** : `X` (longitude) et `Y` (latitude). Tu peux soit coller les deux valeurs depuis Google Maps, soit les taper à la main.
    3. Bouton "Charger"
  - Cesium charge alors les tiles Google Maps 3D centrées sur ces coordonnées, **toujours sur une zone 1 km × 1 km** (le drone et la timeline restent identiques, seul le sol change)
  - Nécessite la clé API de l'étape 5
- Plugin **Remote Control** activé, endpoint exposé
- Test : `curl -X POST localhost:30010/add_cue -d '{"effect":"test_shell","time":2.0}'` → un feu Niagara basique part à T+2s depuis Pos-01

Quand ça marche → Phase 1b (on branche la fenêtre éditeur).

---

## 📁 Note sur le code existant

Le repo contient un ancien skeleton NW.js (`/app/`, `/app.nw/`) qui ne sera pas réutilisé.
On crée un nouveau dossier `/unreal/PrevoFXSim/` pour le projet UE5.
Le NW.js legacy sera supprimé en Phase 2 si rien à récupérer.
