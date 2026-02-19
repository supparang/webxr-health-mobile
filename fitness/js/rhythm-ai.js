// === /fitness/js/rhythm-ai.js ===
// Rhythm Boxer AI — Prediction (Explainable, Research-Locked) v20260219a
// Goals:
//  - Predict fatigue risk + skill score from gameplay telemetry (no cheating)
//  - Provide explainable micro-tips (rate-limited)
//  - Deterministic / reproducible (no random unless seeded)
//
// Usage:
//  - Include BEFORE rhythm-engine uses RB_AI (safe even if loaded after)
//  - Query params:
//      ?ai=1        -> enable assist in normal/play (still prediction-only by default)
//      ?ai=0        -> off
//      ?ailock=1    -> force lock (research-style)
//      ?aidebug=1   -> verbose console (optional)

'use strict';

(function(){
  const WIN = window;

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function clamp01(v){ return clamp(v,0,1); }

  function mean(arr){
    if(!arr || !arr.length) return 0;
    let s=0; for(const x of arr) s+=x;
    return s/arr.length;
  }
  function std(arr){
    if(!arr || arr.length<2) return 0;
    const m = mean(arr);
    let s=0; for(const x of arr) s+=(x-m)*(x-m);
    return Math.sqrt(s/(arr.length-1));
  }

  function sigmoid(x){ return 1/(1+Math.exp(-x)); }

  function qs(name, def){
    try{
      const sp = new URL(location.href).searchParams;
      const v = sp.get(name);
      return (v==null || v==='') ? def : v;
    }catch(_){ return def; }
  }

  const CFG = {
    assistOn: (String(qs('ai','0')).toLowerCase()==='1'),
    forceLock: (String(qs('ailock','')).toLowerCase()==='1'),
    debug: (String(qs('aidebug','0')).toLowerCase()==='1'),
    // rolling windows
    winRT: 16,
    winOffset: 16,
    winMiss: 12,
    // tip rate limit (seconds)
    tipEverySec: 2.5,
  };

  // --- Deterministic tiny PRNG (seeded by session id if provided) ---
  function makeRng(seedStr){
    let h = 2166136261>>>0;
    const s = String(seedStr||'seed');
    for(let i=0;i<s.length;i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619)>>>0;
    }
    return function rnd(){
      h = (Math.imul(h, 1664525) + 1013904223)>>>0;
      return h / 4294967296;
    };
  }

  // --- AI State ---
  const ST = {
    locked: true,              // research lock default (safe)
    assistEnabled: CFG.assistOn,
    sessionSeed: 'RB',
    rnd: makeRng('RB'),
    lastTipAtS: -999,
    // rolling buffers
    rt: [],
    offsetAbs: [],
    missBurst: [],
    combo: [],
    // last snapshot for drift
    lastAcc: null,
    lastOffsetAbsMean: null,
    lastTime: 0,
    // computed
    fatigueRisk: 0,
    skillScore: 0.5,
    suggestedDifficulty: 'normal',
    tip: ''
  };

  function pushWin(buf, v, n){
    buf.push(v);
    if(buf.length > n) buf.shift();
  }

  function explainTopFactors(f){
    // f = feature object
    // return array of {k, msg, w}
    const out = [];

    // fatigue
    if(f.missRate > 0.16) out.push({k:'missRate', w:0.9, msg:'พลาดถี่ขึ้น → เสี่ยงหลุดจังหวะ'});
    if(f.rtDrift > 0.10)  out.push({k:'rtDrift',  w:0.8, msg:'RT เริ่มช้าลง → เริ่มล้า'});
    if(f.offVar > 0.08)   out.push({k:'offVar',   w:0.7, msg:'offset แกว่ง → มือไม่นิ่ง'});
    if(f.comboStab < 0.35)out.push({k:'comboStab',w:0.6, msg:'คอมโบไม่ต่อเนื่อง → จังหวะยังไม่นิ่ง'});

    // skill
    if(f.accPct >= 92)    out.push({k:'acc', w:0.6, msg:'Accuracy สูง → คุมจังหวะดี'});
    if(f.offMean < 0.055) out.push({k:'off', w:0.6, msg:'offset เฉลี่ยต่ำ → timing แม่น'});

    out.sort((a,b)=>b.w-a.w);
    return out.slice(0,2);
  }

  function pickTip(features, snap){
    // tip library (micro & actionable)
    // deterministic pick based on session rng but conditioned by features
    const tips = [];

    // If offsets are late (positive) more often -> "hit earlier"
    if(features.lateBias > 0.62){
      tips.push('ลองกด “ก่อนเส้น” นิดนึง (คุณมักช้าไปเล็กน้อย)');
    } else if(features.earlyBias > 0.62){
      tips.push('ลองกด “ช้าลงนิด” (คุณมักเร็วไปเล็กน้อย)');
    }

    if(features.offVar > 0.08){
      tips.push('โฟกัส “คงจังหวะ” 4 บีตติดกันก่อน แล้วค่อยเร่ง');
    }

    if(features.missRate > 0.16){
      tips.push('ถ้าพลาดติด ๆ ให้ “ลดแรงกด” และดูเลนที่ใกล้เส้นที่สุด');
    }

    if(features.rtMean > 0.42){
      tips.push('หายใจเข้า-ออกสั้น ๆ 1 ครั้ง แล้วกลับไปจับเส้น (ช่วยรีเซ็ตสมอง)');
    }

    if(features.comboStab < 0.35){
      tips.push('เน้น “ไม่พลาด” ก่อนคอมโบ: perfect ไม่ต้องเยอะ แต่ต้องต่อเนื่อง');
    }

    // positive reinforcement
    if(features.accPct >= 90 && features.offMean < 0.06){
      tips.push('ดีมาก! ตอนนี้ timing คมแล้ว ลองรักษาคอมโบให้ยาวขึ้น');
    }

    if(!tips.length){
      tips.push('จับเส้นให้แม่น: มองเส้นเป็นหลัก แล้วกดตามจังหวะคงที่');
    }

    const idx = Math.floor(ST.rnd() * tips.length);
    return tips[idx];
  }

  function computeFeatures(snap){
    // snap from engine: accPct, hitMiss, combo, offsetAbsMean, hp, songTime, durationSec
    const t = Number(snap.songTime||0);
    const acc = Number(snap.accPct||0);

    // rolling means
    const rtMean = mean(ST.rt);
    const offMean = mean(ST.offsetAbs);
    const offVar = std(ST.offsetAbs);

    const missRate = mean(ST.missBurst);   // 0..1 (recent miss indicator)
    const comboStab = clamp01(mean(ST.combo)); // normalized combo stability proxy

    // drift: compare now to last
    const lastAcc = (ST.lastAcc==null) ? acc : ST.lastAcc;
    const lastOff = (ST.lastOffsetAbsMean==null) ? offMean : ST.lastOffsetAbsMean;

    const rtDrift = clamp01((rtMean - 0.34) / 0.18);      // normalize
    const offDrift = clamp01((offMean - lastOff) / 0.06);
    const accDrop = clamp01((lastAcc - acc) / 18);

    // bias placeholders (if you later pass early/late)
    const lateBias = Number(snap.lateBias||0); // 0..1
    const earlyBias = Number(snap.earlyBias||0);

    return {
      t,
      accPct: acc,
      rtMean,
      offMean,
      offVar,
      missRate,
      comboStab,
      rtDrift,
      offDrift,
      accDrop,
      lateBias: clamp01(lateBias),
      earlyBias: clamp01(earlyBias),
    };
  }

  function scoreFatigue(f){
    // ML-ish scoring (hand-tuned, explainable)
    // Higher => more fatigue risk
    const x =
      -1.2 +
      2.4*(f.missRate) +
      1.8*(f.rtDrift) +
      1.4*(clamp01(f.offVar/0.12)) +
      1.2*(f.accDrop) +
      0.8*(1 - f.comboStab);

    return clamp01(sigmoid(x));
  }

  function scoreSkill(f){
    // Higher => better skill
    const accN = clamp01((f.accPct - 55) / 45);
    const offN = 1 - clamp01(f.offMean / 0.14);
    const stabN = clamp01(f.comboStab);

    // weighted
    const s = 0.52*accN + 0.34*offN + 0.14*stabN;
    return clamp01(s);
  }

  function suggestDifficulty(skill, fatigue){
    // suggest only, do not change engine (research lock safe)
    if(fatigue > 0.72) return 'easy';
    if(skill > 0.78 && fatigue < 0.45) return 'hard';
    return 'normal';
  }

  function isLocked(){
    // lock if research or forced
    // engine already sets mode elsewhere, but we keep AI safe default locked
    return !!ST.locked;
  }

  function isAssistEnabled(){
    return !!ST.assistEnabled;
  }

  function setSessionSeed(seed){
    ST.sessionSeed = String(seed || 'RB');
    ST.rnd = makeRng(ST.sessionSeed);
  }

  function setLocked(v){
    ST.locked = !!v;
  }

  function setAssistEnabled(v){
    ST.assistEnabled = !!v;
  }

  // Optional: feed fine-grained events from engine (if you add hooks later)
  function onEvent(ev){
    // ev: {type:'hit'|'miss', rtMs?, offsetAbs? , combo?, early?, late?}
    // keep it deterministic, no randomness
    if(!ev) return;
    if(ev.rtMs != null){
      pushWin(ST.rt, Number(ev.rtMs)/1000, CFG.winRT);
    }
    if(ev.offsetAbs != null){
      pushWin(ST.offsetAbs, Number(ev.offsetAbs), CFG.winOffset);
    }
    if(ev.combo != null){
      // normalize combo into 0..1
      const c = Number(ev.combo)||0;
      pushWin(ST.combo, clamp01(c/30), 18);
    }
    if(ev.type === 'miss'){
      pushWin(ST.missBurst, 1, CFG.winMiss);
    } else if(ev.type === 'hit'){
      pushWin(ST.missBurst, 0, CFG.winMiss);
    }
  }

  function predict(snap){
    // snap from engine loop: accPct, hitMiss, combo, offsetAbsMean, hp, songTime...
    // We can compute some proxy values if engine doesn't provide RT.
    const t = Number(snap.songTime||0);

    // If engine doesn't provide RT stream, approximate from offsetAbsMean & miss trend
    // (still meaningful and non-cheating)
    if(Number.isFinite(snap.offsetAbsMean)){
      pushWin(ST.offsetAbs, Number(snap.offsetAbsMean), CFG.winOffset);
    }
    if(Number.isFinite(snap.combo)){
      pushWin(ST.combo, clamp01((Number(snap.combo)||0)/30), 18);
    }

    // miss burst proxy: compare hitMiss growth (rough)
    // safest: just treat "miss happened recently" when hitMiss increments
    const hm = Number(snap.hitMiss||0);
    if(ST._lastHitMiss == null) ST._lastHitMiss = hm;
    const missInc = hm > ST._lastHitMiss ? 1 : 0;
    ST._lastHitMiss = hm;
    pushWin(ST.missBurst, missInc, CFG.winMiss);

    // RT proxy if none: use offset variance as "instability" -> scale to pseudo-RT
    if(!ST.rt.length){
      const pseudo = 0.34 + clamp(mean(ST.offsetAbs)*1.6, 0, 0.22);
      pushWin(ST.rt, pseudo, CFG.winRT);
    }

    const f = computeFeatures(snap);
    const fatigue = scoreFatigue(f);
    const skill = scoreSkill(f);
    const sug = suggestDifficulty(skill, fatigue);

    // Explainable tip (rate limited)
    let tip = '';
    const factors = explainTopFactors(f);

    const shouldTip = (t - ST.lastTipAtS) >= CFG.tipEverySec;
    if(shouldTip){
      // only show tips if assist enabled OR locked but we still can show “coach” (safe)
      tip = pickTip(f, snap);
      ST.lastTipAtS = t;
    }

    ST.fatigueRisk = fatigue;
    ST.skillScore = skill;
    ST.suggestedDifficulty = sug;
    ST.tip = tip || '';

    ST.lastAcc = f.accPct;
    ST.lastOffsetAbsMean = mean(ST.offsetAbs);
    ST.lastTime = t;

    const state = {
      fatigueRisk: fatigue,                // 0..1
      skillScore: skill,                  // 0..1
      suggestedDifficulty: sug,           // 'easy'|'normal'|'hard'
      tip: ST.tip,                        // string
      explain: factors.map(x=>x.msg).join(' · '), // short explanation
      aiLocked: isLocked() ? 1 : 0,
      aiAssistOn: isAssistEnabled() ? 1 : 0,
    };

    if(CFG.debug){
      console.log('[RB_AI]', {t, f, state});
    }

    return state;
  }

  // Boot defaults:
  // - locked by default, unless ai=1 and not in research (engine can call setLocked)
  ST.locked = CFG.forceLock ? true : true;

  // Expose API
  WIN.RB_AI = {
    predict,
    onEvent,
    isLocked,
    isAssistEnabled,
    setLocked,
    setAssistEnabled,
    setSessionSeed,
    _state: ST
  };
})();