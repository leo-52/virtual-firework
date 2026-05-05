// audio.js
// Charge un fichier audio (File) en AudioBuffer + lecture via Web Audio API.
// Expose un transport simple (play / pause / seek / currentTime).
// Renommé AudioEngine pour éviter la collision avec window.Audio (HTMLAudioElement).
//
// Émet l'événement "tick" via un callback onTick(time).

const AudioEngine = (() => {
  let ctx = null;
  let buffer = null;
  let source = null;
  let startedAt = 0;
  let pauseAt = 0;
  let isPlaying = false;
  let onTickCb = null;
  let rafId = null;
  let durationFallback = 60; // s'il n'y a pas d'audio chargé

  function _ensureCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  async function loadFile(file) {
    _ensureCtx();
    const buf = await file.arrayBuffer();
    buffer = await ctx.decodeAudioData(buf);
    pauseAt = 0;
    return { duration: buffer.duration, name: file.name };
  }

  function getDuration() { return buffer ? buffer.duration : durationFallback; }
  function setFallbackDuration(s) { durationFallback = s; }

  function _stopSource() {
    if (source) {
      try { source.onended = null; source.stop(); } catch (e) {}
      source = null;
    }
  }

  function play() {
    _ensureCtx();
    if (isPlaying) return;
    if (buffer) {
      _stopSource();
      source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      const offset = pauseAt;
      source.start(0, offset);
      startedAt = ctx.currentTime - offset;
      source.onended = () => {
        if (isPlaying && currentTime() >= getDuration() - 0.05) {
          isPlaying = false;
          pauseAt = 0;
          _emitTick(0);
        }
      };
    } else {
      // pas d'audio : utilise une horloge virtuelle
      startedAt = (performance.now() / 1000) - pauseAt;
    }
    isPlaying = true;
    _loop();
  }

  function pause() {
    if (!isPlaying) return;
    pauseAt = currentTime();
    isPlaying = false;
    _stopSource();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    _emitTick(pauseAt);
  }

  function stop() {
    pause();
    pauseAt = 0;
    _emitTick(0);
  }

  function seek(t) {
    const wasPlaying = isPlaying;
    if (isPlaying) pause();
    pauseAt = Math.max(0, Math.min(getDuration(), t));
    if (wasPlaying) play();
    else _emitTick(pauseAt);
  }

  function currentTime() {
    if (!isPlaying) return pauseAt;
    if (buffer) return ctx.currentTime - startedAt;
    return (performance.now() / 1000) - startedAt;
  }

  function _loop() {
    if (!isPlaying) return;
    const t = currentTime();
    if (t >= getDuration()) {
      isPlaying = false;
      pauseAt = 0;
      _emitTick(0);
      return;
    }
    _emitTick(t);
    rafId = requestAnimationFrame(_loop);
  }

  function _emitTick(t) { if (onTickCb) onTickCb(t); }
  function onTick(cb) { onTickCb = cb; }
  function isReady() { return !!buffer; }
  function playing() { return isPlaying; }

  // Construit une silhouette simple de waveform (peaks normalisés)
  function getPeaks(numBuckets = 1000) {
    if (!buffer) return null;
    const ch = buffer.getChannelData(0);
    const step = Math.floor(ch.length / numBuckets);
    const peaks = new Float32Array(numBuckets);
    for (let i = 0; i < numBuckets; i++) {
      let max = 0;
      for (let j = 0; j < step; j++) {
        const v = Math.abs(ch[i * step + j] || 0);
        if (v > max) max = v;
      }
      peaks[i] = max;
    }
    return peaks;
  }

  return { loadFile, play, pause, stop, seek, currentTime, getDuration, setFallbackDuration, getPeaks, onTick, isReady, playing };
})();

window.AudioEngine = AudioEngine;
