// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — PRODUCTION (Lite + Deterministic Friendly)
// ✅ createAIHooks({game,mode,rng,config})
// ✅ Exports: getDifficulty(playedSec, base), getTip(playedSec), onEvent(name,payload)
// ✅ PLAY: adaptive + tips (optional)
// ✅ RESEARCH/STUDY: deterministic-friendly (adaptive off by default)
// NOTE: This is NOT "real ML/DL"; it's a safe hook layer + heuristics.

'use strict';

export function createAIHooks(opts={}){
  const game = String(opts.game||'HHA').trim();
  const mode = String(opts.mode||'play').toLowerCase(); // play | study | research
  const rng  = (typeof opts.rng === 'function') ? opts.rng : Math.random;

  const cfg = Object.assign({
    adaptive: (mode === 'play'),
    tips: (mode === 'play'),
    tipEverySec: 6,
    tipCooldownSec: 5,
    maxTips: 999,
  }, opts.config || {});

  const S = {
    game, mode, cfg,
    // rolling stats (simple)
    lastTipAt: -1e9,
    tipsSent: 0,
    lastEventAt: 0,
    good:0, junk:0, miss:0,
    combo:0,
    fever:0,
    // micro-performance window
    win: [],
    winMax: 24,
  };

  function nowSec(){
    try{ return performance.now()/1000; }catch(_){ return Date.now()/1000; }
  }

  function pushWin(v){
    S.win.push(v);
    if(S.win.length > S.winMax) S.win.shift();
  }

  function winAvg(){
    if(!S.win.length) return 0;
    let s=0; for(const v of S.win) s+=v;
    return s / S.win.length;
  }

  function clamp(v,a,b){ return Math.max(a, Math.min(b, Number(v)||0)); }

  function onEvent(name, payload={}){
    const n = String(name||'').toLowerCase();
    S.lastEventAt = nowSec();

    if(n === 'hitgood'){ S.good++; S.combo = (S.combo||0)+1; pushWin(+1); }
    else if(n === 'hitjunk'){ S.junk++; S.combo = 0; pushWin(-1); }
    else if(n === 'miss'){ S.miss++; S.combo = 0; pushWin(-1.2); }
    else if(n === 'combo'){ S.combo = Number(payload.value||0)||0; }
    else if(n === 'fever'){ S.fever = Number(payload.value||0)||0; }
  }

  // ✅ Adaptive difficulty (heuristic but stable)
  // base: {spawnMs,pGood,pJunk,pStar,pShield}
  function getDifficulty(playedSec, base){
    const B = Object.assign({}, base||{});
    if(!cfg.adaptive){
      return normalize(B);
    }

    const t = clamp(playedSec, 0, 9999);

    // performance signal: recent avg + miss pressure + fever
    const perf = winAvg();                // -1..+1-ish
    const missP = clamp(S.miss/8, 0, 1);  // 0..1
    const feverP = clamp(S.fever/100, 0, 1);

    // director wants: keep tension but fair
    // if player struggles (perf<0 or miss high) -> easier
    // if player dominates (perf>0) -> harder
    const ease = clamp((-perf)*0.28 + missP*0.22 + feverP*0.12, 0, 0.55);
    const hard = clamp(( perf)*0.30 + (1-missP)*0.10, 0, 0.55);

    // spawn rate: base adjusted + slight time ramp
    const ramp = clamp((t-10)*0.004, 0, 0.18); // slowly harder over time
    let spawnMs = B.spawnMs;
    spawnMs = spawnMs * (1 + ease*0.22) * (1 - hard*0.22) * (1 - ramp*0.18);
    spawnMs = clamp(spawnMs, 460, 1200);

    // probabilities: shift between good/junk based on ease/hard
    let pGood = Number(B.pGood||0);
    let pJunk = Number(B.pJunk||0);
    let pStar = Number(B.pStar||0);
    let pShield = Number(B.pShield||0);

    // if struggling -> more good, more shield, fewer junk
    pGood   += ease*0.08;
    pJunk   -= ease*0.10;
    pShield += ease*0.05;

    // if strong -> more junk, slightly fewer powerups
    pGood   -= hard*0.08;
    pJunk   += hard*0.10;
    pStar   -= hard*0.01;
    pShield -= hard*0.02;

    // keep sane
    pGood   = clamp(pGood, 0.30, 0.80);
    pJunk   = clamp(pJunk, 0.12, 0.60);
    pStar   = clamp(pStar, 0.01, 0.06);
    pShield = clamp(pShield, 0.01, 0.10);

    const D = { spawnMs, pGood, pJunk, pStar, pShield };
    return normalize(D);
  }

  function normalize(D){
    let pGood = Number(D.pGood||0);
    let pJunk = Number(D.pJunk||0);
    let pStar = Number(D.pStar||0);
    let pShield = Number(D.pShield||0);
    let s = pGood+pJunk+pStar+pShield;
    if(s<=0) s=1;
    pGood/=s; pJunk/=s; pStar/=s; pShield/=s;
    return { spawnMs: Number(D.spawnMs||900), pGood, pJunk, pStar, pShield };
  }

  function getTip(playedSec){
    if(!cfg.tips) return null;
    if(S.tipsSent >= cfg.maxTips) return null;

    const t = clamp(playedSec, 0, 9999);
    const now = nowSec();
    if(now - S.lastTipAt < cfg.tipCooldownSec) return null;

    // rate-limit by time too
    if(t < 4) return null;

    // choose tip based on state
    let msg = '';
    if(S.miss >= 5 && S.good < 12){
      msg = 'โฟกัส “ของดี” ก่อนนะ 🥦 ยิง/แตะให้แม่น แล้วค่อยไล่คะแนน!';
    }else if(S.combo >= 6){
      msg = 'คอมโบมาแล้ว! 🔥 รักษาจังหวะ อย่าไปโดนของเสีย';
    }else if(S.fever >= 70){
      msg = 'FEVER สูงแล้ว ⚠️ ชะลอหน่อย เล็งกลางจอก่อนยิง';
    }else{
      // small randomness, deterministic friendly via rng
      const r = rng();
      msg = (r < 0.33) ? 'ลองเก็บครบ 3 หมู่ใน 12 วิ เพื่อรับโบนัส ⭐/🛡️'
          : (r < 0.66) ? 'เลี่ยงของทอด/หวาน 🍟🍩 แล้วคะแนนจะพุ่ง'
          : 'ใช้ crosshair ยิงจากกลางจอจะนิ่งกว่า 🎯';
    }

    S.lastTipAt = now;
    S.tipsSent++;
    return { msg, tag:'AI Coach' };
  }

  return { getDifficulty, getTip, onEvent };
}