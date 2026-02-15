// === /herohealth/plate/plate-ai-director.js ===
// PlateVR AI Difficulty Director (Explainable, Fair, Smooth) — v1.0 (ML-5)
// Play: ON (default) | Study/Research: OFF
// Listens: hha:start, hha:features_1s, hha:end
// Emits:   hha:adaptive, hha:ai (difficulty-director)
//
// Query params:
//   ?aid=0  -> force off
//   ?aid=1  -> force on
//   ?aids=0.18 -> smoothing alpha (0.05..0.35)
//   ?aidstep=0.06 -> max step per update (0.02..0.15)
//   ?aidcool=1200 -> min ms between adjustments (600..4000)

'use strict';

(function(){
  const W = window;
  const URLX = new URL(location.href);

  const clamp=(v,a,b)=>{v=Number(v)||0;return v<a?a:(v>b?b:v);};
  const now=()=> (performance && performance.now) ? performance.now() : Date.now();
  function emit(name, detail){ try{ W.dispatchEvent(new CustomEvent(name,{detail})); }catch{} }

  const aidForce = URLX.searchParams.get('aid'); // '0' | '1' | null
  const alpha = clamp(URLX.searchParams.get('aids') || 0.18, 0.05, 0.35);      // EMA smoothing
  const maxStep = clamp(URLX.searchParams.get('aidstep') || 0.06, 0.02, 0.15); // per update change
  const minAdjustMs = clamp(URLX.searchParams.get('aidcool') || 1200, 600, 4000);

  const S = {
    on:false,
    ended:false,
    runMode:'play',
    diff:'normal',
    seed:0,
    session_id:'',

    // current multipliers (what engine should use)
    cur:{ sizeMul:1.0, spawnMul:1.0, junkMul:1.0 },

    // internal EMA “pressure” 0..1
    pEma:0.25,
    lastAdjustMs:0,

    // last snapshot for trend
    last:null,
  };

  function policyOnStart(d){
    S.runMode = String(d?.runMode || 'play').toLowerCase();
    S.diff = String(d?.diff || 'normal').toLowerCase();
    S.seed = Number(d?.seed)||0;
    S.session_id = String(d?.session_id || d?.sessionId || '');

    S.ended = false;
    S.last = null;

    // policy: play ON, study/research OFF
    let on = (S.runMode === 'play');
    if(aidForce === '0') on = false;
    if(aidForce === '1') on = true;
    S.on = on;

    // reset baseline by diff
    const base =
      (S.diff==='easy')   ? { sizeMul:1.06, spawnMul:0.92, junkMul:0.92 } :
      (S.diff==='hard')   ? { sizeMul:0.94, spawnMul:1.10, junkMul:1.08 } :
                            { sizeMul:1.00, spawnMul:1.00, junkMul:1.00 };

    S.cur = { ...base };
    S.pEma = 0.25;
    S.lastAdjustMs = 0;

    emit('hha:ai', { game:'plate', type:'director_config', on:S.on, alpha, maxStep, minAdjustMs, base });
    // tell engine initial multipliers
    emit('hha:adaptive', { game:'plate', adapt:{...S.cur}, rationale:{ init:true, diff:S.diff, runMode:S.runMode } });
  }

  function toF(d){
    d = d || {};
    // required-ish
    const t_sec = Number(d.t_sec ?? d.tSec ?? 0) || 0;
    const accPct= Number(d.accNowPct ?? d.accPct ?? d.accuracyPct ?? d.accuracyGoodPct ?? 0) || 0;
    const miss  = Number(d.missNow ?? d.miss ?? 0) || 0;
    const combo = Number(d.comboNow ?? d.combo ?? 0) || 0;

    // optional
    const fever  = Number(d.fever ?? 0) || 0;
    const shield = Number(d.shield ?? 0) || 0;
    const stormActive = (d.stormActive!=null) ? (d.stormActive?1:0) : (d.storm?.active?1:0);
    const bossActive  = (d.bossActive!=null) ? (d.bossActive?1:0) : (d.boss?.active?1:0);

    return { t_sec, accPct, miss, combo, fever, shield, stormActive, bossActive };
  }

  // map “pressure” -> target multipliers (fair & smooth)
  function pressureToTarget(p, snap){
    // p: 0 easy ... 1 hard
    // keep the game fair: if player struggles (high p), we HELP them:
    // - increase size slightly
    // - reduce spawn slightly
    // - reduce junk slightly
    // if player dominates (low p), we challenge them:
    // - shrink targets a bit
    // - spawn faster a bit
    // - more junk a bit
    const storm = snap.stormActive ? 0.06 : 0;
    const boss  = snap.bossActive  ? 0.05 : 0;

    // During storm/boss, don’t over-crank difficulty: add safety help
    const safety = clamp(storm + boss, 0, 0.12);

    const hardBias = clamp(0.35 - p, -0.35, 0.35); // negative => struggling, positive => dominating
    const help = clamp(-hardBias + safety, 0, 0.45);     // 0..help
    const push = clamp(hardBias, 0, 0.35);               // 0..push

    let sizeMul = 1.0 + 0.18*help - 0.10*push;
    let spawnMul = 1.0 - 0.18*help + 0.16*push;
    let junkMul = 1.0 - 0.16*help + 0.14*push;

    // shield present -> allow tiny more challenge, but gently
    if((snap.shield||0) >= 2){
      spawnMul *= 1.03;
      junkMul *= 1.02;
    }

    // clamp final ranges
    sizeMul = clamp(sizeMul, 0.85, 1.25);
    spawnMul = clamp(spawnMul, 0.80, 1.25);
    junkMul  = clamp(junkMul, 0.85, 1.25);

    return { sizeMul, spawnMul, junkMul, help, push, safety };
  }

  function stepToward(cur, target){
    // per update step limit
    const step=(a,b)=>{
      const d=b-a;
      if(Math.abs(d) <= maxStep) return b;
      return a + Math.sign(d)*maxStep;
    };
    return {
      sizeMul: step(cur.sizeMul, target.sizeMul),
      spawnMul: step(cur.spawnMul, target.spawnMul),
      junkMul: step(cur.junkMul, target.junkMul),
    };
  }

  function explain(p, snap){
    const reasons = [];
    const acc = snap.accPct;
    if(acc < 75) reasons.push({k:'low_acc', v:acc});
    if(acc > 90) reasons.push({k:'high_acc', v:acc});
    if(snap.combo >= 12) reasons.push({k:'high_combo', v:snap.combo});
    if(snap.combo <= 2) reasons.push({k:'low_combo', v:snap.combo});
    if(snap.fever >= 75) reasons.push({k:'fever_high', v:snap.fever});
    if(snap.stormActive) reasons.push({k:'storm', v:1});
    if(snap.bossActive) reasons.push({k:'boss', v:1});

    // summarize with pressure & trend
    return {
      pressure: Math.round(p*1000)/1000,
      reasons: reasons.slice(0,4),
    };
  }

  function updateFromFeatures(snap){
    if(!S.on || S.ended) return;

    // compute instantaneous pressure from performance:
    // higher pressure => player struggling => we help
    // components:
    // - low accuracy
    // - rising miss
    // - low combo stability
    // - high fever
    let p = 0.25;

    const acc = clamp(snap.accPct/100, 0, 1);
    const accBad = clamp((0.84 - acc)/0.30, 0, 1); // below 84% -> pressure

    let missRise = 0;
    if(S.last && snap.t_sec > S.last.t_sec){
      const dm = (snap.miss - S.last.miss);
      const dt = Math.max(0.8, snap.t_sec - S.last.t_sec);
      missRise = clamp((dm/dt)/0.8, 0, 1); // ~+0.8 miss/sec = high
    }

    const comboLow = clamp((6 - (snap.combo||0))/10, 0, 1);
    const feverHi = clamp((snap.fever||0)/100, 0, 1);

    // storm/boss add perceived pressure but we use it mainly for safety
    const storm = snap.stormActive ? 0.18 : 0;
    const boss  = snap.bossActive  ? 0.16 : 0;

    p = 0.10 + 0.40*accBad + 0.22*missRise + 0.18*comboLow + 0.10*feverHi + storm + boss;
    p = clamp(p, 0.02, 0.95);

    // EMA smoothing
    S.pEma = (1-alpha)*S.pEma + alpha*p;

    // adjust at most every minAdjustMs
    const t = now();
    if(t - S.lastAdjustMs < minAdjustMs){
      S.last = snap;
      return;
    }
    S.lastAdjustMs = t;

    const target = pressureToTarget(S.pEma, snap);

    // make step-limited move (fair, non-jitter)
    const next = stepToward(S.cur, target);

    // If change is tiny, skip emitting
    const delta =
      Math.abs(next.sizeMul - S.cur.sizeMul) +
      Math.abs(next.spawnMul - S.cur.spawnMul) +
      Math.abs(next.junkMul - S.cur.junkMul);

    S.cur = next;
    S.last = snap;

    if(delta < 0.010) return;

    const rationale = {
      ...explain(S.pEma, snap),
      target:{ sizeMul:target.sizeMul, spawnMul:target.spawnMul, junkMul:target.junkMul },
      applied:{ ...S.cur },
      help: Math.round((target.help||0)*1000)/1000,
      push: Math.round((target.push||0)*1000)/1000,
      safety: Math.round((target.safety||0)*1000)/1000,
    };

    emit('hha:adaptive', { game:'plate', adapt:{...S.cur}, rationale });

    // also emit a generic AI trace event
    emit('hha:ai', { game:'plate', type:'difficulty_director', ...rationale });
  }

  // ---- listeners ----
  W.addEventListener('hha:start', (e)=>policyOnStart(e?.detail||{}), {passive:true});

  W.addEventListener('hha:features_1s', (e)=>{
    const snap = toF(e?.detail||{});
    if(!isFinite(snap.t_sec)) return;
    updateFromFeatures(snap);
  }, {passive:true});

  W.addEventListener('hha:end', ()=>{
    S.ended = true;
  }, {passive:true});

})();
