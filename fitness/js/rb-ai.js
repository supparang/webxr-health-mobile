// === /fitness/js/rb-ai.js ===
// Rhythm Boxer AI Prediction / Coach / Assist Flags (ML-ready, explainable)
// ✅ Research lock supported
// ✅ Normal assist opt-in via ?ai=1
// ✅ Predict-only by default (no hidden adaptive changes)
// ✅ Smoothing + explainable tips + fatigue/skill estimates
'use strict';

(function(){
  const WIN = window;

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function clamp01(v){ return clamp(v,0,1); }
  function q(name, def=''){
    try{ return new URL(location.href).searchParams.get(name) ?? def; }
    catch(_){ return def; }
  }

  const state = {
    hist: [],
    lastTip: '',
    lastTipAt: 0,
    modeLocked: false,   // research = locked
    assistOn: false,     // ?ai=1 enables normal assist signaling
    explain: true
  };

  function init(){
    const mode = String(q('mode','')).toLowerCase();
    state.modeLocked = (mode === 'research' || q('run','') === 'research');
    state.assistOn = String(q('ai','0')) === '1';
  }

  function smoothPush(x){
    state.hist.push(x);
    if(state.hist.length > 12) state.hist.shift();
  }

  function avg(arr, key){
    if(!arr.length) return 0;
    let s=0;
    for(const x of arr) s += (x[key] || 0);
    return s / arr.length;
  }

  function pickTip(snapshot, derived){
    const now = performance.now ? performance.now() : Date.now();
    const cooldownMs = 2200;

    let tip = '';
    let why = '';

    // priority order
    if (derived.fatigueRisk > 0.78 && snapshot.hp < 55){
      tip = 'ผ่อนแรง 2 จังหวะ แล้วค่อยกลับมาเก็บคอมโบ';
      why = 'hp-low+fatigue';
    } else if (derived.lateBias > 0.65){
      tip = 'คุณกดช้าเล็กน้อย — ลองกด “ก่อนถึงเส้น” นิดหนึ่ง';
      why = 'late-bias';
    } else if (derived.earlyBias > 0.65){
      tip = 'คุณกดเร็วไปนิด — รอให้โน้ตเข้าใกล้เส้นมากขึ้น';
      why = 'early-bias';
    } else if (snapshot.combo >= 12 && derived.skillScore > 0.68){
      tip = 'ดีมาก! รักษาจังหวะนี้ไว้ แล้วโฟกัสความแม่นยำมากกว่าความแรง';
      why = 'good-streak';
    } else if ((snapshot.hitMiss || 0) >= 8 && snapshot.combo === 0){
      tip = 'อย่ากดรัวมั่ว ลองจับ lane หลักก่อน แล้วค่อยขยาย';
      why = 'spam-risk';
    } else if ((snapshot.offsetAbsMean || 0) > 0.10){
      tip = 'ลองปรับ Cal ±20ms ถ้ารู้สึกเพลงกับภาพไม่ตรงกัน';
      why = 'calibration';
    }

    if (!tip) return '';

    // rate limit repeated tips
    if (tip === state.lastTip && (now - state.lastTipAt) < 4000) return '';
    if ((now - state.lastTipAt) < cooldownMs) return '';

    state.lastTip = tip;
    state.lastTipAt = now;
    return tip;
  }

  function predict(snapshot){
    // snapshot from engine:
    // accPct, hitMiss, hitPerfect, hitGreat, hitGood, combo, offsetAbsMean, hp, songTime, durationSec
    snapshot = snapshot || {};

    // derive normalized features
    const acc = clamp01((snapshot.accPct || 0) / 100);
    const missLoad = clamp01((snapshot.hitMiss || 0) / 20);
    const comboNorm = clamp01((snapshot.combo || 0) / 25);
    const hpNorm = clamp01((snapshot.hp || 0) / 100);
    const prog = (snapshot.durationSec > 0) ? clamp01((snapshot.songTime || 0) / snapshot.durationSec) : 0;
    const offsetAbs = clamp01(((snapshot.offsetAbsMean || 0) / 0.14)); // ~140ms = poor timing

    // optional early/late biases passed from engine (if added)
    const earlyBias = clamp01(snapshot.earlyBias || 0);
    const lateBias  = clamp01(snapshot.lateBias  || 0);

    // fatigue risk (rule-based baseline, ML-ready later)
    const fatigueRisk = clamp01(
      0.34 * (1 - hpNorm) +
      0.24 * missLoad +
      0.20 * offsetAbs +
      0.12 * prog +
      0.10 * (comboNorm < 0.2 ? 1 : 0)
    );

    // skill score (stability/accuracy proxy)
    const skillScore = clamp01(
      0.50 * acc +
      0.22 * (1 - offsetAbs) +
      0.18 * comboNorm +
      0.10 * hpNorm
    );

    let suggestedDifficulty = 'normal';
    if (skillScore >= 0.78 && fatigueRisk < 0.45) suggestedDifficulty = 'hard';
    else if (skillScore <= 0.40 || fatigueRisk > 0.75) suggestedDifficulty = 'easy';

    const frame = {
      fatigueRisk,
      skillScore,
      suggestedDifficulty,
      earlyBias,
      lateBias
    };
    smoothPush(frame);

    // smoothed outputs
    const out = {
      fatigueRisk: +avg(state.hist, 'fatigueRisk').toFixed(3),
      skillScore: +avg(state.hist, 'skillScore').toFixed(3),
      suggestedDifficulty: suggestedDifficulty,
      earlyBias: +avg(state.hist, 'earlyBias').toFixed(3),
      lateBias: +avg(state.hist, 'lateBias').toFixed(3),
      locked: state.modeLocked ? 1 : 0,
      assistOn: state.assistOn ? 1 : 0,
      tip: ''
    };

    if (state.explain){
      out.tip = pickTip(snapshot, out);
    }
    return out;
  }

  function isLocked(){ return !!state.modeLocked; }
  function isAssistEnabled(){ return !!state.assistOn; }

  init();

  WIN.RB_AI = Object.assign({}, WIN.RB_AI || {}, {
    predict,
    isLocked,
    isAssistEnabled
  });
})();