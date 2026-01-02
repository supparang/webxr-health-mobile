// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — Universal, OFF by default. Research OFF unless aiForce=1.

(function(ROOT){
  'use strict';

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function hash32(str){
    str = String(str||'');
    let h = 2166136261 >>> 0;
    for (let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h>>>0;
  }
  function mulberry32(seed){
    let a = (seed>>>0) || 0x12345678;
    return function(){
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createAIHooks(opts={}){
    const gameTag = String(opts.gameTag || 'HHA').trim();
    const runMode = String(opts.runMode || qs('run','play') || 'play').toLowerCase();
    const diff = String(opts.diff || qs('diff','normal') || 'normal').toLowerCase();

    const pid = String(opts.pid || qs('pid', qs('participant','')) || '');
    const protocol = String(opts.protocol || qs('protocol', qs('pid','')) || '');
    const conditionGroup = String(opts.conditionGroup || qs('cond', qs('conditionGroup','')) || '');

    const qAi = qs('ai','0');
    const aiForce = qs('aiForce','0') === '1';
    const enabled = !!opts.enabled || (qAi === '1');
    const safeEnabled = (runMode === 'research' && !aiForce) ? false : enabled;

    const aiMode = String(opts.aiMode || qs('aiMode','all') || 'all').toLowerCase();
    const modeOn = (m)=> (aiMode==='all' || aiMode===m);

    let seed = opts.seed;
    seed = (seed!=null) ? (Number(seed)>>>0) : hash32(`${pid}|${protocol}|${diff}|${conditionGroup}|${gameTag}`);
    const rnd = mulberry32(seed);

    const coach = { lastTipAt: 0, minGapMs: 4800, maxPerSession: 8, sent: 0 };

    const director = {
      spawnPpsMul: 1.0, junkRatioDelta: 0.0, missLimitDelta: 0,
      _emaRt: 0, _emaAcc: 0, _emaMissRate: 0
    };

    const pattern = { nextPlanAt: 0, planEveryMs: 1800, lastPlan: null };

    function emit(name, detail){
      try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
    }

    function makeTip(text, why, tag='TIP'){
      return { tag, text, why, seed, gameTag, diff };
    }

    function maybeCoachTip(state){
      if(!safeEnabled || !modeOn('coach')) return null;
      const now = performance.now();
      if(coach.sent >= coach.maxPerSession) return null;
      if(now - coach.lastTipAt < coach.minGapMs) return null;

      const rt = Number(state.avgRtGoodMs)||0;
      const fast = Number(state.fastHitRatePct)||0;
      const miss = Number(state.misses)||0;
      const combo = Number(state.comboMax)||0;

      let tip = null;

      if(miss >= 4 && rnd() < 0.75){
        tip = makeTip('ลอง “หยุด 0.3 วิ” ก่อนยิง เพื่อแยกของดี/ขยะให้ชัดขึ้น', 'พลาดหลายครั้ง → ลดการยิงรัวช่วยความแม่นยำ', 'COACH');
      } else if(rt >= 650 && rnd() < 0.70){
        tip = makeTip('ลอง “เล็งกลางจอ” แล้วให้เป้าเข้ามาหา (ไม่กวาดสายตากว้าง)', 'RT สูง → ลดระยะกวาดสายตาจะตอบสนองไวขึ้น', 'COACH');
      } else if(fast <= 35 && rnd() < 0.70){
        tip = makeTip('ภารกิจ “ยิงให้ไว” ให้โฟกัสเป้าที่อยู่ใกล้จุดเล็งก่อน', 'อัตรายิงไวต่ำ → เลือกเป้าใกล้ crosshair', 'COACH');
      } else if(combo >= 10 && rnd() < 0.55){
        tip = makeTip('คอมโบดีมาก! ตอนนี้ “เน้นไม่โดนขยะ” เพื่อรักษาคะแนน', 'คอมโบสูง → เล่นนิ่ง ๆ จะเสถียรขึ้น', 'COACH');
      } else {
        if(rnd() < 0.18) tip = makeTip('ดีมาก! ลองรักษาจังหวะเดิมอีกนิด 💪', 'จังหวะคงที่ช่วยความแม่นยำ', 'COACH');
      }

      if(tip){
        coach.lastTipAt = now;
        coach.sent++;
        emit('hha:ai:hint', { ...tip });
      }
      return tip;
    }

    function updateDirector(state){
      if(!safeEnabled || !modeOn('director')) return null;

      const rt = clamp(Number(state.avgRtGoodMs)||0, 0, 2000);
      const acc = clamp(Number(state.accuracyGoodPct)||0, 0, 100);
      const miss = clamp(Number(state.misses)||0, 0, 999);
      const timeLeft = clamp(Number(state.timeLeftSec)||0, 0, 999);

      director._emaRt = director._emaRt ? (director._emaRt*0.88 + rt*0.12) : rt;
      director._emaAcc = director._emaAcc ? (director._emaAcc*0.88 + acc*0.12) : acc;

      let spawnMul = 1.0, junkDelta = 0.0, missDelta = 0;

      if(director._emaAcc < 62 || director._emaRt > 720){
        spawnMul *= 0.92;
        junkDelta -= 0.04;
        missDelta += 1;
      }
      if(director._emaAcc > 85 && director._emaRt < 520 && miss < 3){
        spawnMul *= 1.06;
        junkDelta += 0.03;
      }
      if(timeLeft <= 12) spawnMul *= 1.04;

      director.spawnPpsMul = clamp(spawnMul, 0.85, 1.15);
      director.junkRatioDelta = clamp(junkDelta, -0.07, 0.07);
      director.missLimitDelta = clamp(missDelta, 0, 2);

      const rec = {
        spawnPpsMul: director.spawnPpsMul,
        junkRatioDelta: director.junkRatioDelta,
        missLimitDelta: director.missLimitDelta,
        emaRtMs: Math.round(director._emaRt),
        emaAccPct: Number(director._emaAcc.toFixed(2)),
        seed, gameTag, diff
      };
      emit('hha:ai:director', rec);
      return rec;
    }

    function patternPlan(state){
      if(!safeEnabled || !modeOn('pattern')) return null;
      const now = performance.now();
      if(now < pattern.nextPlanAt) return null;
      pattern.nextPlanAt = now + pattern.planEveryMs;

      const fever = clamp(Number(state.fever||0), 0, 100);
      const mode = (rnd() < 0.55) ? 'spread' : 'cluster';
      const intensity = clamp(0.6 + (fever/100)*0.6, 0.6, 1.2);
      const plan = { mode, intensity: Number(intensity.toFixed(2)), seed, gameTag, diff };
      pattern.lastPlan = plan;
      emit('hha:ai:pattern', plan);
      return plan;
    }

    return {
      enabled: safeEnabled,
      seed, runMode, diff, gameTag,
      update(state){
        if(!safeEnabled) return { enabled:false };
        maybeCoachTip(state);
        const d = updateDirector(state);
        const p = patternPlan(state);
        const out = { enabled:true, director:d||null, pattern:p||null };
        emit('hha:ai:state', out);
        return out;
      }
    };
  }

  ROOT.HHA_AI = ROOT.HHA_AI || {};
  ROOT.HHA_AI.createAIHooks = createAIHooks;

})(window);