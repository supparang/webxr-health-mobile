/* === /herohealth/vr-groups/ai-hooks.js ===
AI Hooks — GroupsVR (PLAY-ONLY)
✅ enabled only when ?ai=1 AND run=play
✅ research/practice: hard OFF
✅ Risk prediction (rule-based; ready for ML later)
✅ Director (fair difficulty) -> Engine.setAIDifficulty()
✅ Pre-storm warning (2s) from groups:stormSchedule
✅ Frustration/Fatigue detector (features + micro-tips, rate-limited)
✅ Difficulty trace (replay/research-friendly) stored for summary
Emits:
- groups:ai { risk_bad_next2s, risk_ema, dir_spawnRateMul, stormSoon, frus, fat }
- groups:prestorm { inMs }
*/

(function(root){
  'use strict';

  const NS = root.GroupsVR = root.GroupsVR || {};
  const DOC = root.document;

  const nowMs = ()=> (root.performance && performance.now) ? performance.now() : Date.now();
  const clamp = (v,a,b)=>{ v=Number(v); if(!isFinite(v)) v=a; return v<a?a:(v>b?b:v); };
  const emit = (name, detail)=>{ try{ root.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){ } };

  // ---- config ----
  const CFG = {
    tickMs: 180,
    applyMs: 700,
    tipCooldownMs: 2600,
    traceMax: 160,            // keep small for localStorage/summary
    stormWarnMs: 2000,
    emaAlpha: 0.12
  };

  // ---- runtime ----
  const S = {
    attached: false,
    enabled: false,
    runMode: 'play',
    seed: '',
    t0: 0,

    // live inputs
    leftSec: 0,
    score: 0,
    combo: 0,
    misses: 0,
    grade: 'C',
    acc: 0,

    // derived
    missRate5s: 0,       // approx per second
    comboBreaks10s: 0,
    goodHits5s: 0,
    badHits5s: 0,

    // pressure from engine (0..3)
    pressure: 0,

    // storm schedule
    stormNextAt: 0,
    stormWarned: false,

    // detectors
    frustration: 0,   // 0..1
    fatigue: 0,       // 0..1
    frMax: 0,
    fatMax: 0,
    frSum: 0,
    fatSum: 0,
    frN: 0,

    // risk
    risk: 0.25,
    emaRisk: 0.25,
    riskMax: 0,
    riskSum: 0,
    riskN: 0,

    // director outputs
    dir: {
      spawnRateMul: 1.0,
      wrongAdd: 0.0,
      junkAdd:  0.0,
      lastApplyAt: 0
    },

    // recent windows
    _lastScoreAt: 0,
    _lastScore: 0,
    _lastMisses: 0,
    _lastCombo: 0,
    _comboBreaksBucket: [],
    _missBucket: [],
    _goodBucket: [],
    _badBucket: [],

    // tips
    _lastTipAt: 0,

    // trace
    trace: []
  };

  function resetWindows(){
    S._comboBreaksBucket = [];
    S._missBucket = [];
    S._goodBucket = [];
    S._badBucket = [];
  }

  function pushBucket(bucket, t, v){
    bucket.push([t, v]);
    // prune > 10s
    const cutoff = t - 10000;
    while(bucket.length && bucket[0][0] < cutoff) bucket.shift();
  }

  function sumBucket(bucket, ms){
    const cutoff = nowMs() - ms;
    let s = 0;
    for (let i=0;i<bucket.length;i++){
      if (bucket[i][0] >= cutoff) s += bucket[i][1];
    }
    return s;
  }

  function mean01FromRate(rate, lo, hi){
    // map rate to 0..1
    const x = (rate - lo) / Math.max(1e-6, (hi - lo));
    return clamp(x, 0, 1);
  }

  // ---- event handlers ----
  function onTime(ev){
    const d = ev.detail||{};
    S.leftSec = Number(d.left||0)||0;
  }
  function onScore(ev){
    const d = ev.detail||{};
    const t = nowMs();

    const score = Number(d.score ?? 0)||0;
    const combo = Number(d.combo ?? 0)||0;
    const misses= Number(d.misses ?? 0)||0;

    // detect combo break
    if (S._lastCombo > 2 && combo === 0){
      pushBucket(S._comboBreaksBucket, t, 1);
    }
    S._lastCombo = combo;

    // miss delta for rate
    const dm = Math.max(0, misses - (S._lastMisses||0));
    if (dm>0) pushBucket(S._missBucket, t, dm);
    S._lastMisses = misses;

    // score delta (proxy: performance/energy)
    if (S._lastScoreAt){
      const dt = Math.max(0.1, (t - S._lastScoreAt)/1000);
      const ds = Math.max(0, score - (S._lastScore||0));
      // if ds is low for long time while misses rising -> fatigue indicator
      // we just store; computed in tick
      // (no need to keep in bucket)
    }
    S._lastScoreAt = t;
    S._lastScore = score;

    S.score = score;
    S.combo = combo;
    S.misses = misses;
  }
  function onRank(ev){
    const d = ev.detail||{};
    S.grade = String(d.grade ?? 'C');
    S.acc   = Number(d.accuracy ?? 0)||0;
  }
  function onJudge(ev){
    // counts for fatigue/frustration (good vs bad)
    const d = ev.detail||{};
    const t = nowMs();
    const k = String(d.kind||'').toLowerCase();
    if (k === 'good' || k === 'perfect' || k === 'boss'){
      pushBucket(S._goodBucket, t, 1);
    } else if (k === 'bad' || k === 'miss'){
      pushBucket(S._badBucket, t, 1);
    }
  }
  function onProgress(ev){
    const d = ev.detail||{};
    if (d.kind === 'pressure') S.pressure = Number(d.level||0)||0;
  }
  function onStormSchedule(ev){
    const d = ev.detail||{};
    S.stormNextAt = Number(d.nextStormAtMs||0)||0;
    S.stormWarned = false;
  }

  // ---- core: prediction + director ----
  function calcFrustration(){
    // frustration: combo breaks + bad hits + rising misses
    const cb10 = sumBucket(S._comboBreaksBucket, 10000);
    const bad5 = sumBucket(S._badBucket, 5000);
    const miss5 = sumBucket(S._missBucket, 5000); // delta misses in 5s

    const cbN  = mean01FromRate(cb10/10, 0.05, 0.45);
    const badN = mean01FromRate(bad5/5,  0.10, 0.85);
    const missN= mean01FromRate(miss5/5, 0.05, 0.60);

    const pN   = clamp((S.pressure||0)/3, 0, 1);

    // weighted
    const fr = clamp(0.35*cbN + 0.30*badN + 0.25*missN + 0.10*pN, 0, 1);
    return fr;
  }

  function calcFatigue(){
    // fatigue: sustained bad hits + low good hits + low score growth (proxy)
    const good5 = sumBucket(S._goodBucket, 5000);
    const bad10 = sumBucket(S._badBucket, 10000);

    const goodN = 1 - mean01FromRate(good5/5, 0.15, 1.10); // low good => higher fatigue
    const badN  = mean01FromRate(bad10/10, 0.08, 0.80);

    // score gain per 10s
    const t = nowMs();
    const dt = Math.max(0.2, (t - (S._lastScoreAt||t))/1000);
    // (S._lastScoreAt is updated often; use misses/acc trend as proxy instead)
    const accN = 1 - clamp((S.acc||0)/100, 0, 1);

    const fat = clamp(0.40*goodN + 0.35*badN + 0.25*accN, 0, 1);
    return fat;
  }

  function calcRisk(fr, fat, stormSoon){
    // risk of "bad event" in next ~2s (rule-based)
    // key drivers: pressure + miss rate + low acc + stormSoon + frustration/fatigue
    const miss5 = sumBucket(S._missBucket, 5000);
    const missRate = clamp(miss5/5, 0, 2.0); // per sec
    const missN = mean01FromRate(missRate, 0.05, 0.65);

    const accN = 1 - clamp((S.acc||0)/100, 0, 1);
    const pN   = clamp((S.pressure||0)/3, 0, 1);
    const stormN = stormSoon ? 1 : 0;

    // combo helps reduce risk a bit
    const comboN = clamp((S.combo||0)/12, 0, 1);

    const r = clamp(
      0.28*missN + 0.18*accN + 0.16*pN + 0.14*stormN + 0.14*fr + 0.12*fat - 0.10*comboN,
      0, 1
    );
    return r;
  }

  function policyFromEma(ema, fr, fat){
    // fair policy:
    // - if risk high OR fatigue high: ease a bit
    // - if risk low AND performance good: challenge a bit
    let targetSpawn = 1.0;
    let targetWrong = 0.0;
    let targetJunk  = 0.0;

    const perfGood = (S.acc >= 82 && S.combo >= 4 && (S.pressure||0) <= 1);

    if (ema >= 0.72 || fat >= 0.72){
      targetSpawn = 0.90;
      targetWrong = -0.030;
      targetJunk  = -0.020;
    } else if (ema >= 0.60 || fr >= 0.70){
      targetSpawn = 0.95;
      targetWrong = -0.015;
      targetJunk  = -0.010;
    } else if (ema <= 0.22 && perfGood){
      targetSpawn = 1.07;
      targetWrong = +0.012;
      targetJunk  = +0.010;
    } else if (ema <= 0.28 && perfGood){
      targetSpawn = 1.04;
      targetWrong = +0.008;
      targetJunk  = +0.006;
    }
    return { targetSpawn, targetWrong, targetJunk };
  }

  function applyDirector(target){
    const D = S.dir;
    D.spawnRateMul = clamp(0.80*D.spawnRateMul + 0.20*target.targetSpawn, 0.85, 1.20);
    D.wrongAdd     = clamp(0.75*D.wrongAdd     + 0.25*target.targetWrong, -0.06, 0.10);
    D.junkAdd      = clamp(0.75*D.junkAdd      + 0.25*target.targetJunk,  -0.05, 0.08);

    // apply to engine
    const E = NS && NS.GameEngine;
    if (E && E.setAIDifficulty){
      E.setAIDifficulty({
        spawnRateMul: D.spawnRateMul,
        wrongAdd: D.wrongAdd,
        junkAdd:  D.junkAdd
      });
    }
  }

  function maybeTip(fr, fat, ema){
    const t = nowMs();
    if (t - S._lastTipAt < CFG.tipCooldownMs) return;
    if (!S.enabled) return;

    if (fat >= 0.78){
      S._lastTipAt = t;
      emit('hha:coach', { text:'เหมือนเริ่มล้าแล้วนะ 😵 หายใจลึก ๆ แล้วเล็งช้าลงนิด', mood:'sad' });
      return;
    }
    if (fr >= 0.78){
      S._lastTipAt = t;
      emit('hha:coach', { text:'อย่าใจร้อน! เล็งให้ตรงหมู่ก่อนยิง 👀', mood:'neutral' });
      return;
    }
    if (ema >= 0.70){
      S._lastTipAt = t;
      emit('hha:coach', { text:'ช่วงนี้เสี่ยงพลาดสูง 🔥 ลดการยิงมั่ว แล้วคุมจังหวะนะ', mood:'fever' });
      return;
    }
  }

  function recordTrace(stormSoon, fr, fat){
    // trace point every apply (~700ms) -> ~130 points/90s
    const t = Math.max(0, Math.round(nowMs() - (S.t0||nowMs())));
    const pt = {
      t, // ms since attach
      r: Math.round(S.risk*1000)/1000,
      e: Math.round(S.emaRisk*1000)/1000,
      s: Math.round(S.dir.spawnRateMul*1000)/1000,
      w: Math.round(S.dir.wrongAdd*1000)/1000,
      j: Math.round(S.dir.junkAdd*1000)/1000,
      f: Math.round(fr*1000)/1000,
      a: Math.round(fat*1000)/1000,
      st: stormSoon ? 1 : 0
    };
    S.trace.push(pt);
    if (S.trace.length > CFG.traceMax) S.trace.shift();
  }

  // ---- main tick ----
  let _timer = 0;

  function tick(){
    if (!S.attached || !S.enabled) return;

    const t = nowMs();

    // storm soon?
    let stormSoon = false;
    if (S.stormNextAt > 0){
      const dt = S.stormNextAt - t;
      stormSoon = (dt > 0 && dt <= CFG.stormWarnMs);

      if (stormSoon && !S.stormWarned){
        S.stormWarned = true;
        emit('groups:prestorm', { inMs: dt });
        emit('hha:judge', { kind:'storm', text:'STORM IN 2', x: root.innerWidth*0.5, y: root.innerHeight*0.22 });
        emit('hha:coach', { text:'อีก 2 วิพายุจะมา! เล็งให้แม่นนะ 🌪️', mood:'fever' });
      }
    }

    // detectors
    const fr  = calcFrustration();
    const fat = calcFatigue();
    S.frustration = fr;
    S.fatigue = fat;

    S.frMax = Math.max(S.frMax, fr);
    S.fatMax= Math.max(S.fatMax, fat);
    S.frSum += fr; S.fatSum += fat; S.frN += 1;

    // risk prediction
    const risk = calcRisk(fr, fat, stormSoon);
    S.risk = risk;
    S.emaRisk = clamp((1-CFG.emaAlpha)*S.emaRisk + CFG.emaAlpha*risk, 0, 1);

    S.riskMax = Math.max(S.riskMax, risk);
    S.riskSum += risk; S.riskN += 1;

    // director apply throttled
    if (t - S.dir.lastApplyAt >= CFG.applyMs){
      S.dir.lastApplyAt = t;
      const target = policyFromEma(S.emaRisk, fr, fat);
      applyDirector(target);
      recordTrace(stormSoon, fr, fat);
    }

    // emit AI event for HUD/summary
    emit('groups:ai', {
      risk_bad_next2s: Math.round(risk*1000)/1000,
      risk_ema: Math.round(S.emaRisk*1000)/1000,
      dir_spawnRateMul: Math.round(S.dir.spawnRateMul*1000)/1000,
      stormSoon: !!stormSoon,
      frus: Math.round(fr*1000)/1000,
      fat:  Math.round(fat*1000)/1000
    });

    // micro tip
    maybeTip(fr, fat, S.emaRisk);

    // schedule next
    _timer = root.setTimeout(tick, CFG.tickMs);
  }

  // ---- public ----
  function detach(){
    if (!S.attached) return;
    S.attached = false;
    S.enabled = false;
    try{ root.clearTimeout(_timer); }catch(_){}
    try{ root.removeEventListener('hha:time', onTime); }catch(_){}
    try{ root.removeEventListener('hha:score', onScore); }catch(_){}
    try{ root.removeEventListener('hha:rank', onRank); }catch(_){}
    try{ root.removeEventListener('hha:judge', onJudge); }catch(_){}
    try{ root.removeEventListener('groups:progress', onProgress); }catch(_){}
    try{ root.removeEventListener('groups:stormSchedule', onStormSchedule); }catch(_){}
  }

  function attach(opts){
    opts = opts || {};
    const runMode = String(opts.runMode||'play').toLowerCase();
    const enabled = !!opts.enabled;

    // HARD OFF for research/practice
    if (runMode !== 'play' || !enabled){
      detach();
      return;
    }

    detach(); // reattach fresh

    S.attached = true;
    S.enabled = true;
    S.runMode = 'play';
    S.seed = String(opts.seed||'');
    S.t0 = nowMs();

    // reset stats
    S.pressure = 0;
    S.stormNextAt = 0;
    S.stormWarned = false;

    S.frustration = 0; S.fatigue=0;
    S.frMax=0; S.fatMax=0; S.frSum=0; S.fatSum=0; S.frN=0;

    S.risk=0.25; S.emaRisk=0.25;
    S.riskMax=0; S.riskSum=0; S.riskN=0;

    S.dir.spawnRateMul = 1.0;
    S.dir.wrongAdd = 0.0;
    S.dir.junkAdd  = 0.0;
    S.dir.lastApplyAt = 0;

    S.trace = [];
    resetWindows();

    S._lastTipAt = 0;
    S._lastScoreAt = 0;
    S._lastScore = 0;
    S._lastMisses = 0;
    S._lastCombo = 0;

    // listeners
    root.addEventListener('hha:time', onTime, {passive:true});
    root.addEventListener('hha:score', onScore, {passive:true});
    root.addEventListener('hha:rank', onRank, {passive:true});
    root.addEventListener('hha:judge', onJudge, {passive:true});
    root.addEventListener('groups:progress', onProgress, {passive:true});
    root.addEventListener('groups:stormSchedule', onStormSchedule, {passive:true});

    // kick
    _timer = root.setTimeout(tick, 160);
  }

  function getSnapshot(){
    const n = Math.max(1, S.frN|0);
    const rn = Math.max(1, S.riskN|0);
    return {
      enabled: !!S.enabled,
      seed: S.seed,
      frustrationMean: Math.round((S.frSum/n)*1000)/1000,
      fatigueMean: Math.round((S.fatSum/n)*1000)/1000,
      frustrationMax: Math.round((S.frMax)*1000)/1000,
      fatigueMax: Math.round((S.fatMax)*1000)/1000,
      riskMean: Math.round((S.riskSum/rn)*1000)/1000,
      riskMax: Math.round((S.riskMax)*1000)/1000,
      director: {
        spawnRateMul: Math.round(S.dir.spawnRateMul*1000)/1000,
        wrongAdd: Math.round(S.dir.wrongAdd*1000)/1000,
        junkAdd:  Math.round(S.dir.junkAdd*1000)/1000
      },
      trace: Array.isArray(S.trace) ? S.trace.slice() : []
    };
  }

  NS.AIHooks = { attach, detach, getSnapshot };

})(typeof window !== 'undefined' ? window : globalThis);