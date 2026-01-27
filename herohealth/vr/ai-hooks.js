// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — PRODUCTION (Lite)
// ✅ createAIHooks({game, mode, rng})
// ✅ Methods: onEvent(name,payload), getDifficulty(playedSec, base), getTip(playedSec)
// ✅ Safe: always returns functions (prevents "not a function")
// ✅ Research-safe: if mode !== 'play' => adaptive OFF by default

'use strict';

export function createAIHooks(opts = {}){
  const game = String(opts.game || 'HHA').trim();
  const mode = String(opts.mode || 'play').toLowerCase();
  const rng  = (typeof opts.rng === 'function') ? opts.rng : Math.random;

  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  // ----- state -----
  const S = {
    game, mode,
    t0: nowMs(),
    lastTipAt: 0,
    lastEventAt: 0,

    // rolling window (last ~12s)
    winSec: 12,
    events: [], // {t,type}

    // counters
    hitGood:0,
    hitJunk:0,
    miss:0,
    star:0,
    shield:0,

    // streak
    streakGood:0,
    streakBad:0,

    // last labels
    lastType:''
  };

  function pushEvt(type){
    const t = nowMs();
    S.events.push({ t, type });
    S.lastEventAt = t;
    S.lastType = type;

    // prune
    const cutoff = t - S.winSec*1000;
    while(S.events.length && S.events[0].t < cutoff) S.events.shift();
  }

  function countRecent(){
    const out = { good:0, junk:0, miss:0, other:0 };
    for(const e of S.events){
      if(e.type === 'hitGood') out.good++;
      else if(e.type === 'hitJunk') out.junk++;
      else if(e.type === 'miss') out.miss++;
      else out.other++;
    }
    return out;
  }

  function onEvent(name, payload){
    const n = String(name||'').trim();
    if(!n) return;

    if(n === 'hitGood'){
      S.hitGood++; S.streakGood++; S.streakBad = 0;
      pushEvt('hitGood');
    }else if(n === 'hitJunk'){
      S.hitJunk++; S.streakBad++; S.streakGood = 0;
      pushEvt('hitJunk');
    }else if(n === 'miss'){
      S.miss++; S.streakBad++; S.streakGood = 0;
      pushEvt('miss');
    }else if(n === 'star'){
      S.star++; pushEvt('star');
    }else if(n === 'shield'){
      S.shield++; pushEvt('shield');
    }else{
      pushEvt(n);
    }
  }

  // ----- Difficulty Director (lite) -----
  // base = { spawnMs, pGood, pJunk, pStar, pShield }
  function getDifficulty(playedSec, base){
    // if not play => keep base (research-safe)
    if(mode !== 'play') return { ...base };

    const b = Object.assign(
      { spawnMs: 900, pGood:0.70, pJunk:0.26, pStar:0.02, pShield:0.02 },
      base || {}
    );

    const recent = countRecent();
    const total = Math.max(1, recent.good + recent.junk + recent.miss);
    const acc   = recent.good / total;                 // 0..1
    const bad   = (recent.junk + recent.miss) / total; // 0..1

    // trend by streaks
    const goodStreak = clamp(S.streakGood, 0, 10);
    const badStreak  = clamp(S.streakBad,  0, 10);

    // target: fun+fair (เด็ก ป.5)
    // - ถ้าเริ่มพลาดถี่ => ชะลอ + เพิ่ม good + เพิ่ม shield
    // - ถ้าแม่นต่อเนื่อง => เร่ง + เพิ่ม junk นิดๆ
    let spawnMs = b.spawnMs;
    let pGood   = b.pGood;
    let pJunk   = b.pJunk;
    let pStar   = b.pStar;
    let pShield = b.pShield;

    // gentle ramp by time (progressive)
    const ramp = clamp(playedSec / 60, 0, 1); // 0..1 over 60s
    spawnMs = spawnMs - 120*ramp;
    pJunk   = pJunk + 0.03*ramp;
    pGood   = pGood - 0.03*ramp;

    // performance adjust
    if(bad > 0.45 || badStreak >= 3){
      spawnMs += 140 + 30*badStreak;
      pGood   += 0.06;
      pJunk   -= 0.06;
      pShield += 0.01;
    }else if(acc > 0.70 || goodStreak >= 4){
      spawnMs -= 120 + 25*goodStreak;
      pGood   -= 0.05;
      pJunk   += 0.05;
      pStar   += 0.005;
    }

    // clamps (keep reasonable)
    spawnMs = clamp(spawnMs, 520, 1200);
    pGood   = clamp(pGood,   0.40, 0.82);
    pJunk   = clamp(pJunk,   0.12, 0.55);
    pStar   = clamp(pStar,   0.00, 0.06);
    pShield = clamp(pShield, 0.00, 0.08);

    return { spawnMs, pGood, pJunk, pStar, pShield };
  }

  // ----- Explainable Coach Tip (rate-limited) -----
  function getTip(playedSec){
    if(mode !== 'play') return null; // research mode => silent
    const t = nowMs();
    if(t - S.lastTipAt < 6500) return null; // rate-limit

    const recent = countRecent();
    const total = Math.max(1, recent.good + recent.junk + recent.miss);
    const bad   = (recent.junk + recent.miss) / total;

    let msg = '';
    if(S.lastType === 'hitJunk' || S.lastType === 'miss'){
      msg = 'โฟกัส “ของดี” ก่อนนะ 👀 ถ้าเห็นของเสียใกล้ ๆ ให้หลบ/รอจังหวะ';
    }else if(bad > 0.45){
      msg = 'ใจเย็น ๆ เล็งกลางจอแล้วค่อยยิง 🎯 เน้นของดีให้ชัวร์ก่อน';
    }else if(S.streakGood >= 4){
      msg = 'คอมโบมาแล้ว! 🔥 ลองเก็บของดีต่อเนื่องให้ได้อีก';
    }else if(playedSec > 40){
      msg = 'ช่วงท้ายจะโหดขึ้นนิดนึงนะ 😈 ระวังของเสียให้มากขึ้น';
    }else{
      msg = 'จำง่าย ๆ: ✅ ของดี = เก็บ / ❌ ของเสีย = ห้ามโดน';
    }

    S.lastTipAt = t;
    return { msg, tag:'AI Coach' };
  }

  // Always return stable API
  return Object.freeze({
    onEvent,
    getDifficulty,
    getTip
  });
}