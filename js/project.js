// project.js
// Sauvegarde / chargement du projet (cues + meta) au format JSON.
// Le fichier audio n'est pas embarqué (taille) — l'utilisateur le rechargera.

const Project = (() => {
  function save() {
    const data = {
      version: 1,
      app: 'PrevoFX',
      createdAt: new Date().toISOString(),
      audioName: window.__audioName || null,
      timeline: Timeline.toJSON(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prevofx-projet-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function loadFromFile(file) {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.timeline) Timeline.loadJSON(data.timeline);
    return data;
  }

  return { save, loadFromFile };
})();

window.Project = Project;
