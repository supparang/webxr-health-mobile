/* === /herohealth/vr-groups/ai-hooks.js ===
GroupsVR AI Hooks (DISABLED BY DEFAULT)
✅ จุดเสียบ 3 AI features (ยังไม่เปิดใช้):
  (1) AI Difficulty Director (personalized + fair)   -> suggest spawn/ttl/bias
  (2) AI Coach micro-tips (explainable + rate-limit) -> emit hha:coach
  (3) AI Pattern Generator (seeded)                  -> suggest storm/boss patterns
✅ Collect signals from:
  - groups:progress, hha:score, hha:rank, hha:fever, quest:update
Expose: window.GroupsVR.AIHooks.init({enabled, runMode, seed, diff, style})
Note: enabled=false by default; research forces off
*/

(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});
  const emit = (name, detail)=>{ try{ root.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch{} };

  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }

  // seeded rng (for future pattern generator)
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
    const gen = xmur3(seed);
    return sfc32(gen(), gen(), gen(), gen());
  }

  const AI = {
    enabled:false,
    runMode:'play',
    seed:'seed',
    diff:'normal',
    style:'mix',
    rng: Math.random,

    // signals
    acc:0,
    combo:0,
    misses:0,
    fever:0,
    shield:0,
    lastTipAt:0,
    tipCooldownMs: 4500,

    // future knobs (difficulty director)
    suggest: {
      spawnMs: null,
      ttlMs: null,
      junkBias: null,
      decoyBias: null,
      bossEvery: null,
      stormPattern: null
    },

    _bound:false
  };

  function shouldRun(){
    // research mode -> hard off
    if (AI.runMode === 'research') return false;
    return !!AI.enabled;
  }

  function maybeCoachTip(text, mood){
    if (!shouldRun()) return;
    const t = Date.now();
    if (t - AI.lastTipAt < AI.tipCooldownMs) return;
    AI.lastTipAt = t;
    emit('hha:coach', { text:String(text||''), mood: mood||'neutral' });
  }

  // ---- PLACEHOLDER AI LOGIC (OFF) ----
  function onRank(ev){
    const d = ev.detail||{};
    AI.acc = clamp(d.accuracy ?? 0, 0, 100);
    if (!shouldRun()) return;

    // Example tip (explainable) — disabled unless enabled=true
    if (AI.acc < 65){
      maybeCoachTip('ลองช้าลงนิด! เล็งกลางจอแล้วค่อยแตะ ยิงให้ “ถูกหมู่” ก่อนนะ', 'sad');
    }else if (AI.acc >= 90){
      maybeCoachTip('โหดมาก! รักษาคอมโบแล้วจะได้ OVERDRIVE บ่อยขึ้น 🔥', 'happy');
    }
  }

  function onScore(ev){
    const d = ev.detail||{};
    AI.combo = Number(d.combo||0);
    AI.misses = Number(d.misses||0);
    if (!shouldRun()) return;

    // Difficulty Director (placeholder)
    // -> สามารถคำนวณแล้ว emit กลับไปให้ engine รับ (ยังไม่เปิด)
    // emit('groups:ai_suggest', { spawnMs:..., ttlMs:..., junkBias:... });
  }

  function onFever(ev){
    const d = ev.detail||{};
    AI.fever = Number(d.feverPct||0);
    AI.shield = Number(d.shield||0);
    if (!shouldRun()) return;

    if (AI.fever >= 70){
      maybeCoachTip('ระวัง! Fever สูงแล้ว ขยะจะกดดันขึ้น — เน้นยิงถูกหมู่ให้ต่อเนื่อง', 'fever');
    }
  }

  function onProgress(ev){
    if (!shouldRun()) return;
    const d = ev.detail||{};
    const kind = String(d.kind||'');
    // Pattern Generator placeholder:
    // - stormPattern suggestions seeded by AI.rng
    // - bossPhase pacing suggestions
    // emit('groups:ai_pattern', { stormPattern:'wave'|'spiral'|'burst' });
    if (kind === 'storm_on'){
      // example tip
      maybeCoachTip('STORM มาแล้ว! ยิงให้ไวแต่ห้ามพลาดนะ ⚡', 'neutral');
    }
  }

  function onQuest(ev){
    if (!shouldRun()) return;
    const d = ev.detail||{};
    const left = Number(d.miniTimeLeftSec||0);
    if (left > 0 && left <= 3){
      maybeCoachTip('ใกล้หมดเวลา! เร่งอีกนิด!', 'neutral');
    }
  }

  function bindOnce(){
    if (AI._bound) return;
    AI._bound = true;

    root.addEventListener('hha:rank', onRank, {passive:true});
    root.addEventListener('hha:score', onScore, {passive:true});
    root.addEventListener('hha:fever', onFever, {passive:true});
    root.addEventListener('groups:progress', onProgress, {passive:true});
    root.addEventListener('quest:update', onQuest, {passive:true});
  }

  function init(cfg){
    cfg = cfg || {};
    AI.runMode = (String(cfg.runMode||'play').toLowerCase()==='research') ? 'research' : 'play';
    AI.diff = String(cfg.diff||'normal').toLowerCase();
    AI.style = String(cfg.style||'mix').toLowerCase();
    AI.seed = String(cfg.seed || 'seed');

    // research forces off
    const want = !!cfg.enabled;
    AI.enabled = (AI.runMode === 'research') ? false : want;

    AI.rng = makeRng(AI.seed + '::ai');
    AI.lastTipAt = 0;

    bindOnce();

    // emit status for debug if needed
    emit('groups:ai_status', { enabled: AI.enabled, runMode: AI.runMode });
  }

  NS.AIHooks = { init };

})(typeof window !== 'undefined' ? window : globalThis);