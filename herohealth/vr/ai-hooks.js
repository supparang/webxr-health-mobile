// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — STABLE (Production-safe)
// ✅ createAIHooks({game, mode, rng})
// ✅ Methods: onEvent(name,payload), getTip(playedSec), getDifficulty(playedSec, base)
// ✅ Safe fallback: always returns usable functions (prevents "is not a function")
// ✅ Research/Study: default AI OFF (mode !== 'play') unless explicitly enabled via ?ai=1

'use strict';

const WIN = window;

const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
const clamp = (v,min,max)=>Math.max(min, Math.min(max, Number(v)||0));
const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };

function defaultRng(){
  return Math.random;
}

function shouldEnableAI(mode){
  // play: AI on (director+coach) by default
  // study/research: AI off unless ?ai=1
  const aiParam = String(qs('ai','')).trim();
  if(mode === 'play') return aiParam === '0' ? false : true;
  return aiParam === '1';
}

function pick(rng, arr){
  const a = Array.isArray(arr) ? arr : [];
  if(!a.length) return null;
  const r = (typeof rng === 'function') ? rng() : Math.random();
  const i = Math.max(0, Math.min(a.length-1, Math.floor(r * a.length)));
  return a[i];
}

export function createAIHooks(cfg={}){
  const game = String(cfg.game || 'HHA').trim() || 'HHA';
  const mode = String(cfg.mode || 'play').toLowerCase();
  const rng  = (typeof cfg.rng === 'function') ? cfg.rng : defaultRng();

  const enabled = shouldEnableAI(mode);

  // lightweight rolling stats (no ML heavy) — “AI Director” แบบ explainable
  const M = {
    enabled,
    game,
    mode,
    t0: nowMs(),
    lastTipAt: 0,
    tipCooldownMs: 2600,

    // window stats
    events: [],
    windowMs: 9000,

    // derived
    missRate: 0,      // per sec-ish
    junkHitRate: 0,
    goodHitRate: 0,
    expireRate: 0,
    comboMax: 0
  };

  function prune(now){
    const cut = now - M.windowMs;
    while(M.events.length && M.events[0].t < cut) M.events.shift();
  }

  function updateRates(now){
    prune(now);
    const dt = Math.max(1, M.windowMs/1000);
    let miss=0, junk=0, good=0, exp=0;
    let comboMax=0;

    for(const e of M.events){
      if(e.name === 'miss') miss++;
      else if(e.name === 'hitJunk') junk++;
      else if(e.name === 'hitGood') good++;
      else if(e.name === 'expireGood') exp++;
      if(typeof e.comboMax === 'number') comboMax = Math.max(comboMax, e.comboMax);
    }

    M.missRate = miss/dt;
    M.junkHitRate = junk/dt;
    M.goodHitRate = good/dt;
    M.expireRate = exp/dt;
    M.comboMax = comboMax;
  }

  function onEvent(name, payload={}){
    if(!M.enabled) return;
    const t = (typeof payload.t === 'number') ? payload.t : nowMs();
    M.events.push({ t, name, comboMax: payload.comboMax });
    updateRates(t);
  }

  // Coach micro-tips (rate-limited)
  function getTip(playedSec){
    if(!M.enabled) return null;

    const t = nowMs();
    if(t - M.lastTipAt < M.tipCooldownMs) return null;

    // only start tips after a few seconds
    if((playedSec||0) < 6) return null;

    // heuristics — explainable
    const tips = [];

    if(M.junkHitRate >= 0.25){
      tips.push({ msg:'ระวังของเสีย! ลอง “รอให้ดีโผล่กลางจอ” แล้วค่อยยิง จะ MISS ลดลง 👀', tag:'Coach' });
    }
    if(M.expireRate >= 0.25){
      tips.push({ msg:'ของดีหมดไว! ลองกวาดสายตาเป็นรูป “ตัว Z” จะเก็บทันมากขึ้น ⚡', tag:'Coach' });
    }
    if(M.goodHitRate < 0.35 && (M.junkHitRate > 0.10)){
      tips.push({ msg:'โฟกัสของดีเป็นหลักก่อนนะ แล้วค่อยไล่คอมโบ 🔥', tag:'Coach' });
    }
    if(M.comboMax >= 7){
      tips.push({ msg:'คอมโบกำลังดีมาก! รักษาจังหวะเดิม แล้วคะแนนจะพุ่งเร็ว 🚀', tag:'Coach' });
    }

    const tip = pick(rng, tips);
    if(tip){
      M.lastTipAt = t;
      return tip;
    }
    return null;
  }

  // ✅ Director: returns adjusted spawnMs + probabilities
  function getDifficulty(playedSec, base){
    // Always return a valid object
    const b = Object.assign(
      { spawnMs: 900, pGood:0.70, pJunk:0.26, pStar:0.02, pShield:0.02 },
      (base||{})
    );

    if(!M.enabled){
      // AI OFF: return base (sanitized)
      return sanitize(b);
    }

    // simple ramp over time (mild)
    const p = clamp((playedSec||0)/Math.max(1, (Number(qs('time','80'))||80)), 0, 1);

    // performance pressure: if junk hits high => slightly slow spawn + slightly more shield
    // if good hits high and junk low => slightly faster spawn + slightly more junk
    let spawnMs = b.spawnMs;
    let pGood   = b.pGood;
    let pJunk   = b.pJunk;
    let pStar   = b.pStar;
    let pShield = b.pShield;

    // time-based excitement
    spawnMs = spawnMs - (p*140); // up to -140ms

    // error-protection
    if(M.junkHitRate >= 0.22 || M.missRate >= 0.22){
      spawnMs = spawnMs + 90;
      pShield = pShield + 0.018;
      pStar   = pStar   + 0.006;
      pJunk   = pJunk   - 0.020;
      pGood   = pGood   - 0.004;
    }else if(M.goodHitRate >= 0.55 && M.junkHitRate <= 0.10){
      spawnMs = spawnMs - 70;
      pJunk   = pJunk   + 0.026;
      pGood   = pGood   - 0.018;
    }

    // keep in bounds
    spawnMs = clamp(spawnMs, 520, 1150);

    return sanitize({ spawnMs, pGood, pJunk, pStar, pShield });
  }

  function sanitize(D){
    const out = Object.assign({}, D);
    out.spawnMs = clamp(out.spawnMs, 420, 1600);

    // normalize
    let s = (out.pGood||0) + (out.pJunk||0) + (out.pStar||0) + (out.pShield||0);
    if(!(s > 0)) s = 1;
    out.pGood = (out.pGood||0)/s;
    out.pJunk = (out.pJunk||0)/s;
    out.pStar = (out.pStar||0)/s;
    out.pShield = (out.pShield||0)/s;

    // clamp probs (avoid negative)
    out.pGood = clamp(out.pGood, 0.05, 0.92);
    out.pJunk = clamp(out.pJunk, 0.05, 0.75);
    out.pStar = clamp(out.pStar, 0.00, 0.12);
    out.pShield = clamp(out.pShield, 0.00, 0.12);

    // re-normalize again
    let ss = out.pGood + out.pJunk + out.pStar + out.pShield;
    out.pGood/=ss; out.pJunk/=ss; out.pStar/=ss; out.pShield/=ss;

    return out;
  }

  // Always return full API (never missing funcs)
  return Object.freeze({
    enabled,
    onEvent,
    getTip,
    getDifficulty
  });
}