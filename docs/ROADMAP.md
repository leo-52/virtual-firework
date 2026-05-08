# PrevoFX — Roadmap multi-sessions

> Document vivant. Mis à jour à la fin de chaque session de travail.
> Source de vérité unique pour ce qui est planifié, en cours, terminé.

**Dernière mise à jour** : session 7 — templates, props FX (mortiers/géo), presets caméra, settings, mapping .fin.

---

## 0. Cadre

**But** : application bureau (NW.js) en français pour la création de spectacles
pyrotechniques FX — pour usage interne (équipe).
**Stratégie** : on conserve le moteur Prevot FX embarqué (`app.nw/`) comme
référence et fallback pendant la transition, et on construit progressivement
une nouvelle UI/UX française autour, puis on grignote les morceaux du moteur
au fil des sessions.

**Architecture cible (long terme)** :
```
PrevoFX (notre app)
├── ui/         ← shell français, vues, éditeur, commandes, etc.
├── engine/     ← futur : notre moteur de rendu (à construire)
└── compat/     ← couche d'interop avec le moteur Prevot FX existant
```

---

## 1. État actuel (terminé)

### Session 1 — squelette
- Duplication `app.nw/ → app/` comme base
- Shell vanilla (HTML/CSS/JS) en français : sidebar, routeur, vues stub

### Session 2 — prototype + reconnaissance
- Catalogue de 23 effets (7 catégories)
- Modèle de données Show/Cue + persistance localStorage
- Vues : Accueil (dashboard), Spectacles (CRUD), Éditeur (timeline +
  picker), Bibliothèque (filtrable), Visualiseur (sim 2D + iframe Prevot FX),
  Commandes (agrégation + export CSV), Paramètres (export/import JSON, reset)
- Simulateur 2D Canvas indépendant (5 types de spawn)
- Reconnaissance complète (ce document) :
  - Pipeline GPU documenté (cf. § 4)
  - WASM décodé (cf. § 5)
  - Format VDL identifié (cf. § 6)
- Bouclier réseau hors-ligne (chrome.webRequest + override fetch/XHR)

### Session 3 — éditeur studio + foundations runtime
- **Foundations** :
  - `lib/i18n.js` — table FR centralisée (~120 clefs)
  - `lib/history.js` — undo/redo (50 snapshots max)
  - `lib/keyboard.js` — manager raccourcis (Ctrl+Z/Y/A/S/N/O/P/L/H/Suppr/Esc/,)
  - `lib/menu.js` — menus drop-down + sous-menus
  - `lib/kml.js` — parser KML (Point/Polygon/LineString)
  - `lib/selection.js` — sélection multiple
- **Catalogue VDL aligné** : 30 effets, 15 partTypes (shell/candle/cake/…),
  19 subtypes visuels (peony/willow/kamuro/dahlia/diadem/falling_leaves/…)
- **State enrichi** : favoris, effets personnalisés (CRUD), géolocalisation
  par spectacle, helper `findEffect` unifié
- **Topbar pro** avec menus complets : Fichier, Édition, Affichage, Effet,
  Outils, Aide. Boutons undo/redo dynamiques. À propos + Raccourcis.
- **Éditeur studio** (3-zones) :
  - Pane gauche : bibliothèque condensée avec onglets Tous/Favoris/Mes,
    drag-and-drop sur la timeline, étoile favori
  - Pane centre : preview 2D « overview » (axe X = temps, Y = hauteur,
    dot = cue), section géo
  - Pane droit : Inspecteur live (timing, géométrie, apparence, actions)
  - Bas : timeline multi-sélection (clic-Maj pour multi, Ctrl+A, Suppr)
- **Bibliothèque enrichie** : onglets (Tous/Favoris/Mes/Catalogue), filtres
  par partType + subtype + recherche + tri, badges Personnalisé, CRUD
  d'effets perso (création/édition/suppression)
- **Import KML** : Fichier → Importer → KML, lit les Placemarks et
  positionne le spectacle (lat/lon/centre)
- **Raccourcis clavier** : 12 actions globales (cf. Aide → Raccourcis)

### Session 4 — édition pro, bons de tir, dashboards
- **Clipboard interne** (`lib/clipboard.js`) : copie structurée typée
  pour cues / effets, événements observables.
- **Timeline pro multi-pistes** (`views/timeline.js`) :
  - 3 lanes : Aérien (shell/candle/cake/comet/rocket/mortar/singleShot/rack),
    Sol (fountain/gerb/mine/flame), SFX (sfx/light)
  - Drag-to-move horizontal pour déplacer un cue (ou un groupe sélectionné)
  - Drop d'un effet de la bibliothèque sur n'importe quelle lane
  - Curseur de lecture (playhead) déplaçable au clic sur le ruler
  - Visuel par lane (teinte de fond, libellé)
- **Copier / Couper / Coller / Dupliquer** : Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+D
  - Préserve les écarts relatifs entre cues collés (origineTime/offset)
  - Coller à la position du dernier sélectionné, ou via playhead
