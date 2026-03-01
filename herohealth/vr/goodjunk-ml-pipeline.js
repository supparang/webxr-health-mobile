// === /herohealth/vr/goodjunk-ml-pipeline.js ===
// GoodJunk ML Pipeline (A+B) + Difficulty Director (C)
// - A: logTick (research-only by default)
// - B: window builder (5s) + future labels (1s/3s) + logWindow (research-only by default)
// - C: difficulty director (play-only) — uses hazardRisk to adjust spawn rate smoothly
// FULL v20260301-GJ-ML-PIPELINE-ABC
'use strict';

function now(){ return Date.now(); }
function iso(t=Date.now()){ return new Date(t).toISOString(); }
function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); }
function mean(arr){
  if(!arr || !arr.length) return 0;
  let s=0; for(const x of arr) s += Number(x)||0;
  return s/arr.length;
}
function median(arr){
  if(!arr || !arr.length) return 0;
  const a = arr.slice().map(x=>Number(x)||0).sort((x,y)=>x-y);
  const m = (a.length/2)|0;
  return (a.length%2) ? a[m] : (a[m-1]+a[m])/2;
}

function safeLogEvent(type, payload){
  try{
    // Your cloud logger pattern: HHA_CloudLogger.logEvent(name, data)
    window.HHA_CloudLogger?.logEvent?.(type, payload);
  }catch(e){}
}

