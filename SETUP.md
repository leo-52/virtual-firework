# PrevoFXSim — Setup Phase 0

Checklist d'installation à faire **une seule fois** avant qu'on attaque le POC Unreal + Cesium.

Une fois tout coché, ouvre Claude Code dans le dossier du repo et écris :
> "Setup Phase 0 terminé, on attaque la Phase 1"

---

## ⏱ Temps estimé : ~2 h dont 90 % d'attente de téléchargement

---

## Étape 1 — Claude Code en local (10 min)

Objectif : pouvoir m'utiliser pour éditer directement les fichiers sur ton disque, sans passer par GitHub à chaque modif.

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

⚠️ Vérifie que tu as ~60 Go libres sur ton SSD avant.

- [ ] Télécharger **Epic Games Launcher** : https://store.epicgames.com/fr/download
- [ ] Créer un compte Epic Games (gratuit)
- [ ] Onglet **Unreal Engine** → **Library** → cliquer le **+** → installer la **dernière 5.x** (5.5 actuellement)
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

## Étape 5 — Clé API Google (pour Cesium 3D Tiles) (5 min)

Cesium peut charger les tuiles 3D photoréalistes de Google (mêmes que Google Earth) gratuitement jusqu'à un certain quota.

- [ ] Aller sur https://console.cloud.google.com
- [ ] Créer un projet (n'importe quel nom)
- [ ] Activer l'API **"Map Tiles API"** dans la bibliothèque d'APIs
- [ ] Créer une **clé API** dans "Identifiants"
- [ ] **Copier la clé dans un fichier texte**, on s'en servira à la Phase 1

> Alternative : on peut aussi utiliser Cesium ion (autre fournisseur, gratuit jusqu'à 5 Go/mois). Si Google te paraît compliqué, on basculera dessus.

---

## Étape 6 — Tu reviens ici 🚀

Une fois tout fini :

```powershell
cd C:\Dev\virtual-firework
claude
```

Puis dans la session Claude Code :
> "Setup Phase 0 terminé, on attaque la Phase 1 (POC UE5 + Cesium)"

À partir de là je peux éditer tes fichiers directement, créer le projet UE5, configurer Cesium, écrire les Blueprints du drone et le premier feu Niagara.

---

## 🎯 Plan des phases

| Phase | Objectif | Durée travail |
|------|---------|---------------|
| **0** | Setup (cette page) | ~2 h (90 % attente) |
| **1** | POC : zone 3D Cesium + drone volant + 1 feu Niagara au clic | 2-4 h |
| **2** | 5-10 effets pyro variés (chrysanthème, palmier, saule, etc.) | 4-6 h |
| **3** | UI séquenceur : programmer un show sur timeline | 6-8 h |
| **4** | Export vidéo MP4 du show + import GPS lat/lng | 4-6 h |
| **5** | Polish : sons, fumée, multi-shells synchronisés musique | À voir |

Tu valides chaque phase avant qu'on passe à la suivante.
