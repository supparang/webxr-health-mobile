/* === /herohealth/vr-groups/ai-hooks.js ===
GroupsVR AI Hooks — PACK 15 (disabled by default)
✅ attach({runMode, seed, enabled})
✅ No effect in research (forced OFF)
✅ Provides stable seeded RNG for pattern hooks
✅ Emits hha:ai events (for logging/analysis)
*/

(function(root){
  'use strict';
  const DOC = root.document;
  const NS = root.GroupsVR = root.GroupsVR || {};
  const AI = NS.AIHooks = NS.AIHooks || {};

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function now(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }

  function hashSeed(str){
    str = String(str ?? '');
    let h = 2166136261 >>> 0;
    for (let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h>>>0;
  }
  function makeRng(seedU32){
    let s = (seedU32>>>0) || 1;
    return function(){
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){}
  }

  let _enabled = false;
  let _runMode = 'play';
  let _seed = '0';
  let _rng = null;

  // internal state from game
  const S = {
    score:0, combo:0, misses:0,
    acc:0, grade:'C',
    lastCoachAt:0,
  };

  // ---- Hooks: Difficulty Director (fair + gentle) ----
  // We don't reach into engine internals here (to keep SAFE),
  // but we can emit suggestions that engine *may* adopt later.
  function difficultyDirectorTick(){
    if (!_enabled) return;

    // A simple “suggestion” based on observed stats
    const combo = S.combo|0;
    const misses = S.misses|0;
    const acc = S.acc|0;

    let spawnMul = 1.0;
    let wrongBias = 0.0;
    let junkBias = 0.0;

    if (acc >= 88) spawnMul *= 0.92;
    if (combo >= 10) spawnMul *= 0.90;
    if (misses >= 8) { spawnMul *= 1.10; wrongBias -= 0.04; junkBias -= 0.03; }

    // keep bounded
    spawnMul = clamp(spawnMul, 0.80, 1.18);
    wrongBias = clamp(wrongBias, -0.08, 0.10);
    junkBias  = clamp(junkBias,  -0.08, 0.10);

    emit('hha:ai', {
      kind:'difficulty_suggest',
      spawnMul, wrongBias, junkBias,
      combo, misses, acc,
      ts: Date.now()
    });
  }

  // ---- Hooks: AI Coach micro-tips (rate-limited) ----
  function coachTip(text, mood='neutral', minGapMs=2200){
    const t = now();
    if (t - S.lastCoachAt < minGapMs) return;
    S.lastCoachAt = t;
    emit('hha:coach', { text, mood });
    emit('hha:ai', { kind:'coach_tip', text, mood, ts: Date.now() });
  }

  function maybeCoach(){
    if (!_enabled) return;
    if (S.combo === 0 && S.misses > 0 && (S.misses % 4 === 0)){
      coachTip('ทริค: รอให้ “หมู่” ชัดก่อนค่อยยิง จะลดพลาดได้มาก 👀', 'neutral');
    }
    if (S.combo === 6){
      coachTip('คอมโบมาแล้ว! รักษาจังหวะ อย่ายิงรัวมั่ว 🔥', 'happy');
    }
    if (S.acc >= 90 && (S.combo >= 8)){
      coachTip('โหดมาก! ลองเล็ง “ใกล้กึ่งกลางจอ” จะคุมคอมโบง่ายขึ้น 🎯', 'happy');
    }
  }

  // ---- Hooks: Pattern Generator (seeded) ----
  // For now we only emit a pattern token; engine may adopt later.
  function patternPulse(){
    if (!_enabled) return;
    const r = _rng ? _rng() : Math.random();
    const token = (r < 0.33) ? 'spread' : (r < 0.66 ? 'ring' : 'lane');
    emit('hha:ai', { kind:'pattern_token', token, ts: Date.now() });
  }

  // ---- Event listeners from game ----
  function bind(){
    root.addEventListener('hha:score', (ev)=>{
      const d = ev.detail||{};
      S.score = Number(d.score||0);
      S.combo = Number(d.combo||0);
      S.misses= Number(d.misses||0);
      maybeCoach();
      difficultyDirectorTick();
    }, {passive:true});

    root.addEventListener('hha:rank', (ev)=>{
      const d = ev.detail||{};
      S.acc = Number(d.accuracy||0);
      S.grade = String(d.grade||'C');
    }, {passive:true});

    root.addEventListener('groups:progress', (ev)=>{
      const k = String((ev.detail||{}).kind||'');
      if (k === 'storm_on' || k === 'boss_spawn'){
        // nudge pattern emission at “phase changes”
        patternPulse();
      }
    }, {passive:true});
  }

  let _bound = false;

  AI.attach = function(opts){
    opts = opts || {};
    _runMode = (String(opts.runMode||'play').toLowerCase()==='research') ? 'research' : 'play';
    _seed = String(opts.seed ?? '0');

    // ✅ hard rule: research OFF
    _enabled = !!opts.enabled && (_runMode !== 'research');

    _rng = makeRng(hashSeed(_seed + '::aihooks'));

    if (!_bound){
      _bound = true;
      bind();
    }

    emit('hha:ai', {
      kind:'attach',
      enabled:_enabled,
      runMode:_runMode,
      seed:_seed,
      ts: Date.now()
    });
  };

  AI.isEnabled = ()=>_enabled;

})(typeof window !== 'undefined' ? window : globalThis);