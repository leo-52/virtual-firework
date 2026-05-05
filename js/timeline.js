// timeline.js
// Timeline canvas : waveform + pistes de cues + playhead.
//
// Modèle de cue : { id, time (s), effectId, track (0..N-1), pos: {x,z} }
//
// API publique :
//   Timeline.init(opts)              -> { container, onCueFired, onSelectionChange, getCurrentTime, seek }
//   Timeline.setPeaks(peaks)
//   Timeline.setDuration(s)
//   Timeline.addCue(time, effectId)
//   Timeline.removeCue(id) / Timeline.clearCues()
//   Timeline.cues                    -> tableau (lecture)
//   Timeline.tick(currentTime)       -> appelé en boucle, déclenche onCueFired
//   Timeline.draw()                  -> redessine
//   Timeline.toJSON() / loadJSON

const Timeline = (() => {
  const TRACKS = 4;
  const TRACK_H = 28;
  const HEADER_H = 18;
  const RULER_H = 22;

  let canvas, ctx;
  let container;
  let peaks = null;
  let duration = 60;
  let _cues = [];
  let nextId = 1;
  let lastTickTime = 0;
  let onCueFired = () => {};
  let onSelectionChange = () => {};
  let selectedCueId = null;
  let dragging = null;     // { cueId, dx }
  let placingEffectId = null; // mode "ajouter cue"
  let scrollX = 0;         // pixels (zoom à venir)
  let pxPerSec = 60;       // zoom

  function init(opts) {
    container = opts.container;
    onCueFired = opts.onCueFired || (() => {});
    onSelectionChange = opts.onSelectionChange || (() => {});

    canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = (HEADER_H + RULER_H + TRACKS * TRACK_H + 4) + 'px';
    canvas.style.background = '#10131b';
    container.appendChild(canvas);
    ctx = canvas.getContext('2d');

    canvas.addEventListener('mousedown', _mouseDown);
    window.addEventListener('mousemove', _mouseMove);
    window.addEventListener('mouseup', _mouseUp);
    canvas.addEventListener('wheel', _wheel, { passive: false });
    window.addEventListener('keydown', _keyDown);

    new ResizeObserver(() => {
      _resize();
      draw();
    }).observe(canvas);

    _resize();
    draw();
  }

  function _resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setPeaks(p) { peaks = p; draw(); }
  function setDuration(s) { duration = s; draw(); }

  function timeToX(t) { return (t * pxPerSec) - scrollX + 8; }
  function xToTime(x) { return Math.max(0, (x - 8 + scrollX) / pxPerSec); }

  function addCue(time, effectId, track = 0, pos = null) {
    const cue = {
      id: nextId++,
      time: Math.max(0, Math.min(duration, time)),
      effectId,
      track: Math.max(0, Math.min(TRACKS - 1, track)),
      pos: pos || { x: (Math.random() - 0.5) * 80, z: (Math.random() - 0.5) * 80 },
    };
    _cues.push(cue);
    _cues.sort((a, b) => a.time - b.time);
    draw();
    return cue;
  }

  function removeCue(id) {
    _cues = _cues.filter(c => c.id !== id);
    if (selectedCueId === id) { selectedCueId = null; onSelectionChange(null); }
    draw();
  }

  function clearCues() {
    _cues = [];
    selectedCueId = null;
    onSelectionChange(null);
    draw();
  }

  function getSelected() { return _cues.find(c => c.id === selectedCueId) || null; }

  function setPlacingEffect(effectId) {
    placingEffectId = effectId;
    canvas.style.cursor = effectId ? 'crosshair' : 'default';
  }

  // Lecture : à chaque frame, déclenche les cues franchis depuis la dernière frame.
  function tick(t) {
    if (t < lastTickTime) {
      // saut en arrière (seek)
      lastTickTime = t;
      draw();
      return;
    }
    for (const cue of _cues) {
      if (cue.time > lastTickTime && cue.time <= t) {
        onCueFired(cue);
      }
    }
    lastTickTime = t;
    draw(t);
  }

  function _mouseDown(e) {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;

    // ruler : seek
    if (y < HEADER_H + RULER_H) {
      const t = xToTime(x);
      lastTickTime = t;
      if (typeof Timeline._onSeek === 'function') Timeline._onSeek(t);
      draw();
      return;
    }

    // tracks
    const trackIdx = Math.floor((y - HEADER_H - RULER_H) / TRACK_H);
    if (trackIdx < 0 || trackIdx >= TRACKS) return;

    // hit cue ?
    const hit = _hitTestCue(x, y);
    if (hit) {
      selectedCueId = hit.id;
      onSelectionChange(hit);
      dragging = { cueId: hit.id, offset: x - timeToX(hit.time) };
      draw();
      return;
    }

    // placement d'un nouvel effet ?
    if (placingEffectId) {
      const t = xToTime(x);
      const cue = addCue(t, placingEffectId, trackIdx);
      selectedCueId = cue.id;
      onSelectionChange(cue);
      // garde le mode actif (Shift+clic ferait la même chose) -> on coupe le mode au prochain Esc
      return;
    }

    // sinon : déselection
    selectedCueId = null;
    onSelectionChange(null);
    draw();
  }

  function _mouseMove(e) {
    if (!dragging) return;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const cue = _cues.find(c => c.id === dragging.cueId);
    if (!cue) return;
    cue.time = Math.max(0, Math.min(duration, xToTime(x - dragging.offset)));
    const trackIdx = Math.floor((y - HEADER_H - RULER_H) / TRACK_H);
    if (trackIdx >= 0 && trackIdx < TRACKS) cue.track = trackIdx;
    draw();
  }

  function _mouseUp() {
    if (dragging) {
      _cues.sort((a, b) => a.time - b.time);
      onSelectionChange(getSelected());
      dragging = null;
      draw();
    }
  }

  function _wheel(e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const tAtCursor = xToTime(x);
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      pxPerSec = Math.max(10, Math.min(400, pxPerSec * factor));
      // recale scroll pour garder le curseur fixe
      scrollX = tAtCursor * pxPerSec - (x - 8);
      draw();
    } else {
      e.preventDefault();
      scrollX = Math.max(0, scrollX + e.deltaY);
      draw();
    }
  }

  function _keyDown(e) {
    if (e.key === 'Escape') {
      setPlacingEffect(null);
      selectedCueId = null;
      onSelectionChange(null);
      draw();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCueId) {
      // évite de supprimer si user édite un input
      if (document.activeElement && ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) return;
      removeCue(selectedCueId);
    }
  }

  function _hitTestCue(x, y) {
    for (let i = _cues.length - 1; i >= 0; i--) {
      const c = _cues[i];
      const cx = timeToX(c.time);
      const cy = HEADER_H + RULER_H + c.track * TRACK_H + TRACK_H / 2;
      if (Math.abs(x - cx) <= 7 && Math.abs(y - cy) <= 10) return c;
    }
    return null;
  }

  function draw(playheadTime = lastTickTime) {
    if (!ctx) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    // header
    ctx.fillStyle = '#161b27';
    ctx.fillRect(0, 0, w, HEADER_H);
    ctx.fillStyle = '#7c8aa8';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(`Pistes : ${TRACKS}  •  Cues : ${_cues.length}  •  ${pxPerSec.toFixed(0)} px/s  •  Ctrl+molette = zoom, molette = scroll, Suppr = effacer cue`, 8, 13);

    // ruler
    ctx.fillStyle = '#0d1019';
    ctx.fillRect(0, HEADER_H, w, RULER_H);
    ctx.strokeStyle = '#2a3247';
    ctx.fillStyle = '#7c8aa8';
    ctx.font = '10px system-ui, sans-serif';
    const stepSec = pxPerSec >= 80 ? 1 : pxPerSec >= 30 ? 2 : pxPerSec >= 15 ? 5 : 10;
    const tStart = Math.floor(xToTime(0));
    const tEnd = Math.ceil(xToTime(w));
    ctx.beginPath();
    for (let s = tStart; s <= tEnd; s++) {
      if (s < 0 || s > duration) continue;
      const x = timeToX(s);
      if (s % stepSec === 0) {
        ctx.moveTo(x, HEADER_H + 6);
        ctx.lineTo(x, HEADER_H + RULER_H);
        ctx.fillText(_fmtTime(s), x + 2, HEADER_H + 14);
      } else {
        ctx.moveTo(x, HEADER_H + RULER_H - 4);
        ctx.lineTo(x, HEADER_H + RULER_H);
      }
    }
    ctx.stroke();

    // pistes (zone)
    for (let i = 0; i < TRACKS; i++) {
      const y = HEADER_H + RULER_H + i * TRACK_H;
      ctx.fillStyle = i % 2 === 0 ? '#10131b' : '#131826';
      ctx.fillRect(0, y, w, TRACK_H);
      ctx.fillStyle = '#3a4666';
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(`Piste ${i + 1}`, 6, y + 14);
    }

    // waveform
    if (peaks) {
      ctx.fillStyle = 'rgba(80, 130, 200, 0.18)';
      const waveTop = HEADER_H + RULER_H;
      const waveBot = HEADER_H + RULER_H + TRACKS * TRACK_H;
      const mid = (waveTop + waveBot) / 2;
      const half = (waveBot - waveTop) / 2 - 2;
      const xStart = 8 - scrollX;
      for (let i = 0; i < peaks.length; i++) {
        const t = (i / peaks.length) * duration;
        const x = timeToX(t);
        if (x < -2 || x > w + 2) continue;
        const v = peaks[i] * half;
        ctx.fillRect(x, mid - v, 1, v * 2);
      }
    }

    // cues
    for (const cue of _cues) {
      const x = timeToX(cue.time);
      if (x < -10 || x > w + 10) continue;
      const y = HEADER_H + RULER_H + cue.track * TRACK_H + TRACK_H / 2;
      const eff = window.Effects ? window.Effects.get(cue.effectId) : null;
      const color = eff ? eff.color : '#ffaa00';
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.strokeStyle = cue.id === selectedCueId ? '#ffffff' : '#000000';
      ctx.lineWidth = cue.id === selectedCueId ? 2 : 1;
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // étiquette
      if (eff && pxPerSec >= 30) {
        ctx.fillStyle = '#cdd6e8';
        ctx.font = '10px system-ui, sans-serif';
        ctx.fillText(eff.name, x + 9, y + 3);
      }
    }

    // playhead
    const px = timeToX(playheadTime);
    ctx.strokeStyle = '#ff5e55';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, HEADER_H);
    ctx.lineTo(px, h);
    ctx.stroke();
    ctx.fillStyle = '#ff5e55';
    ctx.beginPath();
    ctx.moveTo(px - 5, HEADER_H);
    ctx.lineTo(px + 5, HEADER_H);
    ctx.lineTo(px, HEADER_H + 6);
    ctx.closePath();
    ctx.fill();
  }

  function _fmtTime(s) {
    const m = Math.floor(s / 60), ss = Math.floor(s % 60);
    return `${m}:${ss.toString().padStart(2, '0')}`;
  }

  function toJSON() {
    return {
      duration,
      cues: _cues.map(c => ({ ...c })),
    };
  }

  function loadJSON(data) {
    duration = data.duration || 60;
    _cues = (data.cues || []).map((c, i) => ({ ...c, id: c.id || (i + 1) }));
    nextId = (_cues.reduce((m, c) => Math.max(m, c.id), 0)) + 1;
    selectedCueId = null;
    onSelectionChange(null);
    draw();
  }

  function setSeekHandler(fn) { Timeline._onSeek = fn; }

  return {
    init, setPeaks, setDuration, addCue, removeCue, clearCues, tick, draw,
    setPlacingEffect, getSelected, toJSON, loadJSON, setSeekHandler,
    get cues() { return _cues.slice(); },
  };
})();

window.Timeline = Timeline;