- **Bons de tir / commande PDF** (`views/order-print.js`) :
  - Fenêtre dédiée stylisée pour `@media print`
  - Bon de tir : séquence chronologique pour l'artificier (temps,
    type, effet, style, calibre, durée, qté, fournisseur)
  - Bon de commande : agrégation par effet (Réf., qté, PU, total HT)
  - Bon consolidé : tous les spectacles cumulés
  - Bouton "Imprimer" (→ PDF système) et "Fermer"
- **Vue Accueil refondue** : "Reprendre" avec mini-timeline du dernier
  spectacle + stats par lane, 6 actions rapides, spectacles récents,
  catégories du catalogue, astuces clavier.
- **Vue Spectacles refondue** : recherche, tri (récent/nom/cues/durée/coût),
  ordre asc/desc, mode grille / liste tabulaire.

### Session 5 — viewer FX, courbes, diagnostic
- **Curve editor canvas réutilisable** (`lib/curve-editor.js`) :
  points draggables, ajout au clic vide, suppression au double-clic,
  presets (Plat / Attaque / Decay / Cloche / Pulse), API `sampleLinear`.
- **Inspector enveloppe** : section "Enveloppe d'intensité" pour chaque
  cue, persistée dans `cue.envelope`, snapshots historique.
- **Render Performance Dialog** (`views/perf-dialog.js`) :
  modal flottante, 6 tuiles (FPS, frame time, RAM heap, particules,
  batches, cues déclenchés), graphe FPS rolling 10 s avec lignes 16/30/60,
  système de stats provider pluggable. Raccourci global F8.
- **Viewer 3D WebGL2 vanilla** (`gl/`) :
  - `gl-utils.js` : compile + program + buffer + textures procédurales
    (sparkTexture gaussienne pour billboards)
  - `math.js` : mat4 identity / perspective / lookAt / multiply
  - `camera.js` : caméra orbit (drag = orbit, Maj+drag = pan, roulette
    = zoom, élévation clamée)
  - `scene.js` : skybox dégradée nuit + étoiles cheap, ground plane
    avec grille douce et fog distance
  - `particles.js` : système CPU SoA jusqu'à 40 000 particules,
    physique simplifiée (gravité, drag), trails auto pour RISING,
    sérialisation pour upload GPU
  - `spawner.js` : règles par partType (shell/comet/rocket → RISING +
    explosion à l'apogée ; cake → multi-shells décalés ; fountain/gerb
    → SPRAY dirigé ; mine → demi-sphère sortante ; sfx/light → GLOW
    ponctuel) ; 12 styles d'explosion (peony / chrysanthemum / willow
    / palm / brocade / kamuro / crossette / dahlia / diadem /
    fallingLeaves / ring / wave) avec count/speed/lifeBase/spread
    spécifiques
  - `renderer.js` : pipeline complet (sky → ground → particules
    instanciées), billboard via uCamRight/uCamUp, blending additif,
    boucle play/pause/seek
- **Visualiseur 3 modes** : FX PrevoFX (par défaut) / Sim 2D / Prevot FX
  embarqué. Stats provider du mode actif branché au Perf Dialog.
- **GPU Lab** (`views/gpu-lab.js`) :
  - Onglet Résumé : pipeline Prevot FX expliqué, 35 shaders inventoriés
    par famille (sparks/smoke/flame/lightbeam/mesh/post/physics/UI)
  - Onglet Shaders : liste filtrable par famille, lecture du fichier
    GLSL, analyse automatique (uniforms, in/out, structs, source brute)
  - Onglet WASM : sondage de `vdl_effect_compiler.wasm` et `tinyexr.wasm`
    via `WebAssembly.compile` puis `Module.imports/exports`. Affiche
    la table complète et explique ce qu'il manque pour l'instanciation
    embind complète.

### Session 6 — audio, bloom GL, présentation, parser .fin
- **Audio synchronisé** (`lib/audio.js`) :
  - Loader WebAudio (mp3/wav/ogg/flac/m4a, max 15 Mo)
  - Extraction de waveform en 1024 buckets RMS normalisés
  - Stockage en dataUrl pour persistance localStorage
  - Classe `AudioPlayer` synchronisable (play/pause/seek)
  - Bip TTS configurable pour les cues
- **Waveform sur la timeline** : bande dédiée au-dessus du ruler
  quand le show a un audio attaché
- **Lecture audio sync dans le visualiseur** : play/pause/reset/seek
  pilotent renderer + audio en parallèle, mode 3D et 2D
- **Bloom GL post-process** (`gl/bloom.js`) :
  - FBO scène + 3 FBOs intermédiaires (bright + 2 blur ping-pong)
  - Brightpass avec seuil ajustable
  - Blur séparable horizontal/vertical, 3 itérations à demi-résolution
  - Composite + tonemap Reinhard final vers écran
  - Activable/désactivable (`renderer.setBloomEnabled`)
- **Notes & étiquettes par cue** dans l'inspector :
  - Textarea "notes pour l'artificier" persistée dans `cue.notes`
  - Chips d'étiquettes avec entrée live, suppression au clic, Enter/`,` valide
