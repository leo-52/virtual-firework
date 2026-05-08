// Audio (stub V2). À étoffer : WebAudio loader + waveform peaks +
// AudioPlayer synchronisable. Pour l'instant on expose juste l'API
// minimum pour ne pas casser les imports ailleurs.

const MAX_AUDIO_SIZE = 15 * 1024 * 1024;

let _ctx = null;
function getCtx() {
  if (!_ctx) {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return _ctx;
}

export async function loadAudioFile(file) {
  if (file.size > MAX_AUDIO_SIZE) {
    throw new Error(`Audio trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo).`);
  }
  // À implémenter complètement plus tard. Pour l'instant on encode
  // juste en base64 sans extraire de waveform.
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Échec lecture audio"));
    r.readAsDataURL(file);
  });
  return {
    name: file.name,
    type: file.type || "audio/mpeg",
    duration: 0,
    peaks: [],
    dataUrl,
  };
}

export function playBeep(freq = 880, duration = 0.06, volume = 0.18) {
  try {
    const ctx = getCtx();
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(volume, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration);
  } catch { /* autoplay policy */ }
}
