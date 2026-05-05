# PrevoFX

Prototype web inspiré de **Finale 3D** : conception de spectacles pyrotechniques avec timeline musicale, simulation 3D des feux d'artifice, bibliothèque d'effets et export d'un script de tir.

## Démarrer

L'app utilise `fetch()` pour charger le catalogue d'effets, donc il faut la servir via un petit serveur local (pas en `file://`). Au choix :

```bash
# Python (déjà installé partout)
cd "final prevot"
python -m http.server 8080

# Ou Node
npx http-server -p 8080 .
```

Ouvre ensuite `http://localhost:8080` dans le navigateur (Chrome/Edge/Firefox récents).

## Utilisation

1. **Audio** : clique sur "🎵 Audio" pour charger un .mp3, .wav ou .ogg. La waveform apparaît dans la timeline. (Sans audio chargé, la lecture utilise une horloge de 60 s pour démo.)
2. **Placer une cue** : clique sur un effet dans la bibliothèque (gauche) → il devient orange, le curseur devient une croix → clique sur la timeline à l'instant et la piste voulus.
3. **Lecture** : ▶ Lecture lance l'audio + déclenche les feux 3D au passage du playhead.
4. **Edition** : clique sur une cue (sur la timeline) pour l'éditer dans l'inspecteur (droite) — temps, piste, position X/Z dans la scène. Touche `Suppr` pour effacer la cue sélectionnée. `Echap` pour quitter le mode placement.
5. **Caméra 3D** : glisser pour orbiter, molette pour zoomer.
6. **Sauvegarde** : 💾 Projet enregistre les cues en .json. 📂 Ouvre un projet sauvegardé.
7. **Export script de tir** : ⤓ CSV ou ⤓ JSON.

## Architecture

```
index.html              entrée + layout
css/styles.css          UI dark
data/effects.json       catalogue d'effets (10 effets de départ)
js/effects.js           registre d'effets
js/scene3d.js           Three.js : ciel, sol, particules de feux
js/audio.js             AudioEngine (Web Audio API + transport)
js/timeline.js          canvas timeline + cues + waveform + playhead
js/project.js           save/load JSON
js/export.js            export CSV / JSON du firing script
js/main.js              bootstrap
```

## Pour étendre

- **Nouveaux effets** : ajouter une entrée dans `data/effects.json`. Champs : `id`, `name`, `category`, `color`, `secondaryColor`, `particleCount`, `duration`, `spread`, `gravity`, `drag`, `trail`, `shellSize`, `shape`, `description`. Les `shape` reconnues : `sphere`, `ring`, `palm`, `comet`, `willow`, `crossette`, `flash`.
- **Plus de pistes** : changer `TRACKS` dans `js/timeline.js`.
- **MIDI ou OSC pour piloter une vraie table de tir** : intercepter `onCueFired` dans `main.js` au lieu d'appeler `Scene3D.fireEffect`.

## Limitations connues

- Pas de gestion fine des trails par particule (opacité globale).
- L'export CSV ne contient pas encore les colonnes "rampe", "module", "canal" d'une vraie table de tir — facile à ajouter dans `js/export.js`.
- Pas de undo/redo.
- Le projet sauvegardé n'embarque pas l'audio (l'utilisateur recharge le fichier).