export function createGoodJunkMLPipeline(opts){
  opts = opts || {};
  const pid  = String(opts.pid||'anon');
  const seed = String(opts.seed||'0');
  const run  = String(opts.run||'play').toLowerCase();
  const diff = String(opts.diff||'normal').toLowerCase();
  const view = String(opts.view||'mobile').toLowerCase();

  // A: log tick only in research by default
  const logTickEnabled =
    (opts.logTickEnabled != null) ? !!opts.logTickEnabled
    : (run === 'research' && String(opts.allowTickInPlay||'0') === '1');

  // B: window builder only in research by default
  const windowEnabled =
    (opts.windowEnabled != null) ? !!opts.windowEnabled
    : (run === 'research' && String(opts.allowWindowInPlay||'0') === '1');

  const windowSec = clamp(opts.windowSec ?? 5, 2, 15);
  const tickMinMs = clamp(opts.tickMinMs ?? 600, 200, 2000); // reduce sheet spam
  const windowMaxKeep = 2000;

  // C: difficulty director only in play by default (keep research deterministic)
  const directorEnabled =
    (opts.directorEnabled != null) ? !!opts.directorEnabled
    : (run === 'play');

  // ===== internal state =====
  let lastTickTs = 0;

  // store recent ticks for window aggregation
  const ticks = []; // each {t, payload, hazardRisk}
  // store miss history to build future labels
  const missTimeline = []; // {t, missTotal}

  // Difficulty director state
  let dir = {
    mult: 1.00,      // applied to spawn rate
    target: 1.00,
    lastUpdate: 0
  };

  function pushMiss(t, missTotal){
    missTimeline.push({ t, missTotal: Number(missTotal)||0 });
    // keep last ~30s
    const cutoff = t - 30000;
    while(missTimeline.length && missTimeline[0].t < cutoff) missTimeline.shift();
  }

  // compute future miss increase label for horizon ms
  function labelMissIncrease(t0, miss0, horizonMs){
    const t1 = t0 + horizonMs;
    for(const it of missTimeline){
      if(it.t <= t0) continue;
      if(it.t > t1) break;
      if(it.missTotal > miss0) return 1;
    }
    return 0;
  }

  function logTick(payload, pred){
    const t = now();
    if(!logTickEnabled) return;
    if(t - lastTickTs < tickMinMs) return;
    lastTickTs = t;

    safeLogEvent('ml_tick_goodjunk', {
      ts: t,
      iso: iso(t),
      pid, run, diff, view, seed,
      ...payload,
      hazardRisk: (pred && typeof pred.hazardRisk==='number') ? +pred.hazardRisk : null,
      miss3s: (pred && typeof pred.miss3s==='number') ? +pred.miss3s : null
    });
  }

  function addTick(payload, pred){
    const t = now();

    // track miss timeline for labeling
    const missTotal = Number(payload.miss||payload.missTotal||0) || 0;
    pushMiss(t, missTotal);

    // keep tick queue
    ticks.push({
      t,
      payload: { ...payload },
      hazardRisk: (pred && typeof pred.hazardRisk==='number') ? +pred.hazardRisk : null
    });
    if(ticks.length > windowMaxKeep) ticks.splice(0, ticks.length - windowMaxKeep);
  }

  // B: build window every windowSec with overlap=windowSec (non-overlap, simple)
  let lastWindowEnd = 0;
  function maybeEmitWindow(){
    if(!windowEnabled) return;
    const t = now();
    if(!lastWindowEnd) lastWindowEnd = t;

    // emit when enough time passed
    const wantEnd = lastWindowEnd + windowSec*1000;
    if(t < wantEnd) return;

    const t0 = lastWindowEnd;
    const t1 = wantEnd;
    lastWindowEnd = t1;

    // collect ticks within [t0,t1]
    const seg = ticks.filter(x => x.t >= t0 && x.t <= t1);
    if(seg.length < 2) return;

    const first = seg[0].payload;
    const last  = seg[seg.length-1].payload;

    const miss0 = Number(first.miss||first.missTotal||0) || 0;
    const miss1 = Number(last.miss||last.missTotal||0) || 0;

    const score0 = Number(first.score||0) || 0;
    const score1 = Number(last.score||0) || 0;

    const accs = seg.map(x=> Number(x.payload.accPct||0)||0);
    const fevers = seg.map(x=> Number(x.payload.feverPct||0)||0);
    const shields = seg.map(x=> Number(x.payload.shield||0)||0);
    const combos = seg.map(x=> Number(x.payload.combo||0)||0);
    const hazards = seg.map(x=> (typeof x.hazardRisk==='number') ? x.hazardRisk : null).filter(v=>v!=null);

    const missGoodExp0 = Number(first.missGoodExpired||0)||0;
    const missGoodExp1 = Number(last.missGoodExpired||0)||0;
    const missJunk0 = Number(first.missJunkHit||0)||0;
    const missJunk1 = Number(last.missJunkHit||0)||0;

    // Future labels (สำคัญ!)
    // hazardNext1sLabel: miss increases in next 1s
    // missNext3sLabel:   miss increases in next 3s
    const hazardNext1sLabel = labelMissIncrease(t1, miss1, 1000);
    const missNext3sLabel   = labelMissIncrease(t1, miss1, 3000);

    const row = {
      ts0: t0, ts1: t1,
      iso0: iso(t0), iso1: iso(t1),
      pid, run, diff, view, seed,
      windowSec,

      scoreEnd: score1,
      scoreDelta: score1 - score0,
      missDelta: miss1 - miss0,

      accMean: Math.round(mean(accs)*100)/100,
      comboMaxWin: Math.max(...combos),
      feverMean: Math.round(mean(fevers)*100)/100,
      shieldMean: Math.round(mean(shields)*100)/100,

      missGoodExpiredDelta: (missGoodExp1 - missGoodExp0),
      missJunkHitDelta: (missJunk1 - missJunk0),

      medianRtGoodMs: Number(last.medianRtGoodMs||0)||0,
      hazardRiskMean: hazards.length ? Math.round(mean(hazards)*1000)/1000 : null,

      hazardNext1sLabel,
      missNext3sLabel
    };

    safeLogEvent('ml_window_goodjunk', row);
  }

  // C: difficulty director (smooth)
  // - only affects spawn multiplier in play
  // - never modifies deterministic seed randomness itself (just rate)
  function updateDirector(pred, missDeltaRecent){
    if(!directorEnabled) return dir.mult;

    const t = now();
    if(t - dir.lastUpdate < 250) return dir.mult;
    dir.lastUpdate = t;

    const risk = clamp(pred?.hazardRisk ?? 0.25, 0, 1);
    const missSpike = clamp(missDeltaRecent ?? 0, 0, 3);

    // target logic:
    // - high risk / miss spike -> ease slightly (lower spawn)
    // - low risk and stable -> raise slightly (higher spawn)
    let target = 1.00;

    if(missSpike >= 2) target = 0.88;
    else if(missSpike >= 1) target = 0.93;
    else{
      if(risk >= 0.75) target = 0.92;
      else if(risk >= 0.60) target = 0.95;
      else if(risk <= 0.25) target = 1.05;
      else if(risk <= 0.15) target = 1.08;
      else target = 1.00;
    }

    // clamp fairness (never too easy / too hard)
    target = clamp(target, 0.85, 1.15);
    dir.target = target;

    // smooth (EMA)
    const alpha = 0.08;
    dir.mult = dir.mult + alpha*(dir.target - dir.mult);
    dir.mult = clamp(dir.mult, 0.85, 1.15);

    return dir.mult;
  }

  // expose
  return {
    // Call this every tick (from goodjunk.safe.js tick)
    onTick({ payload, pred }){
      // A
      logTick(payload, pred);

      // B
      addTick(payload, pred);
      maybeEmitWindow();
    },

    // C: call when you have pred + recent miss delta
    updateDirector(pred, missDeltaRecent){
      return updateDirector(pred, missDeltaRecent);
    }
  };
}
