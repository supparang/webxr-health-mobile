// === /herohealth/ai/ai-hooks.js ===
// HHA AI Hooks — Production Stub (Prediction/ML/DL-ready) — v20260210a
// ✅ Collects event stream: hha:start, hha:time, hha:judge, hha:end
// ✅ Builds ML-ready features (per session)
// ✅ Exposes: window.HHA.createAIHooks(gameKey, opts)
// ✅ Safe: if not used, nothing breaks; if used, never throws
// ✅ Research mode: no adaptive changes (neutral outputs)

(function(){
  'use strict';
  const WIN = window;

  // ---------- helpers ----------
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowMs = ()=>performance.now();

  function safeJsonParse(s, fb){
    try{ return JSON.parse(s); }catch(_){ return fb; }
  }

  function qs(k, d=null){
    try{ return new URL(location.href).searchParams.get(k) ?? d; }
    catch(_){ return d; }
  }

  function isStudyMode(ctx){
    const qStudy = (qs('study','') || qs('mode','') || '').toLowerCase();
    const byQS = (qStudy === '1' || qStudy === 'true' || qStudy === 'study');
    const byCtx = (ctx?.mode && String(ctx.mode).toLowerCase() === 'study') || !!ctx?.studyId;
    return byQS || byCtx;
  }

  // rolling stats
  function mean(arr){
    if(!arr || !arr.length) return 0;
    let s=0; for(const x of arr) s += x;
    return s / arr.length;
  }
  function stdev(arr){
    if(!arr || arr.length<2) return 0;
    const m = mean(arr);
    let s=0; for(const x of arr){ const d=x-m; s += d*d; }
    return Math.sqrt(s / (arr.length-1));
  }

  function slopeFromPoints(points){
    // points: [{t, v}] ; simple linear regression slope
    if(!points || points.length < 2) return 0;
    const n = points.length;
    let sumT=0,sumV=0,sumTT=0,sumTV=0;
    for(const p of points){
      const t = Number(p.t)||0;
      const v = Number(p.v)||0;
      sumT += t; sumV += v;
      sumTT += t*t;
      sumTV += t*v;
    }
    const denom = (n*sumTT - sumT*sumT);
    if(Math.abs(denom) < 1e-9) return 0;
    return (n*sumTV - sumT*sumV) / denom;
  }

  // ---------- session store ----------
  function newSession(gameKey){
    return {
      gameKey,
      startedAt: Date.now(),
      perfStartMs: nowMs(),
      ctx: null,

      // raw stream (lightweight)
      events: [], // {t, name, d} limited
      maxEvents: 420,

      // time series
      timeSeries: {
        tLeft: [],
        score: [],
        combo: [],
        anger: [],
        coverageAvg: [],
        bossHp: []
      },

      // counters
      counts: {
        judge_total: 0,
        hit_total: 0,
        miss_total: 0,
        perfect: 0,
        good: 0,
        miss: 0,

        type_note: 0,
        type_boss: 0,
        type_weak: 0,
        type_stealth: 0,
        type_pickup: 0,

        ult_laser_viol: 0,
        ult_shock_viol: 0,

        blocked_stealth: 0
      },

      // deltas / timing
      deltas: [],        // deltaMs for hits (absolute)
      deltas_note: [],
      deltas_boss: [],
      deltas_weak: [],
      deltas_stealth: [],

      // combo behavior
      comboMax: 0,
      comboDrops: 0,

      // coverage curve
      covCurve: { q1:[], q2:[], q3:[], q4:[] }, // {t,v}
      covLast: { q1:null,q2:null,q3:null,q4:null },

      // “shoot lock” success proxy
      shoot: { total:0, hits:0, lockPxMean:0, lockPxSamples:0 },

      // boss mood
      angerSamples: [],
    };
  }

  function pushEvent(S, name, detail){
    if(!S) return;
    const t = nowMs() - S.perfStartMs;
    // keep tiny: store subset only
    const d = detail ? shallowPick(detail, [
      'game','type','judge','q','deltaMs','combo','boss','bossHp','dmg',
      'uvOn','gateOn','anger','source','kind'
    ]) : null;

    S.events.push({ t: +t.toFixed(1), name, d });
    if(S.events.length > S.maxEvents) S.events.shift();
  }

  function shallowPick(obj, keys){
    const out = {};
    for(const k of keys){
      if(obj && Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
    }
    return out;
  }

  // ---------- feature extraction ----------
  function buildFeatures(S, endSummary){
    const c = S.counts;

    const hits = c.hit_total || 0;
    const totalJudge = c.judge_total || 0;

    const acc = totalJudge ? (hits / totalJudge) : 0;
    const perfectRate = hits ? (c.perfect / hits) : 0;
    const goodRate = hits ? (c.good / hits) : 0;
    const missRate = totalJudge ? (c.miss / totalJudge) : 0;

    const deltaMean = mean(S.deltas);
    const deltaSd = stdev(S.deltas);

    const covAvgSeries = S.timeSeries.coverageAvg;
    const covAvgSlope = slopeFromPoints(covAvgSeries.map((v,i)=>({t:i, v})));

    // per-quadrant slopes
    const covSlopeQ = {};
    for(const q of ['q1','q2','q3','q4']){
      covSlopeQ[q] = slopeFromPoints(S.covCurve[q]);
    }

    // anger stats
    const angerMean = mean(S.angerSamples);
    const angerSd = stdev(S.angerSamples);
    const angerSlope = slopeFromPoints(S.timeSeries.anger.map((v,i)=>({t:i, v})));

    // boss hp slope (if exists)
    const bossHpSlope = slopeFromPoints(S.timeSeries.bossHp.map((v,i)=>({t:i, v})));

    // combo slope (tends to increase when skill good)
    const comboSlope = slopeFromPoints(S.timeSeries.combo.map((v,i)=>({t:i, v})));

    // shoot lock hit rate
    const shootHitRate = S.shoot.total ? (S.shoot.hits / S.shoot.total) : 0;
    const lockPxMean = S.shoot.lockPxSamples ? (S.shoot.lockPxMean / S.shoot.lockPxSamples) : 0;

    // end summary fallback values
    const rank = endSummary?.rank || null;
    const scoreTotal = endSummary?.scoreTotal ?? endSummary?.score ?? null;

    return {
      meta: {
        game: S.gameKey,
        pid: S.ctx?.pid || null,
        mode: S.ctx?.mode || null,
        studyId: S.ctx?.studyId || null,
        phase: S.ctx?.phase || null,
        conditionGroup: S.ctx?.conditionGroup || null,
        seed: S.ctx?.seed || null,
        time: S.ctx?.time || null,
        endedAt: Date.now()
      },

      // primary labels / outcomes (optional)
      outcome: { rank, scoreTotal },

      // core skill metrics
      skill: {
        acc,
        perfectRate,
        goodRate,
        missRate,

        deltaMeanMs: deltaMean,
        deltaSdMs: deltaSd,

        comboMax: S.comboMax,
        comboDrops: S.comboDrops,
        comboSlope,

        shootHitRate,
        lockPxMean
      },

      // content-specific
      brush: {
        covAvgSlope,
        covSlopeQ,
        blockedStealth: c.blocked_stealth,
        ultLaserViol: c.ult_laser_viol,
        ultShockViol: c.ult_shock_viol,
        angerMean,
        angerSd,
        angerSlope,
        bossHpSlope
      },

      // counts
      counts: JSON.parse(JSON.stringify(c)),

      // raw traces (keep compact)
      traces: {
        coverageAvg: covAvgSeries.slice(-120),
        anger: S.timeSeries.anger.slice(-120),
        combo: S.timeSeries.combo.slice(-120),
        bossHp: S.timeSeries.bossHp.slice(-120)
      }
    };
  }

  // ---------- prediction stub ----------
  function predictFromFeatures(F){
    // This is intentionally heuristic now.
    // Later you can replace with a real model (ML/DL) using F as input.
    const acc = F.skill.acc || 0;
    const dm = F.skill.deltaMeanMs || 999;
    const sd = F.skill.deltaSdMs || 999;

    // simple "readiness" score 0..1
    let r = 0.0;
    r += clamp(acc, 0, 1) * 0.55;
    r += clamp(1 - (dm / 260), 0, 1) * 0.25;     // faster timing better
    r += clamp(1 - (sd / 220), 0, 1) * 0.20;     // consistent timing better
    r = clamp(r, 0, 1);

    // suggest diff adjustment (for play mode only)
    let diffDelta = 0;
    if(r > 0.78) diffDelta = +1;       // harder
    else if(r < 0.42) diffDelta = -1;  // easier

    // suggest coach tip id
    let tip = 'TIP_NEUTRAL';
    if(acc < 0.45) tip = 'TIP_SLOW_DOWN';
    else if(dm > 220) tip = 'TIP_LOOK_AHEAD';
    else if(F.brush.ultLaserViol > 0) tip = 'TIP_LASER_STOP';
    else if(F.brush.ultShockViol > 0) tip = 'TIP_SHOCK_TIMING';
    else if((F.brush.blockedStealth||0) > 2) tip = 'TIP_USE_UV';
    else if(F.skill.comboMax >= 18) tip = 'TIP_KEEP_STREAK';

    return { readiness:r, diffDelta, tip };
  }

  // ---------- main factory ----------
  function createAIHooks(gameKey, opts){
    const O = Object.assign({
      storeKey: 'HHA_AI_SESSIONS_V1',
      maxSaved: 60,
      // if true: keep raw event stream too
      saveEvents: false,
      // if true: console log summary
      debug: false
    }, opts || {});

    const S = newSession(gameKey || 'unknown');

    // local write
    function saveSession(F, endSummary){
      try{
        const payload = {
          ts: Date.now(),
          game: S.gameKey,
          features: F,
          // optional
          endSummary: endSummary || null,
          events: O.saveEvents ? S.events : undefined
        };

        const arr = safeJsonParse(localStorage.getItem(O.storeKey) || '[]', []);
        arr.unshift(payload);
        localStorage.setItem(O.storeKey, JSON.stringify(arr.slice(0, O.maxSaved)));
      }catch(_){}
    }

    // public API
    const API = {
      // called by engines (optional)
      onEvent: (name, detail)=>{ try{
        // allow engine direct feed too
        pushEvent(S, name, detail);
      }catch(_){ } },

      // for adaptive difficulty director (play mode)
      getDifficulty: ()=>{
        try{
          const study = isStudyMode(S.ctx);
          if(study) return { delta: 0, readiness: null, reason: 'study_mode' };

          const F = buildFeatures(S, null);
          const P = predictFromFeatures(F);
          return { delta: P.diffDelta, readiness: P.readiness, reason: P.tip };
        }catch(_){
          return { delta: 0, readiness: null, reason: 'error' };
        }
      },

      // for AI coach micro-tips
      getTip: ()=>{
        try{
          const F = buildFeatures(S, null);
          const P = predictFromFeatures(F);
          return { id: P.tip, readiness: P.readiness };
        }catch(_){
          return { id: 'TIP_NEUTRAL', readiness: null };
        }
      },

      // expose current features snapshot
      getFeatures: ()=>{
        try{ return buildFeatures(S, null); }catch(_){ return null; }
      },

      // internal state access (optional)
      _state: S
    };

    // ---------- listeners ----------
    function onStart(ev){
      const d = ev?.detail || {};
      if(d?.ctx) S.ctx = d.ctx;
      else S.ctx = Object.assign({}, d);

      pushEvent(S, 'hha:start', d);

      if(O.debug) console.log('[AIHooks] start', S.gameKey, S.ctx);
    }

    function onTime(ev){
      const d = ev?.detail || {};
      pushEvent(S, 'hha:time', d);

      // series sampling
      if(typeof d.tLeft === 'number') S.timeSeries.tLeft.push(d.tLeft);
      if(typeof d.score === 'number') S.timeSeries.score.push(d.score);
      if(typeof d.anger === 'number'){ S.timeSeries.anger.push(d.anger); S.angerSamples.push(d.anger); }
      if(typeof d.bossHp === 'number') S.timeSeries.bossHp.push(d.bossHp);

      // combo might not be in time event; attempt from d.combo
      if(typeof d.combo === 'number'){
        S.timeSeries.combo.push(d.combo);
        if(d.combo > S.comboMax) S.comboMax = d.combo;
      }

      // coverage avg
      if(d.coverage && typeof d.coverage === 'object'){
        const cov = d.coverage;
        const qs = ['q1','q2','q3','q4'];
        let sum=0, n=0;
        for(const q of qs){
          if(typeof cov[q] === 'number'){
            sum += cov[q]; n++;
            // keep per-q curve
            const t = S.timeSeries.coverageAvg.length;
            S.covCurve[q].push({ t, v: cov[q] });
            if(S.covCurve[q].length > 140) S.covCurve[q].shift();
          }
        }
        if(n>0){
          const avg = sum/n;
          S.timeSeries.coverageAvg.push(avg);
          if(S.timeSeries.coverageAvg.length > 140) S.timeSeries.coverageAvg.shift();
        }
      }

      // cap series
      for(const k of Object.keys(S.timeSeries)){
        if(S.timeSeries[k].length > 180) S.timeSeries[k].shift();
      }
    }

    function onJudge(ev){
      const d = ev?.detail || {};
      pushEvent(S, 'hha:judge', d);

      S.counts.judge_total++;

      // classify
      const judge = (d.judge || '').toLowerCase();
      const type  = (d.type || '').toLowerCase();

      // hits vs miss
      const isHit =
        (judge === 'perfect' || judge === 'good' || judge === 'hit' || judge === 'pick');
      const isMiss =
        (judge === 'miss' || judge === 'blocked' || judge === 'violation');

      if(isHit) S.counts.hit_total++;
      if(isMiss) S.counts.miss_total++;

      if(judge === 'perfect') S.counts.perfect++;
      else if(judge === 'good') S.counts.good++;
      else if(judge === 'miss') S.counts.miss++;

      // note types
      if(type === 'note') S.counts.type_note++;
      else if(type === 'boss') S.counts.type_boss++;
      else if(type === 'weak') S.counts.type_weak++;
      else if(type === 'stealth') S.counts.type_stealth++;
      else if(type === 'pickup') S.counts.type_pickup++;

      // blocked stealth
      if(type === 'stealth' && judge === 'blocked') S.counts.blocked_stealth++;

      // ultimate violations
      if(type === 'laser' && judge === 'violation') S.counts.ult_laser_viol++;
      if(type === 'shock' && judge === 'violation') S.counts.ult_shock_viol++;

      // deltaMs
      if(typeof d.deltaMs === 'number'){
        const delta = Math.abs(d.deltaMs);
        S.deltas.push(delta);
        if(S.deltas.length > 160) S.deltas.shift();

        if(type === 'note') S.deltas_note.push(delta);
        else if(type === 'boss') S.deltas_boss.push(delta);
        else if(type === 'weak') S.deltas_weak.push(delta);
        else if(type === 'stealth') S.deltas_stealth.push(delta);

        const buckets = ['deltas_note','deltas_boss','deltas_weak','deltas_stealth'];
        for(const b of buckets){
          if(S[b].length > 120) S[b].shift();
        }
      }

      // combo update
      if(typeof d.combo === 'number'){
        if(d.combo > S.comboMax) S.comboMax = d.combo;
      }
      if(judge === 'miss' || judge === 'violation'){
        S.comboDrops++;
      }
    }

    // track shoot lock success (from vr-ui)
    function onShoot(ev){
      const d = ev?.detail || {};
      const lockPx = Number(d.lockPx)||0;
      S.shoot.total++;
      if(lockPx>0){
        S.shoot.lockPxMean += lockPx;
        S.shoot.lockPxSamples++;
      }
      // we can’t know hit directly here, but many engines will emit judge after shoot;
      // so we estimate hit when judge arrives. (optional)
    }

    function onEnd(ev){
      const d = ev?.detail || {};
      const summary = d.summary || d;

      pushEvent(S, 'hha:end', summary);

      const F = buildFeatures(S, summary);
      const P = predictFromFeatures(F);

      if(O.debug){
        console.log('[AIHooks] end', S.gameKey, { features:F, pred:P, summary });
      }

      saveSession(F, summary);

      // also expose last AI output
      try{
        localStorage.setItem('HHA_AI_LAST', JSON.stringify({ ts:Date.now(), game:S.gameKey, pred:P, features:F.meta }));
      }catch(_){}
    }

    // attach listeners
    WIN.addEventListener('hha:start', onStart);
    WIN.addEventListener('hha:time',  onTime);
    WIN.addEventListener('hha:judge', onJudge);
    WIN.addEventListener('hha:shoot', onShoot);
    WIN.addEventListener('hha:end',   onEnd);

    // cleanup helper (optional)
    API.dispose = ()=>{
      try{
        WIN.removeEventListener('hha:start', onStart);
        WIN.removeEventListener('hha:time',  onTime);
        WIN.removeEventListener('hha:judge', onJudge);
        WIN.removeEventListener('hha:shoot', onShoot);
        WIN.removeEventListener('hha:end',   onEnd);
      }catch(_){}
    };

    return API;
  }

  // ---------- export ----------
  WIN.HHA = WIN.HHA || {};
  WIN.HHA.createAIHooks = createAIHooks;

})();