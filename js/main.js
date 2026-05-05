// main.js
// Bootstrap de l'application : charge le catalogue, prépare la scène 3D,
// la timeline, le panneau d'effets, branche les contrôles de transport.

(async function main() {
  // 1. Charger la bibliothèque d'effets
  await Effects.load();

  // 2. Initialiser la 3D
  const canvas = document.getElementById('viewport');
  Scene3D.init(canvas);

  // 3. Initialiser la timeline
  Timeline.init({
    container: document.getElementById('timeline'),
    onCueFired: (cue) => {
      const eff = Effects.get(cue.effectId);
      if (eff) Scene3D.fireEffect(eff, { x: cue.pos.x, z: cue.pos.z });
    },
    onSelectionChange: (cue) => updateInspector(cue),
  });
  Timeline.setDuration(60);
  Timeline.setSeekHandler((t) => AudioEngine.seek(t));

  // 4. Tick global aligné sur l'audio
  AudioEngine.onTick((t) => Timeline.tick(t));

  // 5. Construire la palette d'effets
  buildEffectPalette();

  // 6. Brancher les boutons de transport et menus
  bindUIControls();

  // 7. Quelques cues de démo (avant chargement audio)
  AudioEngine.setFallbackDuration(60);
  Timeline.addCue(2.0, 'comet_blue', 0);
  Timeline.addCue(4.0, 'peony_red', 1);
  Timeline.addCue(6.5, 'chrysanthemum_silver', 2);
  Timeline.addCue(8.5, 'willow_gold', 0);
  Timeline.addCue(10.5, 'salute_white', 3);
  Timeline.addCue(12.0, 'brocade_crown', 1);
  setStatus('Prêt. Charge un fichier audio ou clique sur Lecture pour la démo.');
})();

// ---------------- UI ----------------

function buildEffectPalette() {
  const list = document.getElementById('effects-list');
  list.innerHTML = '';
  for (const eff of Effects.all()) {
    const btn = document.createElement('div');
    btn.className = 'effect-card';
    btn.dataset.effectId = eff.id;
    btn.innerHTML = `
      <div class="swatch" style="background:${eff.color}; ${eff.secondaryColor ? `box-shadow: inset 0 -8px 0 ${eff.secondaryColor};` : ''}"></div>
      <div class="meta">
        <div class="name">${eff.name}</div>
        <div class="cat">${eff.category} • ${eff.duration}s</div>
      </div>
      <button class="preview" title="Tirer maintenant">▶</button>
    `;
    btn.addEventListener('click', (e) => {
      if (e.target.closest('.preview')) return;
      // Toggle "place mode"
      const wasActive = btn.classList.contains('active');
      document.querySelectorAll('.effect-card.active').forEach(el => el.classList.remove('active'));
      if (wasActive) {
        Timeline.setPlacingEffect(null);
        setStatus('Mode placement désactivé.');
      } else {
        btn.classList.add('active');
        Timeline.setPlacingEffect(eff.id);
        setStatus(`Mode placement actif : clique sur la timeline pour insérer "${eff.name}". Echap pour annuler.`);
      }
    });
    btn.querySelector('.preview').addEventListener('click', (e) => {
      e.stopPropagation();
      Scene3D.fireEffect(eff);
    });
    list.appendChild(btn);
  }
}

function bindUIControls() {
  document.getElementById('btn-play').addEventListener('click', () => AudioEngine.play());
  document.getElementById('btn-pause').addEventListener('click', () => AudioEngine.pause());
  document.getElementById('btn-stop').addEventListener('click', () => AudioEngine.stop());
  document.getElementById('btn-clear-fx').addEventListener('click', () => Scene3D.clear());

  document.getElementById('btn-clear-cues').addEventListener('click', () => {
    if (confirm('Effacer toutes les cues ?')) Timeline.clearCues();
  });

  document.getElementById('audio-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setStatus(`Chargement de ${file.name}…`);
    try {
      const meta = await AudioEngine.loadFile(file);
      window.__audioName = meta.name;
      Timeline.setDuration(meta.duration);
      Timeline.setPeaks(AudioEngine.getPeaks(1500));
      setStatus(`Audio chargé : ${meta.name} (${meta.duration.toFixed(1)} s)`);
    } catch (err) {
      console.error(err);
      setStatus('Erreur de décodage audio (essaie un .mp3, .wav ou .ogg).');
    }
  });

  document.getElementById('btn-export-csv').addEventListener('click', () => Exporter.downloadCSV());
  document.getElementById('btn-export-json').addEventListener('click', () => Exporter.downloadJSON());
  document.getElementById('btn-save-project').addEventListener('click', () => Project.save());

  document.getElementById('project-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await Project.loadFromFile(file);
      setStatus(`Projet chargé : ${file.name}`);
    } catch (err) {
      console.error(err);
      setStatus('Projet invalide.');
    }
  });
}

function updateInspector(cue) {
  const ins = document.getElementById('inspector-content');
  if (!cue) {
    ins.innerHTML = '<div class="muted">Sélectionne une cue pour l\'éditer.</div>';
    return;
  }
  const eff = Effects.get(cue.effectId);
  ins.innerHTML = `
    <div class="ins-row"><label>Effet</label><span>${eff ? eff.name : cue.effectId}</span></div>
    <div class="ins-row"><label>Temps (s)</label>
      <input type="number" step="0.05" value="${cue.time.toFixed(2)}" data-field="time"></div>
    <div class="ins-row"><label>Piste</label>
      <input type="number" min="1" max="4" value="${cue.track + 1}" data-field="track"></div>
    <div class="ins-row"><label>Position X</label>
      <input type="number" step="1" value="${cue.pos.x.toFixed(1)}" data-field="x"></div>
    <div class="ins-row"><label>Position Z</label>
      <input type="number" step="1" value="${cue.pos.z.toFixed(1)}" data-field="z"></div>
    <div class="ins-row"><button id="btn-fire-cue">Tirer maintenant</button>
      <button id="btn-del-cue" class="danger">Supprimer</button></div>
  `;
  ins.querySelectorAll('input[data-field]').forEach(inp => {
    inp.addEventListener('change', () => {
      const v = parseFloat(inp.value);
      const field = inp.dataset.field;
      if (field === 'time') cue.time = Math.max(0, v);
      if (field === 'track') cue.track = Math.max(0, Math.min(3, Math.round(v) - 1));
      if (field === 'x') cue.pos.x = v;
      if (field === 'z') cue.pos.z = v;
      Timeline.draw();
    });
  });
  document.getElementById('btn-fire-cue').addEventListener('click', () => {
    Scene3D.fireEffect(eff, { x: cue.pos.x, z: cue.pos.z });
  });
  document.getElementById('btn-del-cue').addEventListener('click', () => {
    Timeline.removeCue(cue.id);
  });
}

function setStatus(msg) {
  const el = document.getElementById('status');
  if (el) el.textContent = msg;
}
