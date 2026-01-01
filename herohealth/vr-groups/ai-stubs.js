/* === /herohealth/vr-groups/ai-stubs.js ===
GroupsVR AI Hooks — PRODUCTION (SAFE)
✅ AI Difficulty Director (PLAY only) : fair, smooth, clamped
✅ AI Coach micro-tips (explainable + rate-limit) : PLAY/RESEARCH
✅ AI Pattern Generator (storm pattern / boss behavior) : seeded
Expose: window.GroupsVR.AI = { init, director, coach, pattern, onEvent }
*/

(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});
  const emit = (name, detail)=>{ try{ root.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch{} };

  // ---------- Seeded RNG (local) ----------
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

  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function now(){ return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }

  // ---------- Internal AI State ----------
  const AI = {
    enabled:false,
    runMode:'play',
    diff:'normal',
    style:'mix',
    seed:'seed',
    rng: Math.random,

    // coach
    lastTipAt:0,
    tipCooldownMs: 2400,
    lastTipKey:'',
    tipCounts:{},

    // director smoothing
    lastAdj:{ spawnMul:1, ttlMul:1, junkAdd:0, decoyAdd:0, bossMul:1 },
    smoothK: 0.18,

    // event memory
    missStreak:0,
    goodStreak:0,
    lastMissAt:0,
    lastGoodAt:0,
  };

  function init(cfg){
    cfg = cfg || {};
    AI.enabled = true;
    AI.runMode = (String(cfg.runMode||'play').toLowerCase()==='research') ? 'research' : 'play';
    AI.diff = String(cfg.diff||'normal').toLowerCase();
    AI.style = String(cfg.style||'mix').toLowerCase();
    AI.seed = String(cfg.seed||'seed');
    AI.rng = makeRng(AI.seed + '|AI');

    AI.lastTipAt = 0;
    AI.lastTipKey = '';
    AI.tipCounts = {};
    AI.lastAdj = { spawnMul:1, ttlMul:1, junkAdd:0, decoyAdd:0, bossMul:1 };

    AI.missStreak = 0;
    AI.goodStreak = 0;
    AI.lastMissAt = 0;
    AI.lastGoodAt = 0;
  }

  // ---------- Pattern Generator ----------
  const pattern = {
    pickStormPattern(meta){
      meta = meta || {};
      const style = String(meta.style||AI.style||'mix');
      const heat  = clamp(meta.heat ?? 0.5, 0, 1);
      const r = (meta.rng || AI.rng)();

      // deterministic but feels varied
      if (style === 'feel') return 'wave';
      if (style === 'hard') return 'spiral';

      // mix: more heat -> more spiral
      if (heat > 0.72 && r < 0.65) return 'spiral';
      if (r < 0.50) return 'burst';
      return 'wave';
    },

    // boss behavior suggestion (optional)
    bossShiftChance(meta){
      meta = meta || {};
      const phase = clamp(meta.phase||1,1,3);
      const heat  = clamp(meta.heat ?? 0.5, 0, 1);
      const r = (meta.rng || AI.rng)();

      // phase3 shifts more; keep fair
      let p = 0.10 + heat*0.08;
      if (phase >= 3) p += 0.12;
      return (r < clamp(p, 0.10, 0.28));
    }
  };

  // ---------- Difficulty Director (PLAY ONLY) ----------
  function director(snapshot){
    // In RESEARCH: DO NOT ADAPT (deterministic rule)
    if (AI.runMode !== 'play') return null;

    snapshot = snapshot || {};
    const acc   = clamp(snapshot.acc ?? 0.0, 0, 1);
    const combo = clamp(snapshot.combo ?? 0, 0, 9999);
    const fever = clamp(snapshot.fever ?? 0, 0, 100);
    const misses= clamp(snapshot.misses ?? 0, 0, 9999);

    const comboN = clamp(combo/18, 0, 1); // normalized
    const feverN = clamp(fever/100, 0, 1);

    // "skill" high => speed up a bit; fever high => ease slightly (fair)
    const skill = clamp(0.55*acc + 0.45*comboN, 0, 1);
    const stress = clamp(0.60*feverN + 0.40*clamp(misses/14,0,1), 0, 1);

    // base multipliers
    let spawnMul = 1.0 - (skill*0.18) + (stress*0.10);    // faster if skilled, slower if stressed
    let ttlMul   = 1.0 - (skill*0.10) + (stress*0.12);    // shorter if skilled, longer if stressed
    let junkAdd  = (skill*0.02) - (stress*0.03);          // slight pressure when skilled, relief when stressed
    let decoyAdd = (skill*0.02) - (stress*0.025);
    let bossMul  = 1.0 - (skill*0.14) + (stress*0.12);    // bosses a bit more often when skilled

    // clamp fairness
    spawnMul = clamp(spawnMul, 0.82, 1.12);
    ttlMul   = clamp(ttlMul,   0.88, 1.14);
    junkAdd  = clamp(junkAdd, -0.04, 0.04);
    decoyAdd = clamp(decoyAdd,-0.04, 0.04);
    bossMul  = clamp(bossMul,  0.82, 1.18);

    // smooth to avoid jitter
    const k = AI.smoothK;
    function lerp(a,b,t){ return a + (b-a)*t; }

    const out = {
      spawnMul: lerp(AI.lastAdj.spawnMul, spawnMul, k),
      ttlMul:   lerp(AI.lastAdj.ttlMul,   ttlMul,   k),
      junkAdd:  lerp(AI.lastAdj.junkAdd,  junkAdd,  k),
      decoyAdd: lerp(AI.lastAdj.decoyAdd, decoyAdd, k),
      bossMul:  lerp(AI.lastAdj.bossMul,  bossMul,  k),
      why: `skill=${skill.toFixed(2)} stress=${stress.toFixed(2)}`
    };
    AI.lastAdj = { spawnMul:out.spawnMul, ttlMul:out.ttlMul, junkAdd:out.junkAdd, decoyAdd:out.decoyAdd, bossMul:out.bossMul };
    return out;
  }

  // ---------- Coach (Explainable micro-tips) ----------
  function canTip(key){
    const t = now();
    if (t - AI.lastTipAt < AI.tipCooldownMs) return false;
    if (AI.lastTipKey === key) return false;
    const c = AI.tipCounts[key] || 0;
    if (c >= 3) return false; // no spam
    return true;
  }
  function tip(key, text, mood, explain){
    if (!canTip(key)) return;
    AI.lastTipAt = now();
    AI.lastTipKey = key;
    AI.tipCounts[key] = (AI.tipCounts[key]||0) + 1;
    emit('hha:coach', { text: String(text||''), mood: mood||'neutral', explain: String(explain||'') });
  }

  function coach(evt, snapshot){
    evt = evt || {};
    snapshot = snapshot || {};
    const kind = String(evt.kind||evt.type||'').toLowerCase();
    const acc = clamp(snapshot.acc ?? 0, 0, 1);
    const fever = clamp(snapshot.fever ?? 0, 0, 100);
    const combo = clamp(snapshot.combo ?? 0, 0, 9999);
    const left  = clamp(snapshot.left ?? 0, 0, 999);

    if (kind === 'miss'){
      tip('miss', 'โฟกัส “ตรงกลางจอ” แล้วค่อยยิงนะ 🎯', 'sad', 'พลาด/หมดเวลาเป้า = โดนกดดัน');
      return;
    }
    if (kind === 'junk'){
      tip('junk', 'เจอ 🍟🍔 ให้เลี่ยงก่อน! ใช้ 🛡️ บล็อกได้ถ้ามี', 'fever', 'โดน JUNK ทำ fever ขึ้นแรง');
      return;
    }
    if (kind === 'wrong'){
      tip('wrong', 'ดู “หมู่ที่กำลังเล่น” ก่อนยิงนะ ✅', 'neutral', 'ยิงผิดหมู่ = เสียคอมโบ');
      return;
    }
    if (kind === 'perfect'){
      tip('perfect', 'PERFECT! จังหวะแบบนี้แหละ 🔥', 'happy', 'RT เร็วมาก ได้โบนัส');
      return;
    }
    if (kind === 'storm_on'){
      tip('storm_on', 'STORM มาแล้ว! ยิง “ใกล้กลางจอ” จะชัวร์ขึ้น ⚡', 'neutral', 'ช่วงพายุเป้าออกถี่และล่อ');
      return;
    }
    if (kind === 'storm_urgent'){
      tip('storm_urgent', 'อีกนิดพายุจะจบแล้ว! เก็บแต้มช่วงนี้เลย ⏱️', 'neutral', 'เหลือเวลาพายุน้อย');
      return;
    }
    if (kind === 'boss_spawn'){
      tip('boss_spawn', 'บอสมา! โฟกัส 👑 แล้วค่อยเก็บตัวล่อ', 'neutral', 'ตีบอสได้คะแนนสูง');
      return;
    }
    if (kind === 'clutch' && left <= 10){
      tip('clutch', 'ช่วงท้ายแล้ว! ยิงให้ “ไม่พลาด” สำคัญสุด 🧠', 'neutral', 'ท้ายเกมพลาดแล้วคอมโบร่วง');
      return;
    }

    // generic (rare)
    if (fever >= 70){
      tip('fever_hi', 'fever สูงแล้ว—ชะลอหน่อย เลือกยิงเฉพาะ “ถูกหมู่” ✅', 'fever', 'ลดความเสี่ยงก่อน');
      return;
    }
    if (acc >= 0.90 && combo >= 10){
      tip('hot', 'โหดมาก! รักษาคอมโบไว้ แล้วรอ powerup ⭐💎', 'happy', 'ความแม่น+คอมโบสูง');
      return;
    }
  }

  // ---------- Event bridge ----------
  function onEvent(evt){
    evt = evt || {};
    const kind = String(evt.kind||evt.type||'').toLowerCase();

    if (kind === 'hit_good' || kind === 'good'){
      AI.goodStreak++;
      AI.missStreak = 0;
      AI.lastGoodAt = now();
    }
    if (kind === 'miss' || kind === 'hit_bad' || kind === 'bad' || kind === 'junk' || kind === 'wrong'){
      AI.missStreak++;
      AI.goodStreak = 0;
      AI.lastMissAt = now();
    }
  }

  NS.AI = { init, director, coach, pattern, onEvent };
})(typeof window !== 'undefined' ? window : globalThis);