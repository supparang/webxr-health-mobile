// === /herohealth/vr/ai-hooks.js ===
// AI Hooks (HHA Standard) — Lightweight Prediction + Difficulty Director
// ✅ createAIHooks({game, mode, rng})
// ✅ Methods: onEvent(name,payload), getTip(playedSec), getDifficulty(playedSec, base)
// Notes:
// - mode: play | research | practice
// - research/practice: adaptive OFF by default (deterministic / fair)

'use strict';

export function createAIHooks(cfg = {}){
  const game = String(cfg.game || 'HHA').trim();
  const mode = String(cfg.mode || 'play').toLowerCase();
  const rng  = (typeof cfg.rng === 'function') ? cfg.rng : Math.random;

  const adaptiveOn = (mode === 'play'); // ✅ only play mode
  const tipsOn = (mode === 'play');     // ✅ only play mode

  // --- rolling stats for "prediction" ---
  const S = {
    startedAt: (performance.now ? performance.now() : Date.now()),
    events: [],
    hitGood: 0,
    hitJunk: 0,
    miss: 0,
    comboBreak: 0,
    lastTipAtSec: -999,
    // simple rolling accuracy proxy
    window: [], // store last N event outcomes
    windowN: 18
  };

  function pushWindow(v){
    S.window.push(v);
    if(S.window.length > S.windowN) S.window.shift();
  }

  function nowSec(){
    const t = (performance.now ? performance.now() : Date.now());
    return (t - S.startedAt) / 1000;
  }

  // --- public: event intake ---
  function onEvent(name, payload){
    if(!adaptiveOn && !tipsOn) return;
    const n = String(name||'');
    if(n === 'hitGood'){
      S.hitGood++;
      pushWindow(1);
    }else if(n === 'hitJunk'){
      S.hitJunk++;
      pushWindow(0);
      S.comboBreak++;
    }else if(n === 'miss'){
      S.miss++;
      pushWindow(0);
      S.comboBreak++;
    }else if(n === 'comboBreak'){
      S.comboBreak++;
      pushWindow(0);
    }
    // keep small log (optional)
    S.events.push({ t: nowSec(), name:n, p: payload||null });
    if(S.events.length > 60) S.events.shift();
  }

  // --- prediction: estimate player performance (0..1) ---
  function predictSkill(){
    // skill ~ rolling accuracy (recent)
    const w = S.window;
    if(!w.length) return 0.55;
    const acc = w.reduce((a,b)=>a+b,0)/w.length; // 0..1
    // penalize too many misses/junk
    const penalty = Math.min(0.25, (S.miss + S.hitJunk) * 0.015);
    return clamp01(acc - penalty);
  }

  // --- public: difficulty director ---
  function getDifficulty(playedSec, base){
    // base: {spawnMs, pGood,pJunk,pStar,pShield}
    const B = Object.assign({}, base || {});

    if(!adaptiveOn){
      return B; // research/practice => deterministic (no adapt)
    }

    const skill = predictSkill(); // 0..1
    // target difficulty wants "flow": if skill high -> harder, low -> easier
    // map skill to factor: 0.0..1.0 -> -1..+1
    const f = (skill - 0.55) * 2.0; // around 0 when avg

    // adjust spawn rate (ms)
    // good players => faster spawns, struggling => slower
    const spawnAdj = Math.round(clamp(B.spawnMs + (-120 * f), 520, 1200));

    // adjust probabilities
    // good players => slightly more junk, slightly less good
    let pGood = clamp(B.pGood + (-0.06 * f), 0.40, 0.86);
    let pJunk = clamp(B.pJunk + ( 0.06 * f), 0.10, 0.55);

    // keep powerups gentle (don’t swing too much)
    const pStar   = clamp(B.pStar   + (S.miss >= 3 ? 0.004 : 0), 0.01, 0.06);
    const pShield = clamp(B.pShield + (S.miss >= 2 ? 0.006 : 0), 0.01, 0.08);

    // normalize
    let s = pGood + pJunk + pStar + pShield;
    if(s <= 0) s = 1;
    pGood/=s; pJunk/=s; // star/shield will be normalized below too
    const pStarN = pStar/s;
    const pShieldN = pShield/s;

    return {
      spawnMs: spawnAdj,
      pGood,
      pJunk,
      pStar: pStarN,
      pShield: pShieldN,
      // expose predicted skill (optional use)
      skill
    };
  }

  // --- public: micro tips (coach) ---
  function getTip(playedSec){
    if(!tipsOn) return null;

    // rate limit tips
    const t = Number(playedSec||0);
    if(t - S.lastTipAtSec < 6) return null;

    const skill = predictSkill();
    let msg = null;

    if(S.miss >= 4 && (rng() < 0.65)){
      msg = 'ลอง “ชะลอแล้วเล็ง” ก่อนยิงนะ 👀 พลาดติด ๆ กันจะโดนปรับ MISS';
    }else if(S.hitJunk >= 3 && (rng() < 0.60)){
      msg = 'ของทอด/หวานคือขยะอาหาร 😅 เลี่ยงไว้ก่อน แล้วเก็บของดีให้ครบ';
    }else if(skill > 0.78 && (rng() < 0.55)){
      msg = 'โห เก่งมาก! 🔥 เดี๋ยวระบบจะเร่งความเร็วให้ท้าทายขึ้นนิดนึง';
    }else if(skill < 0.45 && (rng() < 0.55)){
      msg = 'ไม่เป็นไรนะ ✨ โฟกัสของดีทีละอัน เดี๋ยวจะเริ่มเข้ามือเอง';
    }

    if(!msg) return null;
    S.lastTipAtSec = t;

    return { msg, tag: `${game} Coach` };
  }

  return { onEvent, getTip, getDifficulty };
}

// --- utils ---
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function clamp01(v){ return clamp(v,0,1); }