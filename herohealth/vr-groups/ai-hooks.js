/* === /herohealth/vr-groups/ai-hooks.js ===
GroupsVR AI Hooks — PRODUCTION (disabled by default)
✅ Attach point for:
  (1) AI Difficulty Director (bounded heuristic)  -> optional engine.setAIModifiers(...)
  (2) AI Coach micro-tips (explainable, rate-limited) -> emits hha:coach
  (3) AI Pattern Generator (seeded/deterministic) -> emits groups:ai_pattern (engine may consume later)
✅ HARD RULE:
  - OFF by default
  - OFF automatically in run=research OR run=practice
  - ON only when run=play AND ?ai=1 (or attach({enabled:true}))
✅ Deterministic: seeded PRNG from seed string (stable)
✅ Safe: no-crash if engine APIs not present
*/

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if (!WIN || !DOC) return;

  const NS = (WIN.GroupsVR = WIN.GroupsVR || {});
  if (NS.AIHooks && NS.AIHooks.__LOADED__) return;

  // ---------------- utils ----------------
  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
  const qbool = (k)=>{
    const v = String(qs(k,'')||'').toLowerCase();
    return (v==='1'||v==='true'||v==='yes'||v==='on');
  };
  const emit = (name, detail)=>{
    try{ WIN.dispatchEvent(new CustomEvent(name,{ detail })); }catch(_){}
  };

  // ---------------- deterministic PRNG ----------------
  // xmur3 + sfc32 (fast, deterministic)
  function xmur3(str){
    let h = 1779033703 ^ (str.length || 0);
    for (let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= (h >>> 16);
      return (h >>> 0);
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
  function makeRng(seedStr){
    const seed = String(seedStr ?? 'seed');
    const h = xmur3(seed);
    const a = h(), b = h(), c = h(), d = h();
    const rand = sfc32(a,b,c,d);
    rand.int = (n)=>Math.floor(rand() * (n||1));
    rand.pick = (arr)=>arr && arr.length ? arr[rand.int(arr.length)] : null;
    rand.range = (min,max)=>min + rand()*(max-min);
    return rand;
  }

  // ---------------- state ----------------
  const ST = {
    enabled: false,
    runMode: 'play', // play|research|practice
    seed: '',
    rng: null,

    // director
    lastDirectorAt: 0,
    directorEveryMs: 1100,
    lastMods: null,

    // coach
    lastTipAt: 0,
    tipEveryMs: 1700,
    lastPraiseAt: 0,
    praiseEveryMs: 6500,

    // pattern
    lastPatternAt: 0,
    patternEveryMs: 2000,
    phase: 'A',

    // metrics snapshot
    m: {
      acc: 0, miss: 0, combo: 0, left: 0,
      storm: 0, miniUrg: 0, groupKey: '', groupName: ''
    },

    // listeners
    onMetrics: null,
    onQuest: null,
    onProgress: null
  };

  function hardOffReason(runMode){
    const rm = String(runMode||'').toLowerCase();
    if (rm === 'research') return 'research';
    if (rm === 'practice') return 'practice';
    return '';
  }

  function resolveEnabled(input){
    // input.enabled can force on/off, but we still hard-off in research/practice
    const forced = !!(input && input.enabled);
    const rm = String(input && input.runMode ? input.runMode : qs('run','play')).toLowerCase();
    const hard = hardOffReason(rm);
    if (hard) return { enabled:false, hard };
    if (forced) return { enabled:true, hard:'' };

    // default gate by URL: ?ai=1 (play only)
    const on = qbool('ai');
    return { enabled:on, hard:'' };
  }

  function setCoach(text, mood='neutral'){
    emit('hha:coach', { text, mood });
  }

  function tip(text, mood='neutral'){
    if (!ST.enabled) return;
    const t = nowMs();
    if ((t - ST.lastTipAt) < ST.tipEveryMs) return;
    ST.lastTipAt = t;
    setCoach(text, mood);
  }

  // ---------------- (1) AI Difficulty Director ----------------
  // Bounded, explainable heuristic; safe defaults
  function directorStep(metrics){
    if (!ST.enabled) return;
    const t = nowMs();
    if (t - ST.lastDirectorAt < ST.directorEveryMs) return;
    ST.lastDirectorAt = t;

    const acc = Number(metrics.accuracyGoodPct ?? metrics.acc ?? 0) || 0;
    const miss = Number(metrics.misses ?? metrics.miss ?? 0) || 0;
    const combo = Number(metrics.combo ?? 0) || 0;
    const pressure = Number(metrics.pressureLevel ?? 0) || 0;

    // Base modifiers (1.0 means no change)
    let intervalMul = 1.0; // spawn interval multiplier
    let lifeMul     = 1.0; // safety buffer
    let sizeMul     = 1.0; // target size multiplier
    let wrongAdd    = 0.0; // add probability
    let junkAdd     = 0.0;

    // Fairness: ถ้าเด็กหลุด -> ช่วยนิด แต่ไม่ทำให้ “ง่ายเกิน”
    // Skilled -> ท้าทายนิด แต่ไม่ทำให้ “พัง”
    if (acc < 55 || miss >= 10 || pressure >= 2){
      intervalMul = 1.12;   // ช้าลง
      lifeMul     = 1.10;   // เผื่อพลาด
      sizeMul     = 1.08;   // เป้าใหญ่ขึ้นนิด
      wrongAdd    = -0.03;
      junkAdd     = -0.02;
    } else if (acc >= 82 && combo >= 8 && miss <= 6){
      intervalMul = 0.90;   // เร็วขึ้น
      lifeMul     = 0.94;
      sizeMul     = 0.94;
      wrongAdd    = 0.03;
      junkAdd     = 0.02;
    } else if (acc >= 72 && combo >= 6){
      intervalMul = 0.95;
      lifeMul     = 0.98;
      sizeMul     = 0.98;
      wrongAdd    = 0.01;
      junkAdd     = 0.01;
    }

    // Clamp safety
    intervalMul = clamp(intervalMul, 0.85, 1.20);
    lifeMul     = clamp(lifeMul,     0.90, 1.20);
    sizeMul     = clamp(sizeMul,     0.90, 1.15);
    wrongAdd    = clamp(wrongAdd,   -0.05, 0.05);
    junkAdd     = clamp(junkAdd,    -0.05, 0.05);

    const mods = { intervalMul, lifeMul, sizeMul, wrongAdd, junkAdd };

    // De-spam: apply only if meaningfully changed
    const prev = ST.lastMods;
    const changed = !prev ||
      Math.abs(prev.intervalMul - mods.intervalMul) > 0.009 ||
      Math.abs(prev.lifeMul     - mods.lifeMul)     > 0.009 ||
      Math.abs(prev.sizeMul     - mods.sizeMul)     > 0.009 ||
      Math.abs(prev.wrongAdd    - mods.wrongAdd)    > 0.004 ||
      Math.abs(prev.junkAdd     - mods.junkAdd)     > 0.004;

    if (!changed) return;
    ST.lastMods = mods;

    // Optional engine hook
    try{
      const E = NS.GameEngine;
      if (E && typeof E.setAIModifiers === 'function'){
        E.setAIModifiers(mods);
      }
    }catch(_){}

    emit('groups:ai_director', { mods, acc, miss, combo, pressure });

    // Explainable coach (rate-limited by tip())
    if (acc < 55 || miss >= 10){
      tip('AI ช่วยนิดนึง: ลอง “ช้าลงแล้วเล็งให้ตรงหมู่” ก่อนยิงนะ ✅', 'neutral');
    } else if (acc >= 82 && combo >= 8){
      tip('AI เพิ่มความท้าทาย: เก่งมาก! ต่อไปจะเร็วขึ้นนิดนะ 💪', 'happy');
    }
  }

  // ---------------- (2) AI Coach micro-tips ----------------
  function coachFromSnapshot(){
    if (!ST.enabled) return;
    const t = nowMs();

    const acc = ST.m.acc|0;
    const miss = ST.m.miss|0;
    const combo = ST.m.combo|0;
    const left  = ST.m.left|0;
    const storm = ST.m.storm ? 1 : 0;
    const miniU = ST.m.miniUrg ? 1 : 0;

    // Warnings (explainable)
    if (miniU){
      tip('MINI ใกล้หมด! เลือกยิงเป้าที่ “ชัวร์” ก่อน ⏱️', 'fever');
      return;
    }
    if (storm){
      tip('พายุมา! หยุดยิงมั่ว 1 วิ แล้วค่อยยิงใหม่ 🎯', 'fever');
      return;
    }
    if (miss >= 12 && acc < 60){
      tip('พลาดเยอะแล้ว! มองชื่อหมู่ให้ชัดก่อน แล้วค่อยยิง ✅', 'sad');
      return;
    }
    if (left <= 10 && acc >= 70){
      tip('เวลาใกล้หมด! เลือกยิงเป้าที่ง่ายสุดก่อน ⏳', 'fever');
      return;
    }

    // Praise (less frequent)
    if (combo >= 6 && (t - ST.lastPraiseAt) > ST.praiseEveryMs){
      ST.lastPraiseAt = t;
      tip('คอมโบสวยมาก! จังหวะนี้แหละ ✨', 'happy');
    }
  }

  // ---------------- (3) Pattern Generator (seeded) ----------------
  // NOTE: ยังไม่ไป “บังคับ engine” ตรง ๆ เพื่อคุมความเป็น research safe
  // ตอนนี้: สร้าง “ข้อเสนอแนะ” เป็นแพทเทิร์น deterministic แล้ว emit event ให้ engine/telemetry ใช้ได้
  function patternStep(){
    if (!ST.enabled) return;
    const t = nowMs();
    if (t - ST.lastPatternAt < ST.patternEveryMs) return;
    ST.lastPatternAt = t;

    // Phase logic: A -> B -> C (based on time left or performance)
    // (engine อาจเอาไปใช้ในอนาคต)
    let phase = ST.phase;

    if (ST.m.left <= 20) phase = 'C';
    else if (ST.m.combo >= 7 || ST.m.acc >= 78) phase = 'B';
    else phase = 'A';

    ST.phase = phase;

    // Deterministic “pattern suggestion”
    // - spawnBias: where to prefer spawn (top/mid/bot)
    // - stormHint: whether to trigger a short storm window suggestion
    // - bossHint: whether to schedule boss suggestion
    const rng = ST.rng || makeRng(ST.seed || 'seed');
    ST.rng = rng;

    const spawnBias = (phase==='A')
      ? rng.pick(['mid','mid','top','bot'])
      : (phase==='B')
        ? rng.pick(['top','mid','top','bot'])
        : rng.pick(['top','top','mid','bot']); // phase C: ท้าทายขึ้น (top bias)

    const stormHint = (phase!=='A') && (rng() < 0.22); // ไม่ถี่
    const bossHint  = (phase==='C') && (rng() < 0.18);

    const plan = {
      phase,
      spawnBias,
      stormHint,
      bossHint,
      seed: ST.seed,
      atMs: Date.now()
    };

    emit('groups:ai_pattern', plan);
  }

  // ---------------- event wiring ----------------
  function bind(){
    unbind();

    ST.onQuest = (ev)=>{
      const d = ev.detail || {};
      ST.m.groupKey  = String(d.groupKey || ST.m.groupKey || '');
      ST.m.groupName = String(d.groupName || ST.m.groupName || '');
      const mLeft = Number(d.miniTimeLeftSec || 0);
      ST.m.miniUrg = (mLeft > 0 && mLeft <= 3) ? 1 : 0;
    };

    ST.onProgress = (ev)=>{
      const d = ev.detail || {};
      const k = String(d.kind || '');
      if (k === 'storm_on')  ST.m.storm = 1;
      if (k === 'storm_off') ST.m.storm = 0;
    };

    ST.onMetrics = (ev)=>{
      const m = ev.detail || {};
      // snapshot
      ST.m.acc   = Number(m.accuracyGoodPct ?? m.acc ?? ST.m.acc) || 0;
      ST.m.miss  = Number(m.misses ?? m.miss ?? ST.m.miss) || 0;
      ST.m.combo = Number(m.combo ?? ST.m.combo) || 0;
      ST.m.left  = Number(m.leftSec ?? m.left ?? ST.m.left) || 0;

      // run director + coach + pattern
      directorStep(m);
      coachFromSnapshot();
      patternStep();
    };

    WIN.addEventListener('quest:update', ST.onQuest, { passive:true });
    WIN.addEventListener('groups:progress', ST.onProgress, { passive:true });
    WIN.addEventListener('groups:metrics', ST.onMetrics, { passive:true });
  }

  function unbind(){
    if (ST.onQuest) WIN.removeEventListener('quest:update', ST.onQuest);
    if (ST.onProgress) WIN.removeEventListener('groups:progress', ST.onProgress);
    if (ST.onMetrics) WIN.removeEventListener('groups:metrics', ST.onMetrics);
    ST.onQuest = ST.onProgress = ST.onMetrics = null;
  }

  function detach(){
    ST.enabled = false;
    ST.runMode = 'play';
    ST.seed = '';
    ST.rng = null;
    ST.lastMods = null;
    unbind();
  }

  function attach(input){
    const cfg = input || {};
    const runMode = String(cfg.runMode ?? qs('run','play')).toLowerCase();
    const seed = String(cfg.seed ?? qs('seed', String(Date.now())));

    const gate = resolveEnabled({ enabled: !!cfg.enabled, runMode });
    ST.runMode = runMode;
    ST.seed = seed;
    ST.rng = makeRng(seed);

    // Hard off in research/practice
    if (!gate.enabled){
      detach();
      emit('groups:ai_status', { on:false, reason: gate.hard || 'disabled', runMode, seed });
      return { on:false, reason: gate.hard || 'disabled' };
    }

    ST.enabled = true;
    bind();

    emit('groups:ai_status', { on:true, reason:'ok', runMode, seed });

    // Friendly announce (one-time)
    tip('🧠 AI Hooks ON: จะช่วยปรับความยาก + ให้ทิปสั้น ๆ แบบอธิบายได้ ✅', 'neutral');

    return { on:true, reason:'ok' };
  }

  // public API
  NS.AIHooks = {
    __LOADED__: true,
    attach,
    detach,
    isEnabled: ()=>!!ST.enabled,
    getState: ()=>({ enabled:ST.enabled, runMode:ST.runMode, seed:ST.seed, phase:ST.phase })
  };
})();