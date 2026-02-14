/* === /herohealth/vr/ai-hooks-lite.js ===
   HeroHealth AI Hooks (LITE) — v1.0
   - Safe, no dependencies
   - Works in Play (adaptive) + Research (deterministic OFF)
   - Exposes:
       window.HHA.AIHooks.create(opts)
       window.HHA.createAIHooks(opts) (legacy compat)
   opts:
     { game, mode, rng, enabled }
   mode: 'play' | 'research' | 'study' | 'prod' | ...
*/
(() => {
  'use strict';

  const WIN = window;

  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
  function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }

  // deterministic-ish random helper
  function rnd(rng){
    try { return (typeof rng === 'function') ? rng() : Math.random(); }
    catch { return Math.random(); }
  }

  // EMA smoother
  function ema(prev, x, alpha){
    if(!Number.isFinite(prev)) return x;
    return prev + alpha * (x - prev);
  }

  // tip rate limiter
  function makeTipLimiter(ms=6500){
    let lastAt = 0;
    return function can(){
      const t = nowMs();
      if(t - lastAt < ms) return false;
      lastAt = t;
      return true;
    };
  }

  function createAIHooks(opts={}){
    const modeRaw = String(opts.mode || '').toLowerCase();
    const mode = modeRaw || 'play';

    // ✅ A vs B
    const isPlay = (mode === 'play');
    const isResearch = (mode === 'research' || mode === 'study' || mode === 'experiment');

    const rng = opts.rng;
    const enabledFromOpts = (typeof opts.enabled === 'boolean') ? opts.enabled : true;

    // Play: enabled default true
    // Research: enabled default false (no adaptive)
    const enabled = isResearch ? false : enabledFromOpts;

    // state
    const S = {
      // counts (updated by onEvent)
      shoot:0, hitGood:0, hitJunk:0, miss:0, expireGood:0,
      // rolling signals
      emaMiss: 0,
      emaJunk: 0,
      emaExpire: 0,
      emaPace: 0, // shots per sec
      lastT: null,
      lastShoot: 0,
      // pattern
      stormUntilSec: 0,
      stormCooldownUntilSec: 0,
      // tips
      canTip: makeTipLimiter(6500),
      lastTipKey: ''
    };

    function snapshot(){
      const denom = Math.max(1, S.shoot);
      const missRate = S.miss / denom;
      const junkRate = S.hitJunk / denom;
      const expRate  = S.expireGood / Math.max(1, (S.hitGood + S.expireGood));
      return { missRate, junkRate, expRate };
    }

    // --- Prediction: risk score 0..1 (safe heuristic) ---
    function getRisk(sec, base){
      const sig = snapshot();

      // combine + smooth
      S.emaMiss = ema(S.emaMiss, sig.missRate, 0.18);
      S.emaJunk = ema(S.emaJunk, sig.junkRate, 0.15);
      S.emaExpire = ema(S.emaExpire, sig.expRate, 0.12);

      // pace from shoot deltas
      const t = nowMs();
      if(S.lastT == null) S.lastT = t;
      const dt = Math.max(0.001, (t - S.lastT)/1000);
      S.lastT = t;

      const pace = (S.shoot - (S.lastShoot||0)) / Math.max(0.25, dt);
      S.lastShoot = S.shoot;
      S.emaPace = ema(S.emaPace, pace, 0.20);

      // risk formula (bounded)
      let r =
        0.55 * clamp(S.emaMiss, 0, 0.50) / 0.50 +
        0.25 * clamp(S.emaJunk, 0, 0.35) / 0.35 +
        0.20 * clamp(S.emaExpire, 0, 0.40) / 0.40;

      // if shooting too fast, slight risk up
      if(S.emaPace > 4.8) r += 0.08;
      if(S.emaPace > 6.5) r += 0.10;

      r = clamp(r, 0, 1);
      return {
        risk: r,
        missRate: S.emaMiss,
        junkRate: S.emaJunk,
        expireRate: S.emaExpire,
        pace: S.emaPace,
        storm: (sec < S.stormUntilSec)
      };
    }

    // --- Pattern generator (Storm/Wave) ---
    function updatePattern(sec, base){
      // Research: still compute storms deterministically? -> do NOT affect difficulty
      if(isResearch) return;

      // trigger storm occasionally if risk low-mid and cooldown passed
      const r = getRisk(sec, base);
      const cdOk = (sec >= S.stormCooldownUntilSec);
      const notInStorm = (sec >= S.stormUntilSec);

      // chance based on time + rng (safe)
      if(cdOk && notInStorm){
        const chance = (sec > 12) ? 0.015 : 0.0; // ~rare
        if(rnd(rng) < chance){
          // storm lasts 4–7s
          const dur = 4 + Math.floor(rnd(rng)*4);
          S.stormUntilSec = sec + dur;
          // cooldown 10–16s
          S.stormCooldownUntilSec = S.stormUntilSec + 10 + Math.floor(rnd(rng)*7);
        }
      }
    }

    // --- Difficulty Director ---
    function getDifficulty(sec, base){
      const B = Object.assign({}, base || {});
      // Research: no adaptive changes
      if(!enabled) return B;

      updatePattern(sec, B);
      const pr = getRisk(sec, B);

      // smoothing & fair clamps
      // base adjustments from risk
      // - if risk high => slow a bit, reduce junk a bit
      // - if risk low  => speed up, add junk slightly (challenge)
      let spawnMs = Number(B.spawnMs || 900);
      let pGood   = Number(B.pGood   || 0.70);
      let pJunk   = Number(B.pJunk   || 0.26);
      let pStar   = Number(B.pStar   || 0.02);
      let pShield = Number(B.pShield || 0.02);

      if(pr.risk >= 0.70){
        spawnMs = spawnMs + 120;
        pJunk = pJunk - 0.05;
        pGood = pGood + 0.04;
        pShield = pShield + 0.01;
      }else if(pr.risk <= 0.30){
        spawnMs = spawnMs - 120;
        pJunk = pJunk + 0.05;
        pGood = pGood - 0.04;
      }else{
        // mild
        spawnMs = spawnMs - 40;
      }

      // Storm pattern (makes it exciting)
      if(pr.storm){
        spawnMs = Math.max(520, spawnMs - 240);
        pJunk = Math.min(0.55, pJunk + 0.10);
        pGood = Math.max(0.35, pGood - 0.08);
        pStar = pStar + 0.01;
        pShield = pShield + 0.02;
      }

      // fair bounds
      spawnMs = clamp(spawnMs, 520, 1200);
      pGood   = clamp(pGood,   0.35, 0.85);
      pJunk   = clamp(pJunk,   0.10, 0.60);
      pStar   = clamp(pStar,   0.00, 0.08);
      pShield = clamp(pShield, 0.00, 0.08);

      // normalize
      let s = (pGood+pJunk+pStar+pShield);
      if(s <= 0) s = 1;
      pGood/=s; pJunk/=s; pStar/=s; pShield/=s;

      return { spawnMs, pGood, pJunk, pStar, pShield, _risk: pr };
    }

    // --- Explainable Coach Tips (rate-limited) ---
    function getTip(sec){
      // Research: allow tips? default NO (quiet)
      if(isResearch) return null;

      // only in play + enabled
      if(!enabled) return null;
      if(!S.canTip()) return null;

      const pr = getRisk(sec);
      const r = pr.risk;

      // build explainable tips
      let key = '';
      let msg = '';

      if(pr.storm){
        key = 'storm';
        msg = 'พายุมาแล้ว! 🎯 ช้า-แม่น-เลือกของดี ก่อน (อย่ารัวใส่ junk)';
      } else if(r >= 0.75){
        key = 'risk_hi';
        msg = 'เริ่มพลาดเยอะ 👀 ลอง “หยุดครึ่งวิ” ก่อนยิง แล้วเล็งของดีเป็นหลัก';
      } else if(pr.junkRate >= 0.22){
        key = 'junk_hi';
        msg = 'โดนของเสียบ่อย ⚠️ แนะนำ “อย่ายิงทุกอัน” รอของดีเข้ากลางจอแล้วค่อยยิง';
      } else if(pr.expireRate >= 0.25){
        key = 'expire_hi';
        msg = 'ของดีหลุดมือเยอะ ⏱️ ลองโฟกัสทีละเป้า และลดการสแกนมั่ว ๆ';
      } else if(r <= 0.25 && sec > 10){
        key = 'risk_lo';
        msg = 'ฟอร์มดีมาก! 🔥 ลองดันคอมโบต่อเนื่อง 8–10 เพื่อโบนัสใหญ่';
      } else {
        key = 'generic';
        msg = 'ทริค: เลือกยิงของดีที่ “อยู่ใกล้กลาง” จะคุมคอมโบง่ายขึ้น ✨';
      }

      if(key && key === S.lastTipKey) return null;
      S.lastTipKey = key;

      return { msg, tag:'AI Coach', meta:{ risk: Number(r.toFixed(3)), junkRate:Number(pr.junkRate.toFixed(3)), expireRate:Number(pr.expireRate.toFixed(3)) } };
    }

    // --- Event feed ---
    function onEvent(type, payload){
      // Always collect signals (even research) — safe
      switch(String(type||'')){
        case 'shoot': S.shoot++; break;
        case 'hitGood': S.hitGood++; break;
        case 'hitJunk': S.hitJunk++; break;
        case 'miss': S.miss++; break;
        case 'expireGood': S.expireGood++; break;
      }
      // allow payload missCount/junkCount etc.
      if(payload && typeof payload === 'object'){
        if(Number.isFinite(payload.miss)) S.miss = payload.miss|0;
        if(Number.isFinite(payload.hitJunk)) S.hitJunk = payload.hitJunk|0;
        if(Number.isFinite(payload.expireGood)) S.expireGood = payload.expireGood|0;
      }
    }

    return {
      enabled,
      mode,
      onEvent,
      getTip,
      getDifficulty,
      getRisk
    };
  }

  // install
  WIN.HHA = WIN.HHA || {};
  WIN.HHA.AIHooks = WIN.HHA.AIHooks || {};
  WIN.HHA.AIHooks.create = createAIHooks;

  // legacy compat
  WIN.HHA.createAIHooks = function(opts){ return createAIHooks(opts); };

})();