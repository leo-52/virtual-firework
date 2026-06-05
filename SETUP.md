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

## Étape 5 — Clé API Google (optionnel, pour plus tard) (5 min)

⚠️ **Pas nécessaire pour la Phase 1.** On démarre sur un champ vide 1 km² sans carte.
À faire seulement quand on voudra charger Google Maps en photoréaliste.

- https://console.cloud.google.com → projet → activer **"Map Tiles API"** → créer une clé
- Garde la clé pour plus tard

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

## 🎯 Plan révisé (inspiré Finale 3D)

### Architecture

**Un seul projet Unreal, deux fenêtres OS natives :**

| Fenêtre | Contenu |
|--------|---------|
| **Window 1 — Visu** | Vue 3D du show + timeline UMG en bas |
| **Window 2 — Effets** | Catalogue d'effets pyro (cliquables) |

Communication via game instance partagée (pas de HTTP, pas d'Electron).
Click sur un effet dans la Window 2 → ajoute un cue à la timeline → tire dans la Window 1 au temps T.

### Phases

| Phase | Objectif | Durée |
|------|---------|-------|
| **0** | Setup (cette page) | ~2 h (90 % attente) |
| **1** | **POC minimal** : champ vide 1 km² + ciel nuit + drone volant + 2 fenêtres OS + 1 effet Niagara au clic | 3-5 h |
| **2** | 5-10 effets pyro variés (chrysanthème, palmier, saule, comète…) | 4-6 h |
| **3** | Timeline éditable : drag d'effets, déplacement, suppression, lecture | 6-8 h |
| **4** | Chargement carte Google Maps via Cesium (remplace le plan vide) + import GPS lat/lng | 4-6 h |
| **5** | Export vidéo MP4 + sons synchronisés | À voir |

### Phase 1 — détail du POC

À l'ouverture du projet :
- **Window 1** s'ouvre avec :
  - Plan plat 1000 × 1000 m (herbe basique, sol uni)
  - Ciel nuit étoilé
  - Caméra drone contrôlable (ZQSD + souris) à 50 m d'altitude
  - Bandeau timeline UMG en bas de l'écran (0:00 → 3:00)
- **Window 2** s'ouvre automatiquement à côté avec :
  - Liste d'1 effet "Test Shell" cliquable
  - Click → spawn un feu Niagara à un point fixe sur la map

Tu valides le visuel et l'ergonomie → on enchaîne sur Phase 2.

---

## 📁 Note sur le code existant

Le repo contient un ancien skeleton NW.js (`/app/`, `/app.nw/`) qui ne sera pas réutilisé.
On crée un nouveau dossier `/unreal/PrevoFXSim/` pour le projet UE5.
Le NW.js legacy sera supprimé en Phase 2 si rien à récupérer.
