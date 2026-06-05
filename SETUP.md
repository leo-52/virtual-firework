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

À l'ouverture du projet Unreal :
- **Beau champ** 1000 × 1000 m : herbe dense, sol naturel
- **Ambiance lumineuse** au choix : coucher de soleil OU pleine lune (probablement coucher de soleil par défaut, plus joli pour démo)
- **Une seule position de tir** visible au centre du champ (petit marqueur "Pos-01" type mortier au sol)
- Caméra drone contrôlable (ZQSD + souris) à 50 m d'altitude
- Bandeau timeline UMG en bas de l'écran (0:00 → 3:00, vide)
- **Popup au lancement** : "Charger un plan 3D Google Maps de la zone ?" → [Oui / Non, garder le champ vide]
  - "Non" → on reste sur le beau champ par défaut
  - "Oui" → Cesium charge les tiles Google Maps 3D (nécessite la clé API de l'étape 5)
- Plugin **Remote Control** activé, endpoint exposé
- Test : `curl -X POST localhost:30010/add_cue -d '{"effect":"test_shell","time":2.0}'` → un feu Niagara basique part à T+2s depuis Pos-01

Quand ça marche → Phase 1b (on branche la fenêtre éditeur).

---

## 📁 Note sur le code existant

Le repo contient un ancien skeleton NW.js (`/app/`, `/app.nw/`) qui ne sera pas réutilisé.
On crée un nouveau dossier `/unreal/PrevoFXSim/` pour le projet UE5.
Le NW.js legacy sera supprimé en Phase 2 si rien à récupérer.