- **Mode présentation** (`views/presentation.js`) :
  - Plein écran sur fond noir, layout 3-zones
  - Gros timer doré (56 px), vue FX centrale, prochains 3 cues à droite
    avec icône type + couleur, distance temporelle, notes affichées
  - Lecture audio synchronisée
  - Raccourci global F5, bouton "🎭 Présenter" dans l'éditeur,
    accessible aussi via Outils → Mode présentation
  - Espace = play/pause, Échap = quitter
- **Parser .fin générique** (`lib/protobuf-decoder.js`) :
  - Décodeur Protocol Buffers wire-format **sans schéma** (pas besoin
    des `.proto` originaux)
  - Lit les 4 wire types (VARINT, I64, LEN, I32), tente de redécoder
    récursivement les LEN-DELIM comme sous-messages, détecte les chaînes
    UTF-8 par heuristique
  - Fonction `pretty()` pour rendu lisible, `stats()` pour métriques
- **Inspecteur .fin dans GPU Lab** : nouvel onglet permettant de charger
  un fichier `.fin` Prevot FX (ou `.us`) et d'explorer sa structure :
  arbre des champs avec tags numériques, vue "Chaînes lisibles" pour
  repérer titres et noms d'effets.

### Session 7 — templates, props FX, presets caméra, mapping .fin
- **Templates de spectacles** (`data/templates.js`) :
  4 spectacles pré-fabriqués (Fête nationale 180s/33 cues,
  Mariage 90s/15 cues, Ouverture 45s/14 cues, Démo catalogue 60s/22 cues)
  - Picker dans la vue Spectacles + onboarding sur l'Accueil quand
    aucun spectacle n'existe
  - 1 clic = nouveau show préfabriqué prêt à éditer
