// === /herohealth/plate/plate-ml-window.js ===
// PlateVR ML Window Builder — v1.0 (ML-3)
// Listens: hha:start, hha:features_1s, hha:end
// Emits:   hha:mlrow  (windowed training row)
// Optional emits: hha:labels (end labels summary, if you want)
//
// Default: windowSec=5 (override with ?mlwin=10)
// Safe: never crashes if upstream missing fields.

'use strict';

(function(){
  const W = window;

  const clamp=(v,a,b)=>{v=Number(v)||0;return v<a?a:(v>b?b:v);};
  const now=()=> (performance && performance.now) ? performance.now() : Date.now();

  function emit(name, detail){
    try{ W.dispatchEvent(new CustomEvent(name,{detail})); }catch{}
  }

  // --- config ---
  const URLX = new URL(location.href);
  const winSec = clamp(URLX.searchParams.get('mlwin') || 5, 2, 30);      // 5s default
  const strideSec = clamp(URLX.searchParams.get('mlstride') || winSec, 1, 30); // default non-overlap
  const keepRaw = (URLX.searchParams.get('mlraw') === '1'); // include raw sample list in row (optional)

  // --- stats helpers ---
  function mean(a){ if(!a.length) return 0; return a.reduce((s,x)=>s+x,0)/a.length; }
  function max(a){ if(!a.length) return 0; return a.reduce((m,x)=>x>m?x:m,-Infinity); }
  function min(a){ if(!a.length) return 0; return a.reduce((m,x)=>x<m?x:m, Infinity); }
  function std(a){
    if(a.length<2) return 0;
    const m = mean(a);
    const v = a.reduce((s,x)=>s+(x-m)*(x-m),0)/(a.length-1);
    return Math.sqrt(Math.max(0,v));
  }
  function slope(a){
    // linear trend vs index: returns approx slope per step
    const n=a.length;
    if(n<2) return 0;
    let sx=0, sy=0, sxx=0, sxy=0;
    for(let i=0;i<n;i++){
      const x=i, y=Number(a[i])||0;
      sx+=x; sy+=y; sxx+=x*x; sxy+=x*y;
    }
    const den = (n*sxx - sx*sx);
    if(!den) return 0;
    return (n*sxy - sx*sy)/den;
  }

  // --- session memory ---
  const SESSION = {
    sid:'',
    runMode:'play',
    diff:'normal',
    seed:0,
    t0: now(),
    started:false,
    ended:false,

    // rolling buffer of 1s samples
    buf: [], // each {t_sec, score, combo, miss, accPct, g1..g5, stormActive, bossActive, fever, shield, spawnRate, targetN, ...}

    // for stride
    lastEmitT: 0
  };

  function resetOnStart(d){
    SESSION.sid = String(d?.session_id || d?.sessionId || '');
    SESSION.runMode = String(d?.runMode || 'play');
    SESSION.diff = String(d?.diff || 'normal');
    SESSION.seed = Number(d?.seed)||0;
    SESSION.t0 = now();
    SESSION.started = true;
    SESSION.ended = false;
    SESSION.buf = [];
    SESSION.lastEmitT = 0;
  }

  // --- feature normalization (accept many upstream shapes) ---
  function toSample(detail){
    const d = detail || {};
    const t_sec = Number(d.t_sec ?? d.tSec ?? d.timeSec ?? d.playedSec ?? 0) || 0;

    // score/combos/miss
    const score = Number(d.scoreNow ?? d.score ?? 0) || 0;
    const combo = Number(d.comboNow ?? d.combo ?? 0) || 0;
    const miss  = Number(d.missNow ?? d.miss ?? 0) || 0;

    // accuracy
    const accPct = Number(d.accNowPct ?? d.accPct ?? d.accuracyPct ?? d.accuracyGoodPct ?? 0) || 0;

    // groups vector
    const g = Array.isArray(d.g) ? d.g : null;
    const g1 = Number(d.g1 ?? (g?g[0]:0) ?? 0) || 0;
    const g2 = Number(d.g2 ?? (g?g[1]:0) ?? 0) || 0;
    const g3 = Number(d.g3 ?? (g?g[2]:0) ?? 0) || 0;
    const g4 = Number(d.g4 ?? (g?g[3]:0) ?? 0) || 0;
    const g5 = Number(d.g5 ?? (g?g[4]:0) ?? 0) || 0;

    // flags (if present)
    const stormActive = (d.stormActive != null) ? (d.stormActive?1:0) : (d.storm?.active?1:0);
    const bossActive  = (d.bossActive  != null) ? (d.bossActive?1:0)  : (d.boss?.active?1:0);

    // optional game dynamics if you emit them
    const fever  = Number(d.fever ?? 0) || 0;
    const shield = Number(d.shield ?? 0) || 0;
    const spawnRate = Number(d.spawnRatePerSec ?? d.spawnPerSec ?? 0) || 0;
    const targetN = Number(d.targetN ?? d.targetCount ?? 0) || 0;

    // imbalance (0..1)
    const tot = g1+g2+g3+g4+g5;
    const minG = Math.min(g1,g2,g3,g4,g5);
    const maxG = Math.max(g1,g2,g3,g4,g5);
    const imbalance01 = tot>0 ? (maxG-minG)/tot : 0;

    return {
      t_sec,
      score, combo, miss, accPct,
      g1,g2,g3,g4,g5,
      stormActive, bossActive,
      fever, shield,
      spawnRate, targetN,
      imbalance01
    };
  }

  function shouldEmitWindow(t_sec){
    if(!SESSION.buf.length) return false;
    const elapsed = t_sec;
    if(elapsed < winSec) return false;
    if((elapsed - SESSION.lastEmitT) < strideSec - 1e-6) return false;
    return true;
  }

  function buildWindowRow(tEnd){
    // window is last winSec seconds, based on buf t_sec
    const tStart = Math.max(0, tEnd - winSec);
    const arr = SESSION.buf.filter(s => s.t_sec > tStart - 1e-6 && s.t_sec <= tEnd + 1e-6);
    if(!arr.length) return null;

    // series
    const score = arr.map(s=>s.score);
    const combo = arr.map(s=>s.combo);
    const miss  = arr.map(s=>s.miss);
    const acc   = arr.map(s=>s.accPct);
    const imb   = arr.map(s=>s.imbalance01);
    const fever = arr.map(s=>s.fever);
    const shield= arr.map(s=>s.shield);
    const spawn = arr.map(s=>s.spawnRate);
    const tN    = arr.map(s=>s.targetN);

    const g1 = arr.map(s=>s.g1), g2=arr.map(s=>s.g2), g3=arr.map(s=>s.g3), g4=arr.map(s=>s.g4), g5=arr.map(s=>s.g5);

    // deltas within window (end-start)
    const s0 = arr[0], s1 = arr[arr.length-1];
    const dScore = (s1.score - s0.score);
    const dMiss  = (s1.miss  - s0.miss);
    const dAcc   = (s1.accPct - s0.accPct);

    // flags ratio
    const stormRatio = mean(arr.map(s=>s.stormActive));
    const bossRatio  = mean(arr.map(s=>s.bossActive));

    const row = {
      event_type: 'train_row',
      game: 'plate',

      // identity
      session_id: SESSION.sid || '',
      runMode: SESSION.runMode,
      diff: SESSION.diff,
      seed: SESSION.seed,

      // window
      winSec,
      strideSec,
      tEndSec: Math.round(tEnd*10)/10,
      tStartSec: Math.round(tStart*10)/10,
      n: arr.length,

      // aggregates
      score_mean: Math.round(mean(score)),
      score_max:  Math.round(max(score)),
      score_slope: Math.round(slope(score)*1000)/1000,

      combo_mean: Math.round(mean(combo)*10)/10,
      combo_max:  Math.round(max(combo)),
      combo_slope: Math.round(slope(combo)*1000)/1000,

      miss_delta: dMiss|0,
      miss_mean: Math.round(mean(miss)*10)/10,

      acc_mean: Math.round(mean(acc)*10)/10,
      acc_min:  Math.round(min(acc)*10)/10,
      acc_slope: Math.round(slope(acc)*1000)/1000,

      imb_mean01: Math.round(mean(imb)*1000)/1000,
      imb_max01:  Math.round(max(imb)*1000)/1000,

      fever_mean: Math.round(mean(fever)*10)/10,
      fever_max:  Math.round(max(fever)*10)/10,
      shield_mean: Math.round(mean(shield)*10)/10,

      spawn_mean: Math.round(mean(spawn)*100)/100,
      targetN_mean: Math.round(mean(tN)*10)/10,

      storm_ratio: Math.round(stormRatio*1000)/1000,
      boss_ratio:  Math.round(bossRatio*1000)/1000,

      // group dynamics (delta in window)
      g1_delta: (s1.g1 - s0.g1)|0,
      g2_delta: (s1.g2 - s0.g2)|0,
      g3_delta: (s1.g3 - s0.g3)|0,
      g4_delta: (s1.g4 - s0.g4)|0,
      g5_delta: (s1.g5 - s0.g5)|0,

      // label candidates (within same window) — can be used as y_win
      y_miss_win: dMiss|0,
      y_score_win: dScore|0,
      y_acc_end: Math.round(s1.accPct*10)/10,

      // keepRaw optional
      raw: keepRaw ? arr : undefined
    };

    return row;
  }

  function labelNextWindow(tEnd){
    // label y_next based on the NEXT window [tEnd, tEnd+winSec]
    const tStart = tEnd;
    const tStop  = tEnd + winSec;
    const arr = SESSION.buf.filter(s => s.t_sec > tStart - 1e-6 && s.t_sec <= tStop + 1e-6);
    if(arr.length < 2) return null;

    const s0 = arr[0], s1 = arr[arr.length-1];
    return {
      y_next_miss: (s1.miss - s0.miss)|0,
      y_next_score: (s1.score - s0.score)|0,
      y_next_acc_end: Math.round(s1.accPct*10)/10
    };
  }

  function emitWindowIfReady(sample){
    const t_sec = sample.t_sec;
    if(!shouldEmitWindow(t_sec)) return;

    const row = buildWindowRow(t_sec);
    if(!row) return;

    // attach next-window label if possible (self-supervised style)
    const yNext = labelNextWindow(t_sec);
    if(yNext){
      row.y_next_miss = yNext.y_next_miss;
      row.y_next_score = yNext.y_next_score;
      row.y_next_acc_end = yNext.y_next_acc_end;
    }

    SESSION.lastEmitT = t_sec;

    emit('hha:mlrow', row);
  }

  // --- listeners ---
  W.addEventListener('hha:start', (e)=>{
    resetOnStart(e?.detail || {});
  }, {passive:true});

  W.addEventListener('hha:features_1s', (e)=>{
    if(!SESSION.started || SESSION.ended) return;
    const s = toSample(e?.detail || {});
    // guard monotonic time
    if(SESSION.buf.length){
      const last = SESSION.buf[SESSION.buf.length-1];
      if(s.t_sec < (last.t_sec - 0.25)) return;
    }
    SESSION.buf.push(s);

    // keep buffer bounded (keep last 90s + margin)
    const maxKeep = Math.max(120, Math.ceil((winSec*3 + 20) * 2)); // ~ samples
    if(SESSION.buf.length > maxKeep){
      SESSION.buf.splice(0, SESSION.buf.length - maxKeep);
    }

    emitWindowIfReady(s);
  }, {passive:true});

  W.addEventListener('hha:end', (e)=>{
    // emit one final row at end time if possible
    if(SESSION.ended) return;
    SESSION.ended = true;

    // try to infer last t_sec from summary
    const d = e?.detail || {};
    const tPlayed = Number(d.durationPlayedSec ?? d.tPlayedSec ?? d.timePlannedSec ?? 0) || 0;
    const lastT = SESSION.buf.length ? SESSION.buf[SESSION.buf.length-1].t_sec : tPlayed;

    const row = buildWindowRow(lastT);
    if(row){
      row.event_type = 'train_row_end';
      emit('hha:mlrow', row);
    }

    // optional: end labels (useful if you want a final label record)
    emit('hha:labels', {
      game:'plate',
      session_id: SESSION.sid,
      runMode: SESSION.runMode,
      diff: SESSION.diff,
      seed: SESSION.seed,
      end_grade: d.grade || '',
      end_accuracyPct: d.accuracyPct ?? d.accuracyGoodPct ?? null,
      end_miss: d.miss ?? d.misses ?? null,
      end_scoreFinal: d.scoreFinal ?? null
    });
  }, {passive:true});

})();
