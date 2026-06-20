# PrevoFX — version WEB (aperçu client)

Application navigateur : le client choisit son **lieu de tir** (n'importe où, terrain réel
streamé par Cesium / Google 3D Tiles) + son **show**, et obtient un **aperçu visuel direct**.
Aucune installation, distribuable par simple URL.

## Pile technique
- **CesiumJS** : le globe, le terrain photoréaliste (Google 3D Tiles), la caméra, le choix du lieu.
- **Rendu des feux** : `BillboardCollection` Cesium (sprites GPU) + bloom intégré de Cesium.
  *(v1 simple ; on pourra passer à une couche Three.js + shaders additifs pour un rendu plus poussé.)*
- **Simulation** : portée depuis le code Unreal C++ (`FireworkActor`), en JS, en **mètres**,
  repère local z=haut. Voir `src/sim/`.

## Lancer
Cesium ne tourne pas en `file://` — il faut un petit serveur statique :

```bash
cd web
npx serve .          # ou : python -m http.server 8080
```
Puis ouvrir http://localhost:3000 (ou :8080).

## ⚠️ Token Cesium ion REQUIS pour le décor
Mets un token **Cesium ion** (gratuit, ion.cesium.com → Access Tokens) dans
`src/main.js` → `ION_TOKEN`. Sans token, les feux s'affichent mais le terrain reste vide.

**Pourquoi ion et pas la clé Google directe ?** Vérifié : Google **bloque les
Photorealistic 3D Tiles en accès direct par clé pour les comptes européens (EEA)** → 403.
Cesium ion les relaie via son compte US → ça passe en Europe. (Le projet Unreal, lui,
utilise la clé Google en direct → c'est pourquoi son décor ne charge pas vraiment ; à
migrer vers ion aussi côté desktop, plus tard.)

## État (v1 — fondation)
- [x] Globe Cesium + Google 3D Tiles + caméra "public" (hauteur d'homme, 150 m, dans l'axe).
- [x] Moteur de particules + physique (gravité, frein) porté de l'UE.
- [x] **Pivoine** : étoiles fines, traînées à grains de durées variées, bloom.
- [ ] Autres archétypes (saule/kamuro, comète, mosaïque, pot à feu…) — à porter depuis FireworkActor.
- [ ] Chargement du **catalogue** (`data/effets.json`) + dérivation d'archétype (depuis EffectCatalog.cpp).
- [ ] Sortie de tube (gerbe), montée du shell, fumée.
- [ ] UI client : choix du lieu (carte) + choix du show + timeline.
- [ ] Cœur blanc + flou de mouvement (passer en Three.js additif si besoin).

## Plan de migration (depuis l'UE)
La **logique** (archétypes, physique, couleurs, timing, catalogue) se porte ; seul le **rendu**
est réécrit. Source de vérité = les données (catalogue + format de show), partagées avec la
future app desktop.
