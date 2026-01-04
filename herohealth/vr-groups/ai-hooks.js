/* === /herohealth/vr-groups/ai-hooks.js ===
Pack15: AI Hooks (disabled by default; enable with ?ai=1 in play)
Goals:
  (1) AI Difficulty Director (fair/adaptive) -> emits hha:adaptive suggestions (engine may ignore)
  (2) AI Coach micro-tips (explainable, rate-limited) -> emits hha:coach
  (3) AI Pattern Generator hooks (seeded) -> placeholder events for future storm/boss/pattern
Deterministic: seed-based RNG. Research mode: always disabled.
API:
  window.GroupsVR.AIHooks.attach({runMode, seed, enabled})
  window.GroupsVR.AIHooks.detach()
  window.GroupsVR.AIHooks.getSnapshot()
*/

(function (root) {
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};

  function nowMs(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }
  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }

  function hashSeed(str) {
    str = String(str ?? '');
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function makeRng(seedU32) {
    let s = (seedU32 >>> 0) || 1;
    return function rand() {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  const S = {
    on: false,
    enabled: false,
    runMode: 'play',
    seed: '',
    rng: null,

    // live stats
    score: 0,
    combo: 0,
    misses: 0,
    acc: 0,
    grade: 'C',

    // timing
    lastTipAt: 0,
    lastDirectorAt: 0,

    // traces
    lastAdaptive: null,
    lastTip: null,
  };

  function explainableTip(){
    // deterministic but context-aware
    const acc = S.acc|0;
    const combo = S.combo|0;
    const misses = S.misses|0;

    // pick bucket
    let bucket = 'steady';
    if (acc < 60) bucket = 'aim';
    else if (misses >= 8) bucket = 'calm';
    else if (combo >= 8) bucket = 'combo';
    else if (acc >= 85) bucket = 'push';

    const tips = {
      aim: [
        'ทิป: เล็งให้ “หยุดนิ่ง” ครึ่งวินาทีก่อนยิง จะตรงขึ้นมาก 🎯',
        'ทิป: ถ้าพลาดบ่อย ลองยิงเฉพาะ “ใกล้กลางจอ” ก่อน แล้วค่อยกวาดออกข้าง',
        'ทิป: เจอขยะเยอะ ให้ “รอเป้าถูกหมู่” โผล่แล้วค่อยยิง ไม่ต้องรีบ'
      ],
      calm: [
        'ทิป: พลาดเริ่มเยอะแล้ว—ชะลอ 10% แล้วคุมความแม่นก่อน 🔥',
        'ทิป: ถ้าเสียจังหวะ ให้รีเซ็ตคอมโบด้วย “ยิงชัวร์” 2 ครั้งติดก่อน',
        'ทิป: โหมดพายุ/บอส อย่าลากสายตาไกล—คุมวงกลาง'
      ],
      combo: [
        'ทิป: คอมโบมาแล้ว! โฟกัสเป้า “ถูกหมู่เท่านั้น” แล้วแต้มจะพุ่ง 🚀',
        'ทิป: รักษาคอมโบด้วยการยิงเป้าที่อายุยังเยอะก่อน (ไม่โลภตัวไกล)',
        'ทิป: พอคอมโบสูง ให้เลือกเป้าขนาดใหญ่/ใกล้ก่อนเพื่อความชัวร์'
      ],
      push: [
        'ทิป: แม่นมาก! ลองเพิ่มจังหวะยิงให้ถี่ขึ้นอีกนิด 🏎️',
        'ทิป: ตอนนี้คุมเกมได้—เก็บบอสให้ไวเพื่อโบนัสหนัก ๆ 💥',
        'ทิป: ดีมาก! ถ้าอยาก S/SS ให้ลด MISS โดยไม่ยิงมั่ว'
      ],
      steady: [
        'ทิป: คุมจังหวะ “มอง-เล็ง-ยิง” เป็นลูป จะนิ่งและแม่นขึ้น',
        'ทิป: ถ้ารู้สึกเอียง ให้กด RECENTER แล้วค่อยลุยต่อ',
        'ทิป: ระวังขยะ—ถ้าไม่แน่ใจ “ไม่ยิงดีกว่า”'
      ]
    };

    const arr = tips[bucket] || tips.steady;
    const idx = Math.floor((S.rng ? S.rng() : Math.random()) * arr.length);
    return arr[idx];
  }

  // (1) Difficulty Director: propose spawn multiplier (engine may ignore)
  function directorStep(){
    const t = nowMs();
    if (t - S.lastDirectorAt < 1800) return; // rate-limit
    S.lastDirectorAt = t;

    // fairness logic: do not punish low performers too hard
    let spawnMul = 1.0;
    let reason = 'steady';

    if (S.runMode !== 'play') return;

    if (S.acc >= 88 && S.combo >= 8) { spawnMul = 0.90; reason = 'player_strong'; }
    else if (S.acc >= 82 && S.combo >= 6) { spawnMul = 0.94; reason = 'player_good'; }
    else if (S.acc < 60 || S.misses >= 10) { spawnMul = 1.10; reason = 'needs_help'; }
    else if (S.misses >= 7) { spawnMul = 1.06; reason = 'stabilize'; }

    // clamp fairness
    spawnMul = clamp(spawnMul, 0.88, 1.14);

    S.lastAdaptive = { spawnMul, reason, ts: Date.now() };
    emit('hha:adaptive', S.lastAdaptive);
    emit('hha:ai', { kind:'director', ...S.lastAdaptive });
  }

  // (2) AI Coach micro-tips
  function maybeTip(){
    const t = nowMs();
    if (t - S.lastTipAt < 6500) return; // rate-limit tips
    if (S.runMode !== 'play') return;
    if (!S.enabled) return;

    // only tip when meaningful
    const gate = (S.combo === 0 && S.misses >= 3) || (S.combo >= 7) || (S.acc < 65) || (S.acc >= 85);
    if (!gate) return;

    const text = explainableTip();
    S.lastTipAt = t;
    S.lastTip = { text, ts: Date.now() };

    emit('hha:coach', { text, mood: (S.acc >= 85 ? 'happy' : (S.acc < 60 ? 'sad' : 'neutral')) });
    emit('hha:ai', { kind:'coach', tip:text, ts: Date.now() });
  }

  // (3) Pattern Generator hooks (placeholder)
  function patternHook(evName, detail){
    if (!S.enabled) return;
    // deterministic token for future patterns
    const token = Math.floor((S.rng ? S.rng() : Math.random()) * 1e9);
    emit('hha:ai', { kind:'pattern', event: evName, token, ts: Date.now(), detail: detail || null });
  }

  function onScore(ev){
    const d = ev.detail || {};
    S.score = Number(d.score ?? S.score) || 0;
    S.combo = Number(d.combo ?? S.combo) || 0;
    S.misses = Number(d.misses ?? S.misses) || 0;
    directorStep();
    maybeTip();
  }
  function onRank(ev){
    const d = ev.detail || {};
    S.grade = String(d.grade ?? S.grade);
    S.acc = Number(d.accuracy ?? S.acc) || 0;
    directorStep();
    maybeTip();
  }
  function onProgress(ev){
    const k = String((ev.detail||{}).kind||'');
    if (!k) return;
    if (k === 'storm_on' || k === 'boss_spawn' || k === 'boss_down') {
      patternHook('groups:progress', { kind:k });
    }
  }

  function attach({ runMode, seed, enabled } = {}){
    const rm = (String(runMode||'play').toLowerCase()==='research') ? 'research' : 'play';
    if (rm === 'research') {
      // hard-disable in research
      detach();
      S.on = true;
      S.enabled = false;
      S.runMode = 'research';
      S.seed = String(seed||'');
      S.rng = makeRng(hashSeed(S.seed + '::aihooks'));
      emit('hha:ai', { kind:'attach', enabled:false, runMode:'research' });
      return;
    }

    S.on = true;
    S.enabled = !!enabled;
    S.runMode = 'play';
    S.seed = String(seed||Date.now());
    S.rng = makeRng(hashSeed(S.seed + '::aihooks'));

    // reset timing
    S.lastTipAt = 0;
    S.lastDirectorAt = 0;

    root.addEventListener('hha:score', onScore, { passive:true });
    root.addEventListener('hha:rank', onRank, { passive:true });
    root.addEventListener('groups:progress', onProgress, { passive:true });

    emit('hha:ai', { kind:'attach', enabled:S.enabled, runMode:S.runMode, seed:S.seed });
  }

  function detach(){
    try{ root.removeEventListener('hha:score', onScore); }catch(_){}
    try{ root.removeEventListener('hha:rank', onRank); }catch(_){}
    try{ root.removeEventListener('groups:progress', onProgress); }catch(_){}

    S.on = false;
    S.enabled = false;
    emit('hha:ai', { kind:'detach', ts: Date.now() });
  }

  function getSnapshot(){
    return {
      on: S.on,
      enabled: S.enabled,
      runMode: S.runMode,
      seed: S.seed,
      score: S.score,
      combo: S.combo,
      misses: S.misses,
      acc: S.acc,
      grade: S.grade,
      lastAdaptive: S.lastAdaptive,
      lastTip: S.lastTip
    };
  }

  NS.AIHooks = { attach, detach, getSnapshot };

})(typeof window !== 'undefined' ? window : globalThis);