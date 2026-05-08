// Couche audio : décode un fichier (.mp3/.wav/.ogg/.flac) via WebAudio,
// extrait une waveform "peaks" (downsampling à N buckets), et expose
// un controlleur de lecture synchronisable avec le simulateur visuel.
//
// L'audio source (Blob) est stocké en base64 dans le show pour
// persistance localStorage. Pas idéal au-delà de quelques Mo : on
// limite à 15 Mo.

const MAX_AUDIO_SIZE = 15 * 1024 * 1024;
const PEAK_BUCKETS = 1024; // largeur visuelle ; on en garde 1024 valeurs

let sharedCtx = null;
function getCtx() {
  if (!sharedCtx) {
    sharedCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return sharedCtx;
}

// Charge un Blob/File → { peaks, duration, sampleRate, channels, dataUrl }
export async function loadAudioFile(file) {
  if (file.size > MAX_AUDIO_SIZE) {
    throw new Error(`Audio trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo > ${MAX_AUDIO_SIZE / 1024 / 1024} Mo)`);
  }
  const arrayBuf = await file.arrayBuffer();
  const ctx = getCtx();
  const audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0));
  const peaks = extractPeaks(audioBuf, PEAK_BUCKETS);
  const dataUrl = await blobToDataUrl(file);
  return {
    name: file.name,
    type: file.type || "audio/mpeg",
    duration: audioBuf.duration,
    sampleRate: audioBuf.sampleRate,
    channels: audioBuf.numberOfChannels,
    peaks,
    dataUrl,
  };
}

// Re-décode depuis un dataUrl persisté
export async function decodeAudioFromDataUrl(dataUrl) {
  const arr = dataUrlToArrayBuffer(dataUrl);
  const ctx = getCtx();
  return ctx.decodeAudioData(arr);
}

function extractPeaks(audioBuf, buckets) {
  // Mixage mono pour la waveform (somme des canaux)
  const len = audioBuf.length;
  const samplesPerBucket = Math.max(1, Math.floor(len / buckets));
  const peaks = new Float32Array(buckets);
  // On utilise la valeur RMS par bucket pour un visuel doux
  for (let i = 0; i < buckets; i++) {
    let sum = 0, count = 0;
    const start = i * samplesPerBucket;
    const end = Math.min(len, start + samplesPerBucket);
    for (let ch = 0; ch < audioBuf.numberOfChannels; ch++) {
      const data = audioBuf.getChannelData(ch);
      for (let s = start; s < end; s++) {
        sum += data[s] * data[s];
        count++;
      }
    }
    peaks[i] = count ? Math.sqrt(sum / count) : 0;
  }
  // Normalisation
  let max = 0;
  for (const v of peaks) if (v > max) max = v;
  if (max > 0) for (let i = 0; i < peaks.length; i++) peaks[i] /= max;
  return Array.from(peaks);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Échec lecture audio"));
    r.readAsDataURL(blob);
  });
}

function dataUrlToArrayBuffer(dataUrl) {
  const i = dataUrl.indexOf(",");
  const b64 = dataUrl.slice(i + 1);
  const bin = atob(b64);
  const len = bin.length;
  const buf = new ArrayBuffer(len);
  const v = new Uint8Array(buf);
  for (let i2 = 0; i2 < len; i2++) v[i2] = bin.charCodeAt(i2);
  return buf;
}

// ---- Player synchronisable -------------------------------------------------

export class AudioPlayer {
  constructor() {
    this.ctx = getCtx();
    this.buffer = null;
    this.source = null;
    this.startedAt = 0; // ctx.currentTime quand on a démarré
    this.startOffset = 0; // position dans le buffer au moment du start
    this.playing = false;
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 1;
    this.gain.connect(this.ctx.destination);
  }

  async setBuffer(arrayBufferOrAudioBuffer) {
    if (arrayBufferOrAudioBuffer instanceof AudioBuffer) {
      this.buffer = arrayBufferOrAudioBuffer;
    } else {
      this.buffer = await this.ctx.decodeAudioData(
        arrayBufferOrAudioBuffer.slice
          ? arrayBufferOrAudioBuffer.slice(0)
          : arrayBufferOrAudioBuffer
      );
    }
  }

  async setFromDataUrl(dataUrl) {
    const arr = dataUrlToArrayBuffer(dataUrl);
    this.buffer = await this.ctx.decodeAudioData(arr);
  }

  setVolume(v) { this.gain.gain.value = Math.max(0, Math.min(1, v)); }

  play(offset = 0) {
    if (!this.buffer) return;
    this.stop();
    this.source = this.ctx.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.connect(this.gain);
    this.startOffset = Math.max(0, Math.min(this.buffer.duration, offset));
    this.startedAt = this.ctx.currentTime;
    this.playing = true;
    this.source.start(0, this.startOffset);
    this.source.onended = () => {
      if (this.source) this.source.disconnect();
      this.source = null;
      this.playing = false;
    };
  }

  pause() {
    const pos = this.currentTime();
    this.stop();
    this.startOffset = pos;
  }

  stop() {
    if (this.source) {
      try { this.source.stop(); } catch {}
      try { this.source.disconnect(); } catch {}
      this.source = null;
    }
    this.playing = false;
  }

  currentTime() {
    if (!this.buffer) return 0;
    if (!this.playing) return this.startOffset;
    return this.startOffset + (this.ctx.currentTime - this.startedAt);
  }

  get duration() {
    return this.buffer ? this.buffer.duration : 0;
  }
}

// ---- Bip TTS-like pour cues ----

let bipCtx = null;
export function playBeep(freq = 880, duration = 0.06, volume = 0.18) {
  try {
    if (!bipCtx) bipCtx = getCtx();
    const t0 = bipCtx.currentTime;
    const osc = bipCtx.createOscillator();
    const g = bipCtx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(volume, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(g).connect(bipCtx.destination);
    osc.start(t0);
    osc.stop(t0 + duration);
  } catch { /* ignore (autoplay policy not granted yet) */ }
}
