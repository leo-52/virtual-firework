// export.js
// Génère un script de tir CSV à partir de la timeline.
// Colonnes : index, time_s, time_mmss, effect_id, effect_name, category,
//            track, position_x, position_z, duration_s, color, notes

const Exporter = (() => {

  function _fmt(s) {
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(2).padStart(5, '0');
    return `${m}:${sec}`;
  }

  function _csvEscape(v) {
    if (v == null) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function buildCSV() {
    const cues = Timeline.cues.slice().sort((a, b) => a.time - b.time);
    const header = [
      'index', 'time_s', 'time_mmss', 'effect_id', 'effect_name', 'category',
      'track', 'position_x', 'position_z', 'duration_s', 'color', 'notes'
    ];
    const lines = [header.join(',')];
    cues.forEach((c, i) => {
      const eff = Effects.get(c.effectId) || {};
      const row = [
        i + 1,
        c.time.toFixed(3),
        _fmt(c.time),
        c.effectId,
        eff.name || '',
        eff.category || '',
        c.track + 1,
        c.pos ? c.pos.x.toFixed(2) : '',
        c.pos ? c.pos.z.toFixed(2) : '',
        eff.duration ?? '',
        eff.color || '',
        '',
      ].map(_csvEscape);
      lines.push(row.join(','));
    });
    return lines.join('\n');
  }

  function downloadCSV() {
    const csv = buildCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `firing-script-${Date.now()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function downloadJSON() {
    const cues = Timeline.cues.slice().sort((a, b) => a.time - b.time).map((c, i) => {
      const eff = Effects.get(c.effectId) || {};
      return {
        index: i + 1,
        time_s: +c.time.toFixed(3),
        time_mmss: _fmt(c.time),
        effect_id: c.effectId,
        effect_name: eff.name,
        category: eff.category,
        track: c.track + 1,
        position: c.pos ? { x: +c.pos.x.toFixed(2), z: +c.pos.z.toFixed(2) } : null,
        duration_s: eff.duration,
        color: eff.color,
      };
    });
    const blob = new Blob([JSON.stringify({ cues }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `firing-script-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return { buildCSV, downloadCSV, downloadJSON };
})();

window.Exporter = Exporter;
