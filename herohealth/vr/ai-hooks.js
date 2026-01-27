// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — PRODUCTION SAFE (Prediction + ML-ish + DL-ish hooks)
// ✅ API: createAIHooks({game, mode, rng})
// ✅ Returns: { onEvent, getDifficulty, getTip }
// ✅ research/practice: deterministic + adaptive OFF (returns base)
// ✅ play: adaptive ON (fair, smooth) + tips rate-limit
'use strict';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const nowMs = () => (performance && performance.now) ? performance.now() : Date.now();

function makeEMA(alpha = 0.12, init = 0){
  let x = init;
  return {
    push(v){ x = (alpha * v) + ((1 - alpha) * x); return x; },
    value(){ return x; }
  };
}

export function createAIHooks(cfg = {}){
  const game = String(cfg.game || 'Game').trim();
  const mode = String(cfg.mode || 'play').toLowerCase();   // play | research | practice
  const rng  = (typeof cfg.rng === 'function') ? cfg.rng : Math.random;

  // ✅ In research/practice: keep deterministic + no adaptive
  const adaptiveEnabled = (mode === 'play');

  // --- state ---
  const S = {
    game, mode,
    t0: nowMs(),
    lastTipAt: 0,
    tipCooldownMs: 2600,

    // perf counters (recent window)
    hitGood: 0,
    hitJunk: 0,
    miss: 0,

    // rolling signals (ML-ish)
    emaAcc: makeEMA(0.10, 0.70),     // accuracy proxy
    emaMistake: makeEMA(0.12, 0.20), // mistake rate proxy
    emaPace: makeEMA(0.10, 0.50),    // pace proxy (how fast they are interacting)
    lastActionAt: 0,

    // “prediction” memory: if player keeps missing, we predict struggle
    struggle: 0,   // 0..1
    focus: 0       // 0..1 (good streak)
  };

  function onEvent(name, payload = {}){
    if(!adaptiveEnabled) return;

    const t = (payload && typeof payload.t === 'number') ? payload.t : nowMs();

    // pace (time between actions)
    if(S.lastActionAt){
      const dt = clamp((t - S.lastActionAt) / 1000, 0.05, 3.0);
      const pace01 = clamp(1.0 - (dt / 2.2), 0, 1); // faster actions -> higher pace
      S.emaPace.push(pace01);
    }
    S.lastActionAt = t;

    if(name === 'hitGood'){
      S.hitGood++;
      // accuracy rises, mistake drops
      S.emaAcc.push(1);
      S.emaMistake.push(0);

      // focus grows, struggle decays
      S.focus = clamp(S.focus + 0.08, 0, 1);
      S.struggle = clamp(S.struggle - 0.06, 0, 1);
    }
    else if(name === 'hitJunk' || name === 'miss'){
      if(name === 'hitJunk') S.hitJunk++;
      if(name === 'miss') S.miss++;

      S.emaAcc.push(0);
      S.emaMistake.push(1);

      // struggle grows, focus decays
      S.struggle = clamp(S.struggle + 0.10, 0, 1);
      S.focus = clamp(S.focus - 0.07, 0, 1);
    }
  }

  // --- DL-ish hook (placeholder) ---
  // เรา “ไม่ train จริง” ใน production prototype แต่ให้ output เป็นเส้นทางเดียวกัน
  // เพื่อไปต่อกับ DL model ภายหลังได้ โดยไม่ทำให้เกมพัง
  function dlSuggestDifficulty(playedSec, base){
    // simple non-linear mix: struggle pushes easier, focus pushes harder
    const acc = S.emaAcc.value();
    const mis = S.emaMistake.value();
    const pace = S.emaPace.value();

    // pseudo “latent” = combine signals
    const latent = clamp((0.55*acc + 0.25*pace - 0.45*mis), -0.6, 0.9);

    // target difficulty delta (- easier .. + harder)
    const delta = clamp(latent, -0.35, 0.35);

    const D = { ...base };

    // spawnMs: smaller -> harder
    const hardMs = base.spawnMs * (1 - 0.18*delta);
    const easyMs = base.spawnMs * (1 - 0.18*delta);

    // if struggling, push easier (bigger ms); if focusing, push harder (smaller ms)
    const mix = (S.struggle > 0.55) ? -Math.abs(delta) : (S.focus > 0.60 ? Math.abs(delta) : delta);
    D.spawnMs = Math.round(clamp(base.spawnMs * (1 - 0.22*mix), 520, 1200));

    // probabilities: harder => more junk, easier => more good/powerups
    const j = clamp(base.pJunk + (0.10*mix), 0.10, 0.60);
    const g = clamp(base.pGood - (0.09*mix), 0.30, 0.85);

    // give a bit more shield/star when struggling (assist)
    const assist = clamp(S.struggle - 0.35, 0, 0.45);
    const pShield = clamp(base.pShield + 0.03*assist, 0.01, 0.09);
    const pStar   = clamp(base.pStar   + 0.02*assist, 0.01, 0.07);

    D.pGood = g;
    D.pJunk = j;
    D.pShield = pShield;
    D.pStar = pStar;

    // normalize
    let s = D.pGood + D.pJunk + D.pStar + D.pShield;
    if(s <= 0) s = 1;
    D.pGood/=s; D.pJunk/=s; D.pStar/=s; D.pShield/=s;

    return D;
  }

  function getDifficulty(playedSec, base){
    // research/practice: return base unchanged
    if(!adaptiveEnabled) return { ...base };

    // “Prediction” guardrail: early game don't overreact
    const warmup = (playedSec < 6);

    // ML-ish smoothing: we still use dlSuggestDifficulty but clamp changes gently
    const D = dlSuggestDifficulty(playedSec, base);

    if(warmup){
      // during warmup: keep near base
      D.spawnMs = Math.round(base.spawnMs * 0.98 + D.spawnMs * 0.02);
      D.pJunk   = base.pJunk   * 0.98 + D.pJunk   * 0.02;
      D.pGood   = base.pGood   * 0.98 + D.pGood   * 0.02;
      D.pStar   = base.pStar   * 0.98 + D.pStar   * 0.02;
      D.pShield = base.pShield * 0.98 + D.pShield * 0.02;

      let s = D.pGood + D.pJunk + D.pStar + D.pShield;
      if(s <= 0) s = 1;
      D.pGood/=s; D.pJunk/=s; D.pStar/=s; D.pShield/=s;
    }

    return D;
  }

  function getTip(playedSec){
    if(!adaptiveEnabled) return null;

    const t = nowMs();
    if(t - S.lastTipAt < S.tipCooldownMs) return null;

    // only tip when signal is strong
    const struggle = S.struggle;
    const focus = S.focus;

    let msg = '';
    if(struggle > 0.70){
      msg = (rng() < 0.5)
        ? 'ลอง “รอจังหวะ” แล้วยิง/แตะของดีทีละอันนะ 🎯'
        : 'โฟกัสของดี (ผัก/ผลไม้/โปรตีน) แล้วเลี่ยงของทอด/หวาน 🍟❌';
    }else if(focus > 0.72){
      msg = (rng() < 0.5)
        ? 'เริ่มแม่นแล้ว! ลองทำคอมโบของดีต่อเนื่องให้สูงขึ้น 🔥'
        : 'เก่งมาก! ระวังของเสียที่โผล่ถี่ขึ้นช่วงท้าย ⚡';
    }else{
      // occasional small tip only
      if(rng() < 0.75) return null;
      msg = 'กด Missions เพื่อดูเป้าหมาย/มินิเควสท์ได้เลย ✅';
    }

    S.lastTipAt = t;
    return { msg, tag: 'AI Coach' };
  }

  return Object.freeze({ onEvent, getDifficulty, getTip });
}