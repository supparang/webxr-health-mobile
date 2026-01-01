/* === /herohealth/vr-groups/ai-hooks.js ===
GroupsVR AI Hooks (OFF by default)
✅ Difficulty Director (suggest only)
✅ AI Coach micro-tips (explainable + rate-limit)
✅ Pattern Generator (seeded suggestion)
IMPORTANT:
- Default enabled = false
- Always disabled in research (determinism)
Expose: window.GroupsVR.AIHooks
*/

(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});
  const emit = (name, detail)=>{ try{ root.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch{} };

  // --- tiny seeded rng (deterministic suggestions when enabled) ---
  function xmur3(str){
    str = String(str||'seed');
    let h = 1779033703 ^ str.length;
    for (let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= (h >>> 16);
      return h >>> 0;
    };
  }
  function sfc32(a,b,c,d){
    return function(){
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  function makeRng(seed){
    const g = xmur3(seed);
    return sfc32(g(), g(), g(), g());
  }

  function now(){ return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }
  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }

  const AI = {
    enabled:false,
    seed:'seed',
    rng:Math.random,

    // player model (very lightweight; replace later)
    skill:0.5,        // 0..1
    stability:0.5,    // 0..1 (low = shaky)
    lastTipAt:0,

    // director suggestions (read-only from engine side)
    suggest:{
      spawnMul:1.0,
      ttlMul:1.0,
      junkDelta:0.0,
      decoyDelta:0.0,
      aimLockPx: null,     // optional
      stormPattern:null,   // optional
      note:''
    }
  };

  function init(opts){
    opts = opts || {};
    AI.seed = String(opts.seed || AI.seed || 'seed');
    AI.rng = makeRng(AI.seed + '::ai');

    const runMode = String(opts.runMode||'play').toLowerCase();
    const flag = String(opts.ai||'0');

    // default OFF, and forced OFF in research
    AI.enabled = (runMode === 'play') && (flag === '1' || flag === 'true');

    // reset model
    AI.skill = 0.5;
    AI.stability = 0.5;
    AI.lastTipAt = 0;

    AI.suggest.spawnMul = 1.0;
    AI.suggest.ttlMul = 1.0;
    AI.suggest.junkDelta = 0.0;
    AI.suggest.decoyDelta = 0.0;
    AI.suggest.aimLockPx = null;
    AI.suggest.stormPattern = null;
    AI.suggest.note = '';

    return AI.enabled;
  }

  // Explainable micro-tips (rate limit)
  function coachTip(text, mood){
    if (!AI.enabled) return;
    const t = now();
    if (t - AI.lastTipAt < 3200) return;
    AI.lastTipAt = t;
    emit('hha:coach', { text: String(text||''), mood: mood||'neutral' });
  }

  // Simple director: update player model from events
  // Engine should call: onEvent('hit',{correct, rtMs, kind:'good|bad|boss', combo, fever, left})
  function onEvent(type, data){
    if (!AI.enabled) return;
    data = data || {};

    if (type === 'hit'){
      const correct = !!data.correct;
      const rt = clamp(data.rtMs || 0, 0, 5000);
      const fever = clamp(data.fever || 0, 0, 100);
      const combo = clamp(data.combo || 0, 0, 9999);

      // update skill (EMA)
      const rtScore = rt ? clamp(1.0 - (rt/900), 0, 1) : 0.5;
      const hitScore = correct ? 1.0 : 0.0;
      const comboScore = clamp(combo/18, 0, 1);

      const perf = clamp((rtScore*0.35 + hitScore*0.45 + comboScore*0.20), 0, 1);
      AI.skill = clamp(AI.skill*0.86 + perf*0.14, 0, 1);

      // stability: penalize fever spikes / misses
      const stab = clamp(1.0 - (fever/120), 0, 1);
      AI.stability = clamp(AI.stability*0.88 + stab*0.12, 0, 1);

      // suggestions (gentle + fair)
      const hard = clamp(AI.skill - 0.5, -0.5, 0.5); // -0.5..0.5
      AI.suggest.spawnMul = clamp(1.0 - hard*0.18, 0.82, 1.15);
      AI.suggest.ttlMul   = clamp(1.0 + (0.5 - AI.skill)*0.16, 0.85, 1.22);

      // keep junk/decoy fair: only tiny drift
      AI.suggest.junkDelta  = clamp((AI.skill-0.55)*0.03, -0.02, 0.03);
      AI.suggest.decoyDelta = clamp((AI.skill-0.55)*0.025, -0.02, 0.03);

      // optional aim assist lock px: less skill => wider lock
      AI.suggest.aimLockPx = Math.round(clamp(110 + (0.55-AI.skill)*70, 70, 155));

      AI.suggest.note = `skill=${AI.skill.toFixed(2)} stable=${AI.stability.toFixed(2)}`;

      // micro tips (explainable)
      if (!correct && fever >= 70){
        coachTip('ใจเย็น ๆ นะ! เล็งกลางจอ แล้วแตะยิงแบบจังหวะสม่ำเสมอ 🧘', 'sad');
      }else if (correct && combo >= 12){
        coachTip('โหดมาก! รักษาคอมโบไว้ แล้วสลับหมู่ให้ “Perfect” 🔥', 'happy');
      }else if (!correct && rt >= 800){
        coachTip('ลอง “มองหาเป้าที่ถูกหมู่” ก่อนแตะยิง จะเร็วขึ้นนะ 👀', 'neutral');
      }
    }

    if (type === 'storm'){
      // pattern suggestion (seeded)
      if (AI.rng() < 0.50) AI.suggest.stormPattern = 'wave';
      else if (AI.rng() < 0.80) AI.suggest.stormPattern = 'burst';
      else AI.suggest.stormPattern = 'spiral';
    }
  }

  // Engine may query this each tick
  function getSuggest(){
    return Object.assign({}, AI.suggest);
  }

  NS.AIHooks = { init, onEvent, getSuggest, _state: AI };

})(typeof window !== 'undefined' ? window : globalThis);