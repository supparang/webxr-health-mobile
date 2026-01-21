// === /herohealth/vr/ml-feature-ticker.js ===
// ML Feature Ticker — PRODUCTION
// ✅ Emits: hha:ml:row (timeseries rows, 1Hz default)
// ✅ Use: ticker.tick(state) inside game loop
// ✅ Research-ready: stable numeric schema

'use strict';

export function createMLFeatureTicker(opts = {}){
  const WIN = (typeof window !== 'undefined') ? window : globalThis;

  const emit = typeof opts.emit === 'function'
    ? opts.emit
    : ((name, detail)=>{ try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){ } });

  const qs=(k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const now=()=>Date.now();

  const hz = clamp(parseFloat(qs('mlHz', String(opts.hz ?? 1))) || 1, 0.2, 5);
  const intervalMs = Math.round(1000 / hz);

  const game = String(opts.game || 'game').toLowerCase();
  const run  = String(qs('run', qs('runMode','play')) || 'play').toLowerCase();
  const diff = String(qs('diff','normal')).toLowerCase();
  const seed = String(qs('seed','') || '');

  const sessionId = String(qs('sessionId', qs('studentKey','')) || '');
  const studyId = String(qs('studyId','') || '');
  const phase = String(qs('phase','') || '');
  const conditionGroup = String(qs('conditionGroup','') || '');

  const S = { lastAt: 0, seq: 0 };

  function tick(st = {}){
    const t = now();
    if (t - S.lastAt < intervalMs) return null;
    S.lastAt = t;

    const row = {
      kind: 'ml_row',
      game,
      runMode: run,
      diff,
      seed,
      sessionId,
      studyId,
      phase,
      conditionGroup,
      at: t,
      seq: (++S.seq),

      // time
      leftSec: Number(st.leftSec ?? 0),
      elapsedSec: Number(st.elapsedSec ?? 0),

      // performance
      score: Number(st.score ?? 0),
      combo: Number(st.combo ?? 0),
      misses: Number(st.misses ?? 0),
      accPct: Number(st.accPct ?? 0),

      // hydration
      waterPct: Number(st.waterPct ?? 50),
      waterZone: String(st.waterZone ?? ''),
      shield: Number(st.shield ?? 0),

      // storm context
      inStorm: st.inStorm ? 1 : 0,
      inEndWindow: st.inEndWindow ? 1 : 0,
      bossActive: st.bossActive ? 1 : 0,

      // prediction
      risk: Number(st.risk ?? 0),
      riskLevel: String(st.riskLevel ?? ''),

      // labels (optional, for supervised learning later)
      label_failSoon: Number(st.label_failSoon ?? 0), // 0/1
      label_hitBad: Number(st.label_hitBad ?? 0)      // 0/1
    };

    emit('hha:ml:row', row);
    return row;
  }

  return { tick };
}