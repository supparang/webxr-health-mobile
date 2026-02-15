// === /herohealth/vr/ai-hooks.js ===
// HeroHealth AI Hooks — SAFE/PRODUCTION — v20260215a
//
// Goal: Provide a single, consistent AI interface for all HeroHealth games.
// - Never crashes if unused
// - Deterministic OFF in study/research by default
// - Explainable micro-tips (rate-limited)
// - Lightweight prediction + difficulty signal (heuristics) for future ML/DL
//
// Usage:
//   const ai = window.HHA.createAIHooks({ game:'plate', runMode:'play', diff:'normal', seed:123, deterministic:false });
//
// The engine can call:
//   ai.onEvent(type, payload)
//   ai.getTip(features) -> {msg,mood,ttlMs,tag,explain}
//   ai.getPrediction(features) -> {risk01, label, explain}
//   ai.getDifficultySignal(features) -> {spawnMult, junkBias, speedBias, explain}
//   ai.reset()

'use strict';

(function(){
  const ROOT = window;

  // Namespace
  ROOT.HHA = ROOT.HHA || {};
  if(typeof ROOT.HHA.createAIHooks === 'function') return; // don't override

  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const now = ()=> (performance && performance.now) ? performance.now() : Date.now();

  // Very small seeded RNG (only used if you explicitly enable deterministic play AI later)
  function seededRng(seed){
    let t = (Number(seed)||12345) >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rng, arr){
    return arr[Math.floor(rng()*arr.length)];
  }

  // Tip packs (Thai-first)
  const TIP_PACK = {
    generic: [
      { tag:'focus',  mood:'neutral', msg:'โฟกัส “จังหวะ” มากกว่าความเร็ว—คอมโบจะขึ้นเอง 🎯', explain:'ลดการพลาดจากความรีบ' },
      { tag:'steady', mood:'neutral', msg:'เล็งให้ชัวร์ก่อนยิง/แตะ 1 ครั้ง—กัน missShot พุ่ง', explain:'ลดการยิงซ้ำ/แตะรัว' },
      { tag:'reset',  mood:'neutral', msg:'พลาดแล้วอย่าแถ! รีเซ็ตโฟกัสทันที แล้วกลับมาคุมจังหวะ', explain:'จัดการ after-error slump' },
      { tag:'combo',  mood:'happy',   msg:'คอมโบกำลังมา! รักษาความนิ่งไว้ 🔥', explain:'เสริมแรงเมื่อเล่นดี' }
    ],
    plate: [
      { tag:'all5',   mood:'neutral', msg:'ยังไม่ครบ 5 หมู่? เล็งหมู่ที่ยัง “ไม่ขึ้นเลข” ก่อน 🥦🍎🐟🍚🥑', explain:'เพิ่มความสมดุลของจาน' },
      { tag:'junk',   mood:'sad',     msg:'ระวังของทอด/หวาน! โดนทีเดียวคอมโบหาย 💥', explain:'ลด junk hit' },
      { tag:'storm',  mood:'fever',   msg:'STORM มาแล้ว! เล็งเฉพาะ GOOD ที่ใกล้ crosshair ก่อน ⏱️', explain:'เพิ่ม hitGood ในเวลาจำกัด' },
      { tag:'boss',   mood:'neutral', msg:'BOSS: ห้ามโดนขยะ! เอาความชัวร์เป็นหลัก 😤', explain:'ลดความเสี่ยง hitJunk' },
      { tag:'acc',    mood:'neutral', msg:'ถ้าอยากได้ A/S: คุมความแม่นยำ > 80% ไว้ก่อน 🎯', explain:'ชี้เป้าเป้าหมาย acc' }
    ],
    groups: [
      { tag:'switch', mood:'neutral', msg:'จำหมู่ให้แม่น: สี/ไอคอนเปลี่ยน = เป้าหมายใหม่', explain:'ลดสับสนระหว่างกลุ่ม' }
    ],
    hygiene: [
      { tag:'step',   mood:'neutral', msg:'ทำทีละขั้น—ไม่ต้องรีบ แต่ต้องครบ ✅', explain:'เน้นความครบถ้วน' }
    ],
    fitness: [
      { tag:'breath', mood:'neutral', msg:'หายใจเข้าลึก ๆ แล้วคุมจังหวะ—คะแนนจะนิ่งขึ้น', explain:'ลดผิดจังหวะ/พลาด' }
    ]
  };

  function makeRateLimiter(minGapMs){
    let lastAt = 0;
    return function allow(){
      const t = now();
      if(t - lastAt < minGapMs) return false;
      lastAt = t;
      return true;
    };
  }

  // Simple rolling store
  function makeRolling(maxN){
    const a = [];
    return {
      push(x){ a.push(x); while(a.length>maxN) a.shift(); },
      avg(){
        if(!a.length) return 0;
        let s=0; for(const v of a) s += (Number(v)||0);
        return s/a.length;
      },
      sum(){
        let s=0; for(const v of a) s += (Number(v)||0);
        return s;
      },
      last(){ return a.length ? a[a.length-1] : 0; },
      arr(){ return a.slice(); }
    };
  }

  // Core factory
  ROOT.HHA.createAIHooks = function createAIHooks(opts){
    opts = opts || {};
    const game = String(opts.game || 'generic').toLowerCase();
    const runMode = String(opts.runMode || 'play').toLowerCase();
    const diff = String(opts.diff || 'normal').toLowerCase();

    const deterministic = !!opts.deterministic || (runMode === 'study' || runMode === 'research');

    // In deterministic modes: AI disabled by default (for research fairness)
    // You can override by setting opts.forceEnable = true if you ever need it.
    const enabled = !!opts.forceEnable ? true : !deterministic;

    const seed = Number(opts.seed || 0) || 0;
    const rng = deterministic ? seededRng(seed || 12345) : Math.random;

    // Rate-limited tips
    const allowTip = makeRateLimiter(1800);

    // Rolling measures for heuristic predictions
    const rMiss3 = makeRolling(3);
    const rAcc3  = makeRolling(3);
    const rDens3 = makeRolling(3);
    const rShotM3= makeRolling(3);

    // event counters
    const cnt = {
      tStart: now(),
      judgeGood:0, judgeJunk:0, judgeExpire:0, judgeShotMiss:0,
      miniStart:0, miniEnd:0,
      tips:0
    };

    // last feature snapshot
    let lastFeat = null;
    let lastTipTag = '';
    let lastTipAt = 0;

    function onEvent(type, payload){
      if(!enabled) return;
      type = String(type||'').toLowerCase();
      payload = payload || {};

      if(type === 'judge'){
        const k = String(payload.kind||'').toLowerCase();
        if(k === 'good') cnt.judgeGood++;
        else if(k === 'junk') cnt.judgeJunk++;
        else if(k === 'expire_good') cnt.judgeExpire++;
        else if(k === 'shot_miss') cnt.judgeShotMiss++;
      }else if(type === 'features_1s'){
        lastFeat = payload;

        // Feed rolling windows if present
        if(payload.missDelta3s != null) rMiss3.push(payload.missDelta3s);
        if(payload.accAvg3s != null)  rAcc3.push(payload.accAvg3s);
        if(payload.targetDensityAvg3s != null) rDens3.push(payload.targetDensityAvg3s);
        if(payload.shotMissNow != null){
          // approximate delta using last 1s miss signals if available
          const sm = Number(payload.shotMissNow)||0;
          const prev = Number(rShotM3.last())||0;
          rShotM3.push(Math.max(0, sm - prev));
        }
      }else if(type === 'labels'){
        const t = String(payload.type||'').toLowerCase();
        if(t === 'mini_start') cnt.miniStart++;
        if(t === 'mini_end') cnt.miniEnd++;
      }
    }

    // heuristic prediction: "risk of miss spike soon"
    function getPrediction(feat){
      feat = feat || lastFeat;
      if(!enabled || !feat) return null;

      const acc = Number(feat.accAvg3s ?? feat.accNowPct ?? 0) || 0;
      const miss3 = Number(feat.missDelta3s ?? 0) || 0;
      const dens = Number(feat.targetDensityAvg3s ?? feat.targetDensity ?? 0) || 0;
      const imb  = Number(feat.groupImbalance01 ?? 0) || 0;
      const shotM = Number(feat.shotMissNow ?? 0) || 0;

      // risk factors (0..1)
      const fAcc = clamp((80 - acc)/25, 0, 1);
      const fMiss= clamp(miss3/3, 0, 1);
      const fDen = clamp(dens, 0, 1);
      const fImb = clamp(imb, 0, 1);
      const fShot= clamp(shotM/12, 0, 1);

      // weights differ by game
      let risk01 = 0.35*fAcc + 0.30*fMiss + 0.20*fDen + 0.10*fShot + 0.05*fImb;

      if(game === 'plate'){
        // plate: density + junk sensitivity higher
        risk01 = 0.32*fAcc + 0.28*fMiss + 0.26*fDen + 0.10*fShot + 0.04*fImb;
      }

      risk01 = clamp(risk01, 0, 1);

      const label = risk01 >= 0.70 ? 'high' : (risk01 >= 0.40 ? 'mid' : 'low');
      const explain = (label==='high')
        ? 'ความแม่นยำตก/พลาดถี่ + หน้าจอแน่น → เสี่ยง miss spike'
        : (label==='mid')
          ? 'เริ่มมีความหนาแน่น/พลาดเพิ่ม → คุมจังหวะ'
          : 'ทรงดี คุมได้';

      return { risk01: Math.round(risk01*1000)/1000, label, explain };
    }

    // difficulty signal: small nudges (engine decides whether to use)
    function getDifficultySignal(feat){
      feat = feat || lastFeat;
      if(!enabled || !feat) return null;

      const acc = Number(feat.accAvg3s ?? feat.accNowPct ?? 0) || 0;
      const miss3 = Number(feat.missDelta3s ?? 0) || 0;

      let spawnMult = 1.0;
      let junkBias = 0.0;   // + => more junk, - => less junk
      let speedBias = 0.0;  // + => faster movement/spawn, - => slower

      // For play mode only: gentle nudges
      if(acc >= 88 && miss3 <= 1){
        spawnMult = 1.08;
        speedBias = 0.08;
        junkBias = (game === 'plate') ? 0.02 : 0.04;
      }else if(acc <= 72 || miss3 >= 3){
        spawnMult = 0.92;
        speedBias = -0.08;
        junkBias = (game === 'plate') ? -0.06 : -0.04;
      }

      // adjust by diff
      if(diff === 'hard'){ spawnMult *= 1.04; speedBias += 0.03; }
      if(diff === 'easy'){ spawnMult *= 0.96; speedBias -= 0.03; }

      spawnMult = clamp(spawnMult, 0.80, 1.20);
      junkBias  = clamp(junkBias, -0.15, 0.15);
      speedBias = clamp(speedBias, -0.20, 0.20);

      const explain =
        spawnMult>1 ? 'เล่นดี → เพิ่มความท้าทายนิดหน่อย'
        : spawnMult<1 ? 'พลาดเยอะ/แม่นยำตก → ลดความเร็ว/ลดขยะ'
        : 'คงระดับ';

      return {
        spawnMult: Math.round(spawnMult*1000)/1000,
        junkBias: Math.round(junkBias*1000)/1000,
        speedBias: Math.round(speedBias*1000)/1000,
        explain
      };
    }

    function pickTip(feat){
      // Decide a tip tag based on state
      const pred = getPrediction(feat);
      const acc = Number(feat.accAvg3s ?? feat.accNowPct ?? 0) || 0;
      const miss3 = Number(feat.missDelta3s ?? 0) || 0;

      if(game === 'plate'){
        if(feat.bossActive) return 'boss';
        if(feat.stormActive) return 'storm';
        if(feat.groupImbalance01 != null && Number(feat.groupImbalance01) > 0.55) return 'all5';
        if(pred && pred.label === 'high') return 'steady';
        if(acc < 78) return 'acc';
        if(miss3 >= 2) return 'junk';
        if(Number(feat.comboMax||0) >= 10) return 'combo';
      }

      if(pred && pred.label === 'high') return 'steady';
      if(Number(feat.comboMax||0) >= 10) return 'combo';
      if(acc < 78) return 'focus';
      return 'steady';
    }

    function getTip(feat){
      feat = feat || lastFeat;
      if(!enabled || !feat) return null;

      const t = now();
      if(!allowTip()) return null;

      const tag = pickTip(feat);
      // avoid repeating same tag too often
      if(tag === lastTipTag && (t - lastTipAt) < 4500) return null;

      let pool = TIP_PACK[game] || TIP_PACK.generic;
      // add generic fallback
      const gen = TIP_PACK.generic;

      // find exact-tag first
      let tip = pool.find(x=>x.tag===tag) || gen.find(x=>x.tag===tag);

      // if none, random in pack
      if(!tip){
        const merged = pool.concat(gen);
        tip = pick(rng, merged);
      }

      // final guard
      if(!tip || !tip.msg) return null;

      lastTipTag = tip.tag || '';
      lastTipAt = t;
      cnt.tips++;

      return {
        msg: tip.msg,
        mood: tip.mood || 'neutral',
        ttlMs: 2200,
        tag: tip.tag || 'tip',
        explain: tip.explain || ''
      };
    }

    function reset(){
      rMiss3.arr().length = 0; // (no-op; we keep it simple)
      rAcc3.arr().length = 0;
      rDens3.arr().length = 0;
      rShotM3.arr().length = 0;
      lastFeat = null;
      lastTipTag = '';
      lastTipAt = 0;
      cnt.judgeGood=0; cnt.judgeJunk=0; cnt.judgeExpire=0; cnt.judgeShotMiss=0;
      cnt.miniStart=0; cnt.miniEnd=0; cnt.tips=0;
      cnt.tStart = now();
    }

    return {
      enabled,
      deterministic,
      onEvent,
      getTip,
      getPrediction,
      getDifficultySignal,
      reset
    };
  };

})();
