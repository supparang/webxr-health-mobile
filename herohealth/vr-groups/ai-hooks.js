// === /herohealth/vr-groups/ai-hooks.js ===
// PACK 15: AI Hooks Module (disabled by default; research-safe)
// - attach({runMode, seed, enabled})
// - Director (difficulty suggestions), Coach micro-tips, Pattern generator hooks (seeded)
// Emits: hha:ai, hha:coach (micro tips), groups:ai (internal)

(function(){
  'use strict';
  const WIN = window;
  const NS = WIN.GroupsVR = WIN.GroupsVR || {};

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  // deterministic rng (same as engine style)
  function hashSeed(str){
    str = String(str ?? '');
    let h = 2166136261 >>> 0;
    for (let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function makeRng(seedU32){
    let s = (seedU32>>>0) || 1;
    return function(){
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){}
  }

  // ----------------- AI Coach (micro tips) -----------------
  function createCoach(){
    let lastAt = 0;
    let lastKey = '';
    const minGapMs = 3200;

    function say(text, mood='neutral', key=''){
      const t = Date.now();
      if (t - lastAt < minGapMs) return false;
      if (key && key === lastKey) return false;
      lastAt = t; lastKey = key || '';

      emit('hha:coach', { text, mood });
      emit('hha:ai', { kind:'coach', text, mood, key, ts:t });
      return true;
    }

    return { say };
  }

  // ----------------- Difficulty Director (suggestions) -----------------
  // We only compute suggestions. Engine can optionally consume later via setAIMod().
  function createDirector(rng){
    let windowN = 0;
    let goodN = 0;
    let missN = 0;
    let lastPushAt = 0;

    function feedJudge(kind){
      windowN++;
      if (kind==='good' || kind==='boss') goodN++;
      if (kind==='bad' || kind==='miss') missN++;
      if (windowN >= 18) evaluate();
    }

    function evaluate(){
      const t = Date.now();
      const acc = (windowN>0) ? (goodN/windowN) : 0;
      const pressure = clamp(missN/Math.max(1,windowN), 0, 1);

      // reset window
      windowN = 0; goodN = 0; missN = 0;

      if (t - lastPushAt < 3800) return;

      // compute a small mod suggestion (multiplicative)
      // fair: if acc high and pressure low -> slightly harder; if pressure high -> ease.
      let spawnMul = 1.0;
      let junkMul  = 1.0;
      let wrongMul = 1.0;

      if (acc >= 0.86 && pressure <= 0.18){
        spawnMul *= 0.94;  // faster spawn (harder)
        junkMul  *= 1.05;
        wrongMul *= 1.05;
      } else if (pressure >= 0.32){
        spawnMul *= 1.06;  // slower spawn (easier)
        junkMul  *= 0.92;
        wrongMul *= 0.92;
      } else if (acc <= 0.62){
        spawnMul *= 1.08;
        junkMul  *= 0.90;
        wrongMul *= 0.90;
      }

      // tiny randomness but deterministic
      const wobble = (rng()*0.02) - 0.01; // [-0.01..+0.01]
      spawnMul *= (1.0 + wobble);

      lastPushAt = t;
      const sug = {
        kind:'director',
        spawnMul: Number(spawnMul.toFixed(3)),
        junkMul:  Number(junkMul.toFixed(3)),
        wrongMul: Number(wrongMul.toFixed(3)),
        ts: t
      };

      emit('hha:ai', sug);
      emit('groups:ai', sug);
    }

    return { feedJudge };
  }

  // ----------------- Pattern Generator (seeded templates) -----------------
  // This is a hook container; actual spawn patterns can be plugged later.
  function createPattern(rng){
    function pickStormFlavor(){
      const flavors = ['tight','wide','zigzag','burst'];
      return flavors[(rng()*flavors.length)|0];
    }
    function pickBossFlavor(){
      const flavors = ['steady','rage','fakeout'];
      return flavors[(rng()*flavors.length)|0];
    }
    return { pickStormFlavor, pickBossFlavor };
  }

  // ----------------- Attach -----------------
  const AIHooks = (function(){
    let enabled = false;
    let runMode = 'play';
    let seed = '';
    let rng = null;

    let coach = null;
    let director = null;
    let pattern = null;

    function attach(cfg){
      cfg = cfg || {};
      runMode = (String(cfg.runMode||'play').toLowerCase()==='research') ? 'research' : 'play';
      seed = String(cfg.seed||'');
      enabled = !!cfg.enabled && (runMode !== 'research');

      rng = makeRng(hashSeed(seed + '::ai-hooks'));

      coach = createCoach();
      director = createDirector(rng);
      pattern = createPattern(rng);

      emit('hha:ai', { kind:'attach', enabled, runMode, seed, ts: Date.now() });

      if (!enabled){
        // still provide one neutral coach line in cVR practice/play
        try{
          coach.say('โหมด AI: ปิด (ปลอดภัยสำหรับวิจัย) ✅', 'neutral', 'ai-off');
        }catch(_){}
        return;
      }

      // greet
      coach.say('โหมด AI: เปิด ✅ (ปรับความยากแบบยุติธรรม + ทิปสั้น ๆ)', 'happy', 'ai-on');

      // lightweight coach tips from events
      WIN.addEventListener('groups:progress', onProgress, {passive:true});
      WIN.addEventListener('hha:judge', onJudge, {passive:true});
    }

    function onProgress(ev){
      if (!enabled) return;
      const k = String((ev.detail||{}).kind||'').toLowerCase();
      if (k==='storm_on'){
        coach.say(`พายุมาแล้ว! โฟกัส “ถูกหมู่” ก่อนความเร็ว 💨`, 'fever', 'tip-storm');
      }
      if (k==='boss_spawn'){
        const f = pattern.pickBossFlavor();
        coach.say(`บอสมา! จังหวะนี้ “นิ่งแล้วค่อยยิง” (${f}) 👊`, 'fever', 'tip-boss');
      }
      if (k==='perfect_switch'){
        coach.say('สลับหมู่แล้ว! อ่านชื่อหมู่ก่อนยิง 1 วิ 👀', 'neutral', 'tip-switch');
      }
    }

    function onJudge(ev){
      if (!enabled) return;
      const k = String((ev.detail||{}).kind||'').toLowerCase();
      director.feedJudge(k);

      // micro tip when repeated bad
      if (k==='bad' || k==='miss'){
        coach.say('ถ้าพลาดติด ๆ กัน: ชะลอ 0.5 วิ แล้วค่อยยิงใหม่ 🎯', 'sad', 'tip-reset');
      }
    }

    return { attach };
  })();

  NS.AIHooks = AIHooks;

})();