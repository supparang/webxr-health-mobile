// === /fitness/js/sequence-exporter.js ===
// DL-ready export: JSONL (1 event per line) + rolling-window features CSV
'use strict';

export function toJsonl(logs) {
  if (!logs || !logs.length) return '';
  return logs.map(r => JSON.stringify(r)).join('\n');
}

export function toFeatureCsv(events, windowSize = 20) {
  if (!events || !events.length) return '';

  const cols = [
    't_end_ms',
    'win_n',
    'hit',
    'miss',
    'miss_rate',
    'rt_avg',
    'rt_slope',
    'boss_phase',
    'difficulty',
    'fever_on'
  ];

  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  };

  const lines = [cols.join(',')];

  // only use hit/timeout events for learning
  const seq = events.filter(e => e.event_type === 'hit' || e.event_type === 'timeout');

  for (let i = windowSize - 1; i < seq.length; i++) {
    const w = seq.slice(i - windowSize + 1, i + 1);

    let hit = 0, miss = 0, rtSum = 0, rtN = 0;
    const pts = [];
    const t0 = w[0].ts_ms;

    for (const e of w) {
      if (e.event_type === 'hit') {
        hit++;
        if (typeof e.rt_ms === 'number' || (typeof e.rt_ms === 'string' && e.rt_ms !== '')) {
          const rt = +e.rt_ms;
          if (!Number.isNaN(rt)) {
            rtSum += rt; rtN++;
            pts.push({ x: (e.ts_ms - t0) / 1000, y: rt });
          }
        }
      } else {
        // timeout miss only if grade miss
        if (e.grade === 'miss') miss++;
      }
    }

    const total = hit + miss;
    const missRate = total ? (miss / total) : 0;
    const rtAvg = rtN ? (rtSum / rtN) : '';

    // slope
    let slope = '';
    if (pts.length >= 4) {
      const n = pts.length;
      const sx = pts.reduce((a,p)=>a+p.x,0);
      const sy = pts.reduce((a,p)=>a+p.y,0);
      const sxx = pts.reduce((a,p)=>a+p.x*p.x,0);
      const sxy = pts.reduce((a,p)=>a+p.x*p.y,0);
      const denom = (n*sxx - sx*sx);
      slope = denom ? ((n*sxy - sx*sy) / denom) : 0;
      slope = Math.max(-50, Math.min(50, slope));
      slope = +slope.toFixed(3);
    }

    const last = w[w.length - 1];
    const row = [
      last.ts_ms,
      w.length,
      hit,
      miss,
      +missRate.toFixed(4),
      rtAvg === '' ? '' : +rtAvg.toFixed(1),
      slope,
      last.boss_phase,
      last.diff,
      last.fever_on ? 1 : 0
    ];

    lines.push(row.map(esc).join(','));
  }

  return lines.join('\n');
}