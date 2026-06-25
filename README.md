# PrevoFX — version WEB (aperçu client)

Application navigateur : le client choisit son **lieu de tir** (n'importe où, terrain réel
photoréaliste streamé par Cesium / Google 3D Tiles) + son **show**, et obtient un **aperçu
visuel direct**. Aucune installation, distribuable par simple URL.

> 📋 **Où on en est, les effets, ce qui reste à faire → voir [`ETAT_DU_PROJET.md`](ETAT_DU_PROJET.md).**

## Pile technique
- **CesiumJS** : le globe, le terrain photoréaliste (Google 3D Tiles via Cesium ion), la caméra.
- **Three.js** : le rendu des feux, en **overlay additif** (canvas `mix-blend:screen`) + bloom
  ciné (`UnrealBloomPass`) + tonemapping ACES. La caméra Three est synchronisée sur Cesium
  chaque frame (repère ENU du lieu de tir). Cesium ne sert QUE de décor.
- **Moteur** : `src/render/threeFireworks.js` — 1 classe `Shell` générique + table `EFFECTS`
  (25 archétypes), physique en mètres (gravité, frein, montée/burst/retombée), calibrée sur
  le catalogue Prévot.

## Lancer
Cesium ne tourne pas en `file://` — il faut un petit serveur statique :

```bash
cd web
npx serve .          # ou : python -m http.server 8080
```
Puis ouvrir http://localhost:3000 (ou :8080). **Contrôles** : QZSD (déplacement),
clic gauche + glisser (rotation), molette (avancer/reculer). Sélecteur d'effet en haut à droite.

## Déploiement (GitHub Pages)
- On pousse **uniquement le dossier `web/`** sur la branche **`web`** du repo
  `github.com/leo-52/virtual-firework` (PAS le projet Unreal de ~3,9 Go).
- En ligne : **https://leo-52.github.io/virtual-firework/** (ajouter `?v=<hash>` pour
  forcer le rafraîchissement du cache du navigateur).

## ⚠️ Token Cesium ion REQUIS pour le décor
Le token **Cesium ion** (gratuit, ion.cesium.com → Access Tokens) est dans
`src/main.js` → `ION_TOKEN`. Sans token, les feux s'affichent mais le terrain reste vide
(repli sur une carte OpenStreetMap sombre).

**Pourquoi ion et pas la clé Google directe ?** Vérifié : Google **bloque les
Photorealistic 3D Tiles en accès direct par clé pour les comptes européens (EEA)** → 403.
Cesium ion les relaie via son compte US → ça passe en Europe.

## État (résumé)
- [x] Globe Cesium + Google 3D Tiles + caméra « public » (hauteur d'homme, 150 m, dans l'axe).
- [x] Moteur Three.js multi-archétypes : **25 effets** (pivoine, saule/kamuro, comète, palme,
      couronne, formes 2D cœur/smiley/papillon/marguerite, atome, demi-demi, méduse, queue de
      cheval, cascade, poisson, tourbillon, soucoupe, mosaïque, pot à feu, salut, etc.).
- [x] Physique complète (sortie du tube, montée, burst, gravité/frein par type, retombée) + bloom + ACES.
- [x] Démo en boucle sur l'effet sélectionné ; freeze corrigé ; vue publique fiable.
- [ ] UI client (choix du lieu sur carte + choix du show + timeline) — à venir.
- [ ] Branchement du catalogue `data/effets.json` + durées calées Finale 3D + sons procéduraux.

Détails complets, caractéristiques par effet et pièges techniques : [`ETAT_DU_PROJET.md`](ETAT_DU_PROJET.md).