- **Props 3D dans le moteur** (`gl/props.js`) :
  - Mortiers visualisés au sol (cylindres sombres alignés sur 60m
    devant l'origine) avec lighting Lambertien simple
  - Marqueur de lieu géo (disque bleu translucide) si `show.location`
    est défini, à proximité de la rampe
  - Quantité de mortiers ≈ nombre de cues aériens du show, plafonné
- **Presets caméra** : 5 boutons dans la toolbar 3D (Spectateur,
  Tireur, Plongée, Dramatique, Reset). Méthode `applyCameraPreset`
  qui anime target/distance/azimuth/elevation.
- **Toolbar FX enrichie** sous le canvas :
  - Cluster Caméra (5 presets)
  - Cluster Bloom (toggle + slider intensité)
  - Cluster Audio (toggle bip cue + slider volume)
- **Bip cue optionnel** : à chaque déclenchement, oscillateur 880 Hz
  (50 ms, gain 0.15) — utile en répétition silencieuse
- **Settings étendus** : moteur par défaut (gl/sim/prevotfx), bloom
  on/off, intensité 0..2, bip cue par défaut, pas de quantification
  pour le snap timeline (0 = libre, 0.1s par défaut)
- **Timeline pro** :
  - Snap des cues (drop, drag, click) sur le pas configurable
  - Click sur la waveform = seek (hook `ctx.onSeekTime` ou retombe sur
    `onEmptyClick` pour ouvrir le picker)
- **Mapping .fin → cues** (`lib/fin-mapper.js`) :
  - Heuristique : parcourt l'arbre protobuf, identifie les sous-messages
    qui ressemblent à un Shot (un float ∈ [0, 7200] + au moins une chaîne
    courte)
  - Mappe la chaîne vers un `effectId` du catalogue par fuzzy match
    sur 30 mots-clés (peony/willow/kamuro/dahlia/etc., FR + EN)
  - Dédoublonne et trie chronologiquement
  - Bouton "→ Importer dans un nouveau spectacle" dans GPU Lab →
    Inspecteur .fin (le show est créé, l'éditeur s'ouvre dessus)

---

## 2. Reconnaissance — synthèse

### 2.1 Bundle Prevot FX (`app.nw/htmlui/`)
- **`index-2K8NCIxq.js`** (4,6 Mo minifié) : application React + Tailwind CSS
  (détectée via `rc-slider`, classes utilitaires, `displayName`).
- **`index-C-QQLG6G.css`** (12 Ko) : essentiellement Tailwind utility classes ;
  les composants sont stylisés inline.
- **`vdl_effect_compiler-DmdKSrYM.wasm`** (32 Mo) : compilateur d'effets en
  C++/Emscripten/Embind. Détails § 5.
- **`tinyexr-CWVRs81W.wasm`** (164 Ko) : décodeur d'images HDR (`.exr`).
- **`zstd_effect_blob_corpus_1.bin`** (6,1 Mo) : corpus zstd pour la
  (dé)compression d'effets — référence partagée entre app et compilateur.

### 2.2 Assets
- `icons/` : curseurs personnalisés (`back_of_hand.cur`, `download.cur`,
  `up_arrow*.cur`, `rotate_y.cur`, `translate_xz.cur`) — révèlent la nature
  3D + outils de manipulation.
- `sounds/` : effets sonores du moteur.
- `textures/` : textures particulaires (puff, spark, smoke), terrain.
- `fonts/` : polices embarquées.
- `kml/` : fichiers Google Earth (placement géographique du spectacle).
- `k_sig/` : fichiers `.kss` — feuilles de style perso (legacy ?).

### 2.3 Données canoniques
- **`app/vdl_props.txt`** (14 900 lignes) : *catalogue complet des termes
  pyrotechniques multilingues + paramètres de simulation*. Format VDL
  documenté en en-tête.
  - **Subtypes pyrotechniques** : `brocade, cake, chrysanthemum, comet,
    crossette, dahlia, diadem, falling leaves, kamuro, mine, palm, peony,
    ring, wave, willow, ground, sfx, light, other`
  - **Part types** (sémantique programme) : `cake, candle, single_shot,
    shell, ground, rocket, mine, comet, flame, other_effect, not_an_effect,
    rack, sfx, light`
- **`app/render_config.txt`** (136 lignes) : tous les paramètres de rendu
  (brouillard, exposition, blur, cubemap, tonemap, etc.) en clair.
- **`translations/translations_*.txt`** : 22 langues (FR inclus) — chaque
  fichier ≈ 350 Ko. **EN LFS dans cet environnement, à puller localement.**

---

## 3. Inventaire des features Prevot FX (issu du bundle)

> Source : extraction strings + analyse CSS du bundle minifié (session 2).
> 150+ composants UI, ~40 catégories d'effets, 283 sons, 40+ shaders, 30+ endpoints API.

### 3.1 Stack frontend détectée
- **React 18.2** + **Redux** (state global) + **Apollo GraphQL** (sync cloud)
- **Three.js** (rendu FX principal) + **Cesium.js** (3D Tiles, terrain géospatial)
- **Google Maps API** (StreetView, DirectionsRenderer, TrafficLayer, BicyclingLayer)
- **Recharts** (courbes/graphes) — utilisé dans CurvePlot, stats render
- **rc-slider** (sliders), **Draco** (compression 3D), **Moment.js**, **Protobuf**

### 3.2 Pages / Dialogs majeurs
| Composant | Rôle |
|---|---|
| `FireworksSimulationView` | Vue 3D principale du spectacle (Three.js + Cesium) |
| `EffectEditorPage` / `EffectEditor` | Éditeur de l'arbre VDL d'un effet |
| `CreatePhotoDialogPage` | Capture / export photo |
| `Client3dTilesDownloaderDialog` | Téléchargement de tuiles Cesium 3D |
| `ClientSyncDialogPage` | Synchro client ↔ cloud |
| `ConfigFilesPage` | Édition des fichiers config |
| `RenderPerformanceDialogPage` | Monitoring rendu (FPS, batch count, timings) |
| `RequestLogsPage` | Logs API (audit, debug) |
| `PromosPage` | Gestion promotions / licences |
| `LoginForm`, `CreateAccountPage`, `VerifyEmailPage` | Authentification |
| `DataTable`, `TreeView` | Affichage de données tabulaires/hiérarchiques |

### 3.3 Panneaux d'édition / widgets
- `EffectFieldsPanel` (propriétés d'un effet)
- `Timeline` (cues du spectacle)
- `Camera Panel` (position/orientation/FOV)
- `CurvePlot` / `Curve Editor` (édition de courbes d'émission)
- `Global Params Grid`
- `Node Edit Panel` (arbre de scène)
- `Smoke Thickness Widget`, `Particle Limit Widget`
- Inputs : `EditableTextWidget`, `FloatParamSlider`, `BoolWidget`, `ColorSwatch`,
  `RangeSlider`, `DatePicker`, `ActionMenu`, `ContextMenu`
- Nav : `BreadCrumbTrail`, `TopNav`, `PageChooserWidget`

### 3.4 Catégories d'effets (subtypes VDL)
**18 subtypes pyrotechniques** : `brocade`, `cake`, `chrysanthemum`, `comet`,
`crossette`, `dahlia`, `diadem`, `falling leaves`, `kamuro`, `mine`, `palm`,
`peony`, `ring`, `wave`, `willow`, `ground`, `sfx`, `light`, plus `other`.

**Sous-variations** : break, salute, shell, gerb, screamer, crackle, fizzle,
fountain, mortar, fan, rocket, candle, jet, whistles, hummers, spinning
(whirl/tigertail), strobe.

**Couleurs canoniques** : gold, silver, copper, red, green, blue, white, yellow,
purple, titanium salt.

### 3.5 Paramètres VDL éditables (extraits)
`apex_height`, `apex_time`, `launch_height`, `trajectory_height`,
`camera_pos`, `camera_ori`, `camera_fov`, `break_flash_spark_color`,
`emit_inherit_velocity`, `max_light_end_time`, `max_star_end_time`,
courbes : `EmitCurveTaper1`, `EmitCurveLinear`, `EmitCurveSpinner`,
`EmitCurvePopcornCrackle`.

### 3.6 Formats de fichiers supportés
| Extension | Usage |
|---|---|
| `.fin` | Format natif spectacle Finale |
| `.us` | Format d'import alternatif (script ?) |
| `.kml` | Placement géographique (Google Earth) |
| `.csv` | Import/export données en masse (effets, parts) |
| `.json` | Configurations, manifests |
| `.gltf` / `.glb` / `.obj` / `.skp` | Modèles 3D (4 landmarks fournis : Stadium, Eiffel, Eurovision, Golden Gate) |
| `.exr` | Rendu HDR studio-grade |

### 3.7 Cloud / API GraphQL
**Endpoints** : `https://api.prevotfx.com/v1/{create,login}`, `https://api2.prevotfx.com/gql`, `https://effects.prevotfx.com/`.
**Queries** : `GetUser`, `GetUserForEmail`, `GetEmailAddressHasBeenVerified`,
`GetAllUsers`, `GetAllRequestLogs`, `GetRequestLogEntryForId`,
`GetForumPostBalancesForIds`, `GetNetworkPartsInfos`.
**Mutations** : `ApplyMyPartsCsvChanges`, `SaveNetworkInventories`,
`UploadExrImage`, `UploadGltfModel`, `UpdateEddLicensesFromWordpress[Fast]`,
`CreatePromoLicense`, `PostImageToOnlineGallery`.
**Subscriptions** : `SubscribeToRenderEvents`, `SubscribeToRenderFrameStats`,
`RealtimeUpdateLogStreamDescriptions`.
**Auth** : token JWT en `localStorage.auth_token`.

### 3.8 Assets (volumétrie)
- **283 sons** (282 `.wav` + 1 `.mp3` `pgi_carmina.mp3`) : screamers, hummers,
  bursts, gerbs, mambas, whistles, helicopter, ainsi que des sons UI
  (kerchunk, fairy, magic, scale_down, etc.)
- **10 curseurs** `.cur` (back_of_hand, rotate_y, translate_xz, up_arrow*…)
- **8 images de fond** (grass, gravel, concrete, cracked_dirt, tahoe,
  eisernersteg, sydney_bridge, evening_sky)
- **4 modèles SketchUp** (Stadium, Eiffel Tower, Eurovision Studio, Golden Gate)
- **3 polices** (FreeSans Regular/Bold/Oblique)

### 3.9 Stockage local
- `localStorage.auth_token` (jeton d'authentification)
- IndexedDB **non** détecté explicitement dans le bundle minifié — à
  reconfirmer en exécution.

### 3.10 Pépites notables
- **Render Performance Dialog** : timings détaillés (`build_render_dom_ms`,
  `create_render_task_ms`, `inside/outside_render_ms`) → utile à reproduire
  pour diagnostic terrain.
- **Workflow HDR ACEScc** + tonemap cubemap éditable, exposition en stops.
- **Streaming d'événements de rendu** via GraphQL subscriptions (live FPS).
- **28 langues** déjà traduites (FR inclus).
- **Cesium 3D Tiles** : on peut récupérer un terrain réel pour le lieu du
  spectacle.

---

## 4. Pipeline GPU (shaders `app.nw/gpu/`)

### 4.1 Vue d'ensemble
- **GLSL 330 core** (OpenGL 3.3 desktop, donc WebGL2 côté nav).
- **Architecture par étapes** : `physics_pre` → `physics_inline` → `physics_post`
  (mise à jour des particules), puis passes de rendu par primitive.

### 4.2 Shaders par famille

| Famille | Vert. | Frag. | Rôle |
|---|---|---|---|
| **Particules / sparks** | `shader_spark_star_v1/v2.vert`, `shader_spark_trail_v1/v2.vert` | `shader_spark_v1/v2.frag` | Étincelles : v1 = points, v2 = tracées avec aura |
| **Smoke** | `shader_smoke_star.vert`, `shader_smoke_trail.vert` | `shader_smoke.frag` | Fumée |
| **Flame** | `shader_flame_trail.vert` | `shader_flame.frag` | Flammes |
| **Light beam** | `shader_light_beam_star.vert` | `shader_light_beam_star.frag` | Faisceaux lumineux |
| **Mesh / GLTF** | `shader_mesh.vert`, `shader_gltf.vert`, `shader_meshReflective.vert` | `shader_mesh.frag`, `shader_gltf.frag`, `shader_reflective.frag` | Géométrie statique (terrain, public) |
| **Post-process** | `shader_fullscreen.vert` | `shader_postProcess.frag`, `shader_tonemap.frag`, `shader_tonemap_with_cubemap.frag`, `shader_gaussianBlur.frag`, `shader_compositeTextures.frag` | Tone-mapping, blur, composite |
| **2D / UI** | `shader_rect2d.vert`, `shader_line.vert` | `shader_rect2d.frag`, `shader_line.frag` | Overlay 2D |
| **Physique** | `physics_pre/inline/post.vert` | — | Mise à jour des `ParticleState` (transform feedback) |

### 4.3 Modèle de données (issu des structs GLSL)

```glsl
struct ParticleState {
    vec3 pos; float t0;
    vec3 vel; float duration;
    vec3 gravity; float wind_friction;
    vec4 ori0, ori1;          // orientation start/end (quat)
    uint random_state;
    float motion_flags;
    float dmx_strobing_frequency;
    int pos_curve4_id, vel_curve4_id, ori_curve4_id, rgb_curve4_id;
};
struct EmitterInfo {
    vec2 aEmitLifetimeGaussian;
    vec2 aEmitWindFrictionGaussian;
    vec2 aEmitVelGaussian;
    vec2 aEmitInheritVelocityGaussian;
    float aEmitVelTaper, aEmitDiscDiameter;
    int aEmitCurve, aEmitStyle;
    float aEmitStyleArg0;
    int aEmitFlags, aBreakRandomTweak;
};
struct SparkInfo  { vec3 aColor0; float aIntensity1; vec3 aColor1; int aIntensityCurve;
                    vec2 aDiameterGaussian; float aIntensityCurveLoopDuration;
                    float aTemperature0, aTemperature1; vec2 aHotCircleDiameterGaussian; }
struct SmokeInfo  { float aSmokeDensity, aSmokePuffStartSize, aSmokePuffEndSize; int aSmokePuffSizeCurve; }
struct FlameInfo  { float aFlamePuffStartSize, aFlamePuffEndSize; int aFlamePuffSizeCurve, aFlamePuffTempCurve, aFlamePuffAlphaCurve; }
struct LightBeamInfo { vec3 aColor0,aColor1; float aIntensity1; int aIntensityCurve;
                       float aAngleSpread0,aAngleSpread1, aDiameter0, aConeHeight0; }
struct PhysicsParams { vec3 wind_velocity; }
```

### 4.4 Uniforms clés (caméra, scène, post-process)

- **Caméra** : `ProjMat`, `ViewMat`, `ModelMat`, `LightProjMat`, `LightViewMat`, `uCameraFovY`
- **Scène** : `uSunColor`, `uSunDirection`, `uAmbientColor`, `uFogNear`, `uFogFar`, `uFogEnabled`
- **Tone-map** : `uTonemapTexture` (LUT 3D), `R_cubemap_power`
- **Effets** : `R_spark_intensity`, `R_spark_aura_*`, `R_v2_core_*`, `R_sparkPhase0*`
- **Textures partagées** : `uPuffTexture`, `uSmokePuffTexture`, `uSparkAuraTexture`,
  `uReflectionTexture`, `uWaterNormalMap`, `uMaterialBaseColorTexture`,
  `uGroundSplatsTexture` (sampler2DArray)

### 4.5 Conséquences pour le pont GPU
- Les shaders sont **directement réutilisables** (rien d'obfusqué).
- Pour rendre une particule, il faut fournir : un buffer `ParticleState[]`,
  un (ou plusieurs) `EmitterInfo`/`SparkInfo`/etc. via UBO ou attributs,
  des textures de bruit (`puff`, `aura`), un cubemap, une LUT de tonemap.
- Les courbes (`pos_curve4_id`, etc.) sont indexées : il faut un buffer
  global de courbes côté GPU, alimenté par le compilateur.
- → **Le compilateur WASM produit ces buffers** (cf. § 5).

---

## 5. Compilateur d'effets WASM (`vdl_effect_compiler`)

### 5.1 Composition
- **Emscripten + Embind** : module C++ exposé à JS via `_embind_register_class*`.
- **30 imports** : standards Emscripten (libc, WASI stdio).
- **11 exports** : juste `malloc/free`, ctors, helpers de stack et type names.
  L'API métier est exposée par embind à `__wasm_call_ctors` au démarrage.
- **Mémoire** : 22 Mo de départ, 2 Go max.

### 5.2 API métier (déduite des strings dans la `.data`)

#### Fonctions publiques (préfixe `ee_`)
| Fonction | Rôle probable |
|---|---|
| `ee_newState` | Créer un nouvel état de compilateur |
| `ee_newFromInputDescription` | Parser une description textuelle d'effet → arbre VDL |
| `ee_newFromPartFields` | Construire un effet à partir de champs structurés (catalogue) |
| `ee_rebuildFromPartFields` | Idem, en place |
| `ee_addNode` / `ee_copyNode` / `ee_delNode` / `ee_pasteNode` | Édition de l'arbre VDL |
| `ee_setNodeAttribute` / `ee_setNodeVdl` | Mutation d'un nœud |
| `ee_setPartField` | Mutation d'un champ (catalogue) |
| `ee_applyMutation` / `ee_applyState` | Re-compilation après changement |
| `ee_getStateForText` / `ee_getStateForEffectBeingCustomized` | Récupérer l'état courant |
| `ee_compressBlobText` | Compression zstd (corpus partagé) |

#### Classe principale
- `Vdl_effectCompiler` (registered class via embind)
- Fonction `getRenderBatches` → renvoie les batches GPU prêts à dessiner
- Fonctions support : `getSimHashesMapFromText`, `replaceBlobTextsWithSimHashes`,
  `findLaunchSpeedFromDuration`, `getTrajectorySpecInfo`,
  `makeCurveSpecUseCurveVertexes`, `makeEnumInfo`

### 5.3 Format de données : Protocol Buffers
Messages identifiés dans la section data :

```
PrevotFxEffect.Effect.node_vdl       ← racine
PrevotFxEffect.Shot.node_vdl         ← un tir
PrevotFxEffect.Launch.node_vdl       ← trajectoire de montée
PrevotFxEffect.Break.node_vdl        ← explosion
PrevotFxEffect.BreakPetal.node_vdl   ← pétale d'explosion
PrevotFxEffect.Emitter.node_vdl      ← émetteur de particules
PrevotFxEffect.StarParticle.node_vdl ← étoile (particule lumineuse)
PrevotFxEffect.StarPhase.node_vdl    ← phase de vie d'une étoile
PrevotFxEffect.SparkVisual.node_vdl  ← visuel d'étincelle
PrevotFxEffect.FlameVisual.node_vdl  ← visuel de flamme
PrevotFxEffect.SmokeVisual.node_vdl  ← visuel de fumée
PrevotFxEffect.LightBeamVisual.node_vdl ← faisceau lumineux
PrevotFxEffect.Sound.node_vdl        ← effet sonore
```

→ **Un effet = un arbre `Effect → Shot* → (Launch + Break)`**
où `Break` contient `BreakPetal`/`Emitter`/`StarParticle`/`StarPhase`/visuals/sound.

### 5.4 Stratégie d'interop (réaliste)

**Option A — Réutiliser le compilateur WASM tel quel**
- Charger `vdl_effect_compiler.wasm` depuis notre UI
- Utiliser embind comme l'app d'origine
- Avantage : on ne réinvente pas le compilateur (un produit C++ mature)
- Coût : on dépend d'un binaire opaque

**Option B — Reproduire le compilateur**
- Implémenter le format VDL en TS/Rust
- Avantage : maîtrise totale
- Coût : énorme (compilateur de DSL, optim, courbes, etc.)

**→ Décision recommandée : Option A pour l'instant.**
Le pont GPU réutilise le compilateur existant ; la nouvelle UI lui parle
en JS standard.

---

## 6. Plan multi-sessions

### Track A — UI Prevot FX (reproduction française)

| # | Item | Statut | Session cible |
|---|---|---|---|
| A1 | Inventaire exhaustif des features (cf. § 3) | terminé | 2 |
| A2 | `git lfs pull` local + parsing `translations_fr.txt` → table canonique (la nôtre est en place dans `lib/i18n.js`, ~120 clefs ; à enrichir au fil) | partiel | 3 |
| A3 | Maquette FR layout principal : topbar + sidebar + scène + timeline | terminé | 3 |
| A4 | Topbar : Fichier, Édition, Affichage, Effet, Outils, Aide (drop-down + sous-menus, Save/Open/Undo/Redo/Print/Quit) | terminé | 3 |
| A5 | Panneau "Bibliothèque d'effets" : 30 effets, 15 partTypes, 19 subtypes, favoris, custom CRUD | terminé | 3 |
| A6 | Inspector : props d'un cue éditables live (timing, géométrie, apparence) | terminé | 3 |
| A6b | Inspector : courbe d'enveloppe d'intensité (canvas) avec presets | terminé | 5 |
| A7 | Timeline pro : multi-pistes, drag-to-move, copier/coller (Ctrl+C/V/X/D), curseur de lecture, drop d'effets — _zoom + resize cues à venir_ | quasi-terminé | 3-4 |
| A8 | `RenderPerformanceDialog` : modal flottante (FPS lissé, frame time, RAM heap, particules, batches, cues), graphe 10 s, raccourci F8 | terminé | 5 |
| A9 | Bascule progressive : par défaut nouvelle UI, fallback iframe ancien bundle | à faire | 8+ |

### Track B — Pont GPU/GLSL

| # | Item | Statut | Session cible |
|---|---|---|---|
| B1 | Documenter pipeline + structs (CE document § 4) | terminé | 2 |
| B2 | Inventaire WASM (CE document § 5) | terminé | 2 |
| B3 | Charger le WASM compilateur ; sondage exports/imports via WebAssembly.Module (vue GPU Lab) | partiel | 5 |
| B3b | Reproduire glue Embind pour instanciation complète + appel `ee_newState` | à faire | 6+ |
| B4 | Hello-world : compiler un effet trivial → render batch sur un canvas WebGL2 | à faire | 6+ |
| B5a | Mini-renderer WebGL2 vanilla autonome (sky + ground + particules billboardées + 12 styles d'explosion VDL) | terminé | 5 |
| B5b | Câbler la sortie `getRenderBatches()` du WASM aux shaders Prevot FX originaux | à faire | 7+ |
| B6 | Étendre à plusieurs shaders (sparks v2, smoke, flame) | à faire | 5-7 |
| B7 | Caméra / scène (sun, fog, tonemap) — _ground/sky/orbit déjà OK_ | partiel | 5 |
| B8 | Composition full pipeline (post-process, blur, cubemap) | à faire | 9+ |

### Track C — Features métier (parallèle)

| # | Item | Statut | Session cible |
|---|---|---|---|
| C1 | Import KML (placement géographique) — parser + UI Fichier→Importer→KML | terminé | 3 |
| C2 | Édition cue avancée : sélection multiple, copier/coller/couper/dupliquer/supprimer (raccourcis + menus + clipboard interne), décalage groupé, drag-to-move | terminé | 3-4 |
| C3 | Bibliothèque d'effets éditable : favoris ⭐, effets personnalisés CRUD, onglets, filtres | terminé | 3 |
| **C3b** | **Catalogue Prevot réel** : remplacer les 30 effets génériques par le vrai catalogue (export "My Parts" depuis Prevot FX, ou autre format). Cf. § 3.7 — synchro via `api2.prevotfx.com/gql` mutation `ApplyMyPartsCsvChanges`. **Nécessite un fichier d'export utilisateur, en attente.** | en attente | quand l'export sera dispo |
| C4 | Cesium 3D Tiles : terrain réel sous la scène (lat/lon → 3D Tiles streaming) | à faire | 7+ |
| C5 | Import `.fin` / `.us` natif : décodeur protobuf wire-format + mapping heuristique vers le catalogue (30 mots-clés) → import en un clic dans un nouveau show. _Précision limitée sans descripteur officiel._ | quasi-terminé | 7 |
| C6 | Export : bons de tir + bons de commande imprimables (PDF via window.print). _`.fin` natif à venir._ | quasi-terminé | 4 |
| C7 | ~~Décision auth/cloud~~ → **mode hors-ligne** : bouclier réseau qui bloque prevotfx.com et télémétries (cf. § 7) | terminé | 2 |
| C8 | Synchro multi-utilisateur (export `.prevofx` + diff/merge ou backend custom) | à faire | 8+ |

---

## 7. Décisions techniques actées

- **NW.js** comme runtime bureau (déjà en place).
- **Vanilla JS / ES modules** côté UI (pas de build step) jusqu'à preuve
  du contraire — change si la complexité explose.
- **localStorage** comme persistance MVP. Migration vers IndexedDB ou
  fichiers natifs lors du chantier export/import.
- **Réutilisation** du compilateur WASM (Option A) plutôt que réécriture.
- **Anglais → Français** : la source de vérité pour les libellés est
  `app.nw/translations/translations_fr.txt` (à puller en LFS).
- **Mode hors-ligne strict** : aucune donnée ne doit quitter la machine.
  Décidé en session 2. Implémentation : `app/ui/lib/network-shield.js`
  installe un listener `chrome.webRequest` (NW.js) + override `fetch`/`XHR`
  qui bloque les domaines listés ci-dessous, avec compteur visible dans la
  sidebar et détail dans Paramètres → Confidentialité.

  Domaines bloqués (extensible) : `prevotfx.com` (tous sous-domaines),
  `google-analytics.com`, `googletagmanager.com`, `doubleclick.net`,
  `sentry.io`. Localhost et `file://` toujours autorisés.

---

## 8. Risques / inconnues à valider en cours de route

1. **Licence Prevot FX** : produit commercial, distribution à des collègues
   = potentielle violation. **À clarifier avec l'éditeur avant toute
   diffusion**, indépendamment des chantiers techniques.
2. ~~**Cloud `prevotfx.com`**~~ **Tranché en session 2** : mode hors-ligne
   strict, bouclier réseau actif (cf. § 7). À surveiller : que de nouvelles
   versions du bundle Prevot FX n'introduisent pas d'autres domaines à
   bloquer.
3. **NW.js cross-package iframe** : est-ce que l'iframe `app/ui` →
   `app.nw/htmlui` se comporte bien (Node-remote, file://, CORS) ?
   → À tester au prochain lancement local.
4. **Embind sans le bundle** : est-ce qu'on peut charger
   `vdl_effect_compiler.wasm` directement sans le glue JS d'origine ?
   Probablement non — il faut **extraire la glue Embind** du bundle
   original (ou la reproduire). À investiguer.
5. **Corpus zstd partagé** (`zstd_effect_blob_corpus_1.bin`, 6 Mo) :
   nécessaire au compilateur, au render, ou aux deux ?
6. **Format `.fin`** : protobuf binaire — parser nécessite les `.proto`
   sources (à reverse depuis `PrevotFxEffect.*.node_vdl`). Possible mais
   non trivial.
7. **Modèles SketchUp `.skp`** : format propriétaire Trimble, pas de
   parser open source mature. Pour landmarks de démo, accepter de
   re-distribuer ou remplacer par GLTF.
8. **Cesium Ion key** : Cesium 3D Tiles streaming nécessite une clé API.
   Coût à évaluer pour usage équipe.

---

## 9. Glossaire FR

| Terme EN (Prevot FX) | Terme FR | Sens |
|---|---|---|
| Show | Spectacle | Une chorégraphie complète |
| Cue | Cue | Déclenchement d'un effet à un instant t (mot conservé, jargon métier) |
| Effect | Effet | Un effet pyrotechnique (bombe, etc.) |
| Shot | Tir | Une trajectoire individuelle dans un effet |
| Break | Explosion | Le burst d'un shell |
| Petal | Pétale | Sous-ensemble d'une explosion |
| Emitter | Émetteur | Source de particules |
| Star | Étoile | Particule lumineuse |
| Spark | Étincelle | Particule courte |
| Trail | Traînée | Émission continue derrière une particule |
| Subtype | Sous-type | Catégorie visuelle (peony, willow, etc.) |
| PartType | Type de pièce | Catégorie sémantique (cake, mine, etc.) |
| Rack | Rampe | Support de tirs multiples |
